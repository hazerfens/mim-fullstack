package services

import (
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
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

	// Transaction içinde company, rol ve member oluştur
	var company *companymodels.Company
	var ownerRole basemodels.Role

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

		// Create or assign default roles for this company. System (global) roles are stored
		// as `company_id IS NULL` and act as immutable templates for default behavior.
		// Instead of cloning those templates into per-company rows, prefer referencing
		// the global role directly. Only if a system template does not exist do we create
		// a company-scoped role for the company.

		// Helper to find a global template role; if none exists, create a company-scoped fallback.
		cloneOrCreateRole := func(roleName string, createFallback func() basemodels.Role) (basemodels.Role, error) {
			var template basemodels.Role
			if err := tx.Where("name = ? AND company_id IS NULL", roleName).First(&template).Error; err == nil {
				// Use the global template role as-is (do not clone)
				log.Printf("Using global template role '%s' for new company %s", roleName, company.ID.String())
				return template, nil
			}
			// No global template found — create a company-scoped role as fallback
			fallback := createFallback()
			fallback.CompanyID = &company.ID
			fallback.CreatedByID = &userID
			if err := tx.Create(&fallback).Error; err != nil {
				return basemodels.Role{}, fmt.Errorf("failed to create fallback role %s: %w", roleName, err)
			}
			log.Printf("Created company-scoped role '%s' for company %s", roleName, company.ID.String())
			return fallback, nil
		}

		// Owner - full permissions
		ownerRole, err = cloneOrCreateRole("company_owner", func() basemodels.Role {
			ownerPerm := &basemodels.Permissions{
				Users:       fullPermissionDetail(),
				Companies:   fullPermissionDetail(),
				Branches:    fullPermissionDetail(),
				Departments: fullPermissionDetail(),
				Roles:       fullPermissionDetail(),
				Reports:     fullPermissionDetail(),
				Settings:    fullPermissionDetail(),
			}
			return basemodels.Role{
				Name:        stringPtr("company_owner"),
				Description: stringPtr("Company owner with full permissions"),
				Permissions: permissionsToJSON(ownerPerm),
				IsActive:    true,
			}
		})
		if err != nil {
			return err
		}

		// Admin - broad permissions
		_, err = cloneOrCreateRole("company_admin", func() basemodels.Role {
			adminPerm := &basemodels.Permissions{
				Users:       fullPermissionDetail(),
				Companies:   readOnlyPermissionDetail(),
				Branches:    fullPermissionDetail(),
				Departments: fullPermissionDetail(),
				Roles:       fullPermissionDetail(),
				Reports:     fullPermissionDetail(),
				Settings:    readOnlyPermissionDetail(),
			}
			return basemodels.Role{
				Name:        stringPtr("company_admin"),
				Description: stringPtr("Company administrator"),
				Permissions: permissionsToJSON(adminPerm),
				IsActive:    true,
			}
		})
		if err != nil {
			return err
		}

		// Manager - limited management
		_, err = cloneOrCreateRole("company_manager", func() basemodels.Role {
			managerPerm := &basemodels.Permissions{
				Users:       readOnlyPermissionDetail(),
				Companies:   readOnlyPermissionDetail(),
				Branches:    readOnlyPermissionDetail(),
				Departments: fullPermissionDetail(),
				Roles:       readOnlyPermissionDetail(),
				Reports:     fullPermissionDetail(),
				Settings:    readOnlyPermissionDetail(),
			}
			return basemodels.Role{
				Name:        stringPtr("company_manager"),
				Description: stringPtr("Department/Project manager"),
				Permissions: permissionsToJSON(managerPerm),
				IsActive:    true,
			}
		})
		if err != nil {
			return err
		}

		// Employee - read only
		_, err = cloneOrCreateRole("company_employee", func() basemodels.Role {
			employeePerm := &basemodels.Permissions{
				Users:       readOnlyPermissionDetail(),
				Companies:   readOnlyPermissionDetail(),
				Branches:    readOnlyPermissionDetail(),
				Departments: readOnlyPermissionDetail(),
				Roles:       readOnlyPermissionDetail(),
				Reports:     readOnlyPermissionDetail(),
				Settings:    readOnlyPermissionDetail(),
			}
			return basemodels.Role{
				Name:        stringPtr("company_employee"),
				Description: stringPtr("Standard company employee"),
				Permissions: permissionsToJSON(employeePerm),
				IsActive:    true,
			}
		})
		if err != nil {
			return err
		}

		// Company member olarak ekle (owner)
		now := time.Now()
		member := &companymodels.CompanyMember{
			UserID:    userID,
			CompanyID: company.ID,
			RoleID:    ownerRole.ID,
			IsOwner:   true,
			IsActive:  true,
			Status:    "active",
			JoinedAt:  &now,
		}

		if err := tx.Create(member).Error; err != nil {
			return fmt.Errorf("failed to create company member: %w", err)
		}

		// User'ın active company'sini set et
		if err := tx.Model(&authmodels.User{}).Where("id = ?", userID).Update("active_company_id", company.ID).Error; err != nil {
			return fmt.Errorf("failed to set active company: %w", err)
		}

		// Ensure the creating user has a system-level 'customer' role unless they
		// already have a higher-level system role (super_admin/admin) or are
		// already customer. This keeps company and system roles separated: the
		// user becomes 'customer' in the global/system scope and 'company_owner'
		// for the new company.
		var u authmodels.User
		if err := tx.Where("id = ?", userID).First(&u).Error; err == nil {
			// if user is not super_admin/admin/customer then assign customer
			curRole := u.Role
			if curRole != "super_admin" && curRole != "admin" && curRole != "customer" {
				var customerRole basemodels.Role
				if err := tx.Where("name = ? AND company_id IS NULL", "customer").First(&customerRole).Error; err != nil {
					// create system customer role if not present
					customerRole = basemodels.Role{
						Name:        stringPtr("customer"),
						Description: stringPtr("Customer (system)"),
						IsActive:    true,
					}
					if cErr := tx.Create(&customerRole).Error; cErr != nil {
						log.Printf("warning: failed to create global customer role: %v", cErr)
					} else {
						log.Printf("created fallback global customer role: %s", customerRole.ID.String())
					}
				}
				// assign customer role to user
				if customerRole.ID != uuid.Nil {
					if err := tx.Model(&authmodels.User{}).Where("id = ?", userID).Updates(map[string]interface{}{"role_id": customerRole.ID, "role": "customer"}).Error; err != nil {
						return fmt.Errorf("failed to assign customer role to user: %w", err)
					}
				}
			}
		}

		return nil
	})

	if err != nil {
		return nil, err
	}

	// After transaction commit: create default company policies (no Casbin)
	domain := BuildDomainID(&company.ID)

	// Company-level policies (informational) — persisted by role JSON and user assignments
	_ = domain // kept for clarity; policies are enforced via role JSON and membership

	// Assign the creating user to the company_owner role (persisted via CompanyMember created above)
	if ownerRole.Name != nil {
		log.Printf("assigned owner role %s to user %s for company %s", *ownerRole.Name, userID.String(), company.ID.String())
	}

	return company, nil
}

