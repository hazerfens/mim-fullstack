package services

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"mimbackend/config"
	"net"
	"strings"
	"time"

	authmodels "mimbackend/internal/models/auth"
	basemodels "mimbackend/internal/models/basemodels"

	"github.com/casbin/casbin/v2"
	gormadapter "github.com/casbin/gorm-adapter/v3"
	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"gorm.io/datatypes"
	"gorm.io/gorm/clause"
)

var (
	enforcer    *casbin.Enforcer
	redisClient *redis.Client
)

// initRedisClient initializes Redis client for caching
func initRedisClient() {
	redisClient = config.GetRedisClient()
}

// getCacheKey generates cache key for permission check
func getCacheKey(user, resource, action, domain string) string {
	return fmt.Sprintf("casbin:perm:%s:%s:%s:%s", user, resource, action, domain)
}

// getCachedPermission checks Redis cache for permission result
func getCachedPermission(user, resource, action, domain string) (bool, bool) {
	if redisClient == nil {
		return false, false // not cached
	}

	key := getCacheKey(user, resource, action, domain)
	val, err := redisClient.Get(context.Background(), key).Result()
	if err != nil {
		return false, false // not cached
	}

	// Parse cached result
	var result bool
	if err := json.Unmarshal([]byte(val), &result); err != nil {
		return false, false // invalid cache
	}

	return result, true // cached
}

// setCachedPermission caches permission result in Redis
func setCachedPermission(user, resource, action, domain string, result bool) {
	if redisClient == nil {
		return
	}

	key := getCacheKey(user, resource, action, domain)
	data, _ := json.Marshal(result)

	redisClient.Set(context.Background(), key, data, 10*time.Minute) // 10 minute cache
}

// invalidateUserCache clears all cached permissions for a user
func invalidateUserCache(user string) {
	if redisClient == nil {
		return
	}

	// Use pattern matching to delete all user-related cache keys
	pattern := fmt.Sprintf("casbin:perm:%s:*", user)
	keys, err := redisClient.Keys(context.Background(), pattern).Result()
	if err == nil && len(keys) > 0 {
		redisClient.Del(context.Background(), keys...)
	}
}

// InitCasbin initializes the Casbin enforcer with GORM adapter and Redis cache
func InitCasbin() error {
	db, err := config.NewConnection()
	if err != nil {
		return fmt.Errorf("failed to connect to database: %w", err)
	}

	// Create GORM adapter for persistence
	adapter, err := gormadapter.NewAdapterByDB(db)
	if err != nil {
		return fmt.Errorf("failed to create GORM adapter: %w", err)
	}

	// Create enforcer with model
	e, err := casbin.NewEnforcer("config/casbin_model.conf", adapter)
	if err != nil {
		return fmt.Errorf("failed to create enforcer: %w", err)
	}

	enforcer = e

	// Initialize Redis client for caching
	initRedisClient()

	// Load policies
	if err := enforcer.LoadPolicy(); err != nil {
		return fmt.Errorf("failed to load policy: %w", err)
	}

	// Check if Redis is available for caching
	if redisClient != nil {
		log.Println("✅ Casbin initialized with Redis cache support")
	} else {
		log.Println("⚠️  Redis not available, Casbin running without cache")
	}

	log.Println("✅ Casbin ABAC enforcer initialized successfully")
	return nil
}

// GetEnforcer returns the Casbin enforcer instance
func GetEnforcer() *casbin.Enforcer {
	return enforcer
}

// BuildDomainID returns a domain string used by older callers
func BuildDomainID(companyID *uuid.UUID) string {
	if companyID == nil {
		return "*"
	}
	return fmt.Sprintf("company:%s", companyID.String())
}

// ParseDomainID parses a domain string produced by BuildDomainID
func ParseDomainID(domain string) (*uuid.UUID, error) {
	if domain == "*" {
		return nil, nil
	}
	parts := strings.Split(domain, ":")
	if len(parts) != 2 || parts[0] != "company" {
		return nil, fmt.Errorf("invalid domain format")
	}
	cid, err := uuid.Parse(parts[1])
	if err != nil {
		return nil, err
	}
	return &cid, nil
}

