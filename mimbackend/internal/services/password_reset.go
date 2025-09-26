package services

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"mimbackend/config"
	auth "mimbackend/internal/models/auth"
	"time"
	"unicode"

	"golang.org/x/crypto/bcrypt"
)

// generateResetToken generates a secure random token for password reset
func generateResetToken() (string, error) {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}

// SendPasswordResetEmail sends password reset email to user
func SendPasswordResetEmail(email string) error {
	db, err := config.NewConnection()
	if err != nil {
		return err
	}

	// Find user by email
	var user auth.User
	if err := db.Where("email = ?", email).First(&user).Error; err != nil {
		return errors.New("user not found")
	}

	// Generate reset token
	token, err := generateResetToken()
	if err != nil {
		return err
	}

	// Set token and expiry (1 hour)
	expiry := time.Now().Add(1 * time.Hour)
	user.ResetToken = &token
	user.ResetTokenExpires = &expiry

	// Save to database
	if err := db.Save(&user).Error; err != nil {
		return err
	}

	// Send email
	emailService := NewEmailService()
	resetURL := emailService.frontendURL + "/auth/reset-password?token=" + token

	return emailService.SendPasswordResetEmail(user.Email, user.FullName, resetURL)
}

// ResetPassword resets user password using reset token
func ResetPassword(token, newPassword string) error {
	db, err := config.NewConnection()
	if err != nil {
		return err
	}

	// Find user by reset token
	var user auth.User
	if err := db.Where("reset_token = ? AND reset_token_expires > ?", token, time.Now()).First(&user).Error; err != nil {
		return errors.New("invalid or expired reset token")
	}
	// Prevent reuse: check if newPassword equals the current password
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(newPassword)); err == nil {
		return errors.New("yeni şifre önceki şifreyle aynı olamaz")
	}

	// Enforce password strength
	if err := validatePasswordStrength(newPassword); err != nil {
		return err
	}

	// Hash new password
	hashedPassword, err := HashPassword(newPassword)
	if err != nil {
		return err
	}

	// Update password and clear reset token
	user.PasswordHash = hashedPassword
	user.ResetToken = nil
	user.ResetTokenExpires = nil

	// Save to database
	if err := db.Save(&user).Error; err != nil {
		return err
	}

	return nil
}

// validatePasswordStrength ensures a password meets minimal complexity requirements
func validatePasswordStrength(pw string) error {
	var hasMinLen bool
	var hasUpper bool
	var hasLower bool
	var hasNumber bool
	var hasSpecial bool

	if len(pw) >= 6 {
		hasMinLen = true
	}

	for _, r := range pw {
		switch {
		case unicode.IsUpper(r):
			hasUpper = true
		case unicode.IsLower(r):
			hasLower = true
		case unicode.IsDigit(r):
			hasNumber = true
		case unicode.IsPunct(r) || unicode.IsSymbol(r):
			hasSpecial = true
		}
	}

	if !hasMinLen {
		return errors.New("şifre en az 8 karakter olmalıdır")
	}
	if !hasUpper {
		return errors.New("şifre en az bir büyük harf içermelidir")
	}
	if !hasLower {
		return errors.New("şifre en az bir küçük harf içermelidir")
	}
	if !hasNumber {
		return errors.New("şifre en az bir rakam içermelidir")
	}
	if !hasSpecial {
		return errors.New("şifre en az bir özel karakter (örn. !@#$%) içermelidir")
	}

	return nil
}

// ValidateResetToken validates if reset token is valid and not expired
func ValidateResetToken(token string) (*auth.User, error) {
	db, err := config.NewConnection()
	if err != nil {
		return nil, err
	}

	var user auth.User
	if err := db.Where("reset_token = ? AND reset_token_expires > ?", token, time.Now()).First(&user).Error; err != nil {
		return nil, errors.New("invalid or expired reset token")
	}

	return &user, nil
}
