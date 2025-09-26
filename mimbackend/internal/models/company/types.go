package company

type Address struct {
	Street     *string `json:"street,omitempty"`
	City       *string `json:"city,omitempty"`
	State      *string `json:"state,omitempty"`
	Country    *string `json:"country,omitempty"`
	PostalCode *string `json:"postal_code,omitempty"`
}

type Coordinates struct {
	Latitude  *float64 `json:"latitude,omitempty"`
	Longitude *float64 `json:"longitude,omitempty"`
}

type WorkingHours struct {
	Monday    *string `json:"monday,omitempty"`
	Tuesday   *string `json:"tuesday,omitempty"`
	Wednesday *string `json:"wednesday,omitempty"`
	Thursday  *string `json:"thursday,omitempty"`
	Friday    *string `json:"friday,omitempty"`
	Saturday  *string `json:"saturday,omitempty"`
	Sunday    *string `json:"sunday,omitempty"`
}