// AddPolicy adds a policy rule to Casbin and invalidates related cache
func AddPolicy(subject, object, action, domain string) (bool, error) {
	if enforcer == nil {
		return false, fmt.Errorf("enforcer not initialized")
	}

	result, err := enforcer.AddPolicy(subject, object, action, domain)
	if err != nil {
		return false, err
	}

	// Invalidate cache for affected users
	if strings.HasPrefix(subject, "user:") {
		invalidateUserCache(subject)
	}

	// If the subject is a role, invalidate cache for all users who have this role
	if strings.HasPrefix(subject, "role:") {
		if enforcer != nil {
			if users, err := enforcer.GetUsersForRole(subject, domain); err == nil {
				for _, u := range users {
					invalidateUserCache(u)
				}
				log.Printf("AddPolicy: invalidated cache for %d users of role %s", len(users), subject)
			} else {
				// fallback: clear all user caches for safety
				if redisClient != nil {
					pattern := "casbin:perm:*"
					keys, _ := redisClient.Keys(context.Background(), pattern).Result()
					if len(keys) > 0 {
						redisClient.Del(context.Background(), keys...)
					}
				}
				log.Printf("AddPolicy: failed to enumerate users for role %s, cleared global cache as fallback: %v", subject, err)
			}
		}
	}

	return result, nil
}

// RemovePolicy removes a policy rule from Casbin and invalidates related cache
func RemovePolicy(subject, object, action, domain string) (bool, error) {
	if enforcer == nil {
		return false, fmt.Errorf("enforcer not initialized")
	}

	result, err := enforcer.RemovePolicy(subject, object, action, domain)
	if err != nil {
		return false, err
	}

	// Invalidate cache for affected users
	if strings.HasPrefix(subject, "user:") {
		invalidateUserCache(subject)
	}

	// If the subject is a role, invalidate cache for all users who have this role
	if strings.HasPrefix(subject, "role:") {
		if enforcer != nil {
			if users, err := enforcer.GetUsersForRole(subject, domain); err == nil {
				for _, u := range users {
					invalidateUserCache(u)
				}
				log.Printf("RemovePolicy: invalidated cache for %d users of role %s", len(users), subject)
			} else {
				// fallback: clear all user caches for safety
				if redisClient != nil {
					pattern := "casbin:perm:*"
					keys, _ := redisClient.Keys(context.Background(), pattern).Result()
					if len(keys) > 0 {
						redisClient.Del(context.Background(), keys...)
					}
				}
				log.Printf("RemovePolicy: failed to enumerate users for role %s, cleared global cache as fallback: %v", subject, err)
			}
		}
	}

	return result, nil
}

// AddRoleForUser adds a role for a user in a domain
func AddRoleForUser(user, role, domain string) (bool, error) {
	if enforcer == nil {
		return false, fmt.Errorf("enforcer not initialized")
	}
	return enforcer.AddRoleForUser(user, role, domain)
}

// DeleteRoleForUser deletes a role for a user in a domain
func DeleteRoleForUser(user, role, domain string) (bool, error) {
	if enforcer == nil {
		return false, fmt.Errorf("enforcer not initialized")
	}
	return enforcer.DeleteRoleForUser(user, role, domain)
}

// GetRolesForUser gets roles for a user in a domain
func GetRolesForUser(user, domain string) ([]string, error) {
	if enforcer == nil {
		return nil, fmt.Errorf("enforcer not initialized")
	}
	return enforcer.GetRolesForUser(user, domain)
}

// GetUsersForRole gets users for a role in a domain
func GetUsersForRole(role, domain string) ([]string, error) {
	if enforcer == nil {
		return nil, fmt.Errorf("enforcer not initialized")
	}
	return enforcer.GetUsersForRole(role, domain)
}

// GetAllPolicies gets all policies
func GetAllPolicies() ([][]string, error) {
	if enforcer == nil {
		return nil, fmt.Errorf("enforcer not initialized")
	}
	return enforcer.GetPolicy()
}

