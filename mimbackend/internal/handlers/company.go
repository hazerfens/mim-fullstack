package handlers

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	companymodels "mimbackend/internal/models/company"
	"mimbackend/internal/services"
)

// CreateCompanyHandler yeni company oluşturur
// @Summary Create a new company
// @Description Creates a new company for the authenticated user
// @Tags Company
// @Accept json
// @Produce json
// @Param request body object{title=string,name=string,slug=string,logo=string,logo2=string,email=string,vd=string,vn=string,mersis=string,oda=string,odano=string,phone=string,phone2=string,fax=string,cellphone=string,url=string,address=object,coordinates=object,workinghours=object} true "Company data"
// @Success 201 {object} companymodels.Company
// @Failure 400 {object} object{error=string}
// @Failure 401 {object} object{error=string}
// @Failure 500 {object} object{error=string}
// @Router /api/v1/company [post]
func CreateCompanyHandler(c *gin.Context) {
	// Get user from context (set by auth middleware)
	userIDVal, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	userID, ok := userIDVal.(uuid.UUID)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user ID"})
		return
	}

	var req struct {
		Unvani       *string     `json:"unvani"` // Company title (full name)
		Adi          *string     `json:"adi"`    // Short name
		Name         *string     `json:"name"`
		Slug         *string     `json:"slug"`
		Logo         *string     `json:"logo"`
		Logo2        *string     `json:"logo2"`
		Email        *string     `json:"email"`
		VD           *string     `json:"vd"`
		VN           *string     `json:"vn"`
		Mersis       *string     `json:"mersis"`
		Oda          *string     `json:"oda"`
		OdaNo        *string     `json:"odano"`
		Phone        *string     `json:"phone"`
		Phone2       *string     `json:"phone2"`
		Fax          *string     `json:"fax"`
		Cellphone    *string     `json:"cellphone"`
		URL          *string     `json:"url"`
		Address      interface{} `json:"address"`
		Coordinates  interface{} `json:"coordinates"`
		WorkingHours interface{} `json:"workinghours"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request data"})
		return
	}

	// Debug: Log received data
	fmt.Printf("Received company data: unvani=%v, adi=%v, email=%v, phone=%v\n", req.Unvani, req.Adi, req.Email, req.Phone)

	// Validate required fields
	if req.Unvani == nil || *req.Unvani == "" {
		if req.Name == nil || *req.Name == "" {
			if req.Adi == nil || *req.Adi == "" {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Company unvani, name or adi is required"})
				return
			}
		}
	}

	// Use unvani, name or adi for company name
	name := ""
	if req.Unvani != nil && *req.Unvani != "" {
		name = *req.Unvani
	} else if req.Name != nil && *req.Name != "" {
		name = *req.Name
	} else if req.Adi != nil {
		name = *req.Adi
	}

	slug := ""
	if req.Slug != nil && *req.Slug != "" {
		slug = *req.Slug
	} else {
		// Generate slug from name if not provided
		slug = name
	}

	// Create company
	company, err := services.CreateCompany(userID, name, slug)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Update with additional fields
	updates := make(map[string]interface{})

	if req.Unvani != nil && *req.Unvani != "" {
		updates["unvani"] = req.Unvani
	}
	if req.Adi != nil && *req.Adi != "" {
		updates["adi"] = req.Adi
	}
	// Note: "name" field should not be used, Company.Name maps to "adi" column

	// Handle logo URL
	if req.Logo != nil && *req.Logo != "" {
		updates["logo"] = req.Logo
	}

	// Handle logo2 URL
	if req.Logo2 != nil && *req.Logo2 != "" {
		updates["logo2"] = req.Logo2
	}

	if req.Email != nil && *req.Email != "" {
		updates["email"] = req.Email
	}
	if req.VD != nil && *req.VD != "" {
		updates["vd"] = req.VD
	}
	if req.VN != nil && *req.VN != "" {
		updates["vn"] = req.VN
	}
	if req.Mersis != nil && *req.Mersis != "" {
		updates["mersis"] = req.Mersis
	}
	if req.Oda != nil && *req.Oda != "" {
		updates["oda"] = req.Oda
	}
	if req.OdaNo != nil && *req.OdaNo != "" {
		updates["odano"] = req.OdaNo
	}
	if req.Phone != nil && *req.Phone != "" {
		updates["phone"] = req.Phone
	}
	if req.Phone2 != nil && *req.Phone2 != "" {
		updates["phone2"] = req.Phone2
	}
	if req.Fax != nil && *req.Fax != "" {
		updates["fax"] = req.Fax
	}
	if req.Cellphone != nil && *req.Cellphone != "" {
		updates["cellphone"] = req.Cellphone
	}
	if req.URL != nil && *req.URL != "" {
		updates["url"] = req.URL
	}

	// Handle JSON fields - convert map to typed struct so GORM can use Value() method
	if req.Address != nil {
		var address companymodels.Address
		jsonBytes, _ := json.Marshal(req.Address)
		if err := json.Unmarshal(jsonBytes, &address); err == nil {
			updates["address"] = &address
		}
	}
	if req.Coordinates != nil {
		var coordinates companymodels.Coordinates
		jsonBytes, _ := json.Marshal(req.Coordinates)
		if err := json.Unmarshal(jsonBytes, &coordinates); err == nil {
			updates["coordinates"] = &coordinates
		}
	}
	if req.WorkingHours != nil {
		var workingHours companymodels.WorkingHours
		jsonBytes, _ := json.Marshal(req.WorkingHours)
		if err := json.Unmarshal(jsonBytes, &workingHours); err == nil {
			updates["workinghours"] = &workingHours
		}
	}

	// Debug: Log updates
	fmt.Printf("Updates to apply: %d fields\n", len(updates))

	// Apply updates if any
	if len(updates) > 0 {
		if err := services.UpdateCompany(company.ID, updates); err != nil {
			// Company is created but update failed - still return success
			c.JSON(http.StatusCreated, company)
			return
		}

		// Fetch updated company
		updatedCompany, err := services.GetCompanyByID(company.ID)
		if err == nil {
			company = updatedCompany
		}
	}

	c.JSON(http.StatusCreated, company)
}

// GetUserCompaniesHandler kullanıcının company'lerini getirir
// @Summary Get user's companies
// @Description Returns all companies the user is a member of
// @Tags Company
// @Produce json
// @Success 200 {array} companymodels.Company
// @Failure 401 {object} object{error=string}
// @Failure 500 {object} object{error=string}
// @Router /api/v1/company [get]
func GetUserCompaniesHandler(c *gin.Context) {
	// Get user from context (set by auth middleware)
	userIDVal, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	userID, ok := userIDVal.(uuid.UUID)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user ID"})
		return
	}

	companies, err := services.GetUserCompanies(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get companies"})
		return
	}

	c.JSON(http.StatusOK, companies)
}

// SwitchActiveCompanyHandler kullanıcının aktif company'sini değiştirir
// @Summary Switch active company
// @Description Sets the active company for the current user
// @Tags Company
// @Accept json
// @Produce json
// @Param request body object{company_id=string} true "Company ID"
// @Success 200 {object} object{message=string,company_id=string}
// @Failure 400 {object} object{error=string}
// @Failure 401 {object} object{error=string}
// @Failure 403 {object} object{error=string}
// @Failure 500 {object} object{error=string}
// @Router /api/v1/company/switch [post]
func SwitchActiveCompanyHandler(c *gin.Context) {
	userIDVal, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	userID, ok := userIDVal.(uuid.UUID)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user ID"})
		return
	}

	var req struct {
		CompanyID string `json:"company_id" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request data"})
		return
	}

	companyID, err := uuid.Parse(req.CompanyID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid company ID"})
		return
	}

	if err := services.SwitchActiveCompany(userID, companyID); err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":    "Company switched successfully",
		"company_id": req.CompanyID,
	})
}

