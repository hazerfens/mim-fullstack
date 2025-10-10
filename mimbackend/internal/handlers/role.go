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
	"mimbackend/internal/services"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

// GetRoles lists all roles
func GetRoles(c *gin.Context) {
	db, err := config.NewConnection()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database connection failed"})
		return
	}

	var roles []basemodels.Role
	if err := db.Find(&roles).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch roles"})
		return
	}

	var response []gin.H
	for _, r := range roles {
		perm := basemodels.Permissions{}
		if r.Permissions != nil && len([]byte(*r.Permissions)) > 0 {
			_ = json.Unmarshal([]byte(*r.Permissions), &perm)
		}
		response = append(response, gin.H{
			"id":          r.ID,
			"name":        r.Name,
			"description": r.Description,
			"is_active":   r.IsActive,
			"company_id":  r.CompanyID,
			"permissions": perm,
			"created_at":  r.CreatedAt,
		})
	}

	c.JSON(http.StatusOK, gin.H{"roles": response})
}

// GetRole returns a single role by ID
func GetRole(c *gin.Context) {
	id := c.Param("id")
	roleID, err := uuid.Parse(id)
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

	perm := basemodels.Permissions{}
	if role.Permissions != nil && len([]byte(*role.Permissions)) > 0 {
		_ = json.Unmarshal([]byte(*role.Permissions), &perm)
	}

	c.JSON(http.StatusOK, gin.H{"id": role.ID, "name": role.Name, "description": role.Description, "permissions": perm, "is_active": role.IsActive, "company_id": role.CompanyID})
}

// GetSystemRoles returns system/global roles (company_id IS NULL). Only
// super_admin users should be able to access this endpoint.
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
		perm := basemodels.Permissions{}
		if r.Permissions != nil {
			_ = json.Unmarshal([]byte(*r.Permissions), &perm)
		}
		response = append(response, gin.H{
			"id":          r.ID,
			"name":        r.Name,
			"description": r.Description,
			"is_active":   r.IsActive,
			"company_id":  r.CompanyID,
			"permissions": perm,
			"created_at":  r.CreatedAt,
		})
	}

	c.JSON(http.StatusOK, gin.H{"roles": response})
}

// CreateRole creates a global or company-scoped role
func CreateRole(c *gin.Context) {
	var req struct {
		Name        string                  `json:"name" binding:"required"`
		Description string                  `json:"description"`
		Permissions *basemodels.Permissions `json:"permissions"`
		CompanyID   *uuid.UUID              `json:"company_id"`
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
		Permissions: permissionsToJSON(req.Permissions),
		IsActive:    true,
		CompanyID:   req.CompanyID,
	}
	if err := db.Create(role).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create role"})
		return
	}

	// Sync normalized role_permissions rows from provided permissions
	if req.Permissions != nil {
		if err := services.UpsertRolePermissionsFromPermissions(role.ID, req.Permissions); err != nil {
			log.Printf("warning: failed to upsert role_permissions for role %s: %v", req.Name, err)
		}
	}

	responsePerm := basemodels.Permissions{}
	if role.Permissions != nil {
		_ = json.Unmarshal([]byte(*role.Permissions), &responsePerm)
	}

	c.JSON(http.StatusCreated, gin.H{"id": role.ID, "name": role.Name, "permissions": responsePerm})
}

// UpdateRole updates a role (global or company-scoped)
func UpdateRole(c *gin.Context) {
	id := c.Param("id")
	roleID, err := uuid.Parse(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid role ID"})
		return
	}

	var req struct {
		Name        *string                 `json:"name"`
		Description *string                 `json:"description"`
		Permissions *basemodels.Permissions `json:"permissions"`
		IsActive    *bool                   `json:"is_active"`
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

	oldName := ""
	if role.Name != nil {
		oldName = *role.Name
	}

	if req.Name != nil {
		role.Name = req.Name
	}
	if req.Description != nil {
		role.Description = req.Description
	}
	if req.Permissions != nil {
		role.Permissions = permissionsToJSON(req.Permissions)
	}
	if req.IsActive != nil {
		role.IsActive = *req.IsActive
	}

	if err := db.Save(&role).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update role"})
		return
	}

	if req.Name != nil && oldName != *req.Name {
		domain := "*"
		if role.CompanyID != nil {
			domain = services.BuildDomainID(role.CompanyID)
		}
		users, _ := services.GetUsersForRole(oldName, domain)
		for _, u := range users {
			_, _ = services.DeleteRoleForUser(u, oldName, domain)
			_, _ = services.AddRoleForUser(u, *role.Name, domain)
		}
		if err := services.RemovePoliciesForRole(oldName, role.CompanyID); err != nil {
			log.Printf("warning: failed to remove old policies for role %s: %v", oldName, err)
		}
	}

	if req.Permissions != nil {
		if err := services.UpsertRolePermissionsFromPermissions(role.ID, req.Permissions); err != nil {
			log.Printf("warning: failed to upsert role_permissions for role %v: %v", role.ID, err)
		}
	}
	if req.Name != nil && oldName != *req.Name {
		if err := services.UpdatePoliciesForRole(role); err != nil {
			log.Printf("warning: failed to update policies for role %v: %v", role.ID, err)
		}
	}

	perm := basemodels.Permissions{}
	if role.Permissions != nil && len([]byte(*role.Permissions)) > 0 {
		_ = json.Unmarshal([]byte(*role.Permissions), &perm)
	}

	c.JSON(http.StatusOK, gin.H{"id": role.ID, "name": role.Name, "permissions": perm})
}

