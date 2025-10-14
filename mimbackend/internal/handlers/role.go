package handlers

import (
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"mimbackend/config"
	auth "mimbackend/internal/models/auth"
	basemodels "mimbackend/internal/models/basemodels"
	companymodels "mimbackend/internal/models/company"
	"net/http"

	"mimbackend/internal/services"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

// (removed duplicate UpdateRolePermission inserted by mistake)
// GetRoles lists all roles
func GetRoles(c *gin.Context) {
	db, err := config.NewConnection()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database connection failed"})
		return
	}

	var roles []basemodels.Role

	// Optional company scope
	companyIDStr := c.Query("company_id")
	if companyIDStr != "" {
		cid, err := uuid.Parse(companyIDStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid company_id"})
			return
		}
		if err := db.Where("company_id = ?", cid).Find(&roles).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch roles"})
			return
		}
	} else {
		if err := db.Find(&roles).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch roles"})
			return
		}
	}

	var response []gin.H
	for _, r := range roles {
		var perms interface{}
		if r.Permissions != nil {
			var p basemodels.Permissions
			if err := json.Unmarshal(*r.Permissions, &p); err == nil {
				perms = p
			}
		}
		response = append(response, gin.H{
			"id":            r.ID,
			"name":          r.Name,
			"description":   r.Description,
			"is_active":     r.IsActive,
			"company_id":    r.CompanyID,
			"created_at":    r.CreatedAt,
			"created_by_id": r.CreatedByID,
			"permissions":   perms,
		})
	}

	c.JSON(http.StatusOK, gin.H{"roles": response})
}

// GetRole returns a single role by ID
func GetRole(c *gin.Context) {
	roleIDStr := c.Param("roleId")
	roleID, err := uuid.Parse(roleIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid role ID"})
		return
	}

	db, err := config.NewConnection()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database connection failed"})
		return
	}

	var role basemodels.Role
	if err := db.Where("id = ?", roleID).First(&role).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Role not found"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch role"})
		}
		return
	}

	var perms interface{}
	if role.Permissions != nil {
		var p basemodels.Permissions
		if err := json.Unmarshal(*role.Permissions, &p); err == nil {
			perms = p
		}
	}
	c.JSON(http.StatusOK, gin.H{"id": role.ID, "name": role.Name, "description": role.Description, "is_active": role.IsActive, "company_id": role.CompanyID, "permissions": perms})
}

// GetSystemRoles returns system/global roles (company_id IS NULL).
func GetSystemRoles(c *gin.Context) {
	db, err := config.NewConnection()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database connection failed"})
		return
	}

	var roles []basemodels.Role
	if err := db.Where("company_id IS NULL").Find(&roles).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch system roles"})
		return
	}

	var response []gin.H
	for _, r := range roles {
		var perms interface{}
		if r.Permissions != nil {
			var p basemodels.Permissions
			if err := json.Unmarshal(*r.Permissions, &p); err == nil {
				perms = p
			}
		}
		response = append(response, gin.H{
			"id":            r.ID,
			"name":          r.Name,
			"description":   r.Description,
			"is_active":     r.IsActive,
			"company_id":    r.CompanyID,
			"created_at":    r.CreatedAt,
			"created_by_id": r.CreatedByID,
			"permissions":   perms,
		})
	}

	c.JSON(http.StatusOK, gin.H{"roles": response})
}

