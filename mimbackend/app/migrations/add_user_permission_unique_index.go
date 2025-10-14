package migrations

import (
	"fmt"
	"log"
	models "mimbackend/internal/models/auth"

	"gorm.io/gorm"
)

// EnsureUserPermissionUniqueIndex verifies there are no duplicate
// (user_id, resource, action, domain) groups and creates a unique
// index to prevent future duplicates. If duplicates are found the
// function returns an error and logs the offending groups so the
// operator can resolve them manually before re-running.
func EnsureUserPermissionUniqueIndex(db *gorm.DB) error {
	type dupRow struct {
		UserID   string `gorm:"column:user_id"`
		Resource string `gorm:"column:resource"`
		Action   string `gorm:"column:action"`
		Domain   string `gorm:"column:domain"`
		Count    int64  `gorm:"column:count"`
	}

	var duplicates []dupRow
	// Group and find duplicates (count > 1)
	if err := db.Raw(`
        SELECT user_id, resource, action, domain, COUNT(*) as count
        FROM user_permissions
        GROUP BY user_id, resource, action, domain
        HAVING COUNT(*) > 1
    `).Scan(&duplicates).Error; err != nil {
		return fmt.Errorf("failed to check user_permissions duplicates: %w", err)
	}

	if len(duplicates) > 0 {
		log.Printf("Found %d duplicate user_permissions groups; unique index will not be created. Fix duplicates and re-run migration.", len(duplicates))
		for _, d := range duplicates {
			log.Printf("duplicate user_permissions: user_id=%s resource=%s action=%s domain=%s count=%d", d.UserID, d.Resource, d.Action, d.Domain, d.Count)
		}
		return fmt.Errorf("duplicate user_permissions exist; resolve duplicates before creating unique index")
	}

	migrator := db.Migrator()
	// Use a stable index name
	idxName := "idx_user_permissions_user_resource_action_domain"
	if migrator.HasIndex(&models.UserPermission{}, idxName) {
		log.Println("Unique index already exists on user_permissions, skipping")
		return nil
	}

	// Create the unique index. Use raw SQL so we can rely on the
	// database to handle the index creation atomically. This should
	// work on Postgres/MySQL/SQLite.
	if err := db.Exec(fmt.Sprintf(`CREATE UNIQUE INDEX %s ON user_permissions (user_id, resource, action, domain)`, idxName)).Error; err != nil {
		return fmt.Errorf("failed to create unique index on user_permissions: %w", err)
	}

	log.Println("Unique composite index created on user_permissions (user_id,resource,action,domain)")
	return nil
}
