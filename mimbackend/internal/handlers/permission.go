package handlers

import (
	"mimbackend/internal/models/basemodels"
	"mimbackend/internal/services"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// ListPermissions lists the permission catalog (admin)
func ListPermissions(c *gin.Context) {
	all := c.Query("all")
	var perms []basemodels.Permission
	var err error
	if all == "1" {
		perms, err = services.ListAllPermissions()
	} else {
		perms, err = services.ListPermissions()
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list permissions"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"permissions": perms})
}

// CreatePermission creates a new permission catalog entry (admin)
func CreatePermission(c *gin.Context) {
	var req struct {
		Name        string `json:"name" binding:"required"`
		DisplayName string `json:"display_name"`
		Description string `json:"description"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userIDVal, exists := c.Get("user_id")
	var userID *uuid.UUID
	if exists {
		if uid, ok := userIDVal.(uuid.UUID); ok {
			userID = &uid
		}
	}

	p := basemodels.Permission{
		Name:        req.Name,
		DisplayName: &req.DisplayName,
		Description: &req.Description,
		IsActive:    true,
		CreatedByID: userID,
	}
	created, err := services.CreatePermission(p)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create permission"})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"permission": created})
}

// UpdatePermission updates permission metadata (admin)
func UpdatePermission(c *gin.Context) {
	name := c.Param("name")
	var patch map[string]interface{}
	if err := c.ShouldBindJSON(&patch); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	updated, err := services.UpdatePermission(name, patch)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update permission"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"permission": updated})
}

// DeletePermission deletes permission
func DeletePermission(c *gin.Context) {
	name := c.Param("name")
	if err := services.DeletePermission(name); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete permission"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Permission deleted"})
}

// CheckPermissionHandler returns allowed actions for current user on a named permission
func CheckPermissionByNameHandler(c *gin.Context) {
	name := c.Param("name")
	action := c.Query("action") // optional

	userIDVal, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}
	userID, ok := userIDVal.(uuid.UUID)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user id"})
		return
	}

	companyIDStr := c.Query("company_id")
	var companyID *uuid.UUID
	if companyIDStr != "" {
		if cid, err := uuid.Parse(companyIDStr); err == nil {
			companyID = &cid
		}
	}

	allowed, err := services.GetAllowedActionsForUserForPermissionName(userID, name, companyID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to evaluate permission"})
		return
	}
	if action == "" {
		c.JSON(http.StatusOK, gin.H{"allowed": allowed})
		return
	}
	if v, ok := allowed[action]; ok {
		c.JSON(http.StatusOK, gin.H{"allowed": v})
		return
	}
	c.JSON(http.StatusBadRequest, gin.H{"error": "Unknown action"})
}