// CreateRole creates a global or company-scoped role
func CreateRole(c *gin.Context) {
	var req struct {
		Name        string                  `json:"name" binding:"required"`
		Description string                  `json:"description"`
		CompanyID   *uuid.UUID              `json:"company_id"`
		Permissions *basemodels.Permissions `json:"permissions"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	db, err := config.NewConnection()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database connection failed"})
		return
	}

	// Duplicate check
	var existing basemodels.Role
	if req.CompanyID != nil {
		if err := db.Where("name = ? AND company_id = ?", req.Name, req.CompanyID).First(&existing).Error; err == nil {
			c.JSON(http.StatusConflict, gin.H{"error": "Role with this name already exists in company"})
			return
		}
	} else {
		if err := db.Where("name = ? AND company_id IS NULL", req.Name).First(&existing).Error; err == nil {
			c.JSON(http.StatusConflict, gin.H{"error": "Global role with this name already exists"})
			return
		}
	}

	role := &basemodels.Role{
		Name:        &req.Name,
		Description: &req.Description,
		IsActive:    true,
		CompanyID:   req.CompanyID,
	}

	if req.Permissions != nil {
		role.Permissions = permissionsToJSON(req.Permissions)
	}

	// Attach the creating user (if available)
	if userIDVal, exists := c.Get("user_id"); exists {
		if uID, ok := userIDVal.(uuid.UUID); ok {
			role.CreatedByID = &uID
		}
	}
	if err := db.Create(role).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create role"})
		return
	}

	// If permissions provided, sync to Casbin
	if req.Permissions != nil {
		domain := services.BuildDomainID(req.CompanyID)
		casbinList := services.ConvertPermissionsToCasbinList(req.Permissions, domain)
		if err := services.UpsertRolePermissionsFromPermissions(role.ID, casbinList); err != nil {
			// Try to rollback permissions storage in DB
			role.Permissions = nil
			_ = db.Save(role)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to apply role permissions"})
			return
		}
	}

	c.JSON(http.StatusCreated, gin.H{"id": role.ID, "name": role.Name, "description": role.Description, "is_active": role.IsActive, "company_id": role.CompanyID})
}

// UpdateRole updates a role (global or company-scoped)
func UpdateRole(c *gin.Context) {
	roleIDStr := c.Param("roleId")
	roleID, err := uuid.Parse(roleIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid role ID"})
		return
	}

	var req struct {
		Name        *string                 `json:"name"`
		Description *string                 `json:"description"`
		IsActive    *bool                   `json:"is_active"`
		Permissions *basemodels.Permissions `json:"permissions"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	db, err := config.NewConnection()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database connection failed"})
		return
	}

	var role basemodels.Role
	if err := db.Where("id = ?", roleID).First(&role).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Role not found"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch role"})
		}
		return
	}

	if req.Name != nil {
		role.Name = req.Name
	}
	if req.Description != nil {
		role.Description = req.Description
	}
	if req.IsActive != nil {
		role.IsActive = *req.IsActive
	}

	var oldPerm *datatypes.JSON
	if req.Permissions != nil {
		oldPerm = role.Permissions
		role.Permissions = permissionsToJSON(req.Permissions)
	}

	if err := db.Save(&role).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update role"})
		return
	}

	// If permissions provided, sync Casbin policies
	if req.Permissions != nil {
		domain := services.BuildDomainID(role.CompanyID)
		casbinList := services.ConvertPermissionsToCasbinList(req.Permissions, domain)
		if err := services.UpsertRolePermissionsFromPermissions(role.ID, casbinList); err != nil {
			// try to revert DB permissions
			role.Permissions = oldPerm
			_ = db.Save(&role)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to apply role permissions"})
			return
		}
	}

	// Unmarshal permissions JSON for response
	var perms interface{}
	if role.Permissions != nil {
		var p basemodels.Permissions
		if err := json.Unmarshal(*role.Permissions, &p); err == nil {
			perms = p
		}
	}
	c.JSON(http.StatusOK, gin.H{"id": role.ID, "name": role.Name, "description": role.Description, "is_active": role.IsActive, "company_id": role.CompanyID, "permissions": perms})
}

// DeleteRole soft-deletes a role (global) if possible
func DeleteRole(c *gin.Context) {
	roleIDStr := c.Param("roleId")
	roleID, err := uuid.Parse(roleIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid role ID"})
		return
	}

	db, err := config.NewConnection()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database connection failed"})
		return
	}

	var role basemodels.Role
	if err := db.Where("id = ?", roleID).First(&role).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Role not found"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch role"})
		}
		return
	}

	var userCount int64
	if err := db.Model(&auth.User{}).Where("role_id = ?", roleID).Count(&userCount).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to check role usage"})
		return
	}
	if userCount > 0 {
		c.JSON(http.StatusConflict, gin.H{"error": "Cannot delete role that is assigned to users"})
		return
	}

	var memberCount int64
	if err := db.Model(&companymodels.CompanyMember{}).Where("role_id = ?", roleID).Count(&memberCount).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to check company member usage"})
		return
	}
	if memberCount > 0 {
		c.JSON(http.StatusConflict, gin.H{"error": "Role assigned to company members; cannot delete global role"})
		return
	}

	role.IsActive = false
	if err := db.Save(&role).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete role"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Role deleted successfully"})
}

