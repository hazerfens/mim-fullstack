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

	// ABAC Admin routes - require system admin permissions
	admin := router.Group("/admin")
	admin.Use(middleware.JWTMiddleware(), middleware.SystemABACMiddleware("admin", "access"))
	{
		admin.POST("/policies", handlers.AddPolicyHandler)
		admin.DELETE("/policies", handlers.RemovePolicyHandler)
		admin.POST("/roles", handlers.AddRoleForUserHandler)
		admin.DELETE("/roles", handlers.DeleteRoleForUserHandler)
		admin.GET("/roles", handlers.GetRolesForUserHandler)
		admin.GET("/users", handlers.GetUsersForRoleHandler)
		admin.GET("/policies", handlers.GetAllPoliciesHandler)
		admin.POST("/check-permission", handlers.CheckPermissionHandler)
	}

	// Role management routes - require admin permissions
	roleGroup := router.Group("/roles")
	roleGroup.Use(middleware.JWTMiddleware(), middleware.AdminMiddleware())
	{
		roleGroup.GET("", handlers.GetRoles)
		roleGroup.GET("/:id", handlers.GetRole)
		roleGroup.POST("", handlers.CreateRole)
		roleGroup.PUT("/:id", handlers.UpdateRole)
		roleGroup.DELETE("/:id", handlers.DeleteRole)
		roleGroup.POST("/assign", handlers.AssignRoleToUser)
		roleGroup.POST("/:userId/assign-role", handlers.AssignRoleToUser)
		roleGroup.DELETE("/assign/:userId/:roleId", handlers.RemoveRoleFromUser)
	}
}