// ClearAllPolicies clears all policies
func ClearAllPolicies() error {
	enforcer.ClearPolicy()
	return nil
} // InitializeDefaultPolicies initializes default policies for the system
func InitializeDefaultPolicies() error {
	if enforcer == nil {
		return fmt.Errorf("enforcer not initialized")
	}

	// System admin policies
	enforcer.AddPolicy("admin", "*", "*", "*")
	enforcer.AddPolicy("super_admin", "*", "*", "*")

	// User management policies
	enforcer.AddPolicy("admin", "users", "read", "*")
	enforcer.AddPolicy("admin", "users", "create", "*")
	enforcer.AddPolicy("admin", "users", "update", "*")
	enforcer.AddPolicy("admin", "users", "delete", "*")

	// Company management policies
	enforcer.AddPolicy("admin", "companies", "read", "*")
	enforcer.AddPolicy("admin", "companies", "create", "*")
	enforcer.AddPolicy("admin", "companies", "update", "*")
	enforcer.AddPolicy("admin", "companies", "delete", "*")

	// Role management policies
	enforcer.AddPolicy("admin", "roles", "read", "*")
	enforcer.AddPolicy("admin", "roles", "create", "*")
	enforcer.AddPolicy("admin", "roles", "update", "*")
	enforcer.AddPolicy("admin", "roles", "delete", "*")

	// Permission management policies
	enforcer.AddPolicy("admin", "permissions", "read", "*")
	enforcer.AddPolicy("admin", "permissions", "create", "*")
	enforcer.AddPolicy("admin", "permissions", "update", "*")
	enforcer.AddPolicy("admin", "permissions", "delete", "*")

	// Basic user policies
	enforcer.AddPolicy("user", "users", "read", "*")
	enforcer.AddPolicy("user", "companies", "read", "*")

	// Company employee policies (company-scoped)
	enforcer.AddPolicy("company_employee", "companies", "read", "company:*")
	enforcer.AddPolicy("company_employee", "companies", "update", "company:*")

	// Company manager policies
	enforcer.AddPolicy("company_manager", "companies", "read", "company:*")
	enforcer.AddPolicy("company_manager", "companies", "update", "company:*")
	enforcer.AddPolicy("company_manager", "companies", "delete", "company:*")
	enforcer.AddPolicy("company_manager", "users", "read", "company:*")
	enforcer.AddPolicy("company_manager", "users", "create", "company:*")
	enforcer.AddPolicy("company_manager", "users", "update", "company:*")

	// Save policies to database
	if err := enforcer.SavePolicy(); err != nil {
		return fmt.Errorf("failed to save default policies: %w", err)
	}

	log.Println("Default ABAC policies initialized")
	return nil
}

// UpdatePoliciesForRole updates policies when a role is modified
func UpdatePoliciesForRole(role interface{}) error {
	// This is a placeholder - role policy updates would be implemented here
	log.Printf("UpdatePoliciesForRole called with: %v", role)
	return nil
}

// RemovePoliciesForRole removes all policies for a specific role
func RemovePoliciesForRole(roleName string, companyID *uuid.UUID) error {
	if enforcer == nil {
		return fmt.Errorf("enforcer not initialized")
	}

	domain := BuildDomainID(companyID)

	// Remove all policies where subject matches the role
	policies, err := enforcer.GetPolicy()
	if err != nil {
		return err
	}
	var toRemove [][]string

	for _, policy := range policies {
		if len(policy) >= 4 && policy[0] == roleName && policy[3] == domain {
			toRemove = append(toRemove, policy)
		}
	}

	for _, policy := range toRemove {
		enforcer.RemovePolicy(policy[0], policy[1], policy[2], policy[3])
	}

	return enforcer.SavePolicy()
}

// RemovePoliciesForCompany removes all policies for a company
func RemovePoliciesForCompany(companyID uuid.UUID) error {
	if enforcer == nil {
		return fmt.Errorf("enforcer not initialized")
	}

	domain := fmt.Sprintf("company:%s", companyID.String())

	// Remove all policies for this company domain
	policies, err := enforcer.GetPolicy()
	if err != nil {
		return err
	}
	var toRemove [][]string

	for _, policy := range policies {
		if len(policy) >= 4 && policy[3] == domain {
			toRemove = append(toRemove, policy)
		}
	}

	for _, policy := range toRemove {
		enforcer.RemovePolicy(policy[0], policy[1], policy[2], policy[3])
	}

	return enforcer.SavePolicy()
}