// CreateCompanyRoleHandler allows creating a company-scoped role
func CreateCompanyRoleHandler(c *gin.Context) {
	companyIDStr := c.Param("id")
	companyID, err := uuid.Parse(companyIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid company ID"})
		return
	}

	var req struct {
		Name        string                  `json:"name" binding:"required"`
		Description string                  `json:"description"`
		Permissions *basemodels.Permissions `json:"permissions"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	db, err := config.NewConnection()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database connection failed"})
		return
	}

	userIDVal, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}
	userID, ok := userIDVal.(uuid.UUID)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user ID"})
		return
	}

	// Authorization: only company owner/company_admin or system super_admin may update company-scoped roles
	var requestUser auth.User
	if err := db.Where("id = ?", userID).First(&requestUser).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not found"})
		return
	}
	if requestUser.Role != "super_admin" {
		var requestMember companymodels.CompanyMember
		if err := db.Where("company_id = ? AND user_id = ? AND is_active = ?", companyID, userID, true).
			Preload("Role").
			First(&requestMember).Error; err != nil {
			c.JSON(http.StatusForbidden, gin.H{"error": "Only company owners or admins can update roles"})
			return
		}
		isAdmin := requestMember.IsOwner
		if requestMember.Role != nil && requestMember.Role.Name != nil {
			rn := *requestMember.Role.Name
			if rn == "company_owner" || rn == "company_admin" {
				isAdmin = true
			}
		}
		if !isAdmin {
			c.JSON(http.StatusForbidden, gin.H{"error": "Only company owners or admins can update roles"})
			return
		}
	}

	// (authorization already validated above)

	// Duplicate name check within the company
	var existing basemodels.Role
	if err := db.Where("name = ? AND company_id = ?", req.Name, companyID).First(&existing).Error; err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Role with this name already exists in company"})
		return
	}

	role := &basemodels.Role{
		Name:        &req.Name,
		Description: &req.Description,
		IsActive:    true,
		CompanyID:   &companyID,
		CreatedByID: &userID,
	}
	if req.Permissions != nil {
		role.Permissions = permissionsToJSON(req.Permissions)
	}

	if err := db.Create(role).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create role"})
		return
	}

	if req.Permissions != nil {
		domain := services.BuildDomainID(role.CompanyID)
		casbinList := services.ConvertPermissionsToCasbinList(req.Permissions, domain)
		if err := services.UpsertRolePermissionsFromPermissions(role.ID, casbinList); err != nil {
			role.Permissions = nil
			_ = db.Save(role)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to apply role permissions"})
			return
		}
	}

	c.JSON(http.StatusCreated, gin.H{"id": role.ID, "name": role.Name})
}

// GetCompanyRolePermissions returns persisted role_permissions rows for a company-scoped role
func GetCompanyRolePermissions(c *gin.Context) {
	companyIDStr := c.Param("id")
	roleIDStr := c.Param("roleId")
	companyID, err := uuid.Parse(companyIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid company ID"})
		return
	}
	roleID, err := uuid.Parse(roleIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid role ID"})
		return
	}

	db, err := config.NewConnection()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database connection failed"})
		return
	}

	// Ensure role exists and belongs to the company
	var role basemodels.Role
	if err := db.Where("id = ? AND company_id = ?", roleID, companyID).First(&role).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Role not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch role"})
		return
	}

	var perms []basemodels.RolePermission
	if err := db.Where("role_id = ?", roleID).Find(&perms).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch role permissions"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"permissions": perms})
}

// UpdateCompanyRolePermission toggles or updates a persisted RolePermission for a company-scoped role
func UpdateCompanyRolePermission(c *gin.Context) {
	companyIDStr := c.Param("id")
	roleIDStr := c.Param("roleId")
	permIDStr := c.Param("permissionId")

	companyID, err := uuid.Parse(companyIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid company ID"})
		return
	}
	roleID, err := uuid.Parse(roleIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid role ID"})
		return
	}
	permID, err := uuid.Parse(permIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid permission ID"})
		return
	}

	var req struct {
		IsActive *bool `json:"is_active"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || req.IsActive == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "is_active boolean required"})
		return
	}

	db, err := config.NewConnection()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database connection failed"})
		return
	}

	// Auth: check if user is super_admin or company owner/admin
	userIDVal, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}
	userID, ok := userIDVal.(uuid.UUID)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user ID"})
		return
	}

	var requestUser auth.User
	if err := db.Where("id = ?", userID).First(&requestUser).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not found"})
		return
	}
	if requestUser.Role != "super_admin" {
		var requestMember companymodels.CompanyMember
		if err := db.Where("company_id = ? AND user_id = ? AND is_active = ?", companyID, userID, true).
			Preload("Role").
			First(&requestMember).Error; err != nil {
			c.JSON(http.StatusForbidden, gin.H{"error": "Only company owners or admins can change role permissions"})
			return
		}
		isAdmin := requestMember.IsOwner
		if requestMember.Role != nil && requestMember.Role.Name != nil {
			rn := *requestMember.Role.Name
			if rn == "company_owner" || rn == "company_admin" {
				isAdmin = true
			}
		}
		if !isAdmin {
			c.JSON(http.StatusForbidden, gin.H{"error": "Only company owners or admins can change role permissions"})
			return
		}
	}

	// Ensure role belongs to company
	var role basemodels.Role
	if err := db.Where("id = ? AND company_id = ?", roleID, companyID).First(&role).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Role not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch role"})
		return
	}

	var rp basemodels.RolePermission
	if err := db.Where("id = ? AND role_id = ?", permID, roleID).First(&rp).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Permission not found for this role"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch role permission"})
		return
	}

	prev := rp.IsActive
	desired := *req.IsActive
	log.Printf("UpdateRolePermission: role=%s perm_id=%s resource=%s action=%s prev=%v desired=%v user=%v", roleID.String(), rp.ID.String(), rp.Resource, rp.Action, prev, desired, c.GetString("user_id"))
	rp.IsActive = desired
	if err := db.Save(&rp).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update permission record"})
		return
	}
	log.Printf("UpdateRolePermission: saved perm_id=%s is_active=%v", rp.ID.String(), rp.IsActive)

	roleSubject := fmt.Sprintf("role:%s", roleID.String())
	domain := rp.Domain
	if domain == "" {
		domain = services.BuildDomainID(&companyID)
	}
	if rp.IsActive {
		if added, err := services.AddPolicy(roleSubject, rp.Resource, rp.Action, domain); err != nil {
			// revert DB
			rp.IsActive = prev
			_ = db.Save(&rp)
			log.Printf("UpdateRolePermission: AddPolicy failed for perm_id=%s: %v", rp.ID.String(), err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to add policy to Casbin"})
			return
		} else {
			log.Printf("UpdateRolePermission: AddPolicy result for perm_id=%s added=%v", rp.ID.String(), added)
		}
	} else {
		if removed, err := services.RemovePolicy(roleSubject, rp.Resource, rp.Action, domain); err != nil {
			// revert DB
			rp.IsActive = prev
			_ = db.Save(&rp)
			log.Printf("UpdateRolePermission: RemovePolicy failed for perm_id=%s: %v", rp.ID.String(), err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to remove policy from Casbin"})
			return
		} else {
			log.Printf("UpdateRolePermission: RemovePolicy result for perm_id=%s removed=%v", rp.ID.String(), removed)
		}
	}

	if err := services.GetEnforcer().SavePolicy(); err != nil {
		rp.IsActive = prev
		_ = db.Save(&rp)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to persist Casbin policy"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"permission": rp})
}

// GetRolePermissions returns persisted role_permissions rows for a global/system role
func GetRolePermissions(c *gin.Context) {
	roleIDStr := c.Param("roleId")
	roleID, err := uuid.Parse(roleIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid role ID"})
		return
	}

	db, err := config.NewConnection()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database connection failed"})
		return
	}

	var role basemodels.Role
	if err := db.Where("id = ?", roleID).First(&role).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Role not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch role"})
		return
	}

	// Ensure this is a system/global role
	if role.CompanyID != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Role is company-scoped; use company endpoint"})
		return
	}

	var perms []basemodels.RolePermission
	if err := db.Where("role_id = ?", roleID).Find(&perms).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch role permissions"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"permissions": perms})
}

