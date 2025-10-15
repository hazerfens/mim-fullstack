package models

import (
	"database/sql/driver"
	"encoding/json"
	"time"

	basemodels "mimbackend/internal/models/basemodels"

	"github.com/google/uuid"
	"gorm.io/datatypes"
)

// UserPermission kullanıcıya özel izinler ve kısıtlamalar
type UserPermission struct {
	basemodels.BaseModel

	UserID   uuid.UUID `gorm:"type:varchar(36);not null;index" json:"user_id"`
	Resource string    `gorm:"type:varchar(50);not null" json:"resource"` // users, roles, settings, reports
	Action   string    `gorm:"type:varchar(20);not null" json:"action"`   // create, read, update, delete
	// Domain allows scoping the permission (e.g. company:<uuid>), default '*' means all domains
	Domain          string           `gorm:"type:varchar(64);default:'*'" json:"domain"`
	IsAllowed       bool             `gorm:"default:true" json:"is_allowed"`
	TimeRestriction *TimeRestriction `gorm:"type:json" json:"time_restriction,omitempty"`
	// AllowedIPs stored as JSON array of IPs or CIDRs (e.g. ["10.0.0.1","192.168.1.0/24"])
	AllowedIPs datatypes.JSON `gorm:"type:json" json:"allowed_ips,omitempty"`
	Priority   int            `gorm:"default:0" json:"priority"` // Yüksek priority role izinlerini override eder

	// Relations
	User User `gorm:"foreignKey:UserID;constraint:OnDelete:CASCADE" json:"-"`
}

// TimeRestriction zaman bazlı kısıtlamalar
type TimeRestriction struct {
	// Hafta günleri (Monday=1, Sunday=7)
	AllowedDays []int `json:"allowed_days,omitempty"` // [1,2,3,4,5] = Pazartesi-Cuma

	// Saat aralığı (24-saat formatı)
	StartTime string `json:"start_time,omitempty"` // "08:00"
	EndTime   string `json:"end_time,omitempty"`   // "18:00"

	// Tarih aralığı
	StartDate *time.Time `json:"start_date,omitempty"` // Belirli bir tarihten sonra
	EndDate   *time.Time `json:"end_date,omitempty"`   // Belirli bir tarihe kadar
}

// Scan implements sql.Scanner interface
func (tr *TimeRestriction) Scan(value interface{}) error {
	if value == nil {
		return nil
	}

	bytes, ok := value.([]byte)
	if !ok {
		return nil
	}

	return json.Unmarshal(bytes, tr)
}

// Value implements driver.Valuer interface
func (tr TimeRestriction) Value() (driver.Value, error) {
	return json.Marshal(tr)
}

// IsAllowedAtTime belirli bir zamanda izin verilip verilmediğini kontrol eder
func (tr *TimeRestriction) IsAllowedAtTime(t time.Time) bool {
	if tr == nil {
		return true // Kısıtlama yoksa her zaman izinli
	}

	// Tarih kontrolü
	if tr.StartDate != nil && t.Before(*tr.StartDate) {
		return false
	}
	if tr.EndDate != nil && t.After(*tr.EndDate) {
		return false
	}

	// Gün kontrolü
	if len(tr.AllowedDays) > 0 {
		weekday := int(t.Weekday())
		if weekday == 0 {
			weekday = 7 // Sunday = 7
		}

		allowed := false
		for _, day := range tr.AllowedDays {
			if day == weekday {
				allowed = true
				break
			}
		}
		if !allowed {
			return false
		}
	}

	// Saat kontrolü
	if tr.StartTime != "" && tr.EndTime != "" {
		currentTime := t.Format("15:04")
		if currentTime < tr.StartTime || currentTime > tr.EndTime {
			return false
		}
	}

	return true
}

// TableName specifies table name
func (UserPermission) TableName() string {
	return "user_permissions"
}
