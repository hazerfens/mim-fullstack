package services

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"log"
	"mimbackend/config"
	auth "mimbackend/internal/models/auth"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

var jwtSecret = []byte("your-secret-key-change-this-in-production")

type Claims struct {
	UserID uuid.UUID `json:"-"`
	Email  string    `json:"email"`
	Role   string    `json:"role"`
	jwt.RegisteredClaims
}

type sessionTokenPayload struct {
	Token string `json:"token"`
}

// HashPassword şifreyi hashler
func HashPassword(password string) (string, error) {
	bytes, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	return string(bytes), err
}

// CheckPassword şifre doğrulama
func CheckPassword(password, hash string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
	return err == nil
}

// GenerateTokens creates an access token (1 hour) and refresh token (30 days)
func GenerateTokens(userID uuid.UUID, email, role string) (accessToken string, refreshToken string, err error) {
	// Access token: 1 hour
	accessExp := time.Now().Add(1 * time.Hour)
	accessClaims := &Claims{
		UserID: userID,
		Email:  email,
		Role:   role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(accessExp),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			NotBefore: jwt.NewNumericDate(time.Now()),
			Issuer:    "camping-clouds",
			Subject:   userID.String(),
		},
	}

	accessTok := jwt.NewWithClaims(jwt.SigningMethodHS256, accessClaims)
	accessString, err := accessTok.SignedString(jwtSecret)
	if err != nil {
		return "", "", err
	}

	// Refresh token: 30 days
	refreshExp := time.Now().Add(30 * 24 * time.Hour)
	refreshClaims := &Claims{
		UserID: userID,
		Email:  email,
		Role:   role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(refreshExp),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			NotBefore: jwt.NewNumericDate(time.Now()),
			Issuer:    "camping-clouds",
			Subject:   userID.String(),
		},
	}

	refreshTok := jwt.NewWithClaims(jwt.SigningMethodHS256, refreshClaims)
	refreshString, err := refreshTok.SignedString(jwtSecret)
	if err != nil {
		return "", "", err
	}

	return accessString, refreshString, nil
}

// ValidateJWT JWT token doğrular
func ValidateJWT(tokenString string) (*Claims, error) {
	claims := &Claims{}

	token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
		return jwtSecret, nil
	})

	if err != nil {
		return nil, err
	}

	if !token.Valid {
		return nil, errors.New("invalid token")
	}

	// Parse Subject as UserID
	userID, err := uuid.Parse(claims.Subject)
	if err != nil {
		return nil, errors.New("invalid subject in token")
	}
	claims.UserID = userID

	return claims, nil
}

// CreateUser yeni kullanıcı oluşturur
func CreateUser(user *auth.User) error {
	db, err := config.NewConnection()
	if err != nil {
		return err
	}

	// Email kontrolü
	var existingUser auth.User
	if err := db.Where("email = ?", user.Email).First(&existingUser).Error; err == nil {
		return errors.New("user already exists")
	}

	// Kullanıcıyı oluştur
	if err := db.Create(user).Error; err != nil {
		return err
	}

	return nil
}

// CreateSession saves a session record (we'll store refresh token here)
func CreateSession(userID uuid.UUID, token string, expiresAt time.Time) error {
	db, err := config.NewConnection()
	if err != nil {
		return err
	}

	// compute SHA256 hash for token and store both raw token and hash
	h := sha256.Sum256([]byte(token))
	hashHex := hex.EncodeToString(h[:])

	payload := sessionTokenPayload{Token: token}
	tokenJSON, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	session := &auth.Session{
		UserID:    userID,
		TokenData: tokenJSON,
		TokenHash: hashHex,
		ExpiresAt: expiresAt,
	}

	if err := db.Create(session).Error; err != nil {
		log.Printf("CreateSession failed: %v, userID: %s, token length: %d, token_sha256=%s", err, userID, len(token), hashHex)
		return err
	}

	log.Printf("CreateSession: saved session userID=%s token_len=%d token_sha256=%s expiresAt=%s", userID, len(token), hashHex, expiresAt.String())

	return nil
}

