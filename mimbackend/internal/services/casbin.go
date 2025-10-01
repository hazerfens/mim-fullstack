package services

import (
	"fmt"
	"log"
	"mimbackend/config"
	"strings"
	"time"

	authmodels "mimbackend/internal/models/auth"
	basemodels "mimbackend/internal/models/basemodels"

	"github.com/casbin/casbin/v2"
	gormadapter "github.com/casbin/gorm-adapter/v3"
	"github.com/google/uuid"
)

var enforcer *casbin.Enforcer

// ABACRequest represents an access request for ABAC
type ABACRequest struct {
	Subject string                 `json:"subject"`
	Object  string                 `json:"object"`
	Action  string                 `json:"action"`
	Domain  string                 `json:"domain"`
	Context map[string]interface{} `json:"context,omitempty"`
}

// InitCasbin initializes the Casbin enforcer with GORM adapter
func InitCasbin() error {
	db, err := config.NewConnection()
	if err != nil {
		return fmt.Errorf("failed to connect to database: %w", err)
	}

	// Create GORM adapter
	adapter, err := gormadapter.NewAdapterByDB(db)
	if err != nil {
		return fmt.Errorf("failed to create casbin adapter: %w", err)
	}

	// Create enforcer
	enforcer, err = casbin.NewEnforcer("config/casbin_model.conf", adapter)
	if err != nil {
		return fmt.Errorf("failed to create casbin enforcer: %w", err)
	}

	// Load policies
	if err := enforcer.LoadPolicy(); err != nil {
		return fmt.Errorf("failed to load casbin policies: %w", err)
	}

	log.Println("✅ Casbin ABAC system initialized successfully")
	return nil
}

// GetEnforcer returns the Casbin enforcer instance
func GetEnforcer() *casbin.Enforcer {
	return enforcer
}

// CheckPermission checks if a subject has permission to perform an action on an object
func CheckPermission(subject, object, action, domain string) (bool, error) {
	if enforcer == nil {
		return false, fmt.Errorf("casbin enforcer not initialized")
	}

	ok, err := enforcer.Enforce(subject, object, action, domain)
	if err != nil {
		return false, fmt.Errorf("permission check failed: %w", err)
	}

	return ok, nil
}

// CheckPermissionWithContext checks permission with additional context for ABAC
func CheckPermissionWithContext(request ABACRequest) (bool, error) {
	return CheckPermission(request.Subject, request.Object, request.Action, request.Domain)
}

// AddPolicy adds a new policy rule
func AddPolicy(subject, object, action, domain string) (bool, error) {
	if enforcer == nil {
		return false, fmt.Errorf("casbin enforcer not initialized")
	}

	ok, err := enforcer.AddPolicy(subject, object, action, domain, "allow")
	if err != nil {
		return false, fmt.Errorf("failed to add policy: %w", err)
	}

	if ok {
		if err := enforcer.SavePolicy(); err != nil {
			return false, fmt.Errorf("failed to save policy: %w", err)
		}
	}

	return ok, nil
}

// RemovePolicy removes a policy rule
func RemovePolicy(subject, object, action, domain string) (bool, error) {
	if enforcer == nil {
		return false, fmt.Errorf("casbin enforcer not initialized")
	}

	ok, err := enforcer.RemovePolicy(subject, object, action, domain, "allow")
	if err != nil {
		return false, fmt.Errorf("failed to remove policy: %w", err)
	}

	if ok {
		if err := enforcer.SavePolicy(); err != nil {
			return false, fmt.Errorf("failed to save policy: %w", err)
		}
	}

	return ok, nil
}

// AddRoleForUser adds a role for a user in a domain (validates role exists in database)
func AddRoleForUser(user, role, domain string) (bool, error) {
	if enforcer == nil {
		return false, fmt.Errorf("casbin enforcer not initialized")
	}

	// Validate role exists in database
	if err := validateRoleExists(role); err != nil {
		return false, fmt.Errorf("invalid role: %w", err)
	}

	ok, err := enforcer.AddRoleForUserInDomain(user, role, domain)
	if err != nil {
		return false, fmt.Errorf("failed to add role for user: %w", err)
	}

	return ok, nil
}

// DeleteRoleForUser removes a role from a user in a domain
func DeleteRoleForUser(user, role, domain string) (bool, error) {
	if enforcer == nil {
		return false, fmt.Errorf("casbin enforcer not initialized")
	}

	ok, err := enforcer.DeleteRoleForUserInDomain(user, role, domain)
	if err != nil {
		return false, fmt.Errorf("failed to delete role for user: %w", err)
	}

	return ok, nil
}

