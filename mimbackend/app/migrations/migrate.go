package migrations

import (
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"log"
	"mimbackend/config"
	models "mimbackend/internal/models/auth"
	basemodels "mimbackend/internal/models/basemodels"
	companymodels "mimbackend/internal/models/company"
	"strings"

	"gorm.io/gorm"
)

func stringPtr(s string) *string {
	return &s
}

type sessionTokenPayload struct {
	Token string `json:"token"`
}

func RunMigrations() {
	db, err := config.NewConnection()
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	migrator := db.Migrator()

	// Drop legacy index on the token column if it exists.
	if migrator.HasIndex(&models.Session{}, "idx_sessions_token") {
		_ = migrator.DropIndex(&models.Session{}, "idx_sessions_token")
	}
	if migrator.HasIndex(&models.Session{}, "token") {
		_ = migrator.DropIndex(&models.Session{}, "token")
	}

	if err := migrator.AutoMigrate(
		&models.User{},
		&models.Account{},
		&models.Session{},
		&models.VerificationToken{},
		&models.OTP{},
		&models.PasswordResetRequest{},
		&models.UserSession{},    // User session tracking
		&models.UserPermission{}, // User-specific permissions
		&basemodels.Role{},
		&companymodels.Company{},
		&companymodels.CompanyMember{}, // Multi-tenancy: User-Company relationship
		&companymodels.Branch{},
		&companymodels.Department{},
	); err != nil {
		log.Fatalf("Failed to run migrations: %v", err)
	}

	// Ensure token_data and token_hash columns exist (AutoMigrate should add them, but double-check).
	if !migrator.HasColumn(&models.Session{}, "token_data") {
		if err := migrator.AddColumn(&models.Session{}, "token_data"); err != nil {
			log.Fatalf("Failed to add token_data column: %v", err)
		}
	}
	if !migrator.HasColumn(&models.Session{}, "token_hash") {
		if err := migrator.AddColumn(&models.Session{}, "token_hash"); err != nil {
			log.Fatalf("Failed to add token_hash column: %v", err)
		}
	}

	// Backfill token JSON and hashes from legacy token column or existing JSON.
	type legacySession struct {
		ID        string
		Token     sql.NullString
		TokenData []byte
	}

	var legacyRows []legacySession
	if err := db.Table("sessions").Find(&legacyRows).Error; err != nil {
		log.Fatalf("Failed to load legacy sessions for backfill: %v", err)
	}

	for _, row := range legacyRows {
		var token string

		if len(row.TokenData) > 0 {
			var payload sessionTokenPayload
			if err := json.Unmarshal(row.TokenData, &payload); err == nil {
				token = strings.TrimSpace(payload.Token)
			}
		}

		if token == "" && row.Token.Valid {
			token = strings.TrimSpace(row.Token.String)
		}

		if token == "" {
			continue
		}

		payload := sessionTokenPayload{Token: token}
		payloadJSON, err := json.Marshal(payload)
		if err != nil {
			log.Fatalf("Failed to marshal token payload for session %s: %v", row.ID, err)
		}

		hash := sha256.Sum256([]byte(token))
		tokenHash := hex.EncodeToString(hash[:])

		updates := map[string]interface{}{
			"token_data": payloadJSON,
			"token_hash": tokenHash,
		}

		if err := db.Table("sessions").Where("id = ?", row.ID).Updates(updates).Error; err != nil {
			log.Fatalf("Failed to backfill session %s: %v", row.ID, err)
		}
	}

	// Nothing to do for token_hash deduplication anymore; we rely on token_data JSON.

	// Drop legacy token column if it still exists.
	if migrator.HasColumn(&models.Session{}, "token") {
		if err := migrator.DropColumn(&models.Session{}, "token"); err != nil {
			log.Printf("⚠️  Warning: could not drop legacy token column: %v", err)
		}
	}

	// No token_hash index needed when storing token in JSON.

	// Create default roles if they don't exist
	createDefaultRoles(db)

	// Create default admin user if no users exist
	createDefaultAdminUser(db)

	log.Println("✅ Migrations applied successfully")
}

func createDefaultAdminUser(db *gorm.DB) {
	// Check if any users exist
	var userCount int64
	if err := db.Model(&models.User{}).Count(&userCount).Error; err != nil {
		log.Printf("⚠️  Warning: could not count users: %v", err)
		return
	}

	// If users exist, don't create default admin
	if userCount > 0 {
		log.Println("ℹ️  Users already exist, skipping default admin creation")
		return
	}

	// Find super_admin role
	var superAdminRole basemodels.Role
	if err := db.Where("name = ?", "super_admin").First(&superAdminRole).Error; err != nil {
		log.Printf("⚠️  Warning: super_admin role not found, cannot create default admin user: %v", err)
		return
	}

	// Hash default password
	defaultPassword := "admin123"
	hash := sha256.Sum256([]byte(defaultPassword))
	passwordHash := hex.EncodeToString(hash[:])

	// Create default admin user
	adminUser := &models.User{
		Email:        "admin@mimreklam.com",
		FullName:     stringPtr("System Administrator"),
		PasswordHash: passwordHash,
		IsVerified:   true,
		RoleID:       &superAdminRole.ID,
		Role:         "super_admin",
	}

	if err := db.Create(adminUser).Error; err != nil {
		log.Printf("⚠️  Warning: could not create default admin user: %v", err)
		return
	}

	log.Printf("✅ Created default admin user: %s (password: %s)", adminUser.Email, defaultPassword)
}
