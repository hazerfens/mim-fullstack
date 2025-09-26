package routes

import (
	"mimbackend/internal/middleware"

	"github.com/gin-gonic/gin"
)

// SetupAPIRoutes API ile ilgili protected route'ları kurar
func SetupAPIRoutes(router gin.IRouter) {
	api := router.Group("/api")
	api.Use(middleware.JWTMiddleware())
	{
		api.GET("/profile", profileHandler)
	}
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