// GetAllowedActionsForUserForPermissionName returns allowed actions for a user on a specific permission
func GetAllowedActionsForUserForPermissionName(userID uuid.UUID, permissionName string, companyID *uuid.UUID) (map[string]bool, error) {
	if enforcer == nil {
		return nil, fmt.Errorf("enforcer not initialized")
	}

	domain := BuildDomainID(companyID)
	userSubject := fmt.Sprintf("user:%s", userID.String())

	actions := []string{"create", "read", "update", "delete"}
	result := make(map[string]bool)

	for _, action := range actions {
		allowed, err := enforcer.Enforce(userSubject, permissionName, action, domain)
		if err != nil {
			log.Printf("Error checking permission %s:%s for user %s: %v", permissionName, action, userID.String(), err)
			result[action] = false
		} else {
			result[action] = allowed
		}
	}

	return result, nil
}

// CheckUserCustomPermissions checks user's custom permissions
func CheckUserCustomPermissions(userID uuid.UUID, resource, action string) (bool, bool, error) {
	if enforcer == nil {
		return false, false, fmt.Errorf("enforcer not initialized")
	}

	userSubject := fmt.Sprintf("user:%s", userID.String())

	// Check system-wide permission first
	systemAllowed, err := enforcer.Enforce(userSubject, resource, action, "*")
	if err != nil {
		return false, false, err
	}

	return systemAllowed, false, nil
}

// evaluateConditions evaluates a RolePermission or UserPermission conditions JSON
// conditions JSON may contain an optional time_restriction (matching authmodels.TimeRestriction)
// and an optional allowed_ips array of IPs or CIDRs.
func evaluateConditions(conds datatypes.JSON, clientIP string, now time.Time) (bool, error) {
	if len(conds) == 0 {
		return true, nil
	}

	// Generic payload supporting nested time_restriction and allowed_ips
	var payload struct {
		TimeRestriction *authmodels.TimeRestriction `json:"time_restriction,omitempty"`
		AllowedIPs      []string                    `json:"allowed_ips,omitempty"`
	}

	if err := json.Unmarshal(conds, &payload); err != nil {
		return false, fmt.Errorf("invalid conditions JSON: %w", err)
	}

	// Time restriction check
	if payload.TimeRestriction != nil {
		if !payload.TimeRestriction.IsAllowedAtTime(now) {
			return false, nil
		}
	}

	// IP restriction check
	if len(payload.AllowedIPs) > 0 {
		if clientIP == "" {
			// No IP available, deny by default when IP restriction exists
			return false, nil
		}
		ip := net.ParseIP(clientIP)
		if ip == nil {
			return false, nil
		}

		matched := false
		for _, entry := range payload.AllowedIPs {
			entry = strings.TrimSpace(entry)
			if entry == "" {
				continue
			}
			// Try CIDR first
			if _, ipnet, err := net.ParseCIDR(entry); err == nil {
				if ipnet.Contains(ip) {
					matched = true
					break
				}
				continue
			}
			// Try plain IP
			if p := net.ParseIP(entry); p != nil {
				if p.Equal(ip) {
					matched = true
					break
				}
			}
		}
		if !matched {
			return false, nil
		}
	}

	return true, nil
}

