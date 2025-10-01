package migrations

import (
	"encoding/json"
	"errors"
	"log"

	basemodels "mimbackend/internal/models/basemodels"

	"gorm.io/gorm"
)

func createDefaultRoles(db *gorm.DB) {
	// System Level Roles
	systemRoles := []basemodels.Role{
		{
			Name:        stringPtr("super_admin"),
			Description: stringPtr("Sistem süper yöneticisi - tüm yetkilere sahip"),
			IsActive:    true,
			Permissions: permissionsToJSON(&basemodels.Permissions{
				Users:       &basemodels.PermissionDetail{Create: boolPtr(true), Read: boolPtr(true), Update: boolPtr(true), Delete: boolPtr(true)},
				Companies:   &basemodels.PermissionDetail{Create: boolPtr(true), Read: boolPtr(true), Update: boolPtr(true), Delete: boolPtr(true)},
				Branches:    &basemodels.PermissionDetail{Create: boolPtr(true), Read: boolPtr(true), Update: boolPtr(true), Delete: boolPtr(true)},
				Departments: &basemodels.PermissionDetail{Create: boolPtr(true), Read: boolPtr(true), Update: boolPtr(true), Delete: boolPtr(true)},
				Roles:       &basemodels.PermissionDetail{Create: boolPtr(true), Read: boolPtr(true), Update: boolPtr(true), Delete: boolPtr(true)},
				Reports:     &basemodels.PermissionDetail{Create: boolPtr(true), Read: boolPtr(true), Update: boolPtr(true), Delete: boolPtr(true)},
				Settings:    &basemodels.PermissionDetail{Create: boolPtr(true), Read: boolPtr(true), Update: boolPtr(true), Delete: boolPtr(true)},
			}),
		},
		{
			Name:        stringPtr("admin"),
			Description: stringPtr("Sistem yöneticisi - kullanıcı ve şirket yönetimi"),
			IsActive:    true,
			Permissions: permissionsToJSON(&basemodels.Permissions{
				Users:     &basemodels.PermissionDetail{Create: boolPtr(true), Read: boolPtr(true), Update: boolPtr(true), Delete: boolPtr(true)},
				Companies: &basemodels.PermissionDetail{Create: boolPtr(true), Read: boolPtr(true), Update: boolPtr(true), Delete: boolPtr(true)},
				Roles:     &basemodels.PermissionDetail{Create: boolPtr(false), Read: boolPtr(true), Update: boolPtr(false), Delete: boolPtr(false)},
			}),
		},
		{
			Name:        stringPtr("user"),
			Description: stringPtr("Normal kullanıcı - temel erişim"),
			IsActive:    true,
			Permissions: permissionsToJSON(&basemodels.Permissions{
				Users:     &basemodels.PermissionDetail{Create: boolPtr(false), Read: boolPtr(true), Update: boolPtr(false), Delete: boolPtr(false)},
				Companies: &basemodels.PermissionDetail{Create: boolPtr(false), Read: boolPtr(true), Update: boolPtr(false), Delete: boolPtr(false)},
			}),
		},
	}

	// Company Level Roles
	companyRoles := []basemodels.Role{
		{
			Name:        stringPtr("company_owner"),
			Description: stringPtr("Şirket sahibi - şirketinde tüm yetkilere sahip"),
			IsActive:    true,
			Permissions: permissionsToJSON(&basemodels.Permissions{
				Branches:    &basemodels.PermissionDetail{Create: boolPtr(true), Read: boolPtr(true), Update: boolPtr(true), Delete: boolPtr(true)},
				Departments: &basemodels.PermissionDetail{Create: boolPtr(true), Read: boolPtr(true), Update: boolPtr(true), Delete: boolPtr(true)},
				Users:       &basemodels.PermissionDetail{Create: boolPtr(true), Read: boolPtr(true), Update: boolPtr(true), Delete: boolPtr(true)},
				Reports:     &basemodels.PermissionDetail{Create: boolPtr(true), Read: boolPtr(true), Update: boolPtr(true), Delete: boolPtr(true)},
			}),
		},
		{
			Name:        stringPtr("company_admin"),
			Description: stringPtr("Şirket yöneticisi - çoğu yetkiye sahip"),
			IsActive:    true,
			Permissions: permissionsToJSON(&basemodels.Permissions{
				Branches:    &basemodels.PermissionDetail{Create: boolPtr(true), Read: boolPtr(true), Update: boolPtr(true), Delete: boolPtr(false)},
				Departments: &basemodels.PermissionDetail{Create: boolPtr(true), Read: boolPtr(true), Update: boolPtr(true), Delete: boolPtr(false)},
				Users:       &basemodels.PermissionDetail{Create: boolPtr(true), Read: boolPtr(true), Update: boolPtr(true), Delete: boolPtr(false)},
				Reports:     &basemodels.PermissionDetail{Create: boolPtr(true), Read: boolPtr(true), Update: boolPtr(true), Delete: boolPtr(false)},
			}),
		},
		{
			Name:        stringPtr("company_manager"),
			Description: stringPtr("Şirket müdürü - departman yönetimi"),
			IsActive:    true,
			Permissions: permissionsToJSON(&basemodels.Permissions{
				Users:   &basemodels.PermissionDetail{Create: boolPtr(false), Read: boolPtr(true), Update: boolPtr(true), Delete: boolPtr(false)},
				Reports: &basemodels.PermissionDetail{Create: boolPtr(true), Read: boolPtr(true), Update: boolPtr(true), Delete: boolPtr(false)},
			}),
		},
		{
			Name:        stringPtr("company_employee"),
			Description: stringPtr("Şirket çalışanı - temel erişim"),
			IsActive:    true,
			Permissions: permissionsToJSON(&basemodels.Permissions{
				Users:   &basemodels.PermissionDetail{Create: boolPtr(false), Read: boolPtr(true), Update: boolPtr(false), Delete: boolPtr(false)},
				Reports: &basemodels.PermissionDetail{Create: boolPtr(false), Read: boolPtr(true), Update: boolPtr(false), Delete: boolPtr(false)},
			}),
		},
	}

	// Create system roles
	for _, role := range systemRoles {
		var existing basemodels.Role
		if err := db.Where("name = ?", role.Name).First(&existing).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				if err := db.Create(&role).Error; err != nil {
					log.Printf("⚠️  Warning: could not create system role %s: %v", *role.Name, err)
				} else {
					log.Printf("✅ Created system role: %s", *role.Name)
				}
			}
		}
	}

	// Create company roles
	for _, role := range companyRoles {
		var existing basemodels.Role
		if err := db.Where("name = ?", role.Name).First(&existing).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				if err := db.Create(&role).Error; err != nil {
					log.Printf("⚠️  Warning: could not create company role %s: %v", *role.Name, err)
				} else {
					log.Printf("✅ Created company role: %s", *role.Name)
				}
			}
		}
	}
}

func boolPtr(b bool) *bool {
	return &b
}

func permissionsToJSON(p *basemodels.Permissions) *string {
	if p == nil {
		return nil
	}
	jsonBytes, err := json.Marshal(p)
	if err != nil {
		log.Printf("⚠️  Warning: could not marshal permissions to JSON: %v", err)
		return nil
	}
	jsonStr := string(jsonBytes)
	return &jsonStr
}
