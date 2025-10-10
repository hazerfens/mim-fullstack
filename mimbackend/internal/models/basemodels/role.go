package basemodels

import (
	"context"
	"fmt"
	"mimbackend/config"

	"github.com/google/uuid"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

type Role struct {
	BaseModel

	Name        *string         `gorm:"column:name;type:varchar(100)"`
	Description *string         `gorm:"column:description;type:varchar(255)"`
	Permissions *datatypes.JSON `gorm:"column:permissions;type:json" json:"permissions,omitempty"`
	IsActive    bool            `gorm:"column:is_active;default:true"`

	// Company association for multi-tenancy
	// NULL = global role (system-wide), NOT NULL = company-specific role
	CompanyID *uuid.UUID `gorm:"column:company_id;type:varchar(36);index"`

	CreatedByID *uuid.UUID `gorm:"column:created_by_id;type:varchar(36);index"`
}

// (use datatypes.JSON directly for raw permissions payloads)

// AfterSave hook invalidates cached role permissions in Redis
func (r *Role) AfterSave(tx *gorm.DB) error {
	// best-effort: invalidate cache asynchronously
	go func(id uuid.UUID) {
		defer func() {
			_ = recover()
		}()
		cli := config.GetRedisClient()
		if cli == nil {
			return
		}
		ctx := context.Background()
		_ = cli.Del(ctx, fmt.Sprintf("role:permissions:%s", id.String())).Err()
	}(r.ID)
	return nil
}

// AfterDelete hook invalidates cached role permissions in Redis
func (r *Role) AfterDelete(tx *gorm.DB) error {
	go func(id uuid.UUID) {
		defer func() { _ = recover() }()
		cli := config.GetRedisClient()
		if cli == nil {
			return
		}
		ctx := context.Background()
		_ = cli.Del(ctx, fmt.Sprintf("role:permissions:%s", id.String())).Err()
	}(r.ID)
	return nil
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
