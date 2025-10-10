package basemodels

import (
	"github.com/google/uuid"
)

// Permission represents a catalog entry for model-agnostic permissions.
// Resource names (e.g. "invoice") should be defined here and then referenced
// by role_permissions rows for actual allow/deny rules.
type Permission struct {
	BaseModel

	Name        string  `gorm:"type:varchar(100);uniqueIndex;not null" json:"name"`
	DisplayName *string `gorm:"type:varchar(150)" json:"display_name,omitempty"`
	Description *string `gorm:"type:text" json:"description,omitempty"`
	IsActive    bool    `gorm:"default:true" json:"is_active"`

	CreatedByID *uuid.UUID `gorm:"type:varchar(36);index" json:"created_by_id,omitempty"`
}

func (Permission) TableName() string {
	return "permissions"
}

func NewPermission(name, display, desc string, createdBy *uuid.UUID) Permission {
	p := Permission{
		Name:        name,
		DisplayName: &display,
		Description: &desc,
		IsActive:    true,
		CreatedByID: createdBy,
	}
	return p
}