// CheckUserCompanyPermissionWithContext checks permissions for a user and optional company domain
// while also evaluating time/IP conditions stored in persisted role_permissions and user_permissions.
func CheckUserCompanyPermissionWithContext(userID uuid.UUID, resource, action string, companyID *uuid.UUID, clientIP string, now time.Time) (bool, error) {
	if enforcer == nil {
		return false, fmt.Errorf("enforcer not initialized")
	}

	domain := BuildDomainID(companyID)
	userSubject := fmt.Sprintf("user:%s", userID.String())

	// Database connection for persisted role_permissions/user_permissions
	db, dbErr := config.NewConnection()
	if dbErr != nil {
		return false, dbErr
	}

	// 1) Check explicit user_permissions table rows (time-restricted user-level overrides)
	var ups []authmodels.UserPermission
	if err := db.Where("user_id = ? AND resource = ? AND action = ? AND is_allowed = ?", userID, resource, action, true).Find(&ups).Error; err == nil {
		for _, up := range ups {
			// time restriction check
			if up.TimeRestriction != nil && !up.TimeRestriction.IsAllowedAtTime(now) {
				continue
			}
			// allowed_ips in UserPermission is stored as JSON in AllowedIPs field (if present)
			if len(up.AllowedIPs) > 0 {
				// AllowedIPs stored as []byte JSON or string slice depending on model; try to unmarshal
				var ips []string
				if err := json.Unmarshal(up.AllowedIPs, &ips); err == nil {
					// evaluate ips
					payload := struct {
						AllowedIPs []string `json:"allowed_ips,omitempty"`
					}{AllowedIPs: ips}
					// reuse evaluateConditions by marshalling payload
					raw, _ := json.Marshal(payload)
					ok, _ := evaluateConditions(datatypes.JSON(raw), clientIP, now)
					if ok {
						return true, nil
					}
				}
			} else {
				// No IP restriction, time check already passed -> allow
				return true, nil
			}
		}
	}

	// 2) Check role-based persisted role_permissions
	roles, rErr := enforcer.GetRolesForUser(userSubject, domain)
	if rErr != nil {
		return false, rErr
	}

	for _, r := range roles {
		// If role is a canonical role subject (role:<uuid>), use persisted role_permissions
		if strings.HasPrefix(r, "role:") {
			roleIDStr := strings.TrimPrefix(r, "role:")
			roleUUID, pErr := uuid.Parse(roleIDStr)
			if pErr != nil {
				// skip malformed role identifier
				continue
			}

			var rps []basemodels.RolePermission
			if err := db.Where("role_id = ? AND resource = ? AND action = ? AND is_active = ?", roleUUID, resource, action, true).Find(&rps).Error; err != nil {
				continue
			}

			for _, rp := range rps {
				// Domain matching: allow if rp.Domain == domain or wildcard
				if rp.Domain != "*" && rp.Domain != domain {
					continue
				}
				// If no conditions defined, allow immediately
				if len(rp.Conditions) == 0 {
					return true, nil
				}
				ok, _ := evaluateConditions(rp.Conditions, clientIP, now)
				if ok {
					return true, nil
				}
			}
		} else {
			// Non-canonical role names (e.g., 'admin'/'super_admin') — treat via Casbin enforcement
			allowed, err := enforcer.Enforce(userSubject, resource, action, domain)
			if err != nil {
				return false, err
			}
			if allowed {
				return true, nil
			}
		}
	}

	// 3) Fallback: check Casbin enforcement for the user directly (covers system-wide policies)
	allowed, err := enforcer.Enforce(userSubject, resource, action, domain)
	if err != nil {
		return false, err
	}
	return allowed, nil
}

// CheckUserCompanyPermission checks user's company-scoped permission with Redis cache
func CheckUserCompanyPermission(userID uuid.UUID, resource, action string, companyID *uuid.UUID) (bool, error) {
	if enforcer == nil {
		return false, fmt.Errorf("enforcer not initialized")
	}

	domain := BuildDomainID(companyID)
	userSubject := fmt.Sprintf("user:%s", userID.String())

	// Check cache first
	if cached, found := getCachedPermission(userSubject, resource, action, domain); found {
		return cached, nil
	}

	// Not in cache, check with Casbin
	result, err := enforcer.Enforce(userSubject, resource, action, domain)
	if err != nil {
		return false, err
	}

	// Cache the result
	setCachedPermission(userSubject, resource, action, domain, result)

	return result, nil
}

// CheckUserSystemPermission checks user's system-wide permission
func CheckUserSystemPermission(userID uuid.UUID, resource, action string) (bool, error) {
	return CheckUserCompanyPermission(userID, resource, action, nil)
}