// GetActiveCompanyHandler kullanıcının aktif company'sini getirir
// @Summary Get active company
// @Description Returns the current active company for the user
// @Tags Company
// @Produce json
// @Success 200 {object} companymodels.Company
// @Failure 401 {object} object{error=string}
// @Failure 404 {object} object{error=string}
// @Failure 500 {object} object{error=string}
// @Router /api/v1/company/active [get]
func GetActiveCompanyHandler(c *gin.Context) {
	userIDVal, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	userID, ok := userIDVal.(uuid.UUID)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user ID"})
		return
	}

	company, err := services.GetUserActiveCompany(userID)
	if err != nil {
		// If user has no companies, return null instead of error
		if err.Error() == "user has no companies" {
			c.JSON(http.StatusOK, nil)
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, company)
}

// GetCompanyHandler slug ile company getirir
// @Summary Get company by slug
// @Description Returns company details by slug
// @Tags Company
// @Produce json
// @Param slug path string true "Company slug"
// @Success 200 {object} companymodels.Company
// @Failure 404 {object} object{error=string}
// @Failure 500 {object} object{error=string}
// @Router /api/v1/company/{slug} [get]
func GetCompanyHandler(c *gin.Context) {
	slug := c.Param("slug")
	if slug == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Company slug is required"})
		return
	}

	company, err := services.GetCompanyBySlug(slug)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, company)
}

