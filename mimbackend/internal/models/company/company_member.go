package company

import (
	"time"

	authmodels "mimbackend/internal/models/auth"
	basemodels "mimbackend/internal/models/basemodels"

	"github.com/google/uuid"
)

// CompanyMember represents a user's membership in a company with their role
// This enables multi-tenancy where users can belong to multiple companies
type CompanyMember struct {
	basemodels.BaseModel

	// Foreign Keys
	UserID    uuid.UUID `gorm:"type:varchar(36);not null;index:idx_user_company,priority:1" json:"user_id"`
	CompanyID uuid.UUID `gorm:"type:varchar(36);not null;index:idx_user_company,priority:2" json:"company_id"`
	RoleID    uuid.UUID `gorm:"type:varchar(36);not null;index" json:"role_id"`

	// Member Properties
	IsOwner  bool       `gorm:"default:false" json:"is_owner"`                   // Company owner (creator)
	IsActive bool       `gorm:"default:true" json:"is_active"`                   // Active member
	Status   string     `gorm:"type:varchar(20);default:'active'" json:"status"` // active, pending, suspended
	JoinedAt *time.Time `gorm:"type:datetime" json:"joined_at,omitempty"`        // When user joined company

	// Relations
	User    *authmodels.User `gorm:"foreignKey:UserID;constraint:OnDelete:CASCADE" json:"user,omitempty"`
	Company *Company         `gorm:"foreignKey:CompanyID;constraint:OnDelete:CASCADE" json:"company,omitempty"`
	Role    *basemodels.Role `gorm:"foreignKey:RoleID;constraint:OnDelete:RESTRICT" json:"role,omitempty"`
}

// TableName specifies the table name for CompanyMember
func (CompanyMember) TableName() string {
	return "company_members"
}