// LoadRolePermissionsByID loads permissions for a role from Casbin policies
func LoadRolePermissionsByID(roleID uuid.UUID) (interface{}, error) {
	if enforcer == nil {
		return nil, fmt.Errorf("enforcer not initialized")
	}

	roleName := fmt.Sprintf("role:%s", roleID.String())

	// Get all policies where this role is the subject
	policies, err := enforcer.GetFilteredPolicy(0, roleName)
	if err != nil {
		return nil, err
	}

	// Convert policies to permission objects
	permissions := make([]map[string]interface{}, 0, len(policies))
	for _, policy := range policies {
		if len(policy) >= 3 {
			permissions = append(permissions, map[string]interface{}{
				"resource": policy[1],
				"action":   policy[2],
				"domain":   policy[3],
			})
		}
	}

	return permissions, nil
}

// UpsertRolePermissionsFromPermissions updates role permissions in Casbin
func UpsertRolePermissionsFromPermissions(roleID uuid.UUID, p interface{}) error {
	if enforcer == nil {
		return fmt.Errorf("enforcer not initialized")
	}

	roleName := fmt.Sprintf("role:%s", roleID.String())

	log.Printf("UpsertRolePermissionsFromPermissions: role=%s incoming=%T", roleName, p)

	// Capture existing RolePermission rows so we can preserve their is_active state
	conn, connErr := config.NewConnection()
	existingActive := make(map[string]bool)
	if connErr == nil {
		var existingRows []basemodels.RolePermission
		if err := conn.Where("role_id = ?", roleID).Find(&existingRows).Error; err == nil {
			for _, r := range existingRows {
				key := fmt.Sprintf("%s|%s|%s", r.Resource, r.Action, r.Domain)
				existingActive[key] = r.IsActive
			}
		}
	}

	// Remove existing policies for this role
	_, err := enforcer.RemoveFilteredPolicy(0, roleName)
	if err != nil {
		return err
	}

	// Add new policies
	permissions, ok := p.([]map[string]interface{})
	if !ok {
		return fmt.Errorf("invalid permissions format")
	}

	for _, perm := range permissions {
		resource, ok1 := perm["resource"].(string)
		action, ok2 := perm["action"].(string)
		domain, ok3 := perm["domain"].(string)

		if !ok1 || !ok2 || !ok3 {
			continue
		}

		_, err := enforcer.AddPolicy(roleName, resource, action, domain)
		if err != nil {
			return err
		}
	}

	// Persist Casbin policies
	if err := enforcer.SavePolicy(); err != nil {
		return err
	}

	// Invalidate cache for all users who might have this role
	if redisClient != nil {
		pattern := "casbin:perm:*"
		keys, err := redisClient.Keys(context.Background(), pattern).Result()
		if err == nil && len(keys) > 0 {
			redisClient.Del(context.Background(), keys...)
		}
	}

	// Persist role_permissions rows in DB to keep canonical record of role rules
	db, dbErr := config.NewConnection()
	if dbErr != nil {
		// Attempt rollback: remove newly added policies for this role
		_, _ = enforcer.RemoveFilteredPolicy(0, roleName)
		_ = enforcer.SavePolicy()
		return fmt.Errorf("failed to connect db to persist role_permissions: %w", dbErr)
	}

	tx := db.Begin()
	// Hard-delete existing RolePermission rows for role to free unique constraint
	if err := tx.Unscoped().Where("role_id = ?", roleID).Delete(&basemodels.RolePermission{}).Error; err != nil {
		tx.Rollback()
		// rollback casbin policies
		_, _ = enforcer.RemoveFilteredPolicy(0, roleName)
		_ = enforcer.SavePolicy()
		return fmt.Errorf("failed to clear existing role_permissions: %w", err)
	}

	// Create new RolePermission rows (deduplicated by resource+action)
	var rows []basemodels.RolePermission
	seen := make(map[string]bool)
	for _, perm := range permissions {
		resource, ok1 := perm["resource"].(string)
		action, ok2 := perm["action"].(string)
		domain, _ := perm["domain"].(string)
		if !ok1 || !ok2 {
			continue
		}
		if domain == "" {
			domain = "*"
		}
		key := fmt.Sprintf("%s|%s|%s", resource, action, domain)
		if seen[key] {
			// skip duplicate resource+action+domain pairs
			continue
		}
		seen[key] = true
		// Preserve previous is_active value when possible, otherwise default to true
		isActive := true
		if v, ok := existingActive[key]; ok {
			isActive = v
		}
		rp := basemodels.NewRolePermission(roleID, resource, action, "allow", domain, nil, 0, isActive)
		rows = append(rows, rp)
	}

	if len(rows) > 0 {
		// Use ON CONFLICT DO NOTHING as extra safety in case of concurrent inserts
		if err := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&rows).Error; err != nil {
			tx.Rollback()
			// rollback casbin policies
			_, _ = enforcer.RemoveFilteredPolicy(0, roleName)
			_ = enforcer.SavePolicy()
			return fmt.Errorf("failed to insert role_permissions: %w", err)
		}
	}

	if err := tx.Commit().Error; err != nil {
		// rollback casbin policies
		_, _ = enforcer.RemoveFilteredPolicy(0, roleName)
		_ = enforcer.SavePolicy()
		return fmt.Errorf("failed to commit role_permissions transaction: %w", err)
	}

	log.Printf("UpsertRolePermissionsFromPermissions: saved policies for role=%s, count=%d", roleName, len(permissions))
	return nil
}

