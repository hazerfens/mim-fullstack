package routes

import (
	"mimbackend/internal/handlers"

	"github.com/gin-gonic/gin"
)

// SetupOAuthRoutes OAuth ile ilgili route'ları kurar
func SetupOAuthRoutes(router gin.IRouter) {
	oauth := router.Group("/auth")
	{
		oauth.GET("/google", handlers.GoogleOAuthHandler)
		oauth.GET("/facebook", handlers.FacebookOAuthHandler)
		oauth.GET("/github", handlers.GithubOAuthHandler)

		oauth.GET("/google/callback", handlers.GoogleCallbackHandler)
		oauth.GET("/facebook/callback", handlers.FacebookCallbackHandler)
		oauth.GET("/github/callback", handlers.GithubCallbackHandler)
	}
}
