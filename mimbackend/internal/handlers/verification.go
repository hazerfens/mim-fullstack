package handlers

import (
	"mimbackend/internal/services"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

type SendVerificationRequest struct {
	Email string `json:"email" binding:"required,email"`
}

type VerifyEmailRequest struct {
	Email string `json:"email" binding:"required,email"`
	Code  string `json:"code" binding:"required,len=6"`
}

// SendVerificationCode gönderir
// @Summary Send verification code
// @Tags Auth
// @Accept json
// @Produce json
// @Param payload body SendVerificationRequest true "Send verification payload"
// @Success 200 {object} map[string]string
// @Failure 400 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /auth/send-verification [post]
func SendVerificationCode(c *gin.Context) {
	var req SendVerificationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid payload"})
		return
	}

	code, err := services.CreateVerificationToken(req.Email, 10*time.Minute)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not create token"})
		return
	}

	emailService := services.NewEmailService()
	userName := "Kullanıcı" // TODO: Get from user database if available
	if err := emailService.SendVerificationEmail(req.Email, userName, code); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not send email"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "verification sent"})
}

// ResendVerificationCode yeniden kod gönderir (varsa mevcut kodu kullanır)
// @Summary Resend verification code
// @Tags Auth
// @Accept json
// @Produce json
// @Param payload body SendVerificationRequest true "Resend payload"
// @Success 200 {object} map[string]string
// @Failure 400 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /auth/resend-verification [post]
func ResendVerificationCode(c *gin.Context) {
	var req SendVerificationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid payload"})
		return
	}

	code, err := services.GetOrCreateVerificationToken(req.Email, 10*time.Minute)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not create token"})
		return
	}

	emailService := services.NewEmailService()
	userName := "Kullanıcı" // TODO: Get from user database if available
	if err := emailService.SendVerificationEmail(req.Email, userName, code); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not send email"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "verification resent"})
}

// VerifyEmail doğrular
// @Summary Verify verification code
// @Tags Auth
// @Accept json
// @Produce json
// @Param payload body VerifyEmailRequest true "Verify payload"
// @Success 200 {object} map[string]string
// @Failure 400 {object} map[string]interface{}
// @Failure 401 {object} map[string]interface{}
// @Router /auth/verify-email [post]
func VerifyEmail(c *gin.Context) {
	var req VerifyEmailRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid payload"})
		return
	}

	ok, err := services.VerifyVerificationToken(req.Email, req.Code)
	if err != nil || !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid or expired code"})
		return
	}

	// Update user's verified status
	if err := services.UpdateUserVerifiedStatus(req.Email, true); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not update user verification status"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "email verified successfully"})
}
