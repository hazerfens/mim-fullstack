package handlers

import (
	"fmt"
	auth "mimbackend/internal/models/auth"
	"mimbackend/internal/services"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type RegisterRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=6"`
	FullName string `json:"full_name"`
}

type LoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

type RefreshRequest struct {
	RefreshToken string `json:"refresh_token" binding:"required"`
}

type LogoutRequest struct {
	RefreshToken string `json:"refresh_token" binding:"required"`
}

type AuthResponse struct {
	AccessToken  string       `json:"access_token"`
	RefreshToken string       `json:"refresh_token"`
	User         UserResponse `json:"user"`
	Message      string       `json:"message,omitempty"`
}

type UserResponse struct {
	ID         uuid.UUID `json:"id"`
	Email      string    `json:"email"`
	FullName   *string   `json:"full_name"`
	Role       string    `json:"role"`
	IsVerified bool      `json:"is_verified"`
}

// RegisterHandler kullanıcı kayıt işlemi
// @Summary Register a new user
// @Description Create a new user account with email and password
// @Tags Auth
// @Accept json
// @Produce json
// @Param payload body RegisterRequest true "Register payload"
// @Success 201 {object} AuthResponse
// @Failure 400 {object} map[string]interface{}
// @Failure 409 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /auth/register [post]
func RegisterHandler(c *gin.Context) {
	var req RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Geçersiz istek verisi",
			"details": err.Error(),
		})
		return
	}

	// Kullanıcı oluştur (sadece email ve role)
	user := &auth.User{
		Email:    req.Email,
		FullName: &req.FullName,
		Role:     "user",
	}

	// Şifreyi hashle
	hashedPassword, err := services.HashPassword(req.Password)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Şifre hashlenirken hata oluştu",
		})
		return
	}
	user.PasswordHash = hashedPassword

	// Kullanıcıyı kaydet
	if err := services.CreateUser(user); err != nil {
		c.JSON(http.StatusConflict, gin.H{
			"error": "Kullanıcı zaten mevcut veya kayıt edilemedi",
		})
		return
	}

	// Send verification email
	code, err := services.CreateVerificationToken(user.Email, 24*time.Hour)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create verification token"})
		return
	}

	emailSvc := services.NewEmailService()
	userName := ""
	if user.FullName != nil && *user.FullName != "" {
		userName = *user.FullName
	}
	if userName == "" {
		userName = user.Email
	}
	if err := emailSvc.SendVerificationEmail(user.Email, userName, code); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to send verification email"})
		return
	}

	// Tokens oluştur (access + refresh)
	accessTok, refreshTok, err := services.GenerateTokens(user.ID, user.Email, user.Role)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Token oluşturulamadı",
		})
		return
	}

	response := AuthResponse{
		AccessToken:  accessTok,
		RefreshToken: refreshTok,
		User: UserResponse{
			Email:      user.Email,
			FullName:   user.FullName,
			Role:       user.Role,
			IsVerified: user.IsVerified,
		},
		Message: "Registration successful. Please check your email for verification code.",
	}

	// Create session record for refresh token
	refreshExp := time.Now().Add(30 * 24 * time.Hour)
	if err := services.CreateSession(user.ID, refreshTok, refreshExp); err != nil {
		// log but don't fail the registration
		fmt.Printf("CreateSession error (register): %v\n", err)
	}

	// Create a local account entry for this user
	if err := services.CreateAccount(user.ID, "local", user.ID.String(), "", refreshTok, refreshExp.Unix()); err != nil {
		fmt.Printf("CreateAccount error (register): %v\n", err)
	}

	// Set cookies for browser
	http.SetCookie(c.Writer, &http.Cookie{
		Name:     "access_token",
		Value:    response.AccessToken,
		Path:     "/",
		HttpOnly: false,
		Secure:   false,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   3600,
	})
	http.SetCookie(c.Writer, &http.Cookie{
		Name:     "refresh_token",
		Value:    response.RefreshToken,
		Path:     "/",
		HttpOnly: false,
		Secure:   false,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   30 * 24 * 3600,
	})

	c.JSON(http.StatusCreated, response)
}