// UpdateRolePermission toggles a persisted RolePermission for a system/global role (admin only)
func UpdateRolePermission(c *gin.Context) {
	roleIDStr := c.Param("roleId")
	permIDStr := c.Param("permissionId")

	roleID, err := uuid.Parse(roleIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid role ID"})
		return
	}
	permID, err := uuid.Parse(permIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid permission ID"})
		return
	}

	var req struct {
		IsActive *bool `json:"is_active"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || req.IsActive == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "is_active boolean required"})
		return
	}

	db, err := config.NewConnection()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database connection failed"})
		return
	}

	var role basemodels.Role
	if err := db.Where("id = ? AND company_id IS NULL", roleID).First(&role).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Role not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch role"})
		return
	}

	var rp basemodels.RolePermission
	if err := db.Where("id = ? AND role_id = ?", permID, roleID).First(&rp).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Permission not found for this role"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch role permission"})
		return
	}

	prev := rp.IsActive
	desired := *req.IsActive
	log.Printf("UpdateRolePermission: role=%s perm_id=%s resource=%s action=%s prev=%v desired=%v user=%v", roleID.String(), rp.ID.String(), rp.Resource, rp.Action, prev, desired, c.GetString("user_id"))
	rp.IsActive = desired
	if err := db.Save(&rp).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update permission record"})
		return
	}
	log.Printf("UpdateRolePermission: saved perm_id=%s is_active=%v", rp.ID.String(), rp.IsActive)

	roleSubject := fmt.Sprintf("role:%s", roleID.String())
	domain := rp.Domain
	if domain == "" {
		domain = "*"
	}
	if rp.IsActive {
		if added, err := services.AddPolicy(roleSubject, rp.Resource, rp.Action, domain); err != nil {
			// revert DB
			rp.IsActive = prev
			_ = db.Save(&rp)
			log.Printf("UpdateRolePermission: AddPolicy failed for perm_id=%s: %v", rp.ID.String(), err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to add policy to Casbin"})
			return
		} else {
			log.Printf("UpdateRolePermission: AddPolicy result for perm_id=%s added=%v", rp.ID.String(), added)
		}
	} else {
		if removed, err := services.RemovePolicy(roleSubject, rp.Resource, rp.Action, domain); err != nil {
			// revert DB
			rp.IsActive = prev
			_ = db.Save(&rp)
			log.Printf("UpdateRolePermission: RemovePolicy failed for perm_id=%s: %v", rp.ID.String(), err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to remove policy from Casbin"})
			return
		} else {
			log.Printf("UpdateRolePermission: RemovePolicy result for perm_id=%s removed=%v", rp.ID.String(), removed)
		}
	}
	if err := services.GetEnforcer().SavePolicy(); err != nil {
		rp.IsActive = prev
		_ = db.Save(&rp)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to persist Casbin policy"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"permission": rp})
}

// UpdateCompanyRoleHandler updates a company-scoped role
func UpdateCompanyRoleHandler(c *gin.Context) {
	companyIDStr := c.Param("id")
	roleIDStr := c.Param("roleId")

	companyID, err := uuid.Parse(companyIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid company ID"})
		return
	}
	roleID, err := uuid.Parse(roleIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid role ID"})
		return
	}

	var req struct {
		Name        *string                 `json:"name"`
		Description *string                 `json:"description"`
		IsActive    *bool                   `json:"is_active"`
		Permissions *basemodels.Permissions `json:"permissions"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	db, err := config.NewConnection()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database connection failed"})
		return
	}

	userIDVal, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}
	userID, ok := userIDVal.(uuid.UUID)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user ID"})
		return
	}

	var role basemodels.Role
	if err := db.Where("id = ? AND company_id = ?", roleID, companyID).First(&role).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			// The role may be a global template (company_id IS NULL) referenced by this company.
			// In that case: clone the template into a company-scoped role so the company can update it.
			var template basemodels.Role
			if tErr := db.Where("id = ? AND company_id IS NULL", roleID).First(&template).Error; tErr == nil {
				log.Printf("Cloning global role template %s into company %s for on-demand edit", template.ID.String(), companyID.String())
				newRole := basemodels.Role{
					Name:        template.Name,
					Description: template.Description,
					IsActive:    template.IsActive,
					CompanyID:   &companyID,
					CreatedByID: &userID,
				}
				if cErr := db.Create(&newRole).Error; cErr != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create company-scoped role from template"})
					return
				}
				// Use the newly created company-scoped role for subsequent updates
				role = newRole
			} else {
				if tErr == gorm.ErrRecordNotFound {
					c.JSON(http.StatusNotFound, gin.H{"error": "Role not found"})
					return
				}
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch role template"})
				return
			}
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch role"})
			return
		}
	}

	if req.Name != nil {
		role.Name = req.Name
	}
	if req.Description != nil {
		role.Description = req.Description
	}
	if req.IsActive != nil {
		role.IsActive = *req.IsActive
	}

	var oldPerm *datatypes.JSON
	if req.Permissions != nil {
		oldPerm = role.Permissions
		role.Permissions = permissionsToJSON(req.Permissions)
	}

	if err := db.Save(&role).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update role"})
		return
	}

	if req.Permissions != nil {
		domain := services.BuildDomainID(role.CompanyID)
		casbinList := services.ConvertPermissionsToCasbinList(req.Permissions, domain)
		if err := services.UpsertRolePermissionsFromPermissions(role.ID, casbinList); err != nil {
			role.Permissions = oldPerm
			_ = db.Save(&role)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to apply role permissions"})
			return
		}
	}

	c.JSON(http.StatusOK, gin.H{"id": role.ID, "name": role.Name, "description": role.Description, "is_active": role.IsActive, "company_id": role.CompanyID})
}

