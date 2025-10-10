package basemodels

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type BaseModel struct {
	ID        uuid.UUID      `gorm:"type:varchar(36);primaryKey;not null" json:"id"`
	CreatedAt time.Time      `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt time.Time      `gorm:"autoUpdateTime" json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`                  // soft delete için gerekli
	DeletedBy *uuid.UUID     `gorm:"type:varchar(36);index" json:"deleted_by,omitempty"` // silen kullanıcının ID'si
}

// BeforeCreate hook to generate UUID before saving to database
func (b *BaseModel) BeforeCreate(tx *gorm.DB) error {
	// Only generate UUID if it's nil or zero value
	if b.ID == uuid.Nil || b.ID.String() == "00000000-0000-0000-0000-000000000000" {
		b.ID = uuid.New()
	}
	return nil
}
