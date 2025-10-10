package routes

import (
	"mimbackend/internal/handlers"
	"mimbackend/internal/middleware"

	"github.com/gin-gonic/gin"
)

// SetupAuthRoutes auth ile ilgili route'ları kurar
func SetupAuthRoutes(router gin.IRouter) {
	auth := router.Group("/auth")
	{
		auth.POST("/register", handlers.RegisterHandler)
		auth.POST("/login", handlers.LoginHandler)
		auth.POST("/refresh", handlers.RefreshHandler)
		auth.POST("/logout", handlers.LogoutHandler)
		auth.POST("/logout-all", middleware.JWTMiddleware(), handlers.LogoutAllHandler)
		auth.POST("/send-verification", handlers.SendVerificationCode)
		auth.POST("/verify-email", handlers.VerifyEmail)
		auth.POST("/resend-verification", handlers.ResendVerificationCode)
		auth.POST("/forgot-password", handlers.ForgotPasswordHandler)
		auth.POST("/resend-password", handlers.ResendPasswordHandler)
		auth.POST("/reset-password", handlers.ResetPasswordHandler)
	}

	// Casbin admin endpoints removed: policy management is no longer exposed.

	// Role management routes - require admin permissions
	roleGroup := router.Group("/roles")
	roleGroup.Use(middleware.JWTMiddleware(), middleware.AdminMiddleware())
	{
		roleGroup.GET("", handlers.GetRoles)
		// System roles endpoint - only super_admin allowed
		roleGroup.GET("/system", middleware.RoleBasedMiddleware("super_admin"), handlers.GetSystemRoles)
		roleGroup.GET("/:id", handlers.GetRole)
		roleGroup.POST("", handlers.CreateRole)
		roleGroup.PUT("/:id", handlers.UpdateRole)
		roleGroup.DELETE("/:id", handlers.DeleteRole)
		roleGroup.POST("/assign", handlers.AssignRoleToUser)
		roleGroup.POST("/:userId/assign-role", handlers.AssignRoleToUser)
		roleGroup.DELETE("/assign/:userId/:roleId", handlers.RemoveRoleFromUser)
	}

	// Permission catalog routes - admin-managed; check endpoint available to authenticated users
	permGroup := router.Group("/permissions")
	permGroup.Use(middleware.JWTMiddleware())
	{
		// management routes require admin
		permGroup.GET("", middleware.AdminMiddleware(), handlers.ListPermissions)
		permGroup.POST("", middleware.AdminMiddleware(), handlers.CreatePermission)
		permGroup.PUT(":name", middleware.AdminMiddleware(), handlers.UpdatePermission)
		permGroup.DELETE(":name", middleware.AdminMiddleware(), handlers.DeletePermission)

		// check permission for current user (or other user if admin)
		permGroup.GET(":name/check", handlers.CheckPermissionByNameHandler)
	}
}