// permissionsToJSON converts Permissions struct to *datatypes.JSON for storing in DB
func permissionsToJSON(p *basemodels.Permissions) *datatypes.JSON {
	if p == nil {
		return nil
	}
	b, err := json.Marshal(p)
	if err != nil {
		return nil
	}
	d := datatypes.JSON(b)
	return &d
}

// Helper to create a PermissionDetail where all operations are allowed
func fullPermissionDetail() *basemodels.PermissionDetail {
	t := true
	return &basemodels.PermissionDetail{Create: &t, Read: &t, Update: &t, Delete: &t}
}

// Helper to create a PermissionDetail where only read is allowed
func readOnlyPermissionDetail() *basemodels.PermissionDetail {
	t := true
	f := false
	return &basemodels.PermissionDetail{Create: &f, Read: &t, Update: &f, Delete: &f}
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

	// Eğer aktif company yoksa, kullanıcının ilk company'sini aktif yap
	if user.ActiveCompanyID == nil {
		companies, err := GetUserCompanies(userID)
		if err != nil {
			return nil, err
		}

		if len(companies) == 0 {
			return nil, errors.New("user has no companies")
		}

		// İlk company'yi aktif yap
		firstCompanyID := companies[0].ID
		if err := db.Model(&authmodels.User{}).Where("id = ?", userID).
			Update("active_company_id", firstCompanyID).Error; err != nil {
			return nil, fmt.Errorf("failed to set active company: %w", err)
		}

		return &companies[0], nil
	}

	return GetCompanyByID(*user.ActiveCompanyID)
}

