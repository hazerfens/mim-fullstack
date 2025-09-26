package models

import "github.com/google/uuid"

type Account struct {
	BaseModel

	UserID       uuid.UUID `gorm:"type:varchar(36);not null;index"`
	Provider     string    `gorm:"not null"` // google, github, facebook
	ProviderID   string    `gorm:"not null;index;type:varchar(255)"`
	AccessToken  string
	RefreshToken string
	ExpiresAt    int64 // Unix timestamp

	User User `gorm:"foreignKey:UserID;constraint:OnDelete:CASCADE;"`
}