// CreateAccount creates a local account record (for email/password registrations)
func CreateAccount(userID uuid.UUID, provider, providerID, accessToken, refreshToken string, expiresAt int64) error {
	db, err := config.NewConnection()
	if err != nil {
		return err
	}

	var account auth.Account
	if err := db.Where("provider = ? AND provider_id = ?", provider, providerID).First(&account).Error; err == nil {
		// update tokens
		account.AccessToken = accessToken
		account.RefreshToken = refreshToken
		account.ExpiresAt = expiresAt
		if err := db.Save(&account).Error; err != nil {
			return err
		}
		return nil
	}

	// create new
	account = auth.Account{
		UserID:       userID,
		Provider:     provider,
		ProviderID:   providerID,
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		ExpiresAt:    expiresAt,
	}

	if err := db.Create(&account).Error; err != nil {
		return err
	}

	return nil
}

// GetSessionByToken returns a session by token
func GetSessionByToken(token string) (*auth.Session, error) {
	db, err := config.NewConnection()
	if err != nil {
		return nil, err
	}

	// look up by token hash for performance and to avoid indexing very long tokens
	h := sha256.Sum256([]byte(token))
	hashHex := hex.EncodeToString(h[:])

	var sess auth.Session
	if err := db.Where("token_hash = ?", hashHex).First(&sess).Error; err != nil {
		log.Printf("GetSessionByToken: token hash lookup failed len=%d token_sha256=%s err=%v", len(token), hashHex, err)

		if errors.Is(err, gorm.ErrRecordNotFound) {
			// Compatibility fallback: look up by JSON token value
			if errFallback := db.Where("JSON_EXTRACT(token_data, '$.token') = ?", token).First(&sess).Error; errFallback == nil {
				log.Printf("GetSessionByToken: fallback JSON lookup succeeded for session id=%d userID=%s", sess.ID, sess.UserID)

				if strings.TrimSpace(sess.TokenHash) == "" {
					_ = db.Model(&auth.Session{}).Where("id = ?", sess.ID).Update("token_hash", hashHex).Error
				}

				return &sess, nil
			}
		}

		return nil, err
	}

	// backfill token_hash if somehow missing
	if strings.TrimSpace(sess.TokenHash) == "" {
		if err := db.Model(&auth.Session{}).Where("id = ?", sess.ID).Update("token_hash", hashHex).Error; err != nil {
			log.Printf("GetSessionByToken: failed to backfill token_hash for session id=%d: %v", sess.ID, err)
		}
	}

	var payload sessionTokenPayload
	if len(sess.TokenData) > 0 {
		if err := json.Unmarshal(sess.TokenData, &payload); err != nil {
			log.Printf("GetSessionByToken: failed to unmarshal token JSON for session id=%d: %v", sess.ID, err)
		}
	}

	log.Printf("GetSessionByToken: found session id=%d userID=%s token_present=%t token_sha256=%s", sess.ID, sess.UserID, payload.Token != "", hashHex)

	return &sess, nil
}

// DeleteSession removes a session by token (the DB stores refresh tokens in `token` column)
func DeleteSession(refreshToken string) error {
	db, err := config.NewConnection()
	if err != nil {
		return err
	}

	hash := sha256.Sum256([]byte(refreshToken))
	hashHex := hex.EncodeToString(hash[:])

	result := db.Where("token_hash = ?", hashHex).Delete(&auth.Session{})
	if result.Error != nil {
		return result.Error
	}

	if result.RowsAffected == 0 {
		result = db.Where("JSON_EXTRACT(token_data, '$.token') = ?", refreshToken).Delete(&auth.Session{})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return errors.New("session bulunamadı")
		}
	}

	return nil
}

// DeleteAllSessionsForUser removes all sessions for a user
func DeleteAllSessionsForUser(userID uuid.UUID) error {
	db, err := config.NewConnection()
	if err != nil {
		return err
	}

	result := db.Where("user_id = ?", userID).Delete(&auth.Session{})
	if result.Error != nil {
		return result.Error
	}

	return nil
}

