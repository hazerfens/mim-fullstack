package models

import (
	"time"

	"github.com/google/uuid"
)

type Session struct {
	BaseModel

	UserID uuid.UUID `gorm:"type:varchar(36);not null;index"`
	// refresh token payload stored as JSON (e.g., {"token":"..."})
	TokenData []byte    `gorm:"type:json"`
	TokenHash string    `gorm:"type:varchar(128);index"`
	ExpiresAt time.Time `gorm:"not null"`

	User User `gorm:"foreignKey:UserID;constraint:OnDelete:CASCADE;"`
}
