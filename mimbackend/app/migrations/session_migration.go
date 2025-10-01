package migrations

import (
	"log"

	models "mimbackend/internal/models/auth"

	"gorm.io/gorm"
)

// MigrateUserSessions creates or updates the user_sessions table
func MigrateUserSessions(db *gorm.DB) error {
	log.Println("🔄 Running user_sessions migration...")

	// Auto-migrate the user_sessions table
	if err := db.AutoMigrate(&models.UserSession{}); err != nil {
		log.Printf("❌ Failed to migrate user_sessions table: %v", err)
		return err
	}

	log.Println("✅ user_sessions table migrated successfully")
	return nil
}

// RollbackUserSessions drops the user_sessions table
func RollbackUserSessions(db *gorm.DB) error {
	log.Println("🔄 Rolling back user_sessions migration...")

	if err := db.Migrator().DropTable(&models.UserSession{}); err != nil {
		log.Printf("❌ Failed to drop user_sessions table: %v", err)
		return err
	}

	log.Println("✅ user_sessions table dropped successfully")
	return nil
}
