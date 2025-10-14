package handlers

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"

	"mimbackend/config"
	basemodels "mimbackend/internal/models/basemodels"
	"mimbackend/internal/services"
)

// ListPermissions lists the permission catalog (admin)
// Supports optional ?all=1 to return inactive permissions as well.
func ListPermissions(c *gin.Context) {
	db, err := config.NewConnection()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database connection failed"})
		return
	}

	all := c.Query("all") == "1"
	var perms []basemodels.Permission
	if all {
		if err := db.Find(&perms).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch permissions"})
			return
		}
	} else {
		if err := db.Where("is_active = ?", true).Find(&perms).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch permissions"})
			return
		}
	}

	out := make([]gin.H, 0, len(perms))
	for _, p := range perms {
		out = append(out, gin.H{
			"name":          p.Name,
			"display_name":  p.DisplayName,
			"description":   p.Description,
			"is_active":     p.IsActive,
			"created_by_id": p.CreatedByID,
		})
	}

	c.JSON(http.StatusOK, gin.H{"permissions": out})
}

// CreatePermission creates a new permission catalog entry (admin)
func CreatePermission(c *gin.Context) {
	var req struct {
		Name        string  `json:"name" binding:"required"`
		DisplayName *string `json:"display_name"`
		Description *string `json:"description"`
		IsActive    *bool   `json:"is_active"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Basic normalization
	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Permission name cannot be empty"})
		return
	}

	db, err := config.NewConnection()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database connection failed"})
		return
	}

	// Duplicate check
	var existing basemodels.Permission
	if err := db.Where("name = ?", req.Name).First(&existing).Error; err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Permission with this name already exists"})
		return
	} else if err == gorm.ErrRecordNotFound {
		// no existing record, safe to continue
	} else {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to check existing permissions"})
		return
	}

	// Attach creating user if present
	var createdBy *uuid.UUID
	if uVal, ok := c.Get("user_id"); ok {
		if u, ok := uVal.(uuid.UUID); ok {
			createdBy = &u
		}
	}

	perm := basemodels.Permission{
		Name:        req.Name,
		DisplayName: req.DisplayName,
		Description: req.Description,
		IsActive:    true,
		CreatedByID: createdBy,
	}
	if req.IsActive != nil {
		perm.IsActive = *req.IsActive
	}

	if err := db.Create(&perm).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create permission"})
		return
	}

	// Ensure any Casbin-related cleanup/initialization for the resource is performed
	// (no-op for now, kept for future compatibility).
	_, _ = services.CreatePermission(map[string]interface{}{"name": perm.Name, "display_name": perm.DisplayName, "description": perm.Description})

	c.JSON(http.StatusCreated, gin.H{"permission": gin.H{"name": perm.Name, "display_name": perm.DisplayName, "description": perm.Description, "is_active": perm.IsActive}})
}

// UpdatePermission updates permission metadata (admin)
func UpdatePermission(c *gin.Context) {
	name := c.Param("name")
	var req struct {
		DisplayName *string `json:"display_name"`
		Description *string `json:"description"`
		IsActive    *bool   `json:"is_active"`
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

	var perm basemodels.Permission
	if err := db.Where("name = ?", name).First(&perm).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Permission not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch permission"})
		return
	}

	if req.DisplayName != nil {
		perm.DisplayName = req.DisplayName
	}
	if req.Description != nil {
		perm.Description = req.Description
	}
	if req.IsActive != nil {
		perm.IsActive = *req.IsActive
	}

	if err := db.Save(&perm).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update permission"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"permission": gin.H{"name": perm.Name, "display_name": perm.DisplayName, "description": perm.Description, "is_active": perm.IsActive}})
}

// DeletePermission deletes (soft-delete) permission and removes any Casbin policies for it
func DeletePermission(c *gin.Context) {
	name := c.Param("name")

	db, err := config.NewConnection()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database connection failed"})
		return
	}

	var perm basemodels.Permission
	if err := db.Where("name = ?", name).First(&perm).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Permission not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch permission"})
		return
	}

	// Remove policies that reference this permission resource in Casbin
	if err := services.DeletePermission(perm.Name); err != nil {
		// Log and continue — we still mark permission inactive in DB to avoid exposing it
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to remove Casbin policies for permission"})
		return
	}

	perm.IsActive = false
	if err := db.Save(&perm).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to mark permission as inactive"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Permission deleted (soft) successfully"})
}

// CheckPermissionByNameHandler returns allowed actions for current user on a named permission
// For backward compatibility still returns allowed actions (delegates to ABAC service)
func CheckPermissionByNameHandler(c *gin.Context) {
	name := c.Param("name")
	// Optional action query
	action := c.Query("action")

	// If no user in context, return unauthorized
	userIDVal, ok := c.Get("user_id")
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}
	userID, ok := userIDVal.(uuid.UUID)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user id"})
		return
	}

	if action == "" {
		// Return all common actions
		actions := map[string]bool{"create": true, "read": true, "update": true, "delete": true}
		c.JSON(http.StatusOK, gin.H{"allowed": actions})
		return
	}

	if action != "create" && action != "read" && action != "update" && action != "delete" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Unknown action"})
		return
	}

	// For now, delegate to service helper which checks using Casbin
	allowedMap, err := services.GetAllowedActionsForUserForPermissionName(userID, name, nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to check permission"})
		return
	}

	if action != "" {
		c.JSON(http.StatusOK, gin.H{"allowed": allowedMap[action]})
		return
	}
}

// AggregatedPermissionCheck accepts a POST with { user_id, names: [string], company_id? }
// Returns allowed actions for each requested permission name
func AggregatedPermissionCheck(c *gin.Context) {
	var req struct {
		UserID    string   `json:"user_id"`
		Names     []string `json:"names"`
		CompanyID *string  `json:"company_id"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var userID uuid.UUID
	var err error
	if req.UserID != "" {
		userID, err = uuid.Parse(req.UserID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user_id"})
			return
		}
	} else {
		c.JSON(http.StatusBadRequest, gin.H{"error": "user_id is required"})
		return
	}

	out := map[string]map[string]bool{}
	for _, name := range req.Names {
		allowed, err := services.GetAllowedActionsForUserForPermissionName(userID, name, nil)
		if err != nil {
			out[name] = map[string]bool{"create": false, "read": false, "update": false, "delete": false}
			continue
		}
		out[name] = allowed
	}

	c.JSON(http.StatusOK, gin.H{"allowed": out})
}
