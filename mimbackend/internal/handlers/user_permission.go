package handlers

import (
	"log"
	"mimbackend/config"
	models "mimbackend/internal/models/auth"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// GetUserCustomPermissions kullanıcının özel izinlerini getirir
// @Summary Get user custom permissions
// @Description Get custom permissions for a specific user
// @Tags user-permissions
// @Accept json
// @Produce json
// @Param userId path string true "User ID"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} map[string]string
// @Failure 404 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /api/v1/users/{userId}/custom-permissions [get]
func GetUserCustomPermissions(c *gin.Context) {
	userIDStr := c.Param("userId")
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	db, err := config.NewConnection()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database connection failed"})
		return
	}

	// Check if user exists
	var user models.User
	if err := db.Where("id = ?", userID).First(&user).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	// Get custom permissions
	var permissions []models.UserPermission
	if err := db.Where("user_id = ?", userID).Order("resource, action").Find(&permissions).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch permissions"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"user_id":     userID,
		"permissions": permissions,
	})
}

// CreateUserCustomPermission kullanıcıya özel izin ekler
// @Summary Create user custom permission
// @Description Create a custom permission for a specific user
// @Tags user-permissions
// @Accept json
// @Produce json
// @Param userId path string true "User ID"
// @Param permission body models.UserPermission true "Permission data"
// @Success 201 {object} models.UserPermission
// @Failure 400 {object} map[string]string
// @Failure 404 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /api/v1/users/{userId}/custom-permissions [post]
func CreateUserCustomPermission(c *gin.Context) {
	userIDStr := c.Param("userId")
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	db, err := config.NewConnection()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database connection failed"})
		return
	}

	// Check if user exists
	var user models.User
	if err := db.Where("id = ?", userID).First(&user).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	var permission models.UserPermission
	if err := c.ShouldBindJSON(&permission); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Set user ID and generate ID
	permission.ID = uuid.New()
	permission.UserID = userID
	permission.CreatedAt = time.Now()
	permission.UpdatedAt = time.Now()

	// Check for duplicate
	var existing models.UserPermission
	if err := db.Where("user_id = ? AND resource = ? AND action = ?", userID, permission.Resource, permission.Action).First(&existing).Error; err == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Permission already exists for this resource and action"})
		return
	}

	if err := db.Create(&permission).Error; err != nil {
		log.Printf("❌ Error creating user permission: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create permission"})
		return
	}

	log.Printf("✅ Created custom permission for user %s: %s.%s", userID, permission.Resource, permission.Action)
	c.JSON(http.StatusCreated, permission)
}

// UpdateUserCustomPermission kullanıcının özel iznini günceller
// @Summary Update user custom permission
// @Description Update a custom permission for a specific user
// @Tags user-permissions
// @Accept json
// @Produce json
// @Param userId path string true "User ID"
// @Param permissionId path string true "Permission ID"
// @Param permission body models.UserPermission true "Permission data"
// @Success 200 {object} models.UserPermission
// @Failure 400 {object} map[string]string
// @Failure 404 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /api/v1/users/{userId}/custom-permissions/{permissionId} [put]
func UpdateUserCustomPermission(c *gin.Context) {
	userIDStr := c.Param("userId")
	permissionIDStr := c.Param("permissionId")

	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	permissionID, err := uuid.Parse(permissionIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid permission ID"})
		return
	}

	db, err := config.NewConnection()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database connection failed"})
		return
	}

	// Find existing permission
	var permission models.UserPermission
	if err := db.Where("id = ? AND user_id = ?", permissionID, userID).First(&permission).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Permission not found"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch permission"})
		}
		return
	}

	var updateData models.UserPermission
	if err := c.ShouldBindJSON(&updateData); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Update fields
	permission.Resource = updateData.Resource
	permission.Action = updateData.Action
	permission.IsAllowed = updateData.IsAllowed
	permission.TimeRestriction = updateData.TimeRestriction
	permission.Priority = updateData.Priority
	permission.UpdatedAt = time.Now()

	if err := db.Save(&permission).Error; err != nil {
		log.Printf("❌ Error updating user permission: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update permission"})
		return
	}

	log.Printf("✅ Updated custom permission for user %s: %s.%s", userID, permission.Resource, permission.Action)
	c.JSON(http.StatusOK, permission)
}

// DeleteUserCustomPermission kullanıcının özel iznini siler
// @Summary Delete user custom permission
// @Description Delete a custom permission for a specific user
// @Tags user-permissions
// @Accept json
// @Produce json
// @Param userId path string true "User ID"
// @Param permissionId path string true "Permission ID"
// @Success 200 {object} map[string]string
// @Failure 400 {object} map[string]string
// @Failure 404 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /api/v1/users/{userId}/custom-permissions/{permissionId} [delete]
func DeleteUserCustomPermission(c *gin.Context) {
	userIDStr := c.Param("userId")
	permissionIDStr := c.Param("permissionId")

	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	permissionID, err := uuid.Parse(permissionIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid permission ID"})
		return
	}

	db, err := config.NewConnection()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database connection failed"})
		return
	}

	// Find permission
	var permission models.UserPermission
	if err := db.Where("id = ? AND user_id = ?", permissionID, userID).First(&permission).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Permission not found"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch permission"})
		}
		return
	}

	if err := db.Delete(&permission).Error; err != nil {
		log.Printf("❌ Error deleting user permission: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete permission"})
		return
	}

	log.Printf("✅ Deleted custom permission for user %s: %s.%s", userID, permission.Resource, permission.Action)
	c.JSON(http.StatusOK, gin.H{"message": "Permission deleted successfully"})
}
