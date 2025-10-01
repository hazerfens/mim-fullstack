package services

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"mimbackend/config"
	authmodels "mimbackend/internal/models/auth"
	basemodels "mimbackend/internal/models/basemodels"
	companymodels "mimbackend/internal/models/company"
)

// CreateCompany SaaS için yeni company oluşturur ve kullanıcıyı owner olarak ekler
func CreateCompany(userID uuid.UUID, name, slug string) (*companymodels.Company, error) {
	if name == "" || slug == "" {
		return nil, errors.New("company name and slug are required")
	}

	db, err := config.NewConnection()
	if err != nil {
		return nil, err
	}

	// Slug'ı normalize et
	normalizedSlug := normalizeSlug(slug)

	// Slug'ın unique olduğunu kontrol et
	var existingCompany companymodels.Company
	if err := db.Where("slug = ?", normalizedSlug).First(&existingCompany).Error; err == nil {
		return nil, errors.New("company slug already exists")
	}

	// Default modules
	defaultModules := &companymodels.CompanyModules{
		Branches:    true,
		Departments: true,
		Employees:   false,
		Projects:    false,
		Invoices:    false,
		Reports:     false,
		Settings:    true,
	}

	// Transaction içinde company ve member oluştur
	var company *companymodels.Company
	err = db.Transaction(func(tx *gorm.DB) error {
		// Company oluştur
		company = &companymodels.Company{
			UserID:   &userID, // Backward compatibility
			Name:     &name,
			Slug:     &normalizedSlug,
			IsActive: true,
			PlanType: stringPtr("free"),
			Modules:  defaultModules,
			Publish:  true,
		}

		if err := tx.Create(company).Error; err != nil {
			return fmt.Errorf("failed to create company: %w", err)
		}

		// Owner rolünü bul (veya default admin rolü)
		var ownerRole basemodels.Role
		// TODO: Burada company-specific default admin role'ü oluşturulmalı
		// Şimdilik global admin role kullanıyoruz
		if err := tx.Where("name = ? AND company_id IS NULL", "admin").First(&ownerRole).Error; err != nil {
			// Eğer admin role yoksa super_admin kullan
			if err := tx.Where("name = ? AND company_id IS NULL", "super_admin").First(&ownerRole).Error; err != nil {
				return fmt.Errorf("no default role found for company owner")
			}
		}

		// Company member olarak ekle (owner)
		member := &companymodels.CompanyMember{
			UserID:    userID,
			CompanyID: company.ID,
			RoleID:    ownerRole.ID,
			IsOwner:   true,
			IsActive:  true,
			Status:    "active",
		}

		if err := tx.Create(member).Error; err != nil {
			return fmt.Errorf("failed to create company member: %w", err)
		}

		// User'ın active company'sini set et
		if err := tx.Model(&authmodels.User{}).Where("id = ?", userID).Update("active_company_id", company.ID).Error; err != nil {
			return fmt.Errorf("failed to set active company: %w", err)
		}

		return nil
	})

	if err != nil {
		return nil, err
	}

	return company, nil
}

// GetCompanyBySlug Slug ile company getirir
func GetCompanyBySlug(slug string) (*companymodels.Company, error) {
	db, err := config.NewConnection()
	if err != nil {
		return nil, err
	}

	var company companymodels.Company
	if err := db.Where("slug = ? AND is_active = ?", slug, true).
		Preload("Branches").
		Preload("Departments").
		First(&company).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("company not found or inactive")
		}
		return nil, err
	}
	return &company, nil
}

// GetCompanyByID ID ile company getirir
func GetCompanyByID(id uuid.UUID) (*companymodels.Company, error) {
	db, err := config.NewConnection()
	if err != nil {
		return nil, err
	}

	var company companymodels.Company
	if err := db.Where("id = ?", id).
		Preload("Branches").
		Preload("Departments").
		First(&company).Error; err != nil {
		return nil, err
	}
	return &company, nil
}

// GetUserCompanies Kullanıcının member olduğu tüm company'leri getirir
func GetUserCompanies(userID uuid.UUID) ([]companymodels.Company, error) {
	db, err := config.NewConnection()
	if err != nil {
		return nil, err
	}

	var companies []companymodels.Company
	// CompanyMember üzerinden user'ın member olduğu company'leri getir
	if err := db.
		Joins("JOIN company_members ON company_members.company_id = companies.id").
		Where("company_members.user_id = ? AND company_members.is_active = ?", userID, true).
		Preload("Members").
		Preload("Branches").
		Preload("Departments").
		Order("companies.created_at DESC").
		Find(&companies).Error; err != nil {
		return nil, err
	}
	return companies, nil
}

// GetUserCompanyMembership Kullanıcının bir company'deki membership bilgilerini getirir
func GetUserCompanyMembership(userID, companyID uuid.UUID) (*companymodels.CompanyMember, error) {
	db, err := config.NewConnection()
	if err != nil {
		return nil, err
	}

	var member companymodels.CompanyMember
	if err := db.Where("user_id = ? AND company_id = ?", userID, companyID).
		Preload("Role").
		Preload("Company").
		First(&member).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("user is not a member of this company")
		}
		return nil, err
	}

	return &member, nil
}

