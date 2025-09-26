package migrations

import (
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
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
		&basemodels.Role{},
		&companymodels.Company{},
		&companymodels.Branch{},
		&companymodels.Department{},
	); err != nil {
		log.Fatalf("Failed to run migrations: %v", err)
	}

	// Ensure token_hash and token_data columns exist (AutoMigrate should add them, but double-check).
	if !migrator.HasColumn(&models.Session{}, "token_hash") {
		if err := migrator.AddColumn(&models.Session{}, "token_hash"); err != nil {
			log.Fatalf("Failed to add token_hash column: %v", err)
		}
	}
	if !migrator.HasColumn(&models.Session{}, "token_data") {
		if err := migrator.AddColumn(&models.Session{}, "token_data"); err != nil {
			log.Fatalf("Failed to add token_data column: %v", err)
		}
	}

	// Backfill token JSON and hashes from legacy token column or existing JSON.
	type legacySession struct {
		ID        string
		Token     sql.NullString
		TokenHash sql.NullString
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
			// ensure hash cleared if no token present
			if row.TokenHash.Valid && row.TokenHash.String != "" {
				if err := db.Table("sessions").Where("id = ?", row.ID).
					Update("token_hash", gorm.Expr("NULL")).Error; err != nil {
					log.Fatalf("Failed to clear token_hash for session %s: %v", row.ID, err)
				}
			}
			continue
		}

		hash := sha256.Sum256([]byte(token))
		hashHex := hex.EncodeToString(hash[:])

		payload := sessionTokenPayload{Token: token}
		payloadJSON, err := json.Marshal(payload)
		if err != nil {
			log.Fatalf("Failed to marshal token payload for session %s: %v", row.ID, err)
		}

		updates := map[string]interface{}{
			"token_data": payloadJSON,
		}

		if !row.TokenHash.Valid || strings.TrimSpace(row.TokenHash.String) == "" {
			updates["token_hash"] = hashHex
		}

		if err := db.Table("sessions").Where("id = ?", row.ID).Updates(updates).Error; err != nil {
			log.Fatalf("Failed to backfill session %s: %v", row.ID, err)
		}
	}

	// Clear token_hash for rows without a token payload
	if err := db.Model(&models.Session{}).
		Where("token_data IS NULL OR JSON_UNQUOTE(JSON_EXTRACT(token_data, '$.token')) = ''").
		Update("token_hash", gorm.Expr("NULL")).Error; err != nil {
		log.Fatalf("Failed to nullify empty token hashes: %v", err)
	}

	// Remove duplicate token_hash rows, keeping the newest session per hash
	var hashedSessions []models.Session
	if err := db.Where("token_hash IS NOT NULL AND token_hash <> ''").
		Order("token_hash, created_at DESC").
		Find(&hashedSessions).Error; err != nil {
		log.Fatalf("Failed to query hashed sessions for deduplication: %v", err)
	}

	seen := make(map[string]bool)
	for _, sess := range hashedSessions {
		if !seen[sess.TokenHash] {
			seen[sess.TokenHash] = true
			continue
		}

		if err := db.Where("id = ?", sess.ID).Delete(&models.Session{}).Error; err != nil {
			log.Fatalf("Failed to delete duplicate session %d: %v", sess.ID, err)
		}
	}

	// Drop legacy token column if it still exists.
	if migrator.HasColumn(&models.Session{}, "token") {
		if err := migrator.DropColumn(&models.Session{}, "token"); err != nil {
			log.Printf("⚠️  Warning: could not drop legacy token column: %v", err)
		}
	}

	// Create index on token_hash if it doesn't exist. If it fails (e.g., due to older
	// duplicate data), log a warning but continue so the application can still run.
	if !migrator.HasIndex(&models.Session{}, "idx_sessions_token_hash") {
		if err := migrator.CreateIndex(&models.Session{}, "TokenHash"); err != nil {
			log.Printf("⚠️  Warning: could not create idx_sessions_token_hash index: %v", err)
		}
	}

	// Create default "user" role if it doesn't exist
	var defaultRole basemodels.Role
	if err := db.Where("name = ?", "user").First(&defaultRole).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			defaultRole = basemodels.Role{
				Name:        stringPtr("user"),
				Description: stringPtr("Default user role"),
				IsActive:    true,
			}
			if err := db.Create(&defaultRole).Error; err != nil {
				log.Printf("⚠️  Warning: could not create default user role: %v", err)
			} else {
				log.Println("✅ Created default user role")
			}
		}
	}

	log.Println("✅ Migrations applied successfully")
}