// DeleteCompanyRoleHandler deletes a company-scoped role
func DeleteCompanyRoleHandler(c *gin.Context) {
	companyIDStr := c.Param("id")
	roleIDStr := c.Param("roleId")

	companyID, err := uuid.Parse(companyIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid company ID"})
		return
	}
	roleID, err := uuid.Parse(roleIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid role ID"})
		return
	}

	db, err := config.NewConnection()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database connection failed"})
		return
	}

	var role basemodels.Role
	if err := db.Where("id = ? AND company_id = ?", roleID, companyID).First(&role).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Role not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch role"})
		return
	}

	var memberCount int64
	if err := db.Model(&companymodels.CompanyMember{}).Where("role_id = ?", roleID).Count(&memberCount).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to check company member usage"})
		return
	}

	if memberCount > 0 {
		if role.CompanyID != nil {
			var fallback basemodels.Role
			if err := db.Where("name = ? AND company_id = ? AND is_active = ?", "company_employee", role.CompanyID, true).First(&fallback).Error; err != nil {
				c.JSON(http.StatusConflict, gin.H{"error": "Role is assigned to members and fallback role not found; cannot delete"})
				return
			}

			if err := db.Model(&companymodels.CompanyMember{}).Where("role_id = ?", roleID).Update("role_id", fallback.ID).Error; err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to reassign members to fallback role"})
				return
			}
		} else {
			c.JSON(http.StatusConflict, gin.H{"error": "Role is assigned to company members; cannot delete global role assigned to members"})
			return
		}
	}

	role.IsActive = false
	if err := db.Save(&role).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete role"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Role deleted successfully"})
}

