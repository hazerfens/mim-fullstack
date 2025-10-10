package migrations

import (
	"log"

	"mimbackend/internal/models/basemodels"

	"gorm.io/gorm"
)

// CreateCompanyOwnerRole creates the company_owner role if it doesn't exist
func CreateCompanyOwnerRole(db *gorm.DB) error {
	log.Println("Creating company_owner role...")

	// Check if company_owner role exists
	var existingRole basemodels.Role
	result := db.Where("name = ? AND company_id IS NULL", "company_owner").First(&existingRole)

	if result.Error == nil {
		log.Println("company_owner role already exists, skipping...")
		return nil
	}

	// Create company_owner role (no seeded per-model permissions).
	// Permission assignment is intentionally left to super_admin or
	// to explicit admin configuration via the UI/api.
	ownerRole := basemodels.Role{
		Name:        stringPtr("company_owner"),
		Description: stringPtr("Company owner (no seeded permissions)"),
		CompanyID:   nil, // Global role
	}

	if err := db.Create(&ownerRole).Error; err != nil {
		log.Printf("Error creating company_owner role: %v", err)
		return err
	}

	log.Println("company_owner role created successfully (no default permissions)")
	return nil
}
