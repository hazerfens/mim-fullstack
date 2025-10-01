package handlers

import (
	"encoding/json"
	"errors"
	"fmt"
	"mimbackend/config"
	auth "mimbackend/internal/models/auth"
	basemodels "mimbackend/internal/models/basemodels"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// GetRoles tüm role'ları listeler
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

	// JSON string'leri struct'a çevir
	var responseRoles []gin.H
	for _, role := range roles {
		roleData := gin.H{
			"id":          role.ID,
			"name":        role.Name,
			"description": role.Description,
			"is_active":   role.IsActive,
			"created_at":  role.CreatedAt,
		}

		// Permissions'ı parse et, eğer yoksa boş obje ata
		permissions := basemodels.Permissions{}
		if role.Permissions != nil {
			if err := json.Unmarshal([]byte(*role.Permissions), &permissions); err != nil {
				// Parse edilemezse boş permissions kullan
				permissions = basemodels.Permissions{}
			}
		}
		roleData["permissions"] = permissions

		responseRoles = append(responseRoles, roleData)
	}

	c.JSON(http.StatusOK, gin.H{"roles": responseRoles})
}

// GetRole ID ile role getirir
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

	roleData := gin.H{
		"id":          role.ID,
		"name":        role.Name,
		"description": role.Description,
		"is_active":   role.IsActive,
		"created_at":  role.CreatedAt,
	}

	// Permissions'ı parse et, eğer yoksa boş obje ata
	permissions := basemodels.Permissions{}
	if role.Permissions != nil {
		if err := json.Unmarshal([]byte(*role.Permissions), &permissions); err != nil {
			// Parse edilemezse boş permissions kullan
			permissions = basemodels.Permissions{}
		}
	}
	roleData["permissions"] = permissions

	c.JSON(http.StatusOK, roleData)
}

// CreateRole yeni role oluşturur
func CreateRole(c *gin.Context) {
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

	// Aynı isimde role var mı kontrol et
	var existingRole basemodels.Role
	if err := db.Where("name = ?", req.Name).First(&existingRole).Error; err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Role with this name already exists"})
		return
	}

	role := &basemodels.Role{
		Name:        &req.Name,
		Description: &req.Description,
		Permissions: permissionsToJSON(req.Permissions),
		IsActive:    true,
	}

	if err := db.Create(role).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create role"})
		return
	}

	roleData := gin.H{
		"id":          role.ID,
		"name":        role.Name,
		"description": role.Description,
		"is_active":   role.IsActive,
		"created_at":  role.CreatedAt,
	}

	// Permissions'ı parse et, eğer yoksa boş obje ata
	permissions := basemodels.Permissions{}
	if role.Permissions != nil {
		if err := json.Unmarshal([]byte(*role.Permissions), &permissions); err != nil {
			// Parse edilemezse boş permissions kullan
			permissions = basemodels.Permissions{}
		}
	}
	roleData["permissions"] = permissions

	c.JSON(http.StatusCreated, roleData)
}

// UpdateRole role günceller
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

	// Güncellemeleri uygula
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

	roleData := gin.H{
		"id":          role.ID,
		"name":        role.Name,
		"description": role.Description,
		"is_active":   role.IsActive,
		"created_at":  role.CreatedAt,
	}

	// Permissions'ı parse et, eğer yoksa boş obje ata
	permissions := basemodels.Permissions{}
	if role.Permissions != nil {
		if err := json.Unmarshal([]byte(*role.Permissions), &permissions); err != nil {
			// Parse edilemezse boş permissions kullan
			permissions = basemodels.Permissions{}
		}
	}
	roleData["permissions"] = permissions

	c.JSON(http.StatusOK, roleData)
}

// DeleteRole role siler (soft delete)
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

	// Bu role sahip kullanıcı var mı kontrol et
	var userCount int64
	if err := db.Model(&auth.User{}).Where("role_id = ?", roleID).Count(&userCount).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to check role usage"})
		return
	}

	if userCount > 0 {
		c.JSON(http.StatusConflict, gin.H{"error": "Cannot delete role that is assigned to users"})
		return
	}

	// Soft delete - is_active'i false yap
	role.IsActive = false
	if err := db.Save(&role).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete role"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Role deleted successfully"})
}

// AssignRoleToUser kullanıcıya role atar
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

	// Debug log
	fmt.Printf("AssignRoleToUser: userID=%s, roleID=%s\n", userID.String(), req.RoleID.String()) // Database bağlantısı
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

	// Role'ı bul ve doğrula
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

	// Role name'ini al
	if role.Name == nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Role name is nil"})
		return
	}

	// User'ın RoleID'sini güncelle
	user.RoleID = &req.RoleID
	if err := tx.Save(&user).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update user role"})
		return
	}

	// syncUserRole fonksiyonunu çağır
	if err := syncUserRole(tx, &user); err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to sync user role"})
		return
	}

	// syncUserRole sonrası user'ı tekrar kaydet (Role field'i güncellendi)
	if err := tx.Save(&user).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save updated user role"})
		return
	}

	// Transaction'ı commit et
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

// permissionsToJSON converts Permissions struct to JSON string
func permissionsToJSON(p *basemodels.Permissions) *string {
	if p == nil {
		return nil
	}
	jsonBytes, err := json.Marshal(p)
	if err != nil {
		return nil
	}
	jsonStr := string(jsonBytes)
	return &jsonStr
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
