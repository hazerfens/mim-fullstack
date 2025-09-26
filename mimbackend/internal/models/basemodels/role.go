package basemodels

import "github.com/google/uuid"

type Role struct {
	BaseModel

	Name        *string      `gorm:"column:name;type:varchar(100);unique"`
	Description *string      `gorm:"column:description;type:varchar(255)"`
	Permissions *Permissions `gorm:"column:permissions;type:json"`
	IsActive    bool         `gorm:"column:is_active;default:true"`

	CreatedByID *uuid.UUID `gorm:"column:created_by_id;type:varchar(36);index"`
}

type Permissions struct {
	// Standard permissions
	Users       *PermissionDetail `json:"users,omitempty"`
	Companies   *PermissionDetail `json:"companies,omitempty"`
	Branches    *PermissionDetail `json:"branches,omitempty"`
	Departments *PermissionDetail `json:"departments,omitempty"`
	Roles       *PermissionDetail `json:"roles,omitempty"`
	Reports     *PermissionDetail `json:"reports,omitempty"`
	Settings    *PermissionDetail `json:"settings,omitempty"`

	// Custom permissions - key-value pairs for custom permissions
	Custom map[string]*PermissionDetail `json:"custom,omitempty"`
}

type PermissionDetail struct {
	Create *bool `json:"create,omitempty"`
	Read   *bool `json:"read,omitempty"`
	Update *bool `json:"update,omitempty"`
	Delete *bool `json:"delete,omitempty"`
}
