package system

import (
	"mimbackend/internal/handlers/system"
	"mimbackend/internal/middleware"

	"github.com/gin-gonic/gin"
)

// SetupSystemRoutes sets up all system-related routes
func SetupSystemRoutes(router gin.IRouter) {
	// Public routes
	router.GET("/system/menu", system.GetMenu)
	router.GET("/system/menu-categories", system.GetMenuCategories) // Make menu categories public for display

	// Admin routes - require admin permissions
	adminGroup := router.Group("/admin/system")
	adminGroup.Use(middleware.JWTMiddleware(), middleware.AdminMiddleware())
	{
		// Menu management
		adminGroup.GET("/menus", system.GetAllMenuCategories)
		adminGroup.GET("/menu-categories", system.GetAllMenuCategories)
		adminGroup.POST("/menus", system.CreateMenu)
		adminGroup.PUT("/menus/:id", system.UpdateMenu)
		adminGroup.DELETE("/menus/:id", system.DeleteMenu)

		// Category management
		adminGroup.POST("/menu-categories", system.CreateMenuCategory)
		adminGroup.PUT("/menu-categories/:id", system.UpdateMenuCategory)
		adminGroup.DELETE("/menu-categories/:id", system.DeleteMenuCategory)

		// Item management
		adminGroup.POST("/menu-items", system.CreateMenuItem)
		adminGroup.PUT("/menu-items/:id", system.UpdateMenuItem)
		adminGroup.DELETE("/menu-items/:id", system.DeleteMenuItem)

		// Featured item management
		adminGroup.POST("/menu-featured-items", system.CreateMenuFeaturedItem)
		adminGroup.PUT("/menu-featured-items/:id", system.UpdateMenuFeaturedItem)
		adminGroup.DELETE("/menu-featured-items/:id", system.DeleteMenuFeaturedItem)

		// Order management
		adminGroup.PUT("/menu/order", system.UpdateMenuOrder)

		// Sub-menu management
		adminGroup.POST("/sub-menus", system.CreateSubMenu)
		adminGroup.PUT("/sub-menus/:id", system.UpdateSubMenu)
		adminGroup.DELETE("/sub-menus/:id", system.DeleteSubMenu)
	}
}