// ConvertPermissionsToCasbinList converts a Permissions struct into a slice of
// map[string]interface{} entries suitable for UpsertRolePermissionsFromPermissions.
// domain should be a Casbin domain string (e.g. "*" or "company:<id>").
func ConvertPermissionsToCasbinList(p *basemodels.Permissions, domain string) []map[string]interface{} {
	out := make([]map[string]interface{}, 0)
	if p == nil {
		return out
	}

	addFromDetail := func(resource string, d *basemodels.PermissionDetail) {
		if d == nil {
			return
		}
		if d.Create != nil && *d.Create {
			out = append(out, map[string]interface{}{"resource": resource, "action": "create", "domain": domain})
		}
		if d.Read != nil && *d.Read {
			out = append(out, map[string]interface{}{"resource": resource, "action": "read", "domain": domain})
		}
		if d.Update != nil && *d.Update {
			out = append(out, map[string]interface{}{"resource": resource, "action": "update", "domain": domain})
		}
		if d.Delete != nil && *d.Delete {
			out = append(out, map[string]interface{}{"resource": resource, "action": "delete", "domain": domain})
		}
	}

	addFromDetail("users", p.Users)
	addFromDetail("companies", p.Companies)
	addFromDetail("branches", p.Branches)
	addFromDetail("departments", p.Departments)
	addFromDetail("roles", p.Roles)
	addFromDetail("reports", p.Reports)
	addFromDetail("settings", p.Settings)

	// custom permissions
	if p.Custom != nil {
		for k, v := range p.Custom {
			addFromDetail(k, v)
		}
	}

	return out
}

// DeleteRolePermissionsByRoleID deletes permissions for a role from Casbin
func DeleteRolePermissionsByRoleID(roleID uuid.UUID) error {
	if enforcer == nil {
		return fmt.Errorf("enforcer not initialized")
	}

	roleName := fmt.Sprintf("role:%s", roleID.String())

	// Remove all policies for this role
	_, err := enforcer.RemoveFilteredPolicy(0, roleName)
	if err != nil {
		return err
	}

	// Save Casbin policy removal
	if err := enforcer.SavePolicy(); err != nil {
		return err
	}

	// Also remove persisted role_permissions DB rows for this role
	db, dbErr := config.NewConnection()
	if dbErr != nil {
		// Log warning but return nil since Casbin policies were removed
		log.Printf("Warning: could not connect DB to remove role_permissions for role %s: %v", roleName, dbErr)
		return nil
	}

	if err := db.Where("role_id = ?", roleID).Delete(&basemodels.RolePermission{}).Error; err != nil {
		log.Printf("Warning: failed to delete role_permissions DB rows for role %s: %v", roleName, err)
	}

	return nil
}

