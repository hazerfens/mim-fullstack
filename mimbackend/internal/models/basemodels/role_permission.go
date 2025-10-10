package basemodels

import (
	"github.com/google/uuid"
	"gorm.io/datatypes"
)

// RolePermission represents a single permission rule belonging to a Role.
type RolePermission struct {
	BaseModel

	RoleID     uuid.UUID      `gorm:"type:varchar(36);not null;index;uniqueIndex:idx_role_resource_action" json:"role_id"`
	Resource   string         `gorm:"type:varchar(100);not null;index;uniqueIndex:idx_role_resource_action" json:"resource"`
	Action     string         `gorm:"type:varchar(50);not null;uniqueIndex:idx_role_resource_action" json:"action"`
	Effect     string         `gorm:"type:varchar(10);not null;default:'allow'" json:"effect"`
	Conditions datatypes.JSON `gorm:"type:json" json:"conditions,omitempty"`
	Priority   int            `gorm:"default:0" json:"priority"`

	// Timestamps are included via BaseModel
}

// TableName specifies the table name
func (RolePermission) TableName() string {
	return "role_permissions"
}

// Simple helper for creating a new RolePermission row from data
func NewRolePermission(roleID uuid.UUID, resource, action, effect string, conditions []byte, priority int) RolePermission {
	rp := RolePermission{
		RoleID:   roleID,
		Resource: resource,
		Action:   action,
		Effect:   effect,
		Priority: priority,
	}
	if len(conditions) > 0 {
		rp.Conditions = datatypes.JSON(conditions)
	}
	return rp
}
