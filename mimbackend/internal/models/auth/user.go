package models

import (
	"time"

	basemodels "mimbackend/internal/models/basemodels"

	"github.com/google/uuid"
)

type User struct {
	BaseModel

	Email        string  `gorm:"uniqueIndex;not null;type:varchar(255)"`
	Phone        *string `gorm:"uniqueIndex;type:varchar(20)"`
	ImageURL     *string
	FullName     *string
	PasswordHash string
	IsVerified   bool `gorm:"default:false"`

	// Role relationship
	RoleID *uuid.UUID `gorm:"column:role_id;type:varchar(36);index"`
	Role   string     `gorm:"column:role;type:varchar(50);default:'user'"`

	// Password reset fields
	ResetToken        *string
	ResetTokenExpires *time.Time

	Accounts  []Account
	Sessions  []Session
	RoleModel *basemodels.Role `gorm:"foreignKey:RoleID;references:ID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL"`
}
