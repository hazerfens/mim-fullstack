package routes

import (
	"mimbackend/internal/handlers"
	"mimbackend/internal/middleware"
	authRoutes "mimbackend/internal/routes/auth"
	"mimbackend/internal/services"
	"net/http"
	"os"

	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	// Generated Swagger docs
	_ "mimbackend/docs"
)

// NewRouter creates and configures the Gin engine with all routes and middleware.
func NewRouter() *gin.Engine {
	gin.SetMode(gin.ReleaseMode)
	r := gin.Default()

	// Global middleware
	r.Use(middleware.CORSMiddleware())

	// Basic routes
	r.GET("/", handlers.HomeHandler)
	r.GET("/health", handlers.HealthHandler)
	r.GET("/user/me", middleware.JWTMiddleware(), func(c *gin.Context) {
		userIDVal, _ := c.Get("user_id")
		userID, ok := userIDVal.(uuid.UUID)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user ID"})
			return
		}

		user, err := services.GetUserByID(userID)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
			return
		}

		c.JSON(200, gin.H{
			"id":          user.ID,
			"email":       user.Email,
			"full_name":   user.FullName,
			"role":        user.Role,
			"image_url":   user.ImageURL,
			"is_verified": user.IsVerified,
		})
	})
	// Swagger docs
	r.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))
	// Keep the short alias `/swg` for backward compatibility and redirects
	r.GET("/swg", func(c *gin.Context) {
		c.Redirect(http.StatusFound, "/swagger/index.html")
	})
	r.GET("/swg/*any", func(c *gin.Context) {
		c.Redirect(http.StatusFound, "/swagger/index.html")
	})

	// Modular route registration (delegated to auth subpackage)
	apiPrefix := "/api/v1"
	if v := os.Getenv("API_PREFIX"); v != "" {
		apiPrefix = v
	}

	apiGroup := r.Group(apiPrefix)
	{
		authRoutes.SetupAuthRoutes(apiGroup)
		authRoutes.SetupOAuthRoutes(apiGroup)
		authRoutes.SetupAPIRoutes(apiGroup)
	}

	// Debug endpoint
	debugGroup := r.Group("/debug")
	{
		debugGroup.GET("/sessions", handlers.DebugSessionsHandler)
	}

	// Backwards-compatible alias: redirect /auth/* to {apiPrefix}/auth/*
	r.Any("/auth/*any", func(c *gin.Context) {
		path := c.Param("any")

		// Handle specific endpoints that need special attention
		if path == "/send-verification" || path == "/resend-verification" || path == "/verify-email" {
			target := apiPrefix + "/auth" + path
			c.Request.URL.Path = target
			r.HandleContext(c)
			return
		}

		// Default handling for other auth endpoints
		target := apiPrefix + "/auth" + path
		c.Request.URL.Path = target
		r.HandleContext(c)
	})

	return r
}
