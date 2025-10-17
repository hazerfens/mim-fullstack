package basemodels

import "encoding/xml"

// SovosGetUserListRequest - SOVOS E-Fatura GetUserList isteği
type SovosGetUserListRequest struct {
	XMLName    xml.Name `xml:"GetUserList"`
	Identifier string   `xml:"Identifier"`
	VKN_TCKN   string   `xml:"VKN_TCKN"`
	Role       string   `xml:"Role"`
	Filter_VKN string   `xml:"Filter_VKN_TCKN"`
}

// SovosUser - SOVOS'tan dönen mükellef bilgisi
type SovosUser struct {
	VKN           string `xml:"VKN"`
	Unvan         string `xml:"Unvan"`
	Alias         string `xml:"Alias"`
	Type          string `xml:"Type"` // e-fatura tipi
	Adres1        string `xml:"Adres1"`
	Adres2        string `xml:"Adres2"`
	Telefon1      string `xml:"Telefon1"`
	Telefon2      string `xml:"Telefon2"`
	Email         string `xml:"Email"`
	Rol           string `xml:"Rol"`
	Status        string `xml:"Status"` // e-fatura durum: Aktif/Pasif
	KDVDurum      string `xml:"KDVDurum"`
	EFaturaStatus string `xml:"EFaturaStatus"` // Aktif/Pasif
}

// SovosGetUserListResponse - SOVOS'tan dönen cevap
type SovosGetUserListResponse struct {
	XMLName  xml.Name    `xml:"GetUserListResponse"`
	UserList []SovosUser `xml:"GetUserListResult>User"`
}

// SovosVerificationResult - Backend'den frontend'e dönen sonuç
type SovosVerificationResult struct {
	IsEfatura     bool   `json:"is_efattura"`
	SovosVerified bool   `json:"sovos_verified"`
	SovosUnvan    string `json:"sovos_unvan"`
	Message       string `json:"message"`
	Status        string `json:"status"`
	EFaturaStatus string `json:"efattura_status"` // Aktif/Pasif
}