// CreateCompanyRolePermission creates a persisted role_permission row for a company-scoped role
func CreateCompanyRolePermission(c *gin.Context) {
	companyIDStr := c.Param("id")
	roleIDStr := c.Param("roleId")
	companyID, err := uuid.Parse(companyIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid company ID"})
		return
	}
	roleID, err := uuid.Parse(roleIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid role ID"})
		return
	}

	var req struct {
		Resource   string          `json:"resource" binding:"required"`
		Action     string          `json:"action" binding:"required"`
		Domain     *string         `json:"domain"`
		Conditions json.RawMessage `json:"conditions,omitempty"`
		IsActive   *bool           `json:"is_active"`
		Effect     *string         `json:"effect"`
		Priority   *int            `json:"priority"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Authorization: only company owner/company_admin or system super_admin may create company-scoped permissions
	db, err := config.NewConnection()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database connection failed"})
		return
	}

	userIDVal, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}
	userID, ok := userIDVal.(uuid.UUID)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user ID"})
		return
	}

	var requestUser auth.User
	if err := db.Where("id = ?", userID).First(&requestUser).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not found"})
		return
	}
	if requestUser.Role != "super_admin" {
		var requestMember companymodels.CompanyMember
		if err := db.Where("company_id = ? AND user_id = ? AND is_active = ?", companyID, userID, true).
			Preload("Role").
			First(&requestMember).Error; err != nil {
			c.JSON(http.StatusForbidden, gin.H{"error": "Only company owners or admins can create role permissions"})
			return
		}
		isAdmin := requestMember.IsOwner
		if requestMember.Role != nil && requestMember.Role.Name != nil {
			rn := *requestMember.Role.Name
			if rn == "company_owner" || rn == "company_admin" {
				isAdmin = true
			}
		}
		if !isAdmin {
			c.JSON(http.StatusForbidden, gin.H{"error": "Only company owners or admins can create role permissions"})
			return
		}
	}

	// Ensure role belongs to company
	var role basemodels.Role
	if err := db.Where("id = ? AND company_id = ?", roleID, companyID).First(&role).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Role not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch role"})
		return
	}

	domain := services.BuildDomainID(&companyID)
	if req.Domain != nil && *req.Domain != "" {
		domain = *req.Domain
	}

	isActive := true
	if req.IsActive != nil {
		isActive = *req.IsActive
	}

	effect := "allow"
	if req.Effect != nil && *req.Effect != "" {
		effect = *req.Effect
	}

	priority := 0
	if req.Priority != nil {
		priority = *req.Priority
	}

	rp := basemodels.NewRolePermission(roleID, req.Resource, req.Action, effect, domain, req.Conditions, priority, isActive)

	if err := db.Create(&rp).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create role permission"})
		return
	}

	// If active, add casbin policy
	roleSubject := fmt.Sprintf("role:%s", roleID.String())
	if rp.IsActive {
		if _, err := services.AddPolicy(roleSubject, rp.Resource, rp.Action, rp.Domain); err != nil {
			// rollback DB insert
			_ = db.Where("id = ?", rp.ID).Delete(&basemodels.RolePermission{}).Error
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to add policy to Casbin"})
			return
		}
		if err := services.GetEnforcer().SavePolicy(); err != nil {
			_ = db.Where("id = ?", rp.ID).Delete(&basemodels.RolePermission{}).Error
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to persist Casbin policy"})
			return
		}
	}

	c.JSON(http.StatusCreated, gin.H{"permission": rp})
}

// CreateRolePermission creates a persisted role_permission row for a system/global role
func CreateRolePermission(c *gin.Context) {
	roleIDStr := c.Param("roleId")
	roleID, err := uuid.Parse(roleIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid role ID"})
		return
	}

	var req struct {
		Resource   string          `json:"resource" binding:"required"`
		Action     string          `json:"action" binding:"required"`
		Domain     *string         `json:"domain"`
		Conditions json.RawMessage `json:"conditions,omitempty"`
		IsActive   *bool           `json:"is_active"`
		Effect     *string         `json:"effect"`
		Priority   *int            `json:"priority"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	db, err := config.NewConnection()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database connection failed"})
		return
	}

	// Ensure role exists and is a system role
	var role basemodels.Role
	if err := db.Where("id = ? AND company_id IS NULL", roleID).First(&role).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Role not found or not a system role"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch role"})
		return
	}

	domain := "*"
	if req.Domain != nil && *req.Domain != "" {
		domain = *req.Domain
	}

	isActive := true
	if req.IsActive != nil {
		isActive = *req.IsActive
	}

	effect := "allow"
	if req.Effect != nil && *req.Effect != "" {
		effect = *req.Effect
	}

	priority := 0
	if req.Priority != nil {
		priority = *req.Priority
	}

	rp := basemodels.NewRolePermission(roleID, req.Resource, req.Action, effect, domain, req.Conditions, priority, isActive)

	if err := db.Create(&rp).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create role permission"})
		return
	}

	roleSubject := fmt.Sprintf("role:%s", roleID.String())
	if rp.IsActive {
		if _, err := services.AddPolicy(roleSubject, rp.Resource, rp.Action, rp.Domain); err != nil {
			_ = db.Where("id = ?", rp.ID).Delete(&basemodels.RolePermission{}).Error
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to add policy to Casbin"})
			return
		}
		if err := services.GetEnforcer().SavePolicy(); err != nil {
			_ = db.Where("id = ?", rp.ID).Delete(&basemodels.RolePermission{}).Error
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to persist Casbin policy"})
			return
		}
	}

	c.JSON(http.StatusCreated, gin.H{"permission": rp})
}

