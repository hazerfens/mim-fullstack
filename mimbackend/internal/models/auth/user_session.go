package models

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

// UserSession represents a user's login session with security information
type UserSession struct {
	ID        uuid.UUID `gorm:"type:char(36);primary_key" json:"id"`
	UserID    uuid.UUID `gorm:"type:char(36);not null;index" json:"user_id"`
	User      *User     `gorm:"foreignKey:UserID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE" json:"user,omitempty"`
	SessionID string    `gorm:"type:varchar(255);uniqueIndex;not null" json:"session_id"` // Unique session identifier

	// Security Information
	IPAddress  string `gorm:"type:varchar(45);not null" json:"ip_address"` // IPv4 or IPv6
	UserAgent  string `gorm:"type:text" json:"user_agent"`                 // Browser/client info
	DeviceType string `gorm:"type:varchar(50)" json:"device_type"`         // mobile, desktop, tablet, etc.
	OS         string `gorm:"type:varchar(100)" json:"os"`                 // Operating system
	Browser    string `gorm:"type:varchar(100)" json:"browser"`            // Browser name and version
	DeviceID   string `gorm:"type:varchar(255);index" json:"device_id"`    // Device fingerprint
	Location   string `gorm:"type:varchar(255)" json:"location,omitempty"` // Approximate location (city, country)

	// Session Status
	IsActive     bool       `gorm:"default:true;not null" json:"is_active"`
	LoginAt      time.Time  `gorm:"not null" json:"login_at"`
	LastActivity time.Time  `gorm:"not null" json:"last_activity"`
	LogoutAt     *time.Time `gorm:"index" json:"logout_at,omitempty"`
	ExpiresAt    time.Time  `gorm:"not null;index" json:"expires_at"`

	// Security Flags
	IsSuspicious bool   `gorm:"default:false" json:"is_suspicious"`   // Marked if suspicious activity detected
	TrustScore   int    `gorm:"default:100" json:"trust_score"`       // 0-100, trust level of this session
	LoginMethod  string `gorm:"type:varchar(50)" json:"login_method"` // password, oauth, 2fa, etc.

	// Metadata
	RefreshToken string         `gorm:"type:text" json:"-"`             // Associated refresh token (hashed)
	TokenVersion int            `gorm:"default:1" json:"token_version"` // For token invalidation
	Metadata     datatypes.JSON `gorm:"type:json" json:"metadata"`      // Additional custom data

	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`
}

// BeforeCreate generates UUID for new session
func (s *UserSession) BeforeCreate(tx *gorm.DB) error {
	if s.ID == uuid.Nil {
		s.ID = uuid.New()
	}
	if s.SessionID == "" {
		s.SessionID = uuid.New().String()
	}
	if s.LoginAt.IsZero() {
		s.LoginAt = time.Now()
	}
	if s.LastActivity.IsZero() {
		s.LastActivity = time.Now()
	}
	return nil
}

// TableName specifies the table name for UserSession
func (UserSession) TableName() string {
	return "user_sessions"
}

// IsExpired checks if the session is expired
func (s *UserSession) IsExpired() bool {
	return time.Now().After(s.ExpiresAt)
}

// UpdateActivity updates the last activity timestamp
func (s *UserSession) UpdateActivity(db *gorm.DB) error {
	s.LastActivity = time.Now()
	return db.Model(s).Update("last_activity", s.LastActivity).Error
}

// MarkAsLogout marks the session as logged out
func (s *UserSession) MarkAsLogout(db *gorm.DB) error {
	now := time.Now()
	s.LogoutAt = &now
	s.IsActive = false
	return db.Model(s).Updates(map[string]interface{}{
		"logout_at": now,
		"is_active": false,
	}).Error
}

// MarkAsSuspicious marks the session as suspicious
func (s *UserSession) MarkAsSuspicious(db *gorm.DB, reason string) error {
	s.IsSuspicious = true
	if s.TrustScore > 0 {
		s.TrustScore -= 20 // Decrease trust score
		if s.TrustScore < 0 {
			s.TrustScore = 0
		}
	}

	// Create metadata map
	metadata := map[string]interface{}{
		"suspicious_reason": reason,
		"marked_at":         time.Now().Format(time.RFC3339),
	}

	// Convert to JSON
	metadataJSON, err := json.Marshal(metadata)
	if err != nil {
		return err
	}
	s.Metadata = datatypes.JSON(metadataJSON)

	return db.Model(s).Updates(map[string]interface{}{
		"is_suspicious": true,
		"trust_score":   s.TrustScore,
		"metadata":      s.Metadata,
	}).Error
}

// SessionSecurityInfo represents security information for a session
type SessionSecurityInfo struct {
	IPAddress   string                 `json:"ip_address"`
	UserAgent   string                 `json:"user_agent"`
	DeviceType  string                 `json:"device_type,omitempty"`
	OS          string                 `json:"os,omitempty"`
	Browser     string                 `json:"browser,omitempty"`
	DeviceID    string                 `json:"device_id,omitempty"`
	Location    string                 `json:"location,omitempty"`
	LoginMethod string                 `json:"login_method,omitempty"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
}
