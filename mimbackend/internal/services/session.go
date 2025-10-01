package services

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net"
	"strings"
	"time"

	"mimbackend/config"
	authmodels "mimbackend/internal/models/auth"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/mileusna/useragent"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

// SessionService handles user session operations
type SessionService struct {
	db *gorm.DB
}

// NewSessionService creates a new session service
func NewSessionService() (*SessionService, error) {
	db, err := config.NewConnection()
	if err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}
	return &SessionService{db: db}, nil
}

// GetDB returns the database connection
func (s *SessionService) GetDB() *gorm.DB {
	return s.db
}

// ExtractSecurityInfo extracts security information from Gin context
func (s *SessionService) ExtractSecurityInfo(c *gin.Context) *authmodels.SessionSecurityInfo {
	userAgent := c.Request.UserAgent()
	ua := useragent.Parse(userAgent)

	info := &authmodels.SessionSecurityInfo{
		IPAddress:   s.getClientIP(c),
		UserAgent:   userAgent,
		DeviceType:  s.getDeviceType(ua),
		OS:          s.getOS(ua),
		Browser:     s.getBrowser(ua),
		DeviceID:    s.generateDeviceFingerprint(c, ua),
		LoginMethod: "password", // Default, can be overridden
		Metadata:    make(map[string]interface{}),
	}

	// Add additional metadata
	info.Metadata["raw_user_agent"] = userAgent
	info.Metadata["os_version"] = ua.OSVersion
	info.Metadata["browser_version"] = ua.Version
	info.Metadata["is_mobile"] = ua.Mobile
	info.Metadata["is_bot"] = ua.Bot

	return info
}

// CreateSession creates a new user session with security tracking
func (s *SessionService) CreateSession(userID uuid.UUID, refreshToken string, securityInfo *authmodels.SessionSecurityInfo, expirationDuration time.Duration) (*authmodels.UserSession, error) {
	session := &authmodels.UserSession{
		UserID:       userID,
		SessionID:    uuid.New().String(),
		IPAddress:    securityInfo.IPAddress,
		UserAgent:    securityInfo.UserAgent,
		DeviceType:   securityInfo.DeviceType,
		OS:           securityInfo.OS,
		Browser:      securityInfo.Browser,
		DeviceID:     securityInfo.DeviceID,
		Location:     securityInfo.Location,
		IsActive:     true,
		LoginAt:      time.Now(),
		LastActivity: time.Now(),
		ExpiresAt:    time.Now().Add(expirationDuration),
		LoginMethod:  securityInfo.LoginMethod,
		RefreshToken: s.hashToken(refreshToken),
		TokenVersion: 1,
		TrustScore:   100,
		IsSuspicious: false,
	}

	// Check for suspicious activity
	if err := s.checkSuspiciousActivity(session); err != nil {
		fmt.Printf("⚠️ Suspicious activity detected: %v\n", err)
		session.IsSuspicious = true
		session.TrustScore = 50
		metadata := make(map[string]interface{})
		metadata["warning"] = err.Error()
		if metadataJSON, err := json.Marshal(metadata); err == nil {
			session.Metadata = datatypes.JSON(metadataJSON)
		}
	} else if securityInfo.Metadata != nil {
		// Convert map to JSON
		if metadataJSON, err := json.Marshal(securityInfo.Metadata); err == nil {
			session.Metadata = datatypes.JSON(metadataJSON)
			fmt.Printf("📦 Metadata set: %s\n", string(metadataJSON))
		}
	}

	fmt.Printf("💾 Attempting to save session to DB...\n")
	if err := s.db.Debug().Create(session).Error; err != nil {
		fmt.Printf("❌ Failed to create session: %v\n", err)
		return nil, fmt.Errorf("failed to create session: %w", err)
	}

	fmt.Printf("✅ Session saved successfully! ID: %s, SessionID: %s\n", session.ID, session.SessionID)
	return session, nil
}

// GetSessionByToken retrieves a session by refresh token
func (s *SessionService) GetSessionByToken(refreshToken string) (*authmodels.UserSession, error) {
	hashedToken := s.hashToken(refreshToken)

	var session authmodels.UserSession
	if err := s.db.Where("refresh_token = ? AND is_active = ? AND expires_at > ?",
		hashedToken, true, time.Now()).First(&session).Error; err != nil {
		return nil, err
	}

	return &session, nil
}