// UpdateCompany Company günceller
func UpdateCompany(id uuid.UUID, updates map[string]interface{}) error {
	db, err := config.NewConnection()
	if err != nil {
		return err
	}

	// JSON fields are already converted to proper structs in the handler
	// GORM will call their Value() methods for JSON serialization
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
func DeleteCompany(id uuid.UUID, deletedBy uuid.UUID) error {
	db, err := config.NewConnection()
	if err != nil {
		return err
	}

	// Wrap DB modifications in a transaction: soft-delete company and its roles
	var roleNames []string
	err = db.Transaction(func(tx *gorm.DB) error {
		updates := map[string]interface{}{
			"is_active":  false,
			"deleted_at": time.Now(),
			"deleted_by": deletedBy,
		}

		if err := tx.Model(&companymodels.Company{}).Where("id = ?", id).Updates(updates).Error; err != nil {
			return err
		}

		// Soft-delete company-scoped roles
		var roles []basemodels.Role
		if err := tx.Where("company_id = ? AND is_active = ?", id, true).Find(&roles).Error; err != nil {
			return err
		}

		if len(roles) > 0 {
			roleUpdates := map[string]interface{}{
				"is_active":  false,
				"deleted_at": time.Now(),
				"deleted_by": deletedBy,
			}
			if err := tx.Model(&basemodels.Role{}).Where("company_id = ?", id).Updates(roleUpdates).Error; err != nil {
				return err
			}

			for _, r := range roles {
				if r.Name != nil {
					roleNames = append(roleNames, *r.Name)
				}
			}
		}

		// Soft-delete company members
		if err := tx.Model(&companymodels.CompanyMember{}).
			Where("company_id = ? AND is_active = ?", id, true).
			Updates(map[string]interface{}{
				"is_active":  false,
				"deleted_at": time.Now(),
				"deleted_by": deletedBy,
			}).Error; err != nil {
			return err
		}

		// Soft-delete pending invitations for this company
		if err := tx.Model(&companymodels.CompanyInvitation{}).
			Where("company_id = ? AND status != ?", id, "cancelled").
			Updates(map[string]interface{}{
				"status":     "cancelled",
				"deleted_at": time.Now(),
				"deleted_by": deletedBy,
			}).Error; err != nil {
			return err
		}

		// Soft-delete branches and departments
		if err := tx.Model(&companymodels.Branch{}).
			Where("company_id = ?", id).
			Updates(map[string]interface{}{
				"is_active":  false,
				"deleted_at": time.Now(),
				"deleted_by": deletedBy,
			}).Error; err != nil {
			return err
		}

		if err := tx.Model(&companymodels.Department{}).
			Where("company_id = ?", id).
			Updates(map[string]interface{}{
				"is_active":  false,
				"deleted_at": time.Now(),
				"deleted_by": deletedBy,
			}).Error; err != nil {
			return err
		}

		return nil
	})

	if err != nil {
		return err
	}

	// After transaction commit, remove Casbin policies and groupings for this company domain
	if err := RemovePoliciesForCompany(id); err != nil {
		// Log and return error so caller is aware that policy cleanup failed
		log.Printf("⚠️  Failed to clean policies for deleted company %s: %v", id.String(), err)
		return err
	}

	log.Printf("✅ Company deleted: company_id=%s, deleted_by=%s", id, deletedBy)
	return nil
}

// PurgeCompany permanently deletes a company and all related data (hard delete).
// Use with caution: this removes DB records and company files on disk.
func PurgeCompany(id uuid.UUID, performedBy uuid.UUID) error {
	db, err := config.NewConnection()
	if err != nil {
		return err
	}

	// Fetch company to obtain slug for file deletion
	var company companymodels.Company
	if err := db.Where("id = ?", id).First(&company).Error; err != nil {
		return err
	}

	// Begin transaction to remove DB records
	err = db.Transaction(func(tx *gorm.DB) error {
		// Remove policies and groupings for domain (do before deleting roles)
		if err := RemovePoliciesForCompany(id); err != nil {
			return err
		}

		// Permanently delete dependent records first to satisfy FK constraints:
		// 1. Company members (references roles)
		// 2. Invitations (may reference roles)
		// 3. Branches and Departments
		// 4. Roles
		if err := tx.Unscoped().Where("company_id = ?", id).Delete(&companymodels.CompanyMember{}).Error; err != nil {
			return err
		}
		if err := tx.Unscoped().Where("company_id = ?", id).Delete(&companymodels.CompanyInvitation{}).Error; err != nil {
			return err
		}
		if err := tx.Unscoped().Where("company_id = ?", id).Delete(&companymodels.Branch{}).Error; err != nil {
			return err
		}
		if err := tx.Unscoped().Where("company_id = ?", id).Delete(&companymodels.Department{}).Error; err != nil {
			return err
		}
		// Now it's safe to delete roles belonging to the company.
		if err := tx.Unscoped().Where("company_id = ?", id).Delete(&basemodels.Role{}).Error; err != nil {
			return err
		}

		// Finally delete company record
		if err := tx.Unscoped().Where("id = ?", id).Delete(&companymodels.Company{}).Error; err != nil {
			return err
		}

		return nil
	})

	if err != nil {
		return err
	}

	// Remove company files from disk (best-effort)
	if company.Slug != nil && *company.Slug != "" {
		// Remove directory public/companies/<slug>
		dirPath := filepath.Join("public", "companies", *company.Slug)
		_ = os.RemoveAll(dirPath) // don't return error if file deletion fails; we've already purged DB
	}

	log.Printf("🗑️  Company purged permanently: company_id=%s, performed_by=%s", id, performedBy)
	return nil
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
