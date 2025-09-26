package models

import "time"

type OTP struct {
	BaseModel

	Phone     string    `gorm:"index;not null;type:varchar(20)"`
	Code      string    `gorm:"not null;type:varchar(10)"`
	ExpiresAt time.Time `gorm:"not null"`
	IsUsed    bool      `gorm:"default:false"`
}