// UpdateSessionActivity updates the last activity timestamp
func (s *SessionService) UpdateSessionActivity(sessionID string) error {
	return s.db.Model(&authmodels.UserSession{}).
		Where("session_id = ?", sessionID).
		Update("last_activity", time.Now()).Error
}

// LogoutSession marks a session as logged out
func (s *SessionService) LogoutSession(refreshToken string) error {
	hashedToken := s.hashToken(refreshToken)
	now := time.Now()

	return s.db.Model(&authmodels.UserSession{}).
		Where("refresh_token = ?", hashedToken).
		Updates(map[string]interface{}{
			"is_active": false,
			"logout_at": now,
		}).Error
}

// LogoutAllUserSessions logs out all sessions for a user
func (s *SessionService) LogoutAllUserSessions(userID uuid.UUID) error {
	now := time.Now()

	return s.db.Model(&authmodels.UserSession{}).
		Where("user_id = ? AND is_active = ?", userID, true).
		Updates(map[string]interface{}{
			"is_active": false,
			"logout_at": now,
		}).Error
}

// GetUserActiveSessions retrieves all active sessions for a user
func (s *SessionService) GetUserActiveSessions(userID uuid.UUID) ([]authmodels.UserSession, error) {
	var sessions []authmodels.UserSession
	if err := s.db.Where("user_id = ? AND is_active = ? AND expires_at > ?",
		userID, true, time.Now()).
		Order("last_activity DESC").
		Find(&sessions).Error; err != nil {
		return nil, err
	}

	return sessions, nil
}

// GetUserSessionHistory retrieves session history for a user
func (s *SessionService) GetUserSessionHistory(userID uuid.UUID, limit int) ([]authmodels.UserSession, error) {
	var sessions []authmodels.UserSession
	query := s.db.Where("user_id = ?", userID).
		Order("created_at DESC")

	if limit > 0 {
		query = query.Limit(limit)
	}

	if err := query.Find(&sessions).Error; err != nil {
		return nil, err
	}

	return sessions, nil
}

// CleanupExpiredSessions removes expired and inactive sessions
func (s *SessionService) CleanupExpiredSessions() error {
	cutoff := time.Now().Add(-30 * 24 * time.Hour) // Keep last 30 days

	return s.db.Where("expires_at < ? OR (is_active = ? AND logout_at < ?)",
		time.Now(), false, cutoff).
		Delete(&authmodels.UserSession{}).Error
}

// RevokeSession revokes a specific session
func (s *SessionService) RevokeSession(sessionID string, userID uuid.UUID) error {
	now := time.Now()

	return s.db.Model(&authmodels.UserSession{}).
		Where("session_id = ? AND user_id = ?", sessionID, userID).
		Updates(map[string]interface{}{
			"is_active": false,
			"logout_at": now,
		}).Error
}

// MarkSessionSuspicious marks a session as suspicious
func (s *SessionService) MarkSessionSuspicious(sessionID string, reason string) error {
	var session authmodels.UserSession
	if err := s.db.Where("session_id = ?", sessionID).First(&session).Error; err != nil {
		return err
	}

	return session.MarkAsSuspicious(s.db, reason)
}

// Private helper methods

func (s *SessionService) getClientIP(c *gin.Context) string {
	// Try to get real IP from headers (for proxied requests)
	ip := c.GetHeader("X-Real-IP")
	if ip == "" {
		ip = c.GetHeader("X-Forwarded-For")
		if ip != "" {
			// X-Forwarded-For can contain multiple IPs, take the first one
			ips := strings.Split(ip, ",")
			ip = strings.TrimSpace(ips[0])
		}
	}

	// Fallback to RemoteAddr
	if ip == "" {
		ip = c.ClientIP()
	}

	// Validate and clean IP
	if parsedIP := net.ParseIP(ip); parsedIP != nil {
		return parsedIP.String()
	}

	// If still invalid, use RemoteAddr
	if host, _, err := net.SplitHostPort(c.Request.RemoteAddr); err == nil {
		return host
	}

	return c.Request.RemoteAddr
}

