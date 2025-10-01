package services

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"

	"mimbackend/config"
	auth "mimbackend/internal/models/auth"
	basemodels "mimbackend/internal/models/basemodels"
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

func hashRefreshToken(token string) string {
	if token == "" {
		return ""
	}
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
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
		log.Printf("ValidateJWT: Parse error: %v", err)
		return nil, err
	}

	if !token.Valid {
		log.Printf("ValidateJWT: Token invalid")
		return nil, errors.New("invalid token")
	}

	// Parse Subject as UserID
	userID, err := uuid.Parse(claims.Subject)
	if err != nil {
		log.Printf("ValidateJWT: Invalid subject: %s", claims.Subject)
		return nil, errors.New("invalid subject in token")
	}
	claims.UserID = userID

	log.Printf("ValidateJWT: SUCCESS - userID=%s email=%s role=%s", userID, claims.Email, claims.Role)
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

	// Role senkronizasyonu
	if err := syncUserRole(db, user); err != nil {
		return err
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
	payload := sessionTokenPayload{Token: token}
	tokenJSON, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	tokenHash := hashRefreshToken(token)

	session := &auth.Session{
		UserID:    userID,
		TokenData: tokenJSON,
		TokenHash: tokenHash,
		ExpiresAt: expiresAt,
	}

	if err := db.Create(session).Error; err != nil {
		log.Printf("CreateSession failed: %v, userID: %s, token length: %d", err, userID, len(token))
		return err
	}

	// Log token head/tail for debugging (do NOT log full token)
	head := ""
	tail := ""
	if len(token) >= 16 {
		head = token[:8]
		tail = token[len(token)-8:]
	} else {
		head = token
		tail = token
	}
	log.Printf("CreateSession: saved session userID=%s token_len=%d token_head_tail=%s...%s expiresAt=%s hash_prefix=%s", userID, len(token), head, tail, expiresAt.String(), tokenHash[:8])

	return nil
}

// UpdateSessionToken rotates refresh token within an existing session row
func UpdateSessionToken(sessionID uuid.UUID, token string, expiresAt time.Time) error {
	db, err := config.NewConnection()
	if err != nil {
		return err
	}

	payload := sessionTokenPayload{Token: token}
	tokenJSON, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	tokenHash := hashRefreshToken(token)

	updates := map[string]interface{}{
		"token_data": tokenJSON,
		"token_hash": tokenHash,
		"expires_at": expiresAt,
	}

	id := sessionID.String()
	result := db.Model(&auth.Session{}).Where("id = ?", id).Updates(updates)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return errors.New("session not found")
	}

	hashPreview := ""
	if tokenHash != "" && len(tokenHash) >= 8 {
		hashPreview = tokenHash[:8]
	}
	log.Printf("UpdateSessionToken: session_id=%s expiresAt=%s hash_prefix=%s", id, expiresAt.String(), hashPreview)
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

	var sess auth.Session
	// Primary lookup via token hash (matches current sessions table structure)
	hash := hashRefreshToken(token)
	hashPreview := hash
	if len(hashPreview) > 16 {
		hashPreview = hashPreview[:16]
	}
	log.Printf("GetSessionByToken: attempting lookup len=%d hash_prefix=%s", len(token), hashPreview)
	queryErr := db.Where("token_hash = ?", hash).First(&sess).Error
	if queryErr != nil {
		// Fallback to JSON lookup for legacy rows where hash may be missing
		if err := db.Where("JSON_UNQUOTE(JSON_EXTRACT(token_data, '$.token')) = ?", token).First(&sess).Error; err != nil {
			log.Printf("GetSessionByToken: lookup failed len=%d hash_err=%v json_err=%v", len(token), queryErr, err)
			logRecentSessions(db, 5)
			return nil, err
		}
	}

	var payload sessionTokenPayload
	if len(sess.TokenData) > 0 {
		if err := json.Unmarshal(sess.TokenData, &payload); err != nil {
			log.Printf("GetSessionByToken: failed to unmarshal token JSON for session id=%d: %v", sess.ID, err)
		}
	}

	// compute hash only for debug (not stored in DB)
	resultHashPreview := ""
	if hash != "" && len(hash) >= 8 {
		resultHashPreview = hash[:8]
	}
	log.Printf("GetSessionByToken: found session id=%d userID=%s token_present=%t hash_prefix=%s", sess.ID, sess.UserID, payload.Token != "", resultHashPreview)

	return &sess, nil
}

