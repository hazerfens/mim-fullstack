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
		// System roles endpoint - require admin-level access (system admin or company admin)
		roleGroup.GET("/system", middleware.AdminMiddleware(), handlers.GetSystemRoles)
		roleGroup.GET("/:roleId", handlers.GetRole)
		roleGroup.POST("", handlers.CreateRole)
		roleGroup.PUT("/:roleId", handlers.UpdateRole)
		roleGroup.DELETE("/:roleId", handlers.DeleteRole)
		roleGroup.POST("/assign", handlers.AssignRoleToUser)
		roleGroup.DELETE("/assign/:userId/:roleId", handlers.RemoveRoleFromUser)

		// System role permission management (admin only)
		roleGroup.GET("/:roleId/permissions", handlers.GetRolePermissions)
		roleGroup.POST("/:roleId/permissions", handlers.CreateRolePermission)
		roleGroup.PATCH("/:roleId/permissions/:permissionId", handlers.UpdateRolePermission)
		roleGroup.PUT("/:roleId/permissions/:permissionId", handlers.UpdateRolePermissionByID)
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
		// aggregated check for many permission names at once (POST body)
		permGroup.POST("/aggregate/check", handlers.AggregatedPermissionCheck)
	}

	// User-specific permission management routes (Casbin-only)
	userPermGroup := router.Group("/users/:userId/permissions")
	userPermGroup.Use(middleware.JWTMiddleware(), middleware.AdminMiddleware())
	{
		userPermGroup.GET("", handlers.GetUserCustomPermissions)
		userPermGroup.POST("", handlers.CreateUserCustomPermission)
		userPermGroup.PUT("/:permissionId", handlers.UpdateUserCustomPermission)
		userPermGroup.DELETE("/:permissionId", handlers.DeleteUserCustomPermission)
	}
}
