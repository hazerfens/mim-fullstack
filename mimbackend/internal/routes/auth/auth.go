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
}
