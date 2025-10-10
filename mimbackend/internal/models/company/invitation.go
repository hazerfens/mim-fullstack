package company

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"

	authmodels "mimbackend/internal/models/auth"
	basemodels "mimbackend/internal/models/basemodels"
)

// InvitationStatus davet durumu
type InvitationStatus string

const (
	InvitationPending   InvitationStatus = "pending"
	InvitationAccepted  InvitationStatus = "accepted"
	InvitationRejected  InvitationStatus = "rejected"
	InvitationExpired   InvitationStatus = "expired"
	InvitationCancelled InvitationStatus = "cancelled"
)

// CompanyInvitation şirket daveti
type CompanyInvitation struct {
	basemodels.BaseModel

	CompanyID uuid.UUID        `gorm:"column:company_id;type:varchar(36);not null;index" json:"company_id"`
	Email     string           `gorm:"column:email;type:varchar(255);not null" json:"email"`
	Token     string           `gorm:"column:token;type:varchar(255);not null;uniqueIndex" json:"token"`
	RoleID    *uuid.UUID       `gorm:"column:role_id;type:varchar(36)" json:"role_id,omitempty"`
	RoleName  string           `gorm:"column:role_name;type:varchar(50);not null" json:"role_name"` // admin, manager, member, viewer
	InvitedBy uuid.UUID        `gorm:"column:invited_by;type:varchar(36);not null" json:"invited_by"`
	Status    InvitationStatus `gorm:"column:status;type:varchar(20);default:'pending'" json:"status"`
	ExpiresAt time.Time        `gorm:"column:expires_at;not null" json:"expires_at"`

	// Relations
	Company Company          `gorm:"foreignKey:CompanyID;references:ID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE" json:"company,omitempty"`
	Role    *basemodels.Role `gorm:"foreignKey:RoleID;references:ID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL" json:"role,omitempty"`
	Inviter authmodels.User  `gorm:"foreignKey:InvitedBy;references:ID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE" json:"inviter,omitempty"`
}

// TableName override table name
func (CompanyInvitation) TableName() string {
	return "company_invitations"
}

// BeforeCreate hook - generate token
func (ci *CompanyInvitation) BeforeCreate(tx *gorm.DB) error {
	if ci.Token == "" {
		ci.Token = uuid.New().String()
	}
	if ci.Status == "" {
		ci.Status = InvitationPending
	}
	if ci.ExpiresAt.IsZero() {
		// Default expiration: 7 days
		ci.ExpiresAt = time.Now().Add(7 * 24 * time.Hour)
	}
	return nil
}

// IsExpired checks if invitation is expired
func (ci *CompanyInvitation) IsExpired() bool {
	return time.Now().After(ci.ExpiresAt)
}

// IsValid checks if invitation is valid
func (ci *CompanyInvitation) IsValid() bool {
	return ci.Status == InvitationPending && !ci.IsExpired()
}