// SwitchActiveCompany Kullanıcının aktif company'sini değiştirir
func SwitchActiveCompany(userID, companyID uuid.UUID) error {
	db, err := config.NewConnection()
	if err != nil {
		return err
	}

	// Kullanıcının bu company'nin member'ı olduğunu kontrol et
	var member companymodels.CompanyMember
	if err := db.Where("user_id = ? AND company_id = ? AND is_active = ?", userID, companyID, true).
		First(&member).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return errors.New("user is not an active member of this company")
		}
		return err
	}

	// Active company'yi güncelle
	if err := db.Model(&authmodels.User{}).Where("id = ?", userID).
		Update("active_company_id", companyID).Error; err != nil {
		return fmt.Errorf("failed to switch active company: %w", err)
	}

	return nil
}

// GetUserActiveCompany Kullanıcının aktif company'sini getirir
func GetUserActiveCompany(userID uuid.UUID) (*companymodels.Company, error) {
	db, err := config.NewConnection()
	if err != nil {
		return nil, err
	}

	var user authmodels.User
	if err := db.Where("id = ?", userID).First(&user).Error; err != nil {
		return nil, err
	}

	if user.ActiveCompanyID == nil {
		return nil, errors.New("user has no active company")
	}

	return GetCompanyByID(*user.ActiveCompanyID)
}

// UpdateCompany Company günceller
func UpdateCompany(id uuid.UUID, updates map[string]interface{}) error {
	db, err := config.NewConnection()
	if err != nil {
		return err
	}

	if err := db.Model(&companymodels.Company{}).Where("id = ?", id).Updates(updates).Error; err != nil {
		return err
	}
	return nil
}

// UpdateCompanyModules Company modüllerini günceller
func UpdateCompanyModules(companyID uuid.UUID, modules *companymodels.CompanyModules) error {
	updates := map[string]interface{}{
		"modules": modules,
	}
	return UpdateCompany(companyID, updates)
}

// DeleteCompany Company'yi soft delete yapar
func DeleteCompany(id uuid.UUID) error {
	updates := map[string]interface{}{
		"is_active":  false,
		"deleted_at": time.Now(),
	}
	return UpdateCompany(id, updates)
}

// IsModuleActive Company için belirli modül aktif mi kontrol eder
func IsModuleActive(companySlug, moduleName string) (bool, error) {
	company, err := GetCompanyBySlug(companySlug)
	if err != nil {
		return false, err
	}

	if company.Modules == nil {
		return false, nil
	}

	switch strings.ToLower(moduleName) {
	case "branches":
		return company.Modules.Branches, nil
	case "departments":
		return company.Modules.Departments, nil
	case "employees":
		return company.Modules.Employees, nil
	case "projects":
		return company.Modules.Projects, nil
	case "invoices":
		return company.Modules.Invoices, nil
	case "reports":
		return company.Modules.Reports, nil
	case "settings":
		return company.Modules.Settings, nil
	default:
		return false, fmt.Errorf("unknown module: %s", moduleName)
	}
}

// GetActiveCompanies Tüm aktif company'leri getirir (admin için)
func GetActiveCompanies() ([]companymodels.Company, error) {
	db, err := config.NewConnection()
	if err != nil {
		return nil, err
	}

	var companies []companymodels.Company
	if err := db.Where("is_active = ?", true).
		Preload("User").
		Order("created_at DESC").
		Find(&companies).Error; err != nil {
		return nil, err
	}
	return companies, nil
}

// normalizeSlug Slug'ı URL-friendly hale getirir
func normalizeSlug(slug string) string {
	// Küçük harfe çevir
	slug = strings.ToLower(slug)

	// Türkçe karakterleri değiştir
	replacements := map[string]string{
		"ç": "c", "ğ": "g", "ı": "i", "ö": "o", "ş": "s", "ü": "u",
		"Ç": "c", "Ğ": "g", "İ": "i", "Ö": "o", "Ş": "s", "Ü": "u",
	}

	for old, new := range replacements {
		slug = strings.ReplaceAll(slug, old, new)
	}

	// Sadece alfanumerik karakterler ve tire bırak
	var result strings.Builder
	for _, r := range slug {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '-' || r == '_' {
			result.WriteRune(r)
		} else if r == ' ' {
			result.WriteRune('-')
		}
	}

	// Başındaki ve sonundaki tireleri temizle
	normalized := strings.Trim(result.String(), "-")

	// Boş string ise default slug ver
	if normalized == "" {
		normalized = fmt.Sprintf("company-%d", time.Now().Unix())
	}

	return normalized
}

// stringPtr string pointer oluşturur
func stringPtr(s string) *string {
	return &s
}