// DeleteRole soft-deletes a role (global) if possible
func DeleteRole(c *gin.Context) {
	id := c.Param("id")
	roleID, err := uuid.Parse(id)
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

	if role.Name != nil {
		if err := services.RemovePoliciesForRole(*role.Name, role.CompanyID); err != nil {
			log.Printf("warning: failed to remove policies for deleted role %s: %v", *role.Name, err)
		}
	}

	c.JSON(http.StatusOK, gin.H{"message": "Role deleted successfully"})
}

// CreateCompanyRoleHandler allows company owner/admin or super_admin to create a company-scoped role
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

	// Super admin can manage company-scoped roles too
	var requestUser auth.User
	if err := db.Where("id = ?", userID).First(&requestUser).Error; err != nil {
		// If we cannot load user, deny
		c.JSON(http.StatusForbidden, gin.H{"error": "only company owners or admins can create company-scoped roles"})
		return
	}
	isSuperAdmin := requestUser.Role == "super_admin"
	if !isSuperAdmin {
		// Verify requester is owner/admin
		membership, err := services.GetUserCompanyMembership(userID, companyID)
		if err != nil {
			c.JSON(http.StatusForbidden, gin.H{"error": "only company owners or admins can create company-scoped roles"})
			return
		}
		isAdmin := membership.IsOwner
		if membership.Role != nil && membership.Role.Name != nil {
			rn := *membership.Role.Name
			isAdmin = isAdmin || rn == "company_owner" || rn == "company_admin"
		}
		if !isAdmin {
			c.JSON(http.StatusForbidden, gin.H{"error": "only company owners or admins can create company-scoped roles"})
			return
		}
	}

	// Duplicate name check within the company
	var existing basemodels.Role
	if err := db.Where("name = ? AND company_id = ?", req.Name, companyID).First(&existing).Error; err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Role with this name already exists in company"})
		return
	}

	role := &basemodels.Role{
		Name:        &req.Name,
		Description: &req.Description,
		Permissions: permissionsToJSON(req.Permissions),
		IsActive:    true,
		CompanyID:   &companyID,
		CreatedByID: &userID,
	}
	if err := db.Create(role).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create role"})
		return
	}

	// Sync normalized role_permissions rows from provided permissions
	if req.Permissions != nil {
		if err := services.UpsertRolePermissionsFromPermissions(role.ID, req.Permissions); err != nil {
			log.Printf("warning: failed to upsert role_permissions for role %s: %v", req.Name, err)
		}
	}

	c.JSON(http.StatusCreated, gin.H{"id": role.ID, "name": role.Name})
}

