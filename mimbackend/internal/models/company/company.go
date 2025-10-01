package company

import (
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

type Company struct {
	BaseModel

	// DEPRECATED: UserID kept for backward compatibility but should use CompanyMembers
	UserID *uuid.UUID `gorm:"column:user_id;type:varchar(36);index"`

	// SaaS Fields
	Slug        *string `gorm:"column:slug;type:varchar(100);uniqueIndex;not null"`
	IsActive    bool    `gorm:"column:is_active;default:true"`
	PlanType    *string `gorm:"column:plan_type;type:varchar(50);default:'free'"` // free, basic, premium, enterprise
	PlanExpires *Time   `gorm:"column:plan_expires"`

	Title         *string       `gorm:"column:unvani;type:varchar(255);uniqueIndex"`
	Name          *string       `gorm:"column:adi;type:varchar(255)"`
	Logo          *string       `gorm:"column:logo;type:varchar(512)"`
	LogoAlternate *string       `gorm:"column:logo2;type:varchar(512)"`
	URL           *string       `gorm:"column:url;type:varchar(255)"`
	Email         *string       `gorm:"column:email;type:varchar(255)"`
	TaxOffice     *string       `gorm:"column:vd;type:varchar(255)"`
	TaxNumber     *string       `gorm:"column:vn;type:varchar(255)"`
	Phone         *string       `gorm:"column:phone;type:varchar(50)"`
	PhoneAlt      *string       `gorm:"column:phone2;type:varchar(50)"`
	Fax           *string       `gorm:"column:fax;type:varchar(50)"`
	CellPhone     *string       `gorm:"column:cellphone;type:varchar(50)"`
	Address       *Address      `gorm:"column:address;type:json"`
	Coordinates   *Coordinates  `gorm:"column:coordinates;type:json"`
	Mersis        *string       `gorm:"column:mersis;type:varchar(255)"`
	Chamber       *string       `gorm:"column:oda;type:varchar(255)"`
	ChamberNumber *string       `gorm:"column:odano;type:varchar(255)"`
	WorkingHours  *WorkingHours `gorm:"column:workinghours;type:json"`
	Publish       bool          `gorm:"column:publish;default:true"`

	// Company Modules - SaaS için aktif modeller
	Modules *CompanyModules `gorm:"column:modules;type:json"`

	// Relations
	Branches    []Branch        `gorm:"foreignKey:CompanyID"`
	Departments []Department    `gorm:"foreignKey:CompanyID"`
	Members     []CompanyMember `gorm:"foreignKey:CompanyID"` // Many-to-many through CompanyMember

	// Backward compatibility
	User *authmodels.User `gorm:"foreignKey:UserID;references:ID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL"`
}