// RefreshTokens accepts a refresh token, validates it against stored sessions,
// rotates the refresh token and returns new access + refresh tokens.
func RefreshTokens(refreshToken string) (newAccess string, newRefresh string, err error) {
	// Validate token structure and claims
	claims, err := ValidateJWT(refreshToken)
	if err != nil {
		// log validation error
		log.Printf("RefreshTokens: ValidateJWT error: %v", err)
		return "", "", err
	}

	// Find session
	sess, err := GetSessionByToken(refreshToken)
	if err != nil {
		log.Printf("RefreshTokens: GetSessionByToken error for token len=%d: %v", len(refreshToken), err)
		return "", "", err
	}

	// Check expiry
	if time.Now().After(sess.ExpiresAt) {
		// session expired
		_ = DeleteSession(refreshToken)
		return "", "", errors.New("refresh token expired")
	}

	// Load user to get email and role
	user, err := GetUserByID(claims.UserID)
	if err != nil {
		return "", "", err
	}

	// Generate new tokens (rotate)
	accessTok, refreshTok, err := GenerateTokens(user.ID, user.Email, user.Role)
	if err != nil {
		return "", "", err
	}

	// Create new session and delete old one
	// Retry CreateSession a few times in case of rare duplicate token collisions
	refreshExp := time.Now().Add(30 * 24 * time.Hour)
	maxAttempts := 3
	var createErr error
	for attempt := 1; attempt <= maxAttempts; attempt++ {
		createErr = CreateSession(user.ID, refreshTok, refreshExp)
		if createErr == nil {
			break
		}

		// If error indicates duplicate token, regenerate tokens and retry
		if strings.Contains(strings.ToLower(createErr.Error()), "duplicate entry") || strings.Contains(createErr.Error(), "1062") {
			log.Printf("CreateSession duplicate token detected (attempt %d/%d). Regenerating token...", attempt, maxAttempts)
			// regenerate tokens
			accessTok, refreshTok, err = GenerateTokens(user.ID, user.Email, user.Role)
			if err != nil {
				return "", "", err
			}
			// update refreshExp for the new token
			refreshExp = time.Now().Add(30 * 24 * time.Hour)
			continue
		}

		// For other errors, stop retrying
		break
	}
	if createErr != nil {
		return "", "", createErr
	}

	if err := DeleteSession(refreshToken); err != nil {
		// log but continue
	}

	return accessTok, refreshTok, nil
}

// GetUserByEmail email ile kullanıcı bulur
func GetUserByEmail(email string) (*auth.User, error) {
	db, err := config.NewConnection()
	if err != nil {
		return nil, err
	}

	var user auth.User
	if err := db.Where("email = ?", email).First(&user).Error; err != nil {
		return nil, err
	}

	return &user, nil
}

// GetUserByID ID ile kullanıcı bulur
func GetUserByID(id uuid.UUID) (*auth.User, error) {
	db, err := config.NewConnection()
	if err != nil {
		return nil, err
	}

	var user auth.User
	if err := db.Where("id = ?", id).First(&user).Error; err != nil {
		return nil, err
	}

	return &user, nil
}

// UpdateUserVerifiedStatus updates user's verified status
func UpdateUserVerifiedStatus(email string, isVerified bool) error {
	db, err := config.NewConnection()
	if err != nil {
		return err
	}

	result := db.Model(&auth.User{}).Where("email = ?", email).Update("is_verified", isVerified)
	if result.Error != nil {
		return result.Error
	}

	if result.RowsAffected == 0 {
		return errors.New("user not found")
	}

	return nil
}

// GetLastSessions returns the last N sessions for debugging
func GetLastSessions(limit int) ([]auth.Session, error) {
	db, err := config.NewConnection()
	if err != nil {
		return nil, err
	}

	var sessions []auth.Session
	err = db.Order("created_at DESC").Limit(limit).Find(&sessions).Error
	return sessions, err
}

// ParseTokenFromJSON parses token from JSON TokenData
func ParseTokenFromJSON(tokenData []byte) (*sessionTokenPayload, error) {
	var payload sessionTokenPayload
	err := json.Unmarshal(tokenData, &payload)
	if err != nil {
		return nil, err
	}
	return &payload, nil
}

// HashToken generates SHA256 hash of token
func HashToken(token string) string {
	hash := sha256.Sum256([]byte(token))
	return hex.EncodeToString(hash[:])
}