// AssignRoleToUser assigns a role to a user (admin endpoint)
func AssignRoleToUser(c *gin.Context) {
	userIDStr := c.Param("userId")
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	var req struct {
		RoleID uuid.UUID `json:"role_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	db, err := config.NewConnection()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database connection failed"})
		return
	}

	tx := db.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	// Find user
	var user auth.User
	if err := tx.Where("id = ?", userID).First(&user).Error; err != nil {
		tx.Rollback()
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to find user"})
		}
		return
	}

	// Find role and validate
	var role basemodels.Role
	if err := tx.Where("id = ? AND is_active = ?", req.RoleID, true).First(&role).Error; err != nil {
		tx.Rollback()
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Role not found or inactive"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to find role"})
		}
		return
	}

	if role.Name == nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Role name is nil"})
		return
	}

	// Update user's RoleID
	user.RoleID = &req.RoleID
	if err := tx.Save(&user).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update user role"})
		return
	}

	// Sync user role with helper
	if err := syncUserRole(tx, &user); err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to sync user role"})
		return
	}

	if err := tx.Save(&user).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save updated user role"})
		return
	}

	if err := tx.Commit().Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to commit transaction"})
		return
	}

	fmt.Printf("AssignRoleToUser: After commit, user.Role=%s, user.RoleID=%s\n", user.Role, user.RoleID.String())

	c.JSON(http.StatusOK, gin.H{
		"message": "Role assigned successfully",
		"user": gin.H{
			"id":      user.ID,
			"email":   user.Email,
			"role":    user.Role,
			"role_id": user.RoleID,
		},
		"role": gin.H{
			"id":          role.ID,
			"name":        role.Name,
			"description": role.Description,
		},
	})
}

// RemoveRoleFromUser kullanıcıdan role kaldırır
func RemoveRoleFromUser(c *gin.Context) {
	userIDStr := c.Param("userId")
	roleIDStr := c.Param("roleId")

	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	roleID, err := uuid.Parse(roleIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid role ID"})
		return
	}

	db, err := config.NewConnection()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database connection failed"})
		return
	}

	// Transaction başlat
	tx := db.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	// User'ı bul
	var user auth.User
	if err := tx.Where("id = ?", userID).First(&user).Error; err != nil {
		tx.Rollback()
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to find user"})
		}
		return
	}

	// Kullanıcının bu role sahip olup olmadığını kontrol et
	if user.RoleID == nil || *user.RoleID != roleID {
		tx.Rollback()
		c.JSON(http.StatusBadRequest, gin.H{"error": "User does not have this role"})
		return
	}

	// Role'ı kaldır (null yap)
	user.RoleID = nil
	user.Role = ""

	if err := tx.Save(&user).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to remove role from user"})
		return
	}

	// Transaction'ı commit et
	if err := tx.Commit().Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to commit transaction"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Role removed from user successfully",
		"user": gin.H{
			"id":    user.ID,
			"email": user.Email,
			"role":  user.Role,
		},
	})
}

// permissionsToJSON converts Permissions struct to *datatypes.JSON for DB storage
func permissionsToJSON(p *basemodels.Permissions) *datatypes.JSON {
	if p == nil {
		emptyJSON := datatypes.JSON(`{}`)
		return &emptyJSON
	}
	raw, err := json.Marshal(p)
	if err != nil {
		emptyJSON := datatypes.JSON(`{}`)
		return &emptyJSON
	}
	j := datatypes.JSON(raw)
	return &j
}

// syncUserRole senkronize eder User.Role field'ini Role tablosundan
func syncUserRole(db *gorm.DB, user *auth.User) error {
	if user.RoleID == nil {
		// RoleID yoksa default "user" rolü ata
		var defaultRole basemodels.Role
		if err := db.Where("name = ?", "user").First(&defaultRole).Error; err != nil {
			return errors.New("default user role not found")
		}
		user.RoleID = &defaultRole.ID
		user.Role = "user"
		fmt.Printf("syncUserRole: Assigned default user role, user.RoleID=%s, user.Role=%s\n", user.RoleID.String(), user.Role)
		return nil
	}

	// RoleID varsa, Role tablosundan name'i al
	var role basemodels.Role
	if err := db.Where("id = ?", user.RoleID).First(&role).Error; err != nil {
		fmt.Printf("syncUserRole: Error finding role with ID %s: %v\n", user.RoleID.String(), err)
		return errors.New("role not found")
	}

	if role.Name == nil {
		fmt.Printf("syncUserRole: Role name is nil for role ID %s\n", user.RoleID.String())
		return errors.New("role name is nil")
	}

	user.Role = *role.Name
	fmt.Printf("syncUserRole: Synced user role, user.RoleID=%s, user.Role=%s, role.Name=%s\n", user.RoleID.String(), user.Role, *role.Name)
	return nil
}