func (s *SessionService) getDeviceType(ua useragent.UserAgent) string {
	if ua.Mobile {
		return "mobile"
	}
	if ua.Tablet {
		return "tablet"
	}
	if ua.Desktop {
		return "desktop"
	}
	if ua.Bot {
		return "bot"
	}
	return "unknown"
}

func (s *SessionService) getOS(ua useragent.UserAgent) string {
	os := ua.OS
	if ua.OSVersion != "" {
		os += " " + ua.OSVersion
	}
	return os
}

func (s *SessionService) getBrowser(ua useragent.UserAgent) string {
	browser := ua.Name
	if ua.Version != "" {
		browser += " " + ua.Version
	}
	return browser
}

func (s *SessionService) generateDeviceFingerprint(c *gin.Context, ua useragent.UserAgent) string {
	// Create a unique fingerprint based on multiple factors
	fingerprint := fmt.Sprintf("%s|%s|%s|%s|%s",
		s.getClientIP(c),
		ua.OS,
		ua.Name,
		c.GetHeader("Accept-Language"),
		c.GetHeader("Accept-Encoding"),
	)

	// Hash the fingerprint
	hash := sha256.Sum256([]byte(fingerprint))
	return hex.EncodeToString(hash[:])
}

func (s *SessionService) hashToken(token string) string {
	hash := sha256.Sum256([]byte(token))
	return hex.EncodeToString(hash[:])
}

func (s *SessionService) checkSuspiciousActivity(session *authmodels.UserSession) error {
	// Check 1: Multiple rapid logins from different IPs
	var recentSessions []authmodels.UserSession
	if err := s.db.Where("user_id = ? AND created_at > ?",
		session.UserID, time.Now().Add(-5*time.Minute)).
		Find(&recentSessions).Error; err != nil {
		return nil // Don't fail on check error
	}

	if len(recentSessions) > 3 {
		return fmt.Errorf("multiple rapid login attempts detected")
	}

	// Check 2: Login from new device/location
	var previousSessions []authmodels.UserSession
	if err := s.db.Where("user_id = ? AND device_id = ?",
		session.UserID, session.DeviceID).
		Limit(1).
		Find(&previousSessions).Error; err != nil {
		return nil
	}

	if len(previousSessions) == 0 {
		// First time from this device - not necessarily suspicious but worth noting
		metadata := make(map[string]interface{})
		metadata["new_device"] = true
		if metadataJSON, err := json.Marshal(metadata); err == nil {
			session.Metadata = datatypes.JSON(metadataJSON)
		}
	}

	// Check 3: Login from drastically different IP location (if we had geolocation)
	// This would require a geolocation service integration

	return nil
}

// GetSessionStats returns statistics about user sessions
func (s *SessionService) GetSessionStats(userID uuid.UUID) (map[string]interface{}, error) {
	stats := make(map[string]interface{})

	// Active sessions count
	var activeCount int64
	if err := s.db.Model(&authmodels.UserSession{}).
		Where("user_id = ? AND is_active = ? AND expires_at > ?", userID, true, time.Now()).
		Count(&activeCount).Error; err != nil {
		return nil, err
	}
	stats["active_sessions"] = activeCount

	// Total sessions count
	var totalCount int64
	if err := s.db.Model(&authmodels.UserSession{}).
		Where("user_id = ?", userID).
		Count(&totalCount).Error; err != nil {
		return nil, err
	}
	stats["total_sessions"] = totalCount

	// Suspicious sessions count
	var suspiciousCount int64
	if err := s.db.Model(&authmodels.UserSession{}).
		Where("user_id = ? AND is_suspicious = ?", userID, true).
		Count(&suspiciousCount).Error; err != nil {
		return nil, err
	}
	stats["suspicious_sessions"] = suspiciousCount

	// Most used devices
	var deviceCounts []struct {
		DeviceType string
		Count      int64
	}
	if err := s.db.Model(&authmodels.UserSession{}).
		Select("device_type, COUNT(*) as count").
		Where("user_id = ?", userID).
		Group("device_type").
		Order("count DESC").
		Limit(5).
		Scan(&deviceCounts).Error; err != nil {
		return nil, err
	}
	stats["device_types"] = deviceCounts

	return stats, nil
}
