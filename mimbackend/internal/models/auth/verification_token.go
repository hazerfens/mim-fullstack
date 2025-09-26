package models

import "time"

type VerificationToken struct {
	BaseModel

	Identifier string    `gorm:"not null;index;type:varchar(255)"` // email
	Token      string    `gorm:"uniqueIndex;not null;type:varchar(255)"`
	ExpiresAt  time.Time `gorm:"not null"`
}
