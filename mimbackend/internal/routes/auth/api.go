package routes

import (
	"mimbackend/config"
	"mimbackend/internal/handlers"
	"mimbackend/internal/middleware"
	auth "mimbackend/internal/models/auth"
	"strings"

	"github.com/gin-gonic/gin"
)

// SetupAPIRoutes API ile ilgili protected route'ları kurar
func SetupAPIRoutes(router gin.IRouter) {
	api := router.Group("/api")
	api.Use(middleware.JWTMiddleware())
	{
		api.GET("/profile", profileHandler)
	}

	// User management routes - require admin permissions
	userGroup := router.Group("/users")
	userGroup.Use(middleware.JWTMiddleware(), middleware.AdminMiddleware())
	{
		userGroup.GET("", getUsersHandler)
		userGroup.GET("/:userId/permissions", handlers.GetUserPermissionsHandler)

		// User custom permissions management
		userGroup.GET("/:userId/custom-permissions", handlers.GetUserCustomPermissions)
		userGroup.POST("/:userId/custom-permissions", handlers.CreateUserCustomPermission)
		userGroup.PUT("/:userId/custom-permissions/:permissionId", handlers.UpdateUserCustomPermission)
		userGroup.DELETE("/:userId/custom-permissions/:permissionId", handlers.DeleteUserCustomPermission)
	}
}

// getUsersHandler tüm kullanıcıları listeler (admin için)
func getUsersHandler(c *gin.Context) {
	db, err := config.NewConnection()
	if err != nil {
		c.JSON(500, gin.H{"error": "Database connection failed"})
		return
	}

	var users []auth.User
	if err := db.Preload("RoleModel").Find(&users).Error; err != nil {
		c.JSON(500, gin.H{"error": "Failed to fetch users"})
		return
	}

	var userList []gin.H
	for _, user := range users {
		// FullName'i first_name ve last_name olarak ayır (varsayılan olarak)
		firstName := ""
		lastName := ""
		if user.FullName != nil {
			parts := strings.Split(*user.FullName, " ")
			if len(parts) > 0 {
				firstName = parts[0]
			}
			if len(parts) > 1 {
				lastName = strings.Join(parts[1:], " ")
			}
		}

		userData := gin.H{
			"id":         user.ID,
			"email":      user.Email,
			"first_name": firstName,
			"last_name":  lastName,
			"is_active":  true, // User modelinde IsActive yok, varsayılan true
			"created_at": user.CreatedAt,
		}

		// Image URL'yi ekle
		if user.ImageURL != nil {
			userData["image_url"] = *user.ImageURL
		}

		// Role bilgilerini ekle
		if user.RoleID != nil && user.RoleModel.Name != nil {
			userData["role_id"] = user.RoleID
			userData["role_name"] = user.RoleModel.Name
		}

		userList = append(userList, userData)
	}

	c.JSON(200, gin.H{"users": userList})
}

// profileHandler kullanıcının profil bilgilerini döndürür
func profileHandler(c *gin.Context) {
	userID, _ := c.Get("user_id")
	userEmail, _ := c.Get("user_email")
	userRole, _ := c.Get("user_role")

	c.JSON(200, gin.H{
		"user_id": userID,
		"email":   userEmail,
		"role":    userRole,
	})
}
