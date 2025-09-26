package handlers

import (
	"net/http"
	"strings"

	auth "mimbackend/internal/models/auth"
	"mimbackend/internal/services"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// capitalizeFirst capitalizes the first rune of the given string for user-facing messages.
func capitalizeFirst(s string) string {
	if s == "" {
		return s
	}
	r := []rune(s)
	r[0] = rune(strings.ToUpper(string(r[0]))[0])
	return string(r)
}

type PasswordResetHandler struct {
	db           *gorm.DB
	emailService *services.EmailService
}

func NewPasswordResetHandler(db *gorm.DB, emailService *services.EmailService) *PasswordResetHandler {
	return &PasswordResetHandler{
		db:           db,
		emailService: emailService,
	}
}

// ForgotPasswordRequest represents the request payload for forgot password
type ForgotPasswordRequest struct {
	Email string `json:"email" binding:"required,email"`
}

// ResetPasswordRequest represents the request payload for reset password
type ResetPasswordRequest struct {
	Token    string `json:"token" binding:"required"`
	Password string `json:"password" binding:"required,min=6"`
}

// ForgotPassword handles POST /auth/forgot-password
// @Summary Send password reset email
// @Description Send password reset email to user
// @Tags Auth
// @Accept json
// @Produce json
// @Param payload body ForgotPasswordRequest true "Forgot password payload"
// @Success 200 {object} map[string]string
// @Failure 400 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /auth/forgot-password [post]
func (h *PasswordResetHandler) ForgotPassword(c *gin.Context) {
	var req ForgotPasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Geçersiz email formatı"})
		return
	}

	// Find user by email
	var user auth.User
	if err := h.db.Where("email = ?", strings.ToLower(req.Email)).First(&user).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			// Don't reveal if email exists or not for security
			c.JSON(http.StatusOK, gin.H{"message": "Şifre sıfırlama bağlantısı email adresinize gönderildi"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Veritabanı hatası"})
		return
	}

	// Send password reset email
	if err := services.SendPasswordResetEmail(strings.ToLower(req.Email)); err != nil {
		// keep log-level/internal errors lowercase in services, but send user-facing message capitalized
		c.JSON(http.StatusInternalServerError, gin.H{"error": capitalizeFirst(err.Error())})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Şifre sıfırlama bağlantısı email adresinize gönderildi"})
}

// ResetPassword handles POST /auth/reset-password
// @Summary Reset user password
// @Description Reset user password using reset token
// @Tags Auth
// @Accept json
// @Produce json
// @Param payload body ResetPasswordRequest true "Reset password payload"
// @Success 200 {object} map[string]string
// @Failure 400 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /auth/reset-password [post]
func (h *PasswordResetHandler) ResetPassword(c *gin.Context) {
	var req ResetPasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Geçersiz istek formatı"})
		return
	}

	// Validate token and reset password
	if err := services.ResetPassword(req.Token, req.Password); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": capitalizeFirst(err.Error())})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Şifreniz başarıyla güncellendi"})
}

// ForgotPasswordHandler is the exported handler function for forgot password
// @Summary Send password reset email
// @Description Send password reset email to user
// @Tags Auth
// @Accept json
// @Produce json
// @Param payload body ForgotPasswordRequest true "Forgot password payload"
// @Success 200 {object} map[string]string
// @Failure 400 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /auth/forgot-password [post]
func ForgotPasswordHandler(c *gin.Context) {
	// This would need to be initialized with proper dependencies
	// For now, we'll create a simple implementation
	var req ForgotPasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Geçersiz email formatı"})
		return
	}

	// Send password reset email
	if err := services.SendPasswordResetEmail(strings.ToLower(req.Email)); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": capitalizeFirst(err.Error())})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Şifre sıfırlama bağlantısı email adresinize gönderildi"})
}

// ResetPasswordHandler is the exported handler function for reset password
// @Summary Reset user password
// @Description Reset user password using reset token
// @Tags Auth
// @Accept json
// @Produce json
// @Param payload body ResetPasswordRequest true "Reset password payload"
// @Success 200 {object} map[string]string
// @Failure 400 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /auth/reset-password [post]
func ResetPasswordHandler(c *gin.Context) {
	// Accept two shapes for compatibility with some frontends:
	// 1) { "email": "..." } => treat as forgot-password / resend
	// 2) { "token": "...", "password": "..." } => perform reset

	var payload map[string]interface{}
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Geçersiz istek formatı"})
		return
	}

	// If email is present, trigger resend
	if em, ok := payload["email"]; ok {
		if emailStr, ok := em.(string); ok && emailStr != "" {
			// Check if user exists first
			if _, err := services.GetUserByEmail(strings.ToLower(emailStr)); err != nil {
				// Return explicit message when email not registered
				c.JSON(http.StatusBadRequest, gin.H{"error": "Email kayıtlı değil"})
				return
			}

			if err := services.SendPasswordResetEmail(strings.ToLower(emailStr)); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Email gönderme hatası"})
				return
			}
			c.JSON(http.StatusOK, gin.H{"message": "Şifre sıfırlama bağlantısı email adresinize gönderildi"})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": "Geçersiz email"})
		return
	}

	// Otherwise expect token + password
	t, tokOK := payload["token"]
	p, passOK := payload["password"]
	// also accept "new_password" for some clients
	if !passOK {
		p, passOK = payload["new_password"]
	}

	if !tokOK || !passOK {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Eksik token veya password"})
		return
	}

	tokenStr, _ := t.(string)
	passStr, _ := p.(string)
	if tokenStr == "" || passStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Geçersiz token veya password"})
		return
	}

	if err := services.ResetPassword(tokenStr, passStr); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Şifreniz başarıyla güncellendi"})
}

// ResendPasswordHandler re-sends a password reset email to the given address
// @Summary Resend password reset email
// @Description Re-send password reset email if a previous link/ticket expired
// @Tags Auth
// @Accept json
// @Produce json
// @Param payload body ForgotPasswordRequest true "Forgot password payload"
// @Success 200 {object} map[string]string
// @Failure 400 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /auth/resend-password [post]
func ResendPasswordHandler(c *gin.Context) {
	var req ForgotPasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Geçersiz email formatı"})
		return
	}

	// Check if user exists
	if _, err := services.GetUserByEmail(strings.ToLower(req.Email)); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Email kayıtlı değil"})
		return
	}

	// Send password reset email
	if err := services.SendPasswordResetEmail(strings.ToLower(req.Email)); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Email gönderme hatası"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Şifre sıfırlama bağlantısı email adresinize gönderildi"})
}
