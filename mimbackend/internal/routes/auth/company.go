package routes

import (
	"mimbackend/internal/handlers"
	"mimbackend/internal/middleware"

	"github.com/gin-gonic/gin"
)

// SetupCompanyRoutes company ile ilgili route'ları kurar
func SetupCompanyRoutes(router gin.IRouter) {
	// Background export endpoint (auth via cookie or token handled inside handler)
	router.POST("/company/:id/export/background", handlers.RequestExportBackgroundHandler)
	router.GET("/company/export/download", handlers.DownloadExportHandler)

	company := router.Group("/company")
	company.Use(middleware.JWTMiddleware())
	{
		// Root level routes
		company.POST("", handlers.CreateCompanyHandler)
		company.GET("", handlers.GetUserCompaniesHandler)
		company.GET("/active", handlers.GetActiveCompanyHandler)     // Get active company
		company.POST("/switch", handlers.SwitchActiveCompanyHandler) // Switch company

		// Slug-based routes (at the end to avoid conflicts)
		company.GET("/by-slug/:slug", handlers.GetCompanyHandler)
		company.GET("/by-slug/:slug/module/:module", handlers.IsModuleActiveHandler)

		// ID-based routes grouped so we can apply company active-state enforcement
		idGroup := company.Group(":id")
		idGroup.Use(middleware.CompanyActiveMiddleware())
		{
			idGroup.PUT("", handlers.UpdateCompanyHandler)
			idGroup.DELETE("", handlers.DeleteCompanyHandler)
			idGroup.DELETE("/permanent", handlers.DeleteCompanyPermanentHandler)

			// Invitation routes (ID-based)
			idGroup.POST("/invitations", handlers.CreateCompanyInvitationHandler)
			idGroup.GET("/invitations", handlers.GetCompanyInvitationsHandler)
			idGroup.DELETE("/invitations/:invitationId", handlers.CancelInvitationHandler)

			// Member routes (ID-based)
			idGroup.GET("/members", handlers.GetCompanyMembersHandler)
			idGroup.DELETE("/members/:memberId", handlers.RemoveMemberHandler)
			idGroup.PUT("/members/:memberId/role", handlers.UpdateMemberRoleHandler)

			// Company-scoped role management (owner/admin)
			idGroup.POST("/roles", handlers.CreateCompanyRoleHandler)
			idGroup.PUT("/roles/:roleId", handlers.UpdateCompanyRoleHandler)
			idGroup.DELETE("/roles/:roleId", handlers.DeleteCompanyRoleHandler)
		}
	}

	// Invitation routes (public with auth)
	invitations := router.Group("/invitations")
	invitations.Use(middleware.JWTMiddleware())
	{
		invitations.GET("/me", handlers.GetUserInvitationsHandler)
		invitations.GET("/:token", handlers.GetInvitationHandler)
		invitations.POST("/:token/accept", handlers.AcceptInvitationHandler)
		invitations.POST("/:token/reject", handlers.RejectInvitationHandler)
	}

	// Admin routes
	admin := router.Group("/admin")
	admin.Use(middleware.JWTMiddleware())
	{
		admin.GET("/companies", handlers.GetActiveCompaniesHandler)
		admin.PUT("/company/:id/modules", handlers.UpdateCompanyModulesHandler)
	}
}
