package services

import (
	"bytes"
	"encoding/xml"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"

	"mimbackend/internal/models/basemodels"
)

// SovosService - SOVOS E-Fatura entegrasyonu
type SovosService struct {
	wsdlURL  string
	username string
	password string
	role     string
	vkno     string // Kendi VKN'miz (sorgulayan)
}

// NewSovosService - Yeni SOVOS service instance'ı oluştur
func NewSovosService() (*SovosService, error) {
	username := os.Getenv("SOVOS_USERNAME")
	password := os.Getenv("SOVOS_PASSWORD")
	wsdlURL := os.Getenv("SOVOS_WSDL_URL")
	vkno := os.Getenv("SOVOS_VKNO")
	role := "PK" // Varsayılan rol

	if username == "" || password == "" || wsdlURL == "" || vkno == "" {
		return nil, fmt.Errorf("SOVOS configuration missing: check SOVOS_USERNAME, SOVOS_PASSWORD, SOVOS_WSDL_URL, SOVOS_VKNO")
	}

	return &SovosService{
		wsdlURL:  wsdlURL,
		username: username,
		password: password,
		vkno:     vkno,
		role:     role,
	}, nil
}

// buildSOAPRequest - Mükellef sorgulama için SOAP XML oluştur (getPartialUserList metodu)
func (s *SovosService) buildSOAPRequest(vknTC, role string) []byte {
	namespace := "http://fitcons.com/eInvoice/"
	identifier := "urn:mail:" + s.username

	soapRequest := fmt.Sprintf(`<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ein="%s">
   <soapenv:Header/>
   <soapenv:Body>
      <ein:getPartialUserListRequest>
         <ein:Identifier>%s</ein:Identifier>
         <ein:VKN_TCKN>%s</ein:VKN_TCKN>
         <ein:Role>%s</ein:Role>
         <ein:IncludeBinary>false</ein:IncludeBinary>
      </ein:getPartialUserListRequest>
   </soapenv:Body>
</soapenv:Envelope>`,
		namespace,  // Namespace
		identifier, // Identifier (urn:mail:username)
		vknTC,      // SORGULANACAK VKN/TC
		role,       // Role (PK veya GB)
	)

	return []byte(soapRequest)
}

// VerifyTaxInfo - TC/VKN ile SOVOS'tan şirket bilgisini doğrula
func (s *SovosService) VerifyTaxInfo(vknTC, role string) (*basemodels.SovosVerificationResult, error) {
	if vknTC == "" {
		return nil, fmt.Errorf("VKN/TC boş olamaz")
	}

	if role == "" {
		role = "PK" // Varsayılan rol
	}

	log.Printf("[SOVOS] Mükellef sorgulanıyor - VKN/TC: %s, Role: %s\n", vknTC, role)

	// SOAP request oluştur (sorgulanacak VKN ile)
	soapBody := s.buildSOAPRequest(vknTC, role)

	log.Printf("[SOVOS] SOAP Request:\n%s\n", string(soapBody))

	req, err := http.NewRequest("POST", s.wsdlURL, bytes.NewBuffer(soapBody))
	if err != nil {
		return nil, fmt.Errorf("request oluşturma hatası: %w", err)
	}

	req.Header.Add("Content-Type", "text/xml; charset=UTF-8")
	req.Header.Add("SOAPAction", "http://fitcons.com/eInvoice/getPartialUserList")
	req.SetBasicAuth(s.username, s.password)

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("HTTP hatası: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("response okuma hatası: %w", err)
	}

	log.Printf("[SOVOS] Response status: %d\n", resp.StatusCode)
	log.Printf("[SOVOS] Raw response:\n%s\n", string(body))

	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("SOVOS API HTTP error: %d - %s", resp.StatusCode, string(body))
	}

	parsedResp, err := s.parseSoapResponse(body)
	if err != nil {
		log.Printf("[SOVOS] Response parse hatası: %v\n", err)
		return &basemodels.SovosVerificationResult{
			SovosVerified: false,
			IsEfatura:     false,
			Message:       fmt.Sprintf("SOVOS API hatası: %v", err),
		}, nil
	}

	result := &basemodels.SovosVerificationResult{
		SovosVerified: false,
		IsEfatura:     false,
		Message:       "Mükellef e-fatura sisteminde kayıtlı değil",
	}

	if len(parsedResp.UserList) > 0 {
		user := parsedResp.UserList[0]
		result.SovosUnvan = user.Unvan
		result.EFaturaStatus = user.EFaturaStatus

		// E-Fatura durumu kontrolü
		// type değerleri kontrol edilmeli (dokümantasyona göre)
		// Genelde type boş değilse e-fatura aktiftir
		if user.Type != "" {
			result.IsEfatura = true
			result.SovosVerified = true
			result.Message = fmt.Sprintf("✓ E-Fatura aktif - Firma: %s (Tip: %s)", user.Unvan, user.Type)
			log.Printf("[SOVOS] ✓ Mükellef e-fatura aktif: %s (VKN: %s, Tip: %s)\n", user.Unvan, user.VKN, user.Type)
		} else {
			result.IsEfatura = false
			result.SovosVerified = true
			result.Message = fmt.Sprintf("E-Arşiv kullanılacak - Firma: %s", user.Unvan)
			log.Printf("[SOVOS] Mükellef e-arşiv: %s\n", user.Unvan)
		}
	} else {
		log.Printf("[SOVOS] VKN/TC %s için kayıt bulunamadı\n", vknTC)
		result.Message = "Bu VKN/TC için SOVOS'ta kayıt bulunamadı"
	}

	return result, nil
}

