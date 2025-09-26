package company

import (
	authmodels "mimbackend/internal/models/auth"

	"github.com/google/uuid"
)

type Branch struct {
	BaseModel

	CompanyID uuid.UUID `gorm:"column:company_id;type:varchar(36);index"`
	Name      *string   `gorm:"column:name;type:varchar(255)"`
	Address   *Address  `gorm:"column:address;type:json"`
	Phone     *string   `gorm:"column:phone;type:varchar(50)"`

	AuthorizedUserID *uuid.UUID `gorm:"column:authorized_user_id;type:varchar(36);index"`
	ManagerID        *uuid.UUID `gorm:"column:manager_id;type:varchar(36);index"`

	Company        Company          `gorm:"constraint:OnUpdate:CASCADE,OnDelete:CASCADE"`
	AuthorizedUser *authmodels.User `gorm:"foreignKey:AuthorizedUserID;references:ID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL"`
	Manager        *authmodels.User `gorm:"foreignKey:ManagerID;references:ID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL"`
}
