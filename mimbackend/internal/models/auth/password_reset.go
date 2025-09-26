package models

import (
	"time"

	"github.com/google/uuid"
)

type PasswordResetRequest struct {
	BaseModel

	UserID    uuid.UUID `gorm:"type:varchar(36);not null;index"`
	Token     string    `gorm:"uniqueIndex;not null;type:varchar(255)"`
	ExpiresAt time.Time `gorm:"not null"`
	IsUsed    bool      `gorm:"default:false"`

	User User `gorm:"foreignKey:UserID;constraint:OnDelete:CASCADE;"`
}
