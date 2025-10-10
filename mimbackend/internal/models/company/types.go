package company

import (
	"database/sql/driver"
	"encoding/json"
)

type Address struct {
	Street     *string `json:"street,omitempty"`
	City       *string `json:"city,omitempty"`
	State      *string `json:"state,omitempty"`
	Country    *string `json:"country,omitempty"`
	PostalCode *string `json:"postal_code,omitempty"`
}

// Scan implements sql.Scanner interface for GORM
func (a *Address) Scan(value interface{}) error {
	if value == nil {
		return nil
	}
	bytes, ok := value.([]byte)
	if !ok {
		return nil
	}
	return json.Unmarshal(bytes, a)
}

// Value implements driver.Valuer interface for GORM
func (a Address) Value() (driver.Value, error) {
	return json.Marshal(a)
}

type Coordinates struct {
	Lat *float64 `json:"lat,omitempty"`
	Lng *float64 `json:"lng,omitempty"`
}

// Scan implements sql.Scanner interface for GORM
func (c *Coordinates) Scan(value interface{}) error {
	if value == nil {
		return nil
	}
	bytes, ok := value.([]byte)
	if !ok {
		return nil
	}
	return json.Unmarshal(bytes, c)
}

// Value implements driver.Valuer interface for GORM
func (c Coordinates) Value() (driver.Value, error) {
	return json.Marshal(c)
}

type DayHours struct {
	Open   *string `json:"open,omitempty"`
	Close  *string `json:"close,omitempty"`
	Closed *bool   `json:"closed,omitempty"`
}

type WorkingHours struct {
	Monday    *DayHours `json:"monday,omitempty"`
	Tuesday   *DayHours `json:"tuesday,omitempty"`
	Wednesday *DayHours `json:"wednesday,omitempty"`
	Thursday  *DayHours `json:"thursday,omitempty"`
	Friday    *DayHours `json:"friday,omitempty"`
	Saturday  *DayHours `json:"saturday,omitempty"`
	Sunday    *DayHours `json:"sunday,omitempty"`
}

// Scan implements sql.Scanner interface for GORM
func (w *WorkingHours) Scan(value interface{}) error {
	if value == nil {
		return nil
	}
	bytes, ok := value.([]byte)
	if !ok {
		return nil
	}
	return json.Unmarshal(bytes, w)
}

// Value implements driver.Valuer interface for GORM
func (w WorkingHours) Value() (driver.Value, error) {
	return json.Marshal(w)
}