// CopyRolePermissions copies permissions from one role to another in Casbin
func CopyRolePermissions(srcRoleID, dstRoleID uuid.UUID) error {
	if enforcer == nil {
		return fmt.Errorf("enforcer not initialized")
	}

	srcRoleName := fmt.Sprintf("role:%s", srcRoleID.String())
	dstRoleName := fmt.Sprintf("role:%s", dstRoleID.String())

	// Get source role policies
	policies, err := enforcer.GetFilteredPolicy(0, srcRoleName)
	if err != nil {
		return err
	}

	// Remove existing destination role policies
	_, err = enforcer.RemoveFilteredPolicy(0, dstRoleName)
	if err != nil {
		return err
	}

	// Add policies to destination role
	for _, policy := range policies {
		if len(policy) >= 4 {
			_, err := enforcer.AddPolicy(dstRoleName, policy[1], policy[2], policy[3])
			if err != nil {
				return err
			}
		}
	}

	return enforcer.SavePolicy()
}

// ListPermissions lists all unique resources (permissions) from Casbin policies
func ListPermissions() ([]interface{}, error) {
	if enforcer == nil {
		return nil, fmt.Errorf("enforcer not initialized")
	}

	policies, err := enforcer.GetPolicy()
	if err != nil {
		return nil, err
	}

	// Extract unique resources
	resourceMap := make(map[string]bool)
	for _, policy := range policies {
		if len(policy) >= 2 {
			resourceMap[policy[1]] = true
		}
	}

	// Convert to interface slice
	result := make([]interface{}, 0, len(resourceMap))
	for resource := range resourceMap {
		result = append(result, map[string]interface{}{
			"name":         resource,
			"display_name": resource,
			"description":  fmt.Sprintf("Permission for %s", resource),
			"is_active":    true,
		})
	}

	return result, nil
}

// ListAllPermissions lists all permissions including inactive ones
func ListAllPermissions() ([]interface{}, error) {
	return ListPermissions()
}

// CreatePermission creates a new permission (resource) in Casbin
func CreatePermission(p interface{}) (interface{}, error) {
	perm, ok := p.(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("invalid permission type")
	}

	name, ok := perm["name"].(string)
	if !ok {
		return nil, fmt.Errorf("permission name is required")
	}

	// In Casbin-only approach, permissions are just resources
	// We don't need to store them separately, they're created when policies are added
	return map[string]interface{}{
		"name":         name,
		"display_name": perm["display_name"],
		"description":  perm["description"],
		"is_active":    true,
	}, nil
}

// UpdatePermission updates a permission (not applicable in Casbin-only approach)
func UpdatePermission(name string, patch map[string]interface{}) (interface{}, error) {
	// In Casbin-only approach, permissions are implicit
	// This is a no-op but we return success for compatibility
	return map[string]interface{}{
		"name":         name,
		"display_name": patch["display_name"],
		"description":  patch["description"],
		"is_active":    patch["is_active"],
	}, nil
}

// DeletePermission deletes a permission (removes all policies for this resource)
func DeletePermission(name string) error {
	if enforcer == nil {
		return fmt.Errorf("enforcer not initialized")
	}

	// Remove all policies where this resource is the object
	_, err := enforcer.RemoveFilteredPolicy(1, name)
	if err != nil {
		return err
	}

	return enforcer.SavePolicy()
}

// SyncUserRole syncs user role with Casbin (simplified for Casbin-only approach)
func SyncUserRole(userID uuid.UUID) error {
	if enforcer == nil {
		return fmt.Errorf("enforcer not initialized")
	}

	// In Casbin-only approach, we assume roles are already managed in Casbin
	// This function is kept for compatibility but simplified
	log.Printf("SyncUserRole called for user %s (Casbin-only mode)", userID.String())
	return nil
}

// ValidateCustomPermissionsExist validates that custom permissions exist (simplified)
func ValidateCustomPermissionsExist(p interface{}) ([]string, error) {
	// In Casbin-only approach, permissions are validated at policy level
	// This is kept for compatibility
	return []string{}, nil
}