// parseSoapResponse - SOAP response'unu parse et
func (s *SovosService) parseSoapResponse(xmlData []byte) (*basemodels.SovosGetUserListResponse, error) {
	// SOAP Fault kontrolü
	type Fault struct {
		FaultCode   string `xml:"faultcode"`
		FaultString string `xml:"faultstring"`
	}

	type SoapFault struct {
		XMLName xml.Name `xml:"Envelope"`
		Body    struct {
			Fault Fault `xml:"Fault"`
		} `xml:"Body"`
	}

	var faultEnv SoapFault
	if err := xml.Unmarshal(xmlData, &faultEnv); err == nil && faultEnv.Body.Fault.FaultString != "" {
		log.Printf("[SOVOS] SOAP Fault: %s (kod: %s)\n", faultEnv.Body.Fault.FaultString, faultEnv.Body.Fault.FaultCode)
		return nil, fmt.Errorf("SOAP Fault: %s (kod: %s)", faultEnv.Body.Fault.FaultString, faultEnv.Body.Fault.FaultCode)
	}

	// getPartialUserListResponse formatı
	type User struct {
		VKN          string `xml:"vkn"`
		Unvan        string `xml:"unvan"`
		Alias        string `xml:"alias"`
		Type         string `xml:"type"`
		FirstCreTime string `xml:"firstCreationTime"`
		AliasCreTime string `xml:"aliasCreationTime"`
	}

	type GetPartialUserListResponse struct {
		Users []User `xml:"User"`
	}

	type SoapBody struct {
		GetPartialUserListResponse GetPartialUserListResponse `xml:"getPartialUserListResponse"`
	}

	type SoapEnvelope struct {
		XMLName xml.Name `xml:"Envelope"`
		Body    SoapBody `xml:"Body"`
	}

	var envelope SoapEnvelope
	if err := xml.Unmarshal(xmlData, &envelope); err != nil {
		return nil, fmt.Errorf("XML parse hatası: %w", err)
	}

	result := &basemodels.SovosGetUserListResponse{
		UserList: make([]basemodels.SovosUser, 0),
	}

	// User listesi dönüyor
	for _, user := range envelope.Body.GetPartialUserListResponse.Users {
		if user.VKN != "" {
			result.UserList = append(result.UserList, basemodels.SovosUser{
				VKN:           user.VKN,
				Unvan:         user.Unvan,
				Alias:         user.Alias,
				Type:          user.Type,
				EFaturaStatus: user.Type,
			})
		}
	}

	return result, nil
}