// UpdateCompanyHandler company günceller
// @Summary Update company
// @Description Updates company information
// @Tags Company
// @Accept json
// @Produce json
// @Param id path string true "Company ID"
// @Param request body object{title=string,name=string,modules=object} true "Company update data"
// @Success 200 {object} object{message=string}
// @Failure 400 {object} object{error=string}
// @Failure 401 {object} object{error=string}
// @Failure 403 {object} object{error=string}
// @Failure 404 {object} object{error=string}
// @Failure 500 {object} object{error=string}
// @Router /api/v1/company/{id} [put]
func UpdateCompanyHandler(c *gin.Context) {
	companyIDStr := c.Param("id")
	companyID, err := uuid.Parse(companyIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid company ID"})
		return
	}

	// Get user from context
	userIDVal, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	userID, ok := userIDVal.(uuid.UUID)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user ID"})
		return
	}

	// Check if user owns the company
	company, err := services.GetCompanyByID(companyID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Company not found"})
		return
	}

	if company.UserID == nil || *company.UserID != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	var req struct {
		Title   *string                       `json:"title"`
		Name    *string                       `json:"name"`
		Modules *companymodels.CompanyModules `json:"modules"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request data"})
		return
	}

	updates := make(map[string]interface{})

	if req.Title != nil {
		updates["title"] = req.Title
	}
	if req.Name != nil {
		updates["name"] = req.Name
	}
	if req.Modules != nil {
		updates["modules"] = req.Modules
	}

	if len(updates) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No fields to update"})
		return
	}

	if err := services.UpdateCompany(companyID, updates); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update company"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Company updated successfully"})
}

// DeleteCompanyHandler company'yi siler (soft delete)
// @Summary Delete company
// @Description Soft deletes a company
// @Tags Company
// @Param id path string true "Company ID"
// @Success 200 {object} object{message=string}
// @Failure 401 {object} object{error=string}
// @Failure 403 {object} object{error=string}
// @Failure 404 {object} object{error=string}
// @Failure 500 {object} object{error=string}
// @Router /api/v1/company/{id} [delete]
func DeleteCompanyHandler(c *gin.Context) {
	companyIDStr := c.Param("id")
	companyID, err := uuid.Parse(companyIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid company ID"})
		return
	}

	// Get user from context
	userIDVal, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	userID, ok := userIDVal.(uuid.UUID)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user ID"})
		return
	}

	// Check if user owns the company
	company, err := services.GetCompanyByID(companyID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Company not found"})
		return
	}

	if company.UserID == nil || *company.UserID != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	// Delete company with logging
	if err := services.DeleteCompany(companyID, userID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete company"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Company deleted successfully"})
}

// DeleteCompanyPermanentHandler permanently deletes a company and all related data.
// Only the company owner may perform this action.
// @Summary Permanently delete company
// @Description Permanently deletes a company and all related records and files
// @Tags Company
// @Param id path string true "Company ID"
// @Success 200 {object} object{message=string}
// @Failure 400 {object} object{error=string}
// @Failure 401 {object} object{error=string}
// @Failure 403 {object} object{error=string}
// @Failure 404 {object} object{error=string}
// @Failure 500 {object} object{error=string}
// @Router /api/v1/company/{id}/permanent [delete]
func DeleteCompanyPermanentHandler(c *gin.Context) {
	companyIDStr := c.Param("id")
	companyID, err := uuid.Parse(companyIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid company ID"})
		return
	}

	// Get user from context
	userIDVal, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	userID, ok := userIDVal.(uuid.UUID)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user ID"})
		return
	}

	// Check ownership
	company, err := services.GetCompanyByID(companyID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Company not found"})
		return
	}

	if company.UserID == nil || *company.UserID != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	// Call service to purge
	if err := services.PurgeCompany(companyID, userID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to permanently delete company"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Company permanently deleted"})
}

// RequestExportBackgroundHandler starts a background export job for a company and emails a download link to the owner.
func RequestExportBackgroundHandler(c *gin.Context) {
	companyIDStr := c.Param("id")
	companyID, err := uuid.Parse(companyIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid company ID"})
		return
	}

	// Read models from JSON body: { models: ["members","roles"] }
	var req struct {
		Models []string `json:"models"`
	}
	if err := c.BindJSON(&req); err != nil {
		// allow empty body
		req.Models = []string{}
	}

	// Parse access_token cookie as fallback if Authorization header is not present
	var userID uuid.UUID
	if v, exists := c.Get("user_id"); exists {
		if uid, ok := v.(uuid.UUID); ok {
			userID = uid
		}
	}
	// If middleware didn't set user, try cookie
	if userID == uuid.Nil {
		cookie, err := c.Cookie("access_token")
		if err != nil || cookie == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
			return
		}
		claims, err := services.ValidateJWT(cookie)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token"})
			return
		}
		userID = claims.UserID
	}

	company, err := services.GetCompanyByID(companyID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Company not found"})
		return
	}
	if company.UserID == nil || *company.UserID != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only company owner can request an export"})
		return
	}

	// Start background goroutine
	go func() {
		_, err := services.StartExportJob(companyID, userID, req.Models)
		if err != nil {
			// log error
			log.Printf("background export failed: %v", err)
		}
	}()

	c.JSON(http.StatusAccepted, gin.H{"message": "Export started; you will receive an email with a download link when ready."})
}

// DownloadExportHandler returns the exported file by token. Requires authentication.
func DownloadExportHandler(c *gin.Context) {
	token := c.Query("token")
	if token == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "token is required"})
		return
	}

	rec, ok := services.GetExport(token)
	if !ok {
		c.JSON(http.StatusNotFound, gin.H{"error": "export not found or expired"})
		return
	}

	// Validate requester is the same user who initiated export
	var userID uuid.UUID
	if v, exists := c.Get("user_id"); exists {
		if uid, ok := v.(uuid.UUID); ok {
			userID = uid
		}
	}
	if userID == uuid.Nil {
		// try cookie
		cookie, err := c.Cookie("access_token")
		if err != nil || cookie == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
			return
		}
		claims, err := services.ValidateJWT(cookie)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token"})
			return
		}
		userID = claims.UserID
	}

	if userID != rec.UserID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Forbidden"})
		return
	}

	c.Header("Content-Type", "application/json")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", rec.Filename))
	c.Writer.WriteHeader(http.StatusOK)
	c.Writer.Write(rec.Data)
}

// GetActiveCompaniesHandler tüm aktif company'leri getirir (admin)
// @Summary Get all active companies
// @Description Returns all active companies (admin only)
// @Tags Company
// @Produce json
// @Success 200 {array} companymodels.Company
// @Failure 401 {object} object{error=string}
// @Failure 403 {object} object{error=string}
// @Failure 500 {object} object{error=string}
// @Router /api/v1/admin/companies [get]
func GetActiveCompaniesHandler(c *gin.Context) {
	// Check if user is admin (you might want to implement role checking)
	// For now, just check if user exists
	_, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	companies, err := services.GetActiveCompanies()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get companies"})
		return
	}

	c.JSON(http.StatusOK, companies)
}

// UpdateCompanyModulesHandler company modüllerini günceller (admin)
// @Summary Update company modules
// @Description Updates company modules (admin only)
// @Tags Company
// @Accept json
// @Produce json
// @Param id path string true "Company ID"
// @Param request body companymodels.CompanyModules true "Company modules"
// @Success 200 {object} object{message=string}
// @Failure 400 {object} object{error=string}
// @Failure 401 {object} object{error=string}
// @Failure 403 {object} object{error=string}
// @Failure 404 {object} object{error=string}
// @Failure 500 {object} object{error=string}
// @Router /api/v1/admin/company/{id}/modules [put]
func UpdateCompanyModulesHandler(c *gin.Context) {
	companyIDStr := c.Param("id")
	companyID, err := uuid.Parse(companyIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid company ID"})
		return
	}

	// Check if user is admin
	_, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var modules companymodels.CompanyModules
	if err := c.ShouldBindJSON(&modules); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid modules data"})
		return
	}

	if err := services.UpdateCompanyModules(companyID, &modules); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update company modules"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Company modules updated successfully"})
}

// IsModuleActiveHandler modül aktif mi kontrol eder
// @Summary Check if module is active
// @Description Checks if a specific module is active for a company
// @Tags Company
// @Produce json
// @Param slug path string true "Company slug"
// @Param module path string true "Module name"
// @Success 200 {object} object{active=bool}
// @Failure 400 {object} object{error=string}
// @Failure 404 {object} object{error=string}
// @Failure 500 {object} object{error=string}
// @Router /api/v1/company/{slug}/module/{module} [get]
func IsModuleActiveHandler(c *gin.Context) {
	slug := c.Param("slug")
	module := c.Param("module")

	if slug == "" || module == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Company slug and module are required"})
		return
	}

	active, err := services.IsModuleActive(slug, module)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"active": active})
}