// LoginHandler kullanıcı giriş işlemi
// @Summary Login user
// @Description Authenticate user and return access token
// @Tags Auth
// @Accept json
// @Produce json
// @Param payload body LoginRequest true "Login payload"
// @Success 200 {object} AuthResponse
// @Failure 400 {object} map[string]interface{}
// @Failure 401 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /auth/login [post]
func LoginHandler(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Geçersiz istek verisi",
			"details": err.Error(),
		})
		return
	}

	// Kullanıcıyı email ile bul
	user, err := services.GetUserByEmail(req.Email)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "Geçersiz email veya şifre",
		})
		return
	}

	// Şifreyi doğrula
	if !services.CheckPassword(req.Password, user.PasswordHash) {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "Geçersiz email veya şifre",
		})
		return
	}

	// Tokens oluştur (access + refresh)
	accessTok, refreshTok, err := services.GenerateTokens(user.ID, user.Email, user.Role)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Token oluşturulamadı",
		})
		return
	}

	response := AuthResponse{
		AccessToken:  accessTok,
		RefreshToken: refreshTok,
		User: UserResponse{
			ID:         user.ID,
			Email:      user.Email,
			FullName:   user.FullName,
			Role:       user.Role,
			IsVerified: user.IsVerified,
		},
	}

	// Create session record for refresh token
	refreshExp := time.Now().Add(30 * 24 * time.Hour)
	if err := services.CreateSession(user.ID, refreshTok, refreshExp); err != nil {
		fmt.Printf("CreateSession error (login): %v\n", err)
	}

	// Ensure local account exists (upsert handled by service)
	if err := services.CreateAccount(user.ID, "local", user.ID.String(), "", refreshTok, refreshExp.Unix()); err != nil {
		fmt.Printf("CreateAccount error (login): %v\n", err)
	}

	http.SetCookie(c.Writer, &http.Cookie{
		Name:     "access_token",
		Value:    response.AccessToken,
		Path:     "/",
		HttpOnly: false,
		Secure:   false,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   3600,
	})
	http.SetCookie(c.Writer, &http.Cookie{
		Name:     "refresh_token",
		Value:    response.RefreshToken,
		Path:     "/",
		HttpOnly: false,
		Secure:   false,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   30 * 24 * 3600,
	})

	c.JSON(http.StatusOK, response)
}

// RefreshHandler exchanges a refresh token for new tokens
// @Summary Refresh tokens
// @Description Exchange refresh token for new access and refresh tokens
// @Tags Auth
// @Accept json
// @Produce json
// @Param payload body RefreshRequest true "Refresh payload"
// @Success 200 {object} map[string]string
// @Failure 400 {object} map[string]interface{}
// @Failure 401 {object} map[string]interface{}
// @Router /auth/refresh [post]
func RefreshHandler(c *gin.Context) {
	var req RefreshRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid payload"})
		return
	}
	// diagnostic log: show incoming refresh token length to help debug issues
	tokenToUse := req.RefreshToken
	if tokenToUse == "" {
		// try cookie fallback
		cookieVal, cookieErr := c.Cookie("refresh_token")
		if cookieErr == nil && cookieVal != "" {
			tokenToUse = cookieVal
			fmt.Printf("RefreshHandler: using refresh token from cookie length=%d\n", len(tokenToUse))
		} else {
			fmt.Printf("RefreshHandler: no refresh token provided in request body or cookie\n")
		}
	} else {
		fmt.Printf("RefreshHandler: received refresh token length=%d\n", len(tokenToUse))
	}

	accessTok, refreshTok, err := services.RefreshTokens(tokenToUse)
	if err != nil {
		// log error for debugging
		fmt.Printf("RefreshHandler: services.RefreshTokens error: %v\n", err)
		// clear cookies on invalid/expired refresh token so client state is cleaned
		http.SetCookie(c.Writer, &http.Cookie{Name: "access_token", Value: "", Path: "/", Expires: time.Unix(0, 0)})
		http.SetCookie(c.Writer, &http.Cookie{Name: "refresh_token", Value: "", Path: "/", Expires: time.Unix(0, 0)})

		c.JSON(http.StatusUnauthorized, gin.H{"error": "refresh_token_invalid_or_expired", "message": "Refresh token expired or invalid. Please login again."})
		return
	}
	// set refreshed tokens as HttpOnly cookies (safer) and return JSON
	secure := false
	if os.Getenv("ENV") == "production" || os.Getenv("NODE_ENV") == "production" {
		secure = true
	}

	http.SetCookie(c.Writer, &http.Cookie{
		Name:     "access_token",
		Value:    accessTok,
		Path:     "/",
		HttpOnly: false, // Frontend'in erişebilmesi için false yapıyoruz
		Secure:   secure,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   3600,
	})
	http.SetCookie(c.Writer, &http.Cookie{
		Name:     "refresh_token",
		Value:    refreshTok,
		Path:     "/",
		HttpOnly: false, // Frontend'in erişebilmesi için false yapıyoruz
		Secure:   secure,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   30 * 24 * 3600,
	})

	// Debug: log new token lengths
	fmt.Printf("RefreshHandler: SUCCESS - new access_token len=%d, new refresh_token len=%d\n", len(accessTok), len(refreshTok))

	c.JSON(http.StatusOK, gin.H{"access_token": accessTok, "refresh_token": refreshTok})
}