// GetRolesForUser gets all roles for a user in a domain
func GetRolesForUser(user, domain string) ([]string, error) {
	if enforcer == nil {
		return nil, fmt.Errorf("casbin enforcer not initialized")
	}

	roles := enforcer.GetRolesForUserInDomain(user, domain)
	return roles, nil
}

// GetUsersForRole gets all users for a role in a domain
func GetUsersForRole(role, domain string) ([]string, error) {
	if enforcer == nil {
		return nil, fmt.Errorf("casbin enforcer not initialized")
	}

	users := enforcer.GetUsersForRoleInDomain(role, domain)
	return users, nil
}

// GetAllPolicies gets all policies
func GetAllPolicies() ([][]string, error) {
	if enforcer == nil {
		return nil, fmt.Errorf("casbin enforcer not initialized")
	}

	policies, _ := enforcer.GetPolicy()
	return policies, nil
}

// ClearPolicy clears all policies
func ClearPolicy() error {
	if enforcer == nil {
		return fmt.Errorf("casbin enforcer not initialized")
	}

	enforcer.ClearPolicy()
	return enforcer.SavePolicy()
}

// InitializeDefaultPolicies initializes default system policies
func InitializeDefaultPolicies() error {
	if enforcer == nil {
		return fmt.Errorf("casbin enforcer not initialized")
	}

	// System-level policies for super_admin
	systemPolicies := [][]string{
		// Super admin can do everything system-wide
		{"super_admin", "*", "*", "*", "allow"},
		// Admin can manage users and companies
		{"admin", "user", "*", "*", "allow"},
		{"admin", "company", "*", "*", "allow"},
		// User can read their own data
		{"user", "user", "read", "*", "allow"},
		{"user", "company", "read", "*", "allow"},
	}

	for _, policy := range systemPolicies {
		_, err := enforcer.AddPolicy(policy[0], policy[1], policy[2], policy[3], policy[4])
		if err != nil {
			log.Printf("Failed to add system policy: %v", err)
		}
	}

	// Company-level policies
	companyPolicies := [][]string{
		// Company owner can do everything in their company
		{"company_owner", "*", "*", "company", "allow"},
		// Company admin can manage most things except ownership
		{"company_admin", "user", "*", "company", "allow"},
		{"company_admin", "branch", "*", "company", "allow"},
		{"company_admin", "department", "*", "company", "allow"},
		{"company_admin", "employee", "*", "company", "allow"},
		{"company_admin", "project", "*", "company", "allow"},
		{"company_admin", "invoice", "*", "company", "allow"},
		{"company_admin", "report", "*", "company", "allow"},
		// Company manager can manage their department
		{"company_manager", "employee", "*", "company", "allow"},
		{"company_manager", "project", "*", "company", "allow"},
		{"company_manager", "report", "*", "company", "allow"},
		// Company employee can read most data
		{"company_employee", "branch", "read", "company", "allow"},
		{"company_employee", "department", "read", "company", "allow"},
		{"company_employee", "employee", "read", "company", "allow"},
		{"company_employee", "project", "read", "company", "allow"},
		{"company_employee", "invoice", "read", "company", "allow"},
		{"company_employee", "report", "read", "company", "allow"},
	}

	for _, policy := range companyPolicies {
		_, err := enforcer.AddPolicy(policy[0], policy[1], policy[2], policy[3], policy[4])
		if err != nil {
			log.Printf("Failed to add company policy: %v", err)
		}
	}

	if err := enforcer.SavePolicy(); err != nil {
		return fmt.Errorf("failed to save default policies: %w", err)
	}

	log.Println("✅ Default ABAC policies initialized")
	return nil
}

// CheckUserCompanyPermission checks if a user has permission for a company resource
func CheckUserCompanyPermission(userID uuid.UUID, resource, action string, companyID *uuid.UUID) (bool, error) {
	userStr := userID.String()

	// Build domain string
	domain := "*"
	if companyID != nil {
		domain = "company:" + companyID.String()
	}

	// Check permission
	return CheckPermission(userStr, resource, action, domain)
}

// CheckUserSystemPermission checks if a user has system-level permission
func CheckUserSystemPermission(userID uuid.UUID, resource, action string) (bool, error) {
	userStr := userID.String()

	return CheckPermission(userStr, resource, action, "*")
}