func logRecentSessions(db *gorm.DB, limit int) {
	var sessions []auth.Session
	if err := db.Order("id DESC").Limit(limit).Find(&sessions).Error; err != nil {
		log.Printf("logRecentSessions: error listing sessions: %v", err)
		return
	}

	log.Printf("logRecentSessions: showing last %d sessions", len(sessions))
	for _, sess := range sessions {
		tokenDataPreview := ""
		if len(sess.TokenData) > 0 {
			var tokenPayload map[string]any
			if err := json.Unmarshal(sess.TokenData, &tokenPayload); err != nil {
				tokenDataPreview = fmt.Sprintf("invalid json len=%d", len(sess.TokenData))
			} else if token, ok := tokenPayload["token"].(string); ok {
				head := token
				tail := token
				if len(token) > 16 {
					head = token[:8]
					tail = token[len(token)-8:]
				}
				if len(token) > 16 {
					tokenDataPreview = fmt.Sprintf("token:%s...%s", head, tail)
				} else {
					tokenDataPreview = fmt.Sprintf("token:%s", token)
				}
			} else {
				tokenDataPreview = "token missing"
			}
		} else {
			tokenDataPreview = "no token_data"
		}

		hashPreview := sess.TokenHash
		if len(hashPreview) > 18 {
			hashPreview = fmt.Sprintf("%s...", hashPreview[:18])
		}

		log.Printf(
			"logRecentSessions: id=%d user=%s hash=%s %s expires=%s updated=%s",
			sess.ID,
			sess.UserID,
			hashPreview,
			tokenDataPreview,
			sess.ExpiresAt.Format(time.RFC3339),
			sess.UpdatedAt.Format(time.RFC3339),
		)
	}
}

// DeleteSession removes a session by token (the DB stores refresh tokens in `token` column)
func DeleteSession(refreshToken string) error {
	db, err := config.NewConnection()
	if err != nil {
		return err
	}
	// Delete by matching the hashed token (current schema) and fallback to JSON for older rows
	hash := hashRefreshToken(refreshToken)
	result := db.Where("token_hash = ?", hash).Delete(&auth.Session{})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		result = db.Where("JSON_UNQUOTE(JSON_EXTRACT(token_data, '$.token')) = ?", refreshToken).Delete(&auth.Session{})
		if result.Error != nil {
			return result.Error
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
	// Debug: log incoming token head/tail
	if len(refreshToken) >= 16 {
		log.Printf("RefreshTokens: incoming token head_tail=%s...%s", refreshToken[:8], refreshToken[len(refreshToken)-8:])
	} else {
		log.Printf("RefreshTokens: incoming token (short)=%s", refreshToken)
	}

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

	// Debug: log the token parsed from session token_data for correlation
	if len(sess.TokenData) > 0 {
		if parsed, pErr := ParseTokenFromJSON(sess.TokenData); pErr == nil {
			t := parsed.Token
			if len(t) >= 16 {
				log.Printf("RefreshTokens: matched session token head_tail=%s...%s", t[:8], t[len(t)-8:])
			} else {
				log.Printf("RefreshTokens: matched session token (short)=%s", t)
			}
		}
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

	// Rotate token in the existing session row to avoid orphaned records
	refreshExp := time.Now().Add(30 * 24 * time.Hour)
	updateErr := UpdateSessionToken(sess.ID, refreshTok, refreshExp)
	if updateErr != nil {
		log.Printf("RefreshTokens: UpdateSessionToken failed, falling back to new session creation: %v", updateErr)
		if createErr := CreateSession(user.ID, refreshTok, refreshExp); createErr != nil {
			return "", "", createErr
		}
		if delErr := DeleteSession(refreshToken); delErr != nil {
			log.Printf("RefreshTokens: DeleteSession fallback error: %v", delErr)
		}
	}

	if postSess, postErr := GetSessionByToken(refreshTok); postErr != nil {
		log.Printf("RefreshTokens: post-rotation lookup failed len=%d err=%v", len(refreshTok), postErr)
	} else {
		log.Printf("RefreshTokens: post-rotation session id=%s expires=%s", postSess.ID, postSess.ExpiresAt.String())
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
	if err := db.Preload("RoleModel").Where("id = ?", id).First(&user).Error; err != nil {
		return nil, err
	}

	// Role senkronizasyonu
	if err := syncUserRole(db, &user); err != nil {
		log.Printf("Warning: failed to sync user role: %v", err)
	}

	return &user, nil
}

// UpdateUser kullanıcı bilgilerini günceller
func UpdateUser(user *auth.User) error {
	db, err := config.NewConnection()
	if err != nil {
		return err
	}

	// Role senkronizasyonu
	if err := syncUserRole(db, user); err != nil {
		return err
	}

	// Kullanıcıyı güncelle
	if err := db.Save(user).Error; err != nil {
		return err
	}

	return nil
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

// syncUserRole senkronize eder User.Role field'ini Role tablosundan
func syncUserRole(db *gorm.DB, user *auth.User) error {
	if user.RoleID == nil {
		// RoleID yoksa default "user" rolü ata
		var defaultRole basemodels.Role
		if err := db.Where("name = ?", "user").First(&defaultRole).Error; err != nil {
			return errors.New("default user role not found")
		}
		user.RoleID = &defaultRole.ID
		user.Role = "user"
		return nil
	}

	// RoleID varsa, Role tablosundan name'i al
	var role basemodels.Role
	if err := db.Where("id = ?", user.RoleID).First(&role).Error; err != nil {
		return errors.New("role not found")
	}

	if role.Name == nil {
		return errors.New("role name is nil")
	}

	user.Role = *role.Name
	return nil
}