// LogoutHandler refresh token ile oturumu sonlandırır
// @Summary Logout user
// @Description Invalidate refresh token and end user session
// @Tags Auth
// @Accept json
// @Produce json
// @Param payload body LogoutRequest true "Logout payload"
// @Success 200 {object} map[string]string
// @Failure 400 {object} map[string]interface{}
// @Failure 401 {object} map[string]interface{}
// @Router /auth/logout [post]
func LogoutHandler(c *gin.Context) {
	var req LogoutRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Geçersiz istek verisi"})
		return
	}

	// Session'ı sil
	if err := services.DeleteSession(req.RefreshToken); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Geçersiz oturum"})
		return
	}

	// Clear cookies
	http.SetCookie(c.Writer, &http.Cookie{Name: "access_token", Value: "", Path: "/", Expires: time.Unix(0, 0)})
	http.SetCookie(c.Writer, &http.Cookie{Name: "refresh_token", Value: "", Path: "/", Expires: time.Unix(0, 0)})

	c.JSON(http.StatusOK, gin.H{"message": "Oturum başarıyla sonlandırıldı"})
}

// LogoutAllHandler tüm oturumları sonlandırır
// @Summary Logout from all devices
// @Description Invalidate all refresh tokens for the user
// @Tags Auth
// @Accept json
// @Produce json
// @Security BearerAuth
// @Success 200 {object} map[string]string
// @Failure 401 {object} map[string]interface{}
// @Router /auth/logout-all [post]
func LogoutAllHandler(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	uid, ok := userID.(uuid.UUID)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid user ID"})
		return
	}

	// Tüm session'ları sil
	if err := services.DeleteAllSessionsForUser(uid); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to logout from all devices"})
		return
	}

	// Clear cookies
	http.SetCookie(c.Writer, &http.Cookie{Name: "access_token", Value: "", Path: "/", Expires: time.Unix(0, 0)})
	http.SetCookie(c.Writer, &http.Cookie{Name: "refresh_token", Value: "", Path: "/", Expires: time.Unix(0, 0)})

	c.JSON(http.StatusOK, gin.H{"message": "Tüm oturumlar başarıyla sonlandırıldı"})
}

// VerifyEmailHandler email doğrulama işlemi
// @Summary Verify email
// @Description Verify user email with verification code
// @Tags Auth
// @Accept json
// @Produce json
// @Param payload body VerifyEmailRequest true "Verify email payload"
// @Success 200 {object} map[string]string
// @Failure 400 {object} map[string]interface{}
// @Failure 401 {object} map[string]interface{}
// @Router /auth/verify-email [post]
func VerifyEmailHandler(c *gin.Context) {
	var req VerifyEmailRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Geçersiz istek verisi"})
		return
	}

	// Token'ı doğrula ve sil
	valid, err := services.VerifyVerificationToken(req.Email, req.Code)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Doğrulama kodu geçersiz veya süresi dolmuş"})
		return
	}

	if !valid {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Doğrulama kodu geçersiz"})
		return
	}

	// Kullanıcıyı doğrulanmış olarak işaretle
	if err := services.UpdateUserVerifiedStatus(req.Email, true); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Kullanıcı doğrulama durumu güncellenemedi"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Email başarıyla doğrulandı"})
}

// DebugSessionsHandler sessions tablosundan son 5 kaydı gösterir
// @Summary Debug Sessions
// @Description Shows last 5 sessions for debugging
// @Tags Debug
// @Produce json
// @Success 200 {object} map[string]interface{}
// @Router /debug/sessions [get]
func DebugSessionsHandler(c *gin.Context) {
	sessions, err := services.GetLastSessions(5)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	var debugSessions []map[string]interface{}
	for _, session := range sessions {
		debugSession := map[string]interface{}{
			"id":                session.ID.String(),
			"user_id":           session.UserID.String(),
			"token_hash":        session.TokenHash,
			"token_data_length": len(session.TokenData),
			"expires_at":        session.ExpiresAt,
			"created_at":        session.CreatedAt,
		}

		// TokenData'dan token'ı parse etmeye çalış
		if len(session.TokenData) > 0 {
			tokenPayload, parseErr := services.ParseTokenFromJSON(session.TokenData)
			if parseErr == nil {
				debugSession["parsed_token_length"] = len(tokenPayload.Token)
				debugSession["parsed_token_hash"] = services.HashToken(tokenPayload.Token)
			} else {
				debugSession["parse_error"] = parseErr.Error()
			}
		}

		debugSessions = append(debugSessions, debugSession)
	}

	c.JSON(http.StatusOK, gin.H{
		"sessions": debugSessions,
		"count":    len(debugSessions),
	})
}
