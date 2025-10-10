package company

import (
	"database/sql/driver"
	"encoding/json"
	"time"

	"github.com/google/uuid"

	authmodels "mimbackend/internal/models/auth"
)

// Time alias for time.Time
type Time = time.Time

// CompanyModules - SaaS için company altında aktif modeller
type CompanyModules struct {
	Branches    bool `json:"branches"`
	Departments bool `json:"departments"`
	Employees   bool `json:"employees"`
	Projects    bool `json:"projects"`
	Invoices    bool `json:"invoices"`
	Reports     bool `json:"reports"`
	Settings    bool `json:"settings"`
}

// Scan implements sql.Scanner interface for GORM
func (m *CompanyModules) Scan(value interface{}) error {
	if value == nil {
		return nil
	}
	bytes, ok := value.([]byte)
	if !ok {
		return nil
	}
	return json.Unmarshal(bytes, m)
}

// Value implements driver.Valuer interface for GORM
func (m CompanyModules) Value() (driver.Value, error) {
	if (m == CompanyModules{}) {
		return nil, nil
	}
	return json.Marshal(m)
}

type Company struct {
	BaseModel

	// DEPRECATED: UserID kept for backward compatibility but should use CompanyMembers
	UserID *uuid.UUID `gorm:"column:user_id;type:varchar(36);index" json:"user_id,omitempty"`

	// SaaS Fields
	Slug        *string `gorm:"column:slug;type:varchar(100);uniqueIndex;not null" json:"slug"`
	IsActive    bool    `gorm:"column:is_active;default:true" json:"is_active"`
	PlanType    *string `gorm:"column:plan_type;type:varchar(50);default:'free'" json:"plan_type,omitempty"` // free, basic, premium, enterprise
	PlanExpires *Time   `gorm:"column:plan_expires" json:"plan_expires,omitempty"`

	Title         *string       `gorm:"column:unvani;type:varchar(255);uniqueIndex" json:"unvani,omitempty"`
	Name          *string       `gorm:"column:adi;type:varchar(255)" json:"name,omitempty"`
	Logo          *string       `gorm:"column:logo;type:varchar(512)" json:"logo,omitempty"`
	LogoAlternate *string       `gorm:"column:logo2;type:varchar(512)" json:"logo2,omitempty"`
	URL           *string       `gorm:"column:url;type:varchar(255)" json:"url,omitempty"`
	Email         *string       `gorm:"column:email;type:varchar(255)" json:"email,omitempty"`
	TaxOffice     *string       `gorm:"column:vd;type:varchar(255)" json:"vd,omitempty"`
	TaxNumber     *string       `gorm:"column:vn;type:varchar(255)" json:"vn,omitempty"`
	Phone         *string       `gorm:"column:phone;type:varchar(50)" json:"phone,omitempty"`
	PhoneAlt      *string       `gorm:"column:phone2;type:varchar(50)" json:"phone2,omitempty"`
	Fax           *string       `gorm:"column:fax;type:varchar(50)" json:"fax,omitempty"`
	CellPhone     *string       `gorm:"column:cellphone;type:varchar(50)" json:"cellphone,omitempty"`
	Address       *Address      `gorm:"column:address;type:json" json:"address,omitempty"`
	Coordinates   *Coordinates  `gorm:"column:coordinates;type:json" json:"coordinates,omitempty"`
	Mersis        *string       `gorm:"column:mersis;type:varchar(255)" json:"mersis,omitempty"`
	Chamber       *string       `gorm:"column:oda;type:varchar(255)" json:"oda,omitempty"`
	ChamberNumber *string       `gorm:"column:odano;type:varchar(255)" json:"odano,omitempty"`
	WorkingHours  *WorkingHours `gorm:"column:workinghours;type:json" json:"workinghours,omitempty"`
	Publish       bool          `gorm:"column:publish;default:true" json:"publish"`

	// Company Modules - SaaS için aktif modeller
	Modules *CompanyModules `gorm:"column:modules;type:json" json:"modules,omitempty"`

	// Relations
	Branches    []Branch        `gorm:"foreignKey:CompanyID" json:"branches,omitempty"`
	Departments []Department    `gorm:"foreignKey:CompanyID" json:"departments,omitempty"`
	Members     []CompanyMember `gorm:"foreignKey:CompanyID" json:"members,omitempty"` // Many-to-many through CompanyMember

	// Backward compatibility
	User *authmodels.User `gorm:"foreignKey:UserID;references:ID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL" json:"user,omitempty"`
}
