package models

import "time"

type User struct {
	BaseModel

	Email        string  `gorm:"uniqueIndex;not null;type:varchar(255)"`
	Phone        *string `gorm:"uniqueIndex;type:varchar(20)"`
	ImageURL     *string
	FullName     *string
	PasswordHash string
	IsVerified   bool   `gorm:"default:false"`
	Role         string `gorm:"default:user"` // admin, user vs.

	// Password reset fields
	ResetToken        *string
	ResetTokenExpires *time.Time

	Accounts []Account
	Sessions []Session
}
