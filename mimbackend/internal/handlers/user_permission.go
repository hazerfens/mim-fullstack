package handlers

import (
	"encoding/json"
	"fmt"
	"mimbackend/config"
	authmodels "mimbackend/internal/models/auth"
	"mimbackend/internal/services"
	"net/http"

	// ... no longer using composite policy ID parsing
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/datatypes"
)

// GetUserCustomPermissions kullanıcının özel izinlerini getirir (Casbin'den)
func GetUserCustomPermissions(c *gin.Context) {
	userIDStr := c.Param("userId")
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	// Return persisted UserPermission rows from DB so UI can edit/delete by UUID
	db, dbErr := config.NewConnection()
	if dbErr != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database connection failed"})
		return
	}

	var ups []authmodels.UserPermission
	if err := db.Where("user_id = ?", userID).Find(&ups).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch user permissions"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"user_id":     userIDStr,
		"permissions": ups,
	})
}

// CreateUserCustomPermission kullanıcıya özel izin ekler (Casbin'e)
func CreateUserCustomPermission(c *gin.Context) {
	userIDStr := c.Param("userId")
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	var req struct {
		Resource        string                      `json:"resource" binding:"required"`
		Action          string                      `json:"action" binding:"required"`
		Domain          string                      `json:"domain"` // optional, defaults to "*"
		TimeRestriction *authmodels.TimeRestriction `json:"time_restriction,omitempty"`
		AllowedIPs      []string                    `json:"allowed_ips,omitempty"`
		IsAllowed       *bool                       `json:"is_allowed,omitempty"`
		Priority        *int                        `json:"priority,omitempty"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	enforcer := services.GetEnforcer()
	if enforcer == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Permission system not initialized"})
		return
	}

	userSubject := fmt.Sprintf("user:%s", userID.String())
	domain := req.Domain
	if domain == "" {
		domain = "*"
	}

	fmt.Printf("DEBUG: Creating permission for user %s: resource=%s, action=%s, domain=%s\n", userSubject, req.Resource, req.Action, domain)

	// Check if policy already exists
	existingPolicies, err := enforcer.GetFilteredPolicy(0, userSubject)
	if err != nil {
		fmt.Printf("DEBUG: Error checking existing policies: %v\n", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to check existing policies"})
		return
	}

	fmt.Printf("DEBUG: Found %d existing policies for user\n", len(existingPolicies))

	policyExists := false
	for _, policy := range existingPolicies {
		if len(policy) >= 4 && policy[1] == req.Resource && policy[2] == req.Action && policy[3] == domain {
			policyExists = true
			break
		}
	}

	if policyExists {
		fmt.Printf("DEBUG: Permission already exists\n")
		c.JSON(http.StatusConflict, gin.H{"error": "Permission already exists for this user"})
		return
	}

	// Add policy for user-specific permission
	added, err := enforcer.AddPolicy(userSubject, req.Resource, req.Action, domain)
	if err != nil {
		fmt.Printf("DEBUG: Error adding policy: %v\n", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create user permission"})
		return
	}

	fmt.Printf("DEBUG: Policy added: %t\n", added)

	if !added {
		fmt.Printf("DEBUG: Policy was not added (already exists or error)\n")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to add permission (policy not added)"})
		return
	}

	if err := enforcer.SavePolicy(); err != nil {
		fmt.Printf("DEBUG: Error saving policy: %v\n", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save policy"})
		return
	}

	// Persist or upsert user permission row so UI can edit/delete later
	db, dbErr := config.NewConnection()
	if dbErr != nil {
		// rollback casbin policy
		_, _ = enforcer.RemovePolicy(userSubject, req.Resource, req.Action, domain)
		_ = enforcer.SavePolicy()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database connection failed"})
		return
	}

	var allowedIPsJSON datatypes.JSON
	if len(req.AllowedIPs) > 0 {
		if raw, jErr := json.Marshal(req.AllowedIPs); jErr == nil {
			allowedIPsJSON = datatypes.JSON(raw)
		}
	}

	isAllowed := true
	if req.IsAllowed != nil {
		isAllowed = *req.IsAllowed
	}
	priority := 0
	if req.Priority != nil {
		priority = *req.Priority
	}

	var existing authmodels.UserPermission
	var persisted authmodels.UserPermission
	if err := db.Where("user_id = ? AND resource = ? AND action = ? AND domain = ?", userID, req.Resource, req.Action, domain).First(&existing).Error; err != nil {
		// create new
		up := authmodels.UserPermission{
			UserID:          userID,
			Resource:        req.Resource,
			Action:          req.Action,
			Domain:          domain,
			IsAllowed:       isAllowed,
			TimeRestriction: req.TimeRestriction,
			AllowedIPs:      allowedIPsJSON,
			Priority:        priority,
		}
		// Ensure ID is set to a non-zero UUID before create to avoid duplicate zero-UUID primary key
		if up.ID == uuid.Nil {
			up.ID = uuid.New()
		}
		if err := db.Create(&up).Error; err != nil {
			// rollback casbin policy
			_, _ = enforcer.RemovePolicy(userSubject, req.Resource, req.Action, domain)
			_ = enforcer.SavePolicy()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to persist user permission"})
			return
		}
		persisted = up
	} else {
		// update existing
		existing.IsAllowed = isAllowed
		existing.TimeRestriction = req.TimeRestriction
		existing.AllowedIPs = allowedIPsJSON
		existing.Priority = priority
		existing.UpdatedAt = time.Now()
		if err := db.Save(&existing).Error; err != nil {
			// rollback casbin policy
			_, _ = enforcer.RemovePolicy(userSubject, req.Resource, req.Action, domain)
			_ = enforcer.SavePolicy()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to persist user permission"})
			return
		}
		persisted = existing
	}

	fmt.Printf("DEBUG: Policy saved successfully\n")

	// Return persisted row so frontend can edit/delete by DB UUID
	c.JSON(http.StatusCreated, gin.H{"permission": persisted, "added": added})
}

// UpdateUserCustomPermission kullanıcının özel iznini günceller (Casbin'de)
func UpdateUserCustomPermission(c *gin.Context) {
	userIDStr := c.Param("userId")
	permIDStr := c.Param("permissionId")

	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	var req struct {
		Resource        *string                     `json:"resource"`
		Action          *string                     `json:"action"`
		Domain          *string                     `json:"domain"`
		TimeRestriction *authmodels.TimeRestriction `json:"time_restriction,omitempty"`
		AllowedIPs      []string                    `json:"allowed_ips,omitempty"`
		IsAllowed       *bool                       `json:"is_allowed,omitempty"`
		Priority        *int                        `json:"priority,omitempty"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	enforcer := services.GetEnforcer()
	if enforcer == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Permission system not initialized"})
		return
	}

	userSubject := fmt.Sprintf("user:%s", userID.String())

	// permissionId should be a UUID of the persisted user_permissions row
	permID, err := uuid.Parse(permIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid permission ID"})
		return
	}

	db, dbErr := config.NewConnection()
	if dbErr != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database connection failed"})
		return
	}

	var up authmodels.UserPermission
	if err := db.Where("id = ? AND user_id = ?", permID, userID).First(&up).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Permission not found"})
		return
	}

	oldResource := up.Resource
	oldAction := up.Action
	oldDomain := up.Domain

	// Remove old casbin policy using persisted domain
	_, err = enforcer.RemovePolicy(userSubject, oldResource, oldAction, oldDomain)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to remove old policy"})
		return
	}

	// Update DB row
	if req.Resource != nil {
		up.Resource = *req.Resource
	}
	if req.Action != nil {
		up.Action = *req.Action
	}
	if req.TimeRestriction != nil {
		up.TimeRestriction = req.TimeRestriction
	}
	if len(req.AllowedIPs) > 0 {
		if raw, jErr := json.Marshal(req.AllowedIPs); jErr == nil {
			up.AllowedIPs = datatypes.JSON(raw)
		}
	}
	if req.Domain != nil {
		up.Domain = *req.Domain
	}
	if req.IsAllowed != nil {
		up.IsAllowed = *req.IsAllowed
	}
	if req.Priority != nil {
		up.Priority = *req.Priority
	}
	up.UpdatedAt = time.Now()

	if err := db.Save(&up).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update permission"})
		return
	}

	// Add updated casbin policy (use persisted or provided domain)
	pdomain := up.Domain
	if pdomain == "" {
		pdomain = "*"
	}
	_, err = enforcer.AddPolicy(userSubject, up.Resource, up.Action, pdomain)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to add updated policy"})
		return
	}

	if err := enforcer.SavePolicy(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save policy"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"permission": up})
}

// DeleteUserCustomPermission kullanıcının özel iznini siler (Casbin'den)
func DeleteUserCustomPermission(c *gin.Context) {
	userIDStr := c.Param("userId")
	permIDStr := c.Param("permissionId")

	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	permID, err := uuid.Parse(permIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid permission ID"})
		return
	}

	db, dbErr := config.NewConnection()
	if dbErr != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database connection failed"})
		return
	}

	var up authmodels.UserPermission
	if err := db.Where("id = ? AND user_id = ?", permID, userID).First(&up).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Permission not found"})
		return
	}

	enforcer := services.GetEnforcer()
	if enforcer == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Permission system not initialized"})
		return
	}

	userSubject := fmt.Sprintf("user:%s", userID.String())

	// Remove casbin policy using persisted domain
	removed, err := enforcer.RemovePolicy(userSubject, up.Resource, up.Action, up.Domain)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to remove policy"})
		return
	}

	if err := enforcer.SavePolicy(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save policy"})
		return
	}

	// Remove DB row
	if err := db.Where("id = ?", up.ID).Delete(&authmodels.UserPermission{}).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete permission record"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "User permission deleted successfully", "removed": removed})
}
