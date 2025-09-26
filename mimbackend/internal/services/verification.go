package services

import (
	"fmt"
	"math/rand"
	"mimbackend/config"
	auth "mimbackend/internal/models/auth"
	"time"
)

// generate6Code returns a zero-padded 6-digit string
func generate6Code() string {
	rand.Seed(time.Now().UnixNano())
	n := rand.Intn(1000000)
	return fmt.Sprintf("%06d", n)
}

// CreateVerificationToken creates a 6-digit token and stores it
func CreateVerificationToken(identifier string, ttl time.Duration) (string, error) {
	db, err := config.NewConnection()
	if err != nil {
		return "", err
	}

	code := generate6Code()
	exp := time.Now().Add(ttl)

	vt := &auth.VerificationToken{
		Identifier: identifier,
		Token:      code,
		ExpiresAt:  exp,
	}

	if err := db.Create(vt).Error; err != nil {
		return "", err
	}

	return code, nil
}

// VerifyVerificationToken checks code and deletes it on success
func VerifyVerificationToken(identifier, code string) (bool, error) {
	db, err := config.NewConnection()
	if err != nil {
		return false, err
	}

	var vt auth.VerificationToken
	if err := db.Where("identifier = ? AND token = ? AND expires_at > ?", identifier, code, time.Now()).First(&vt).Error; err != nil {
		return false, err
	}

	// delete used token
	if err := db.Delete(&vt).Error; err != nil {
		return false, err
	}

	return true, nil
}

// GetOrCreateVerificationToken returns an existing unexpired code or creates a new one
func GetOrCreateVerificationToken(identifier string, ttl time.Duration) (string, error) {
	db, err := config.NewConnection()
	if err != nil {
		return "", err
	}

	var vt auth.VerificationToken
	// try to find an existing, not-yet-expired token
	if err := db.Where("identifier = ? AND expires_at > ?", identifier, time.Now()).Order("created_at desc").First(&vt).Error; err == nil {
		return vt.Token, nil
	}

	// otherwise create a new one
	return CreateVerificationToken(identifier, ttl)
}
