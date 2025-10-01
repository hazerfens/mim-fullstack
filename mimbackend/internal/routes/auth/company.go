package routes

import (
	"mimbackend/internal/handlers"
	"mimbackend/internal/middleware"

	"github.com/gin-gonic/gin"
)

// SetupCompanyRoutes company ile ilgili route'ları kurar
func SetupCompanyRoutes(router gin.IRouter) {
	company := router.Group("/company")
	company.Use(middleware.JWTMiddleware())
	{
		company.POST("", handlers.CreateCompanyHandler)
		company.GET("", handlers.GetUserCompaniesHandler)
		company.GET("/active", handlers.GetActiveCompanyHandler)     // Get active company
		company.POST("/switch", handlers.SwitchActiveCompanyHandler) // Switch company
		company.GET("/:slug", handlers.GetCompanyHandler)
		company.PUT("/:id", handlers.UpdateCompanyHandler)
		company.DELETE("/:id", handlers.DeleteCompanyHandler)
		company.GET("/:slug/module/:module", handlers.IsModuleActiveHandler)
	}

	// Admin routes
	admin := router.Group("/admin")
	admin.Use(middleware.JWTMiddleware())
	{
		admin.GET("/companies", handlers.GetActiveCompaniesHandler)
		admin.PUT("/company/:id/modules", handlers.UpdateCompanyModulesHandler)
	}
}
