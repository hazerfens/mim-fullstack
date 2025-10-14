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
	"mimbackend/internal/services"
	"strings"

	"gorm.io/datatypes"
	"gorm.io/gorm"
)

func stringPtr(s string) *string {
	return &s
}

func boolPtr(b bool) *bool { return &b }

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
		&companymodels.CompanyMember{},     // Multi-tenancy: User-Company relationship
		&companymodels.CompanyInvitation{}, // Company invitations
		&companymodels.Branch{},
		&companymodels.Department{},
	); err != nil {
		log.Fatalf("Failed to run migrations: %v", err)
	}

	// Migrate role_permissions table (new normalized permissions)
	if err := migrator.AutoMigrate(&basemodels.RolePermission{}); err != nil {
		log.Fatalf("Failed to migrate role_permissions: %v", err)
	}

	// Permission catalog for model-agnostic permission names
	if err := migrator.AutoMigrate(&basemodels.Permission{}); err != nil {
		log.Fatalf("Failed to migrate permissions catalog: %v", err)
	}

	// Ensure a unique composite index on user_permissions to prevent duplicates
	if err := EnsureUserPermissionUniqueIndex(db); err != nil {
		// Log a warning but continue — operator should inspect duplicate rows
		log.Printf("⚠️  Warning: could not create unique index on user_permissions: %v", err)
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

	// Create default roles if they don't exist (roles created without
	// model-derived permissions — permissions will be managed by admins).
	createDefaultRoles(db)

	// Backfill role_permissions from any existing Role.Permissions JSON
	backfillRolePermissions(db)

	// Create company_owner role
	if err := CreateCompanyOwnerRole(db); err != nil {
		log.Printf("⚠️  Warning: could not create company_owner role: %v", err)
	}

	// Create default admin user if no users exist
	createDefaultAdminUser(db)

	// Legacy address column migration removed — these columns are no longer dropped automatically.

	log.Println("✅ Migrations applied successfully")
}

// createDefaultRoles ensures common system roles exist (non-destructive)
func createDefaultRoles(db *gorm.DB) {
	// Note: Do NOT seed model-derived permissions here. Permissions are
	// managed by administrators via the catalog (Option A). We still create
	// the system roles but leave permissions empty so admins can assign them.

	defaults := []struct {
		Role  basemodels.Role
		Perms *basemodels.Permissions
	}{
		{Role: basemodels.Role{Name: stringPtr("super_admin"), Description: stringPtr("Super administrator"), IsActive: true}, Perms: nil},
		{Role: basemodels.Role{Name: stringPtr("admin"), Description: stringPtr("System administrator"), IsActive: true}, Perms: nil},
		{Role: basemodels.Role{Name: stringPtr("user"), Description: stringPtr("Default user role"), IsActive: true}, Perms: nil},
		{Role: basemodels.Role{Name: stringPtr("company_owner"), Description: stringPtr("Company owner (alias)"), IsActive: true}, Perms: nil},
		{Role: basemodels.Role{Name: stringPtr("customer"), Description: stringPtr("Customer role (limited)"), IsActive: true}, Perms: nil},
	}

	for _, d := range defaults {
		var existing basemodels.Role
		if err := db.Where("name = ?", d.Role.Name).First(&existing).Error; err != nil {
			// create role and optionally seed permissions
			roleToCreate := d.Role
			if d.Perms != nil {
				if raw, jErr := json.Marshal(d.Perms); jErr == nil {
					dr := datatypes.JSON(raw)
					roleToCreate.Permissions = &dr
				}
			}
			if err := db.Create(&roleToCreate).Error; err != nil {
				log.Printf("warning: could not create default role %v: %v", d.Role.Name, err)
				continue
			}
			if d.Perms != nil {
				if err := services.UpsertRolePermissionsFromPermissions(roleToCreate.ID, d.Perms); err != nil {
					log.Printf("warning: could not upsert role_permissions for seeded role %v: %v", *d.Role.Name, err)
				}
			}
		}
	}
}

// Company owner migration exists in a dedicated migration file.

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

// backfillRolePermissions migrates existing role.Permissions JSON blobs into the
// normalized role_permissions table. This operation is idempotent: it will skip
// running if role_permissions already contains rows.
func backfillRolePermissions(db *gorm.DB) {
	var cnt int64
	if err := db.Model(&basemodels.RolePermission{}).Count(&cnt).Error; err != nil {
		log.Printf("⚠️  Could not count role_permissions table: %v", err)
		return
	}
	if cnt > 0 {
		log.Println("ℹ️  role_permissions already populated; skipping backfill")
		return
	}

	var roles []basemodels.Role
	if err := db.Find(&roles).Error; err != nil {
		log.Printf("⚠️  Could not load roles for backfill: %v", err)
		return
	}

	for _, r := range roles {
		if r.Permissions == nil || len(*r.Permissions) == 0 {
			continue
		}
		var perms basemodels.Permissions
		if err := json.Unmarshal(*r.Permissions, &perms); err != nil {
			log.Printf("⚠️  Could not parse permissions JSON for role %s: %v", r.ID.String(), err)
			continue
		}

		var rows []basemodels.RolePermission

		addFromDetail := func(resource string, d *basemodels.PermissionDetail) {
			if d == nil {
				return
			}
			if d.Create != nil && *d.Create {
				rows = append(rows, basemodels.NewRolePermission(r.ID, resource, "create", "allow", "*", nil, 0, true))
			}
			if d.Read != nil && *d.Read {
				rows = append(rows, basemodels.NewRolePermission(r.ID, resource, "read", "allow", "*", nil, 0, true))
			}
			if d.Update != nil && *d.Update {
				rows = append(rows, basemodels.NewRolePermission(r.ID, resource, "update", "allow", "*", nil, 0, true))
			}
			if d.Delete != nil && *d.Delete {
				rows = append(rows, basemodels.NewRolePermission(r.ID, resource, "delete", "allow", "*", nil, 0, true))
			}
		}

		addFromDetail("users", perms.Users)
		addFromDetail("companies", perms.Companies)
		addFromDetail("branches", perms.Branches)
		addFromDetail("departments", perms.Departments)
		addFromDetail("roles", perms.Roles)
		addFromDetail("reports", perms.Reports)
		addFromDetail("settings", perms.Settings)

		for k, v := range perms.Custom {
			addFromDetail(k, v)
		}

		if len(rows) == 0 {
			continue
		}

		if err := db.Create(&rows).Error; err != nil {
			log.Printf("⚠️  Could not insert backfilled role_permissions for role %s: %v", r.ID.String(), err)
			// continue; don't abort the whole migration
		} else {
			log.Printf("✅ Backfilled %d role_permissions rows for role %s", len(rows), r.ID.String())
		}
	}
}