// BuildSubjectID builds a subject ID for Casbin
func BuildSubjectID(userID uuid.UUID) string {
	return fmt.Sprintf("user:%s", userID.String())
}

// BuildObjectID builds an object ID for Casbin
func BuildObjectID(resourceType, resourceID string) string {
	return fmt.Sprintf("%s:%s", resourceType, resourceID)
}

// BuildDomainID builds a domain ID for Casbin
func BuildDomainID(companyID *uuid.UUID) string {
	if companyID == nil {
		return "*" // System-wide
	}
	return fmt.Sprintf("company:%s", companyID.String())
}

// ParseSubjectID parses a subject ID
func ParseSubjectID(subject string) (uuid.UUID, error) {
	parts := strings.Split(subject, ":")
	if len(parts) != 2 || parts[0] != "user" {
		return uuid.Nil, fmt.Errorf("invalid subject format")
	}
	return uuid.Parse(parts[1])
}

// ParseObjectID parses an object ID
func ParseObjectID(object string) (string, string, error) {
	parts := strings.Split(object, ":")
	if len(parts) != 2 {
		return "", "", fmt.Errorf("invalid object format")
	}
	return parts[0], parts[1], nil
}

// ParseDomainID parses a domain ID
func ParseDomainID(domain string) (*uuid.UUID, error) {
	if domain == "*" {
		return nil, nil
	}

	parts := strings.Split(domain, ":")
	if len(parts) != 2 || parts[0] != "company" {
		return nil, fmt.Errorf("invalid domain format")
	}

	companyID, err := uuid.Parse(parts[1])
	if err != nil {
		return nil, err
	}

	return &companyID, nil
}

// validateRoleExists checks if a role exists in the database
func validateRoleExists(roleName string) error {
	db, err := config.NewConnection()
	if err != nil {
		return fmt.Errorf("failed to connect to database: %w", err)
	}

	var role basemodels.Role
	if err := db.Where("name = ? AND is_active = ?", roleName, true).First(&role).Error; err != nil {
		return fmt.Errorf("role '%s' not found or inactive: %w", roleName, err)
	}

	return nil
}

// SyncUserRoleWithCasbin synchronizes user's database role with Casbin
func SyncUserRoleWithCasbin(userID uuid.UUID) error {
	db, err := config.NewConnection()
	if err != nil {
		return fmt.Errorf("failed to connect to database: %w", err)
	}

	var user authmodels.User
	if err := db.Preload("RoleModel").Where("id = ?", userID).First(&user).Error; err != nil {
		return fmt.Errorf("failed to get user: %w", err)
	}

	if user.RoleModel.Name == nil || *user.RoleModel.Name == "" {
		return fmt.Errorf("user has no role assigned")
	}

	roleName := *user.RoleModel.Name

	// Check if user already has this role in Casbin
	roles, err := GetRolesForUser(userID.String(), "*")
	if err != nil {
		return fmt.Errorf("failed to get user roles from Casbin: %w", err)
	}

	hasRole := false
	for _, role := range roles {
		if role == roleName {
			hasRole = true
			break
		}
	}

	// Add role if not exists
	if !hasRole {
		_, err := AddRoleForUser(userID.String(), roleName, "*")
		if err != nil {
			return fmt.Errorf("failed to add role to Casbin: %w", err)
		}
	}

	return nil
}

// CheckUserCustomPermissions checks user-specific permissions with time restrictions
// Returns: (allowed bool, isCustomPermission bool, error)
func CheckUserCustomPermissions(userID uuid.UUID, resource, action string) (bool, bool, error) {
	db, err := config.NewConnection()
	if err != nil {
		return false, false, fmt.Errorf("database connection failed: %w", err)
	}

	// Get user custom permissions for this resource and action
	var userPermission authmodels.UserPermission
	err = db.Where("user_id = ? AND resource = ? AND action = ?", userID, resource, action).
		Order("priority DESC"). // Higher priority first
		First(&userPermission).Error

	if err != nil {
		// No custom permission found, return false (not found, not an error)
		return false, false, nil
	}

	// Check if permission is explicitly denied
	if !userPermission.IsAllowed {
		return false, true, nil // Explicitly denied
	}

	// Check time restrictions if they exist
	if userPermission.TimeRestriction != nil {
		now := time.Now()
		if !userPermission.TimeRestriction.IsAllowedAtTime(now) {
			log.Printf("⏰ User %s denied access to %s.%s due to time restriction", userID, resource, action)
			return false, true, nil // Time restricted
		}
	}

	// Permission allowed
	return true, true, nil
}
