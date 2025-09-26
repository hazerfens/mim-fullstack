package company

import (
	"github.com/google/uuid"

	authmodels "mimbackend/internal/models/auth"
)

type Company struct {
	BaseModel

	UserID *uuid.UUID `gorm:"column:user_id;type:varchar(36);index"`

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

	Branches    []Branch     `gorm:"foreignKey:CompanyID"`
	Departments []Department `gorm:"foreignKey:CompanyID"`

	User *authmodels.User `gorm:"foreignKey:UserID;references:ID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL"`
}
