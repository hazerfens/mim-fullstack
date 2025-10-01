package handlers

import (
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
		Title        *string     `json:"title"`
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

	// Validate required fields
	if req.Title == nil || *req.Title == "" {
		if req.Name == nil || *req.Name == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Company title or name is required"})
			return
		}
	}

	// Use title or name
	name := ""
	if req.Name != nil && *req.Name != "" {
		name = *req.Name
	} else if req.Title != nil {
		name = *req.Title
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

	if req.Title != nil {
		updates["unvani"] = req.Title
	}
	if req.Logo != nil {
		updates["logo"] = req.Logo
	}
	if req.Logo2 != nil {
		updates["logo2"] = req.Logo2
	}
	if req.Email != nil {
		updates["email"] = req.Email
	}
	if req.VD != nil {
		updates["vd"] = req.VD
	}
	if req.VN != nil {
		updates["vn"] = req.VN
	}
	if req.Mersis != nil {
		updates["mersis"] = req.Mersis
	}
	if req.Oda != nil {
		updates["oda"] = req.Oda
	}
	if req.OdaNo != nil {
		updates["odano"] = req.OdaNo
	}
	if req.Phone != nil {
		updates["phone"] = req.Phone
	}
	if req.Phone2 != nil {
		updates["phone2"] = req.Phone2
	}
	if req.Fax != nil {
		updates["fax"] = req.Fax
	}
	if req.Cellphone != nil {
		updates["cellphone"] = req.Cellphone
	}
	if req.URL != nil {
		updates["url"] = req.URL
	}
	if req.Address != nil {
		updates["address"] = req.Address
	}
	if req.Coordinates != nil {
		updates["coordinates"] = req.Coordinates
	}
	if req.WorkingHours != nil {
		updates["workinghours"] = req.WorkingHours
	}

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
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
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

	if err := services.DeleteCompany(companyID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete company"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Company deleted successfully"})
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