// UpdateCompanyRoleHandler updates a company-scoped role (owner/admin only)
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
		Permissions *basemodels.Permissions `json:"permissions"`
		IsActive    *bool                   `json:"is_active"`
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

	var requestUser auth.User
	if err := db.Where("id = ?", userID).First(&requestUser).Error; err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "only company owners or admins can update roles"})
		return
	}
	isSuperAdmin := requestUser.Role == "super_admin"
	if !isSuperAdmin {
		membership, err := services.GetUserCompanyMembership(userID, companyID)
		if err != nil {
			c.JSON(http.StatusForbidden, gin.H{"error": "only company owners or admins can update roles"})
			return
		}
		isAdmin := membership.IsOwner
		if membership.Role != nil && membership.Role.Name != nil {
			rn := *membership.Role.Name
			isAdmin = isAdmin || rn == "company_owner" || rn == "company_admin"
		}
		if !isAdmin {
			c.JSON(http.StatusForbidden, gin.H{"error": "only company owners or admins can update roles"})
			return
		}
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
					Permissions: template.Permissions,
					IsActive:    template.IsActive,
					CompanyID:   &companyID,
					CreatedByID: &userID,
				}
				if cErr := db.Create(&newRole).Error; cErr != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create company-scoped role from template"})
					return
				}
				// Copy normalized permission rows from the global template if any
				if err := services.CopyRolePermissions(template.ID, newRole.ID); err != nil {
					log.Printf("warning: failed to copy role_permissions from template %s to new role %s: %v", template.ID.String(), newRole.ID.String(), err)
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

	oldName := ""
	if role.Name != nil {
		oldName = *role.Name
	}

	if req.Name != nil {
		role.Name = req.Name
	}
	if req.Description != nil {
		role.Description = req.Description
	}
	if req.Permissions != nil {
		role.Permissions = permissionsToJSON(req.Permissions)
	}
	if req.IsActive != nil {
		role.IsActive = *req.IsActive
	}

	if err := db.Save(&role).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update role"})
		return
	}

	if req.Name != nil && oldName != *req.Name {
		domain := services.BuildDomainID(role.CompanyID)
		users, _ := services.GetUsersForRole(oldName, domain)
		for _, u := range users {
			_, _ = services.DeleteRoleForUser(u, oldName, domain)
			_, _ = services.AddRoleForUser(u, *role.Name, domain)
		}
		if err := services.RemovePoliciesForRole(oldName, role.CompanyID); err != nil {
			log.Printf("warning: failed to remove old policies for role %s: %v", oldName, err)
		}
	}

	if req.Permissions != nil {
		if err := services.UpsertRolePermissionsFromPermissions(role.ID, req.Permissions); err != nil {
			log.Printf("warning: failed to upsert role_permissions for role %v: %v", role.ID, err)
		}
	}
	if req.Name != nil && oldName != *req.Name {
		if err := services.UpdatePoliciesForRole(role); err != nil {
			log.Printf("warning: failed to update policies for role %v: %v", role.ID, err)
		}
	}

	c.JSON(http.StatusOK, gin.H{"message": "Role updated"})
}

// DeleteCompanyRoleHandler deletes a company-scoped role (owner/admin only)
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

	db, err := config.NewConnection()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database connection failed"})
		return
	}

	var requestUser auth.User
	if err := db.Where("id = ?", userID).First(&requestUser).Error; err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "only company owners or admins can delete roles"})
		return
	}
	isSuperAdmin := requestUser.Role == "super_admin"
	if !isSuperAdmin {
		membership, err := services.GetUserCompanyMembership(userID, companyID)
		if err != nil {
			c.JSON(http.StatusForbidden, gin.H{"error": "only company owners or admins can delete roles"})
			return
		}
		isAdmin := membership.IsOwner
		if membership.Role != nil && membership.Role.Name != nil {
			rn := *membership.Role.Name
			isAdmin = isAdmin || rn == "company_owner" || rn == "company_admin"
		}
		if !isAdmin {
			c.JSON(http.StatusForbidden, gin.H{"error": "only company owners or admins can delete roles"})
			return
		}
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

			var members []companymodels.CompanyMember
			if err := db.Where("company_id = ? AND role_id = ?", companyID, fallback.ID).Find(&members).Error; err == nil {
				domain := services.BuildDomainID(&companyID)
				for _, m := range members {
					userStr := m.UserID.String()
					if role.Name != nil {
						_, _ = services.DeleteRoleForUser(userStr, *role.Name, domain)
					}
					if fallback.Name != nil {
						_, _ = services.AddRoleForUser(userStr, *fallback.Name, domain)
					}
				}
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

	if role.Name != nil {
		if err := services.RemovePoliciesForRole(*role.Name, role.CompanyID); err != nil {
			log.Printf("warning: failed to remove policies for deleted role %s: %v", *role.Name, err)
		}
	}
	// Delete normalized role_permissions rows as part of cleanup
	if err := services.DeleteRolePermissionsByRoleID(role.ID); err != nil {
		log.Printf("warning: failed to delete normalized role_permissions for role %s: %v", role.ID.String(), err)
	}

	c.JSON(http.StatusOK, gin.H{"message": "Role deleted successfully"})
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
		return nil
	}
	jsonBytes, err := json.Marshal(p)
	if err != nil {
		return nil
	}
	d := datatypes.JSON(jsonBytes)
	return &d
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
