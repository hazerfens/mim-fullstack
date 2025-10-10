package services

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"mimbackend/internal/cache"
	"strings"
	"time"

	"mimbackend/config"
	authmodels "mimbackend/internal/models/auth"
	basemodels "mimbackend/internal/models/basemodels"
	companymodels "mimbackend/internal/models/company"

	"github.com/google/uuid"
	"gorm.io/gorm/clause"
)

// Permissions service: provides DB-backed permission checks and
// compatibility shims for legacy Casbin helper names. No Casbin dependency.

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

// AddPolicy is a no-op (policy management removed)
func AddPolicy(subject, object, action, domain string) (bool, error) {
	log.Printf("permissions: AddPolicy ignored: %s %s %s %s", subject, object, action, domain)
	return true, nil
}

// RemovePolicy is a no-op
func RemovePolicy(subject, object, action, domain string) (bool, error) {
	log.Printf("permissions: RemovePolicy ignored: %s %s %s %s", subject, object, action, domain)
	return true, nil
}

// AddRoleForUser is a shim; role assignment is persisted elsewhere (user.Role / company members)
func AddRoleForUser(user, role, domain string) (bool, error) {
	log.Printf("permissions: AddRoleForUser (ignored): user=%s role=%s domain=%s", user, role, domain)
	return true, nil
}

// DeleteRoleForUser is a shim
func DeleteRoleForUser(user, role, domain string) (bool, error) {
	log.Printf("permissions: DeleteRoleForUser (ignored): user=%s role=%s domain=%s", user, role, domain)
	return true, nil
}

// GetRolesForUser returns role names for a user, considering system role and active company membership roles
func GetRolesForUser(user, domain string) ([]string, error) {
	// Accept both 'user:<uuid>' and raw uuid
	user = strings.TrimPrefix(user, "user:")
	uid, err := uuid.Parse(user)
	if err != nil {
		return nil, fmt.Errorf("invalid user id: %w", err)
	}
	db, err := config.NewConnection()
	if err != nil {
		return nil, err
	}
	var u authmodels.User
	if err := db.Preload("RoleModel").Where("id = ?", uid).First(&u).Error; err != nil {
		return nil, err
	}
	roles := []string{}
	if u.Role != "" {
		roles = append(roles, u.Role)
	}
	if domain != "*" && strings.HasPrefix(domain, "company:") {
		if p := strings.Split(domain, ":"); len(p) == 2 {
			if cid, pErr := uuid.Parse(p[1]); pErr == nil {
				var cm companymodels.CompanyMember
				if err := db.Preload("Role").Where("user_id = ? AND company_id = ? AND is_active = ?", uid, cid, true).First(&cm).Error; err == nil {
					if cm.Role != nil && cm.Role.Name != nil {
						roles = append(roles, *cm.Role.Name)
					}
				}
			}
		}
	}
	return roles, nil
}

// GetUsersForRole returns user IDs (string) for a role in a domain
func GetUsersForRole(role, domain string) ([]string, error) {
	db, err := config.NewConnection()
	if err != nil {
		return nil, err
	}
	var ids []string
	// System-level users
	var r basemodels.Role
	if err := db.Where("name = ? AND company_id IS NULL", role).First(&r).Error; err == nil {
		var users []authmodels.User
		if err := db.Where("role_id = ?", r.ID).Find(&users).Error; err == nil {
			for _, u := range users {
				ids = append(ids, u.ID.String())
			}
		}
	}
	// Company members
	if domain == "*" {
		var members []companymodels.CompanyMember
		if err := db.Preload("Role").Where("is_active = ?", true).Find(&members).Error; err == nil {
			for _, m := range members {
				if m.Role != nil && m.Role.Name != nil && *m.Role.Name == role {
					ids = append(ids, m.UserID.String())
				}
			}
		}
	} else if strings.HasPrefix(domain, "company:") {
		parts := strings.Split(domain, ":")
		if len(parts) == 2 {
			if cid, pErr := uuid.Parse(parts[1]); pErr == nil {
				var members []companymodels.CompanyMember
				if err := db.Preload("Role").Where("company_id = ?", cid).Find(&members).Error; err == nil {
					for _, m := range members {
						if m.Role != nil && m.Role.Name != nil && *m.Role.Name == role {
							ids = append(ids, m.UserID.String())
						}
					}
				}
			}
		}
	}
	return ids, nil
}

// GetAllPolicies returns empty set now
func GetAllPolicies() ([][]string, error) {
	return [][]string{}, nil
}

// ClearPolicy no-op
func ClearPolicy() error {
	log.Println("permissions: ClearPolicy ignored")
	return nil
}

// InitializeDefaultPolicies no-op
func InitializeDefaultPolicies() error {
	log.Println("permissions: InitializeDefaultPolicies ignored")
	return nil
}

// UpdatePoliciesForRole no-op replacement (was UpdateCasbinPoliciesForRole)
func UpdatePoliciesForRole(role basemodels.Role) error {
	log.Printf("permissions: UpdatePoliciesForRole ignored for role=%v", role.ID)
	return nil
}

// RemovePoliciesForRole no-op replacement (was RemoveCasbinPoliciesForRole)
func RemovePoliciesForRole(roleName string, companyID *uuid.UUID) error {
	log.Printf("permissions: RemovePoliciesForRole ignored for role=%s company=%v", roleName, companyID)
	return nil
}

// RemovePoliciesForCompany no-op replacement (was RemoveCasbinPoliciesForCompany)
func RemovePoliciesForCompany(companyID uuid.UUID) error {
	log.Printf("permissions: RemovePoliciesForCompany ignored for company=%s", companyID.String())
	return nil
}

// (role existence checks handled directly where needed)

// LoadRolePermissionsByID loads a role's permissions (parsed) using Redis cache
func LoadRolePermissionsByID(roleID uuid.UUID) (*basemodels.Permissions, error) {
	ctx := context.Background()
	// Try cache first
	if data, err := cache.GetRolePermissionsCache(ctx, roleID); err == nil && len(data) > 0 {
		var p basemodels.Permissions
		if jErr := json.Unmarshal(data, &p); jErr == nil {
			return &p, nil
		}
		// fallthrough to DB on unmarshal error
	}

	db, err := config.NewConnection()
	if err != nil {
		return nil, err
	}

	// Prefer normalized role_permissions rows when present
	var rpRows []basemodels.RolePermission
	if err := db.Where("role_id = ?", roleID).Find(&rpRows).Error; err == nil && len(rpRows) > 0 {
		p := rolePermissionsToPermissions(rpRows)
		if raw, jErr := json.Marshal(p); jErr == nil {
			_ = cache.SetRolePermissionsCache(ctx, roleID, raw, time.Hour)
			return &p, nil
		}
		return &p, nil
	}

	// Fallback: read Role.Permissions JSON blob
	var role basemodels.Role
	if err := db.Where("id = ?", roleID).First(&role).Error; err != nil {
		return nil, err
	}

	var p basemodels.Permissions
	if role.Permissions != nil && len([]byte(*role.Permissions)) > 0 {
		raw := []byte(*role.Permissions)
		if jErr := json.Unmarshal(raw, &p); jErr == nil {
			// cache the raw bytes for faster subsequent lookups
			_ = cache.SetRolePermissionsCache(ctx, roleID, raw, time.Hour)
			return &p, nil
		}
	}
	return &p, nil
}

// Helper to convert role_permissions rows into Permissions struct
func rolePermissionsToPermissions(rows []basemodels.RolePermission) basemodels.Permissions {
	p := basemodels.Permissions{Custom: map[string]*basemodels.PermissionDetail{}}
	for _, r := range rows {
		res := strings.ToLower(r.Resource)
		act := strings.ToLower(r.Action)

		// helper to apply action to a *PermissionDetail pointer (allocate if nil)
		applyToField := func(d **basemodels.PermissionDetail, action string) {
			if *d == nil {
				*d = &basemodels.PermissionDetail{}
			}
			switch action {
			case "create":
				v := true
				(*d).Create = &v
			case "read":
				v := true
				(*d).Read = &v
			case "update":
				v := true
				(*d).Update = &v
			case "delete":
				v := true
				(*d).Delete = &v
			case "*":
				v := true
				(*d).Create = &v
				(*d).Read = &v
				(*d).Update = &v
				(*d).Delete = &v
			}
		}

		applyToDetail := func(d *basemodels.PermissionDetail, action string) {
			if d == nil {
				return
			}
			switch action {
			case "create":
				v := true
				d.Create = &v
			case "read":
				v := true
				d.Read = &v
			case "update":
				v := true
				d.Update = &v
			case "delete":
				v := true
				d.Delete = &v
			case "*":
				v := true
				d.Create = &v
				d.Read = &v
				d.Update = &v
				d.Delete = &v
			}
		}

		switch res {
		case "users":
			applyToField(&p.Users, act)
		case "companies":
			applyToField(&p.Companies, act)
		case "branches":
			applyToField(&p.Branches, act)
		case "departments":
			applyToField(&p.Departments, act)
		case "roles":
			applyToField(&p.Roles, act)
		case "reports":
			applyToField(&p.Reports, act)
		case "settings":
			applyToField(&p.Settings, act)
		default:
			if p.Custom == nil {
				p.Custom = map[string]*basemodels.PermissionDetail{}
			}
			d := p.Custom[res]
			if d == nil {
				d = &basemodels.PermissionDetail{}
				p.Custom[res] = d
			}
			applyToDetail(d, act)
		}
	}
	return p
}

// UpsertRolePermissionsFromPermissions replaces all role_permissions rows for a role
// with rows derived from the provided Permissions struct. This keeps normalized
// permission rows in-sync when the role JSON is updated via the admin UI.
func UpsertRolePermissionsFromPermissions(roleID uuid.UUID, p *basemodels.Permissions) error {
	db, err := config.NewConnection()
	if err != nil {
		return err
	}

	tx := db.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	if err := tx.Where("role_id = ?", roleID).Delete(&basemodels.RolePermission{}).Error; err != nil {
		tx.Rollback()
		return err
	}

	var rows []basemodels.RolePermission
	if p != nil {
		add := func(resource string, d *basemodels.PermissionDetail) {
			if d == nil {
				return
			}
			if d.Create != nil && *d.Create {
				rows = append(rows, basemodels.NewRolePermission(roleID, resource, "create", "allow", nil, 0))
			}
			if d.Read != nil && *d.Read {
				rows = append(rows, basemodels.NewRolePermission(roleID, resource, "read", "allow", nil, 0))
			}
			if d.Update != nil && *d.Update {
				rows = append(rows, basemodels.NewRolePermission(roleID, resource, "update", "allow", nil, 0))
			}
			if d.Delete != nil && *d.Delete {
				rows = append(rows, basemodels.NewRolePermission(roleID, resource, "delete", "allow", nil, 0))
			}
		}
		add("users", p.Users)
		add("companies", p.Companies)
		add("branches", p.Branches)
		add("departments", p.Departments)
		add("roles", p.Roles)
		add("reports", p.Reports)
		add("settings", p.Settings)
		for k, v := range p.Custom {
			add(k, v)
		}
	}

	if len(rows) > 0 {
		if err := tx.Create(&rows).Error; err != nil {
			tx.Rollback()
			return err
		}
	}

	if err := tx.Commit().Error; err != nil {
		return err
	}

	// Invalidate cache
	_ = cache.InvalidateRolePermissionsCache(context.Background(), roleID)
	return nil
}

// DeleteRolePermissionsByRoleID removes all normalized permission rows for a role
func DeleteRolePermissionsByRoleID(roleID uuid.UUID) error {
	db, err := config.NewConnection()
	if err != nil {
		return err
	}
	if err := db.Where("role_id = ?", roleID).Delete(&basemodels.RolePermission{}).Error; err != nil {
		return err
	}
	return cache.InvalidateRolePermissionsCache(context.Background(), roleID)
}

// CopyRolePermissions duplicates all role_permissions rows from a source role
// into a destination role. Used when cloning global role templates into
// company-scoped roles so the normalized rows are also copied.
func CopyRolePermissions(srcRoleID, dstRoleID uuid.UUID) error {
	db, err := config.NewConnection()
	if err != nil {
		return err
	}
	var rows []basemodels.RolePermission
	if err := db.Where("role_id = ?", srcRoleID).Find(&rows).Error; err != nil {
		return err
	}
	if len(rows) == 0 {
		return nil
	}
	var dst []basemodels.RolePermission
	for _, r := range rows {
		dst = append(dst, basemodels.NewRolePermission(dstRoleID, r.Resource, r.Action, r.Effect, []byte(r.Conditions), r.Priority))
	}
	if err := db.Create(&dst).Error; err != nil {
		return err
	}
	// Invalidate destination cache
	_ = cache.InvalidateRolePermissionsCache(context.Background(), dstRoleID)
	return nil
}

// ListPermissions returns the permission catalog, preferring Redis cache.
func ListPermissions() ([]basemodels.Permission, error) {
	ctx := context.Background()
	if data, err := cache.GetPermissionsCatalogAllCache(ctx); err == nil && len(data) > 0 {
		var perms []basemodels.Permission
		if jErr := json.Unmarshal(data, &perms); jErr == nil {
			return perms, nil
		}
	}

	db, err := config.NewConnection()
	if err != nil {
		return nil, err
	}
	var perms []basemodels.Permission
	if err := db.Where("is_active = ?", true).Find(&perms).Error; err != nil {
		return nil, err
	}
	if raw, jErr := json.Marshal(perms); jErr == nil {
		_ = cache.SetPermissionsCatalogAllCache(ctx, raw, time.Minute*10)
	}
	return perms, nil
}

// ListAllPermissions returns the permission catalog including inactive entries.
func ListAllPermissions() ([]basemodels.Permission, error) {
	ctx := context.Background()
	if data, err := cache.GetPermissionsCatalogCache(ctx); err == nil && len(data) > 0 {
		var perms []basemodels.Permission
		if jErr := json.Unmarshal(data, &perms); jErr == nil {
			return perms, nil
		}
	}

	db, err := config.NewConnection()
	if err != nil {
		return nil, err
	}
	var perms []basemodels.Permission
	if err := db.Find(&perms).Error; err != nil {
		return nil, err
	}
	if raw, jErr := json.Marshal(perms); jErr == nil {
		_ = cache.SetPermissionsCatalogCache(ctx, raw, time.Minute*10)
	}
	return perms, nil
}

// CreatePermission creates a new permission catalog entry and invalidates cache.
func CreatePermission(p basemodels.Permission) (*basemodels.Permission, error) {
	db, err := config.NewConnection()
	if err != nil {
		return nil, err
	}
	if err := db.Create(&p).Error; err != nil {
		return nil, err
	}
	_ = cache.InvalidatePermissionsCatalogCache(context.Background())
	_ = cache.InvalidatePermissionsCatalogAllCache(context.Background())
	// After creating a permission catalog entry, optionally create default
	// bindings for common roles so admin UX has sensible defaults. This is
	// intentionally conservative: it only affects global roles (company_id IS NULL).
	if err := addDefaultBindingsForNewPermission(p.Name); err != nil {
		log.Printf("warning: failed to add default bindings for permission %s: %v", p.Name, err)
	}
	return &p, nil
}

// addDefaultBindingsForNewPermission will grant default actions for newly
// created permission names to common roles (admin/company_owner/user) at the
// global scope. It inserts normalized role_permissions rows while avoiding
// duplicates via ON CONFLICT DO NOTHING.
func addDefaultBindingsForNewPermission(resource string) error {
	db, err := config.NewConnection()
	if err != nil {
		return err
	}

	// Which roles get which default actions
	defaultMap := map[string][]string{
		"admin":         {"create", "read", "update", "delete"},
		"company_owner": {"create", "read", "update", "delete"},
		"user":          {"read"},
	}

	var roles []basemodels.Role
	if err := db.Where("company_id IS NULL AND name IN ? AND is_active = ?", []string{"admin", "company_owner", "user"}, true).Find(&roles).Error; err != nil {
		return err
	}

	for _, r := range roles {
		// Determine actions by role name
		var roleActions []string
		if r.Name != nil {
			if a, exists := defaultMap[*r.Name]; exists {
				roleActions = a
			}
		}
		if len(roleActions) == 0 {
			continue
		}

		var rows []basemodels.RolePermission
		for _, act := range roleActions {
			rows = append(rows, basemodels.NewRolePermission(r.ID, resource, act, "allow", nil, 0))
		}

		// Insert rows ignoring conflicts (we added unique index on role+resource+action)
		if err := db.Clauses(clause.OnConflict{DoNothing: true}).Create(&rows).Error; err != nil {
			log.Printf("warning: failed to insert default role_permissions for role %s resource %s: %v", r.ID.String(), resource, err)
			continue
		}
		// Invalidate role cache
		_ = cache.InvalidateRolePermissionsCache(context.Background(), r.ID)
	}
	return nil
}

// UpdatePermission updates an existing catalog entry and invalidates cache.
func UpdatePermission(name string, patch map[string]interface{}) (*basemodels.Permission, error) {
	db, err := config.NewConnection()
	if err != nil {
		return nil, err
	}
	var p basemodels.Permission
	if err := db.Where("name = ?", name).First(&p).Error; err != nil {
		return nil, err
	}
	// Normalize common fields that may arrive as strings from JSON
	if v, ok := patch["is_active"]; ok {
		switch vv := v.(type) {
		case bool:
			// ok
		case string:
			// convert string to bool if possible
			if strings.ToLower(vv) == "true" {
				patch["is_active"] = true
			} else if strings.ToLower(vv) == "false" {
				patch["is_active"] = false
			}
		}
	}
	if err := db.Model(&p).Updates(patch).Error; err != nil {
		return nil, err
	}
	_ = cache.InvalidatePermissionsCatalogCache(context.Background())
	_ = cache.InvalidatePermissionsCatalogAllCache(context.Background())
	// Reload to return the fresh state
	if err := db.Where("id = ?", p.ID).First(&p).Error; err != nil {
		return nil, err
	}
	return &p, nil
}

// DeletePermission deletes a permission catalog entry (soft delete if using GORM) and invalidates cache.
func DeletePermission(name string) error {
	db, err := config.NewConnection()
	if err != nil {
		return err
	}
	if err := db.Where("name = ?", name).Delete(&basemodels.Permission{}).Error; err != nil {
		return err
	}
	_ = cache.InvalidatePermissionsCatalogCache(context.Background())
	_ = cache.InvalidatePermissionsCatalogAllCache(context.Background())
	return nil
}

// GetAllowedActionsForUserForPermissionName returns allowed CRUD actions for a user on a named permission.
func GetAllowedActionsForUserForPermissionName(userID uuid.UUID, permissionName string, companyID *uuid.UUID) (map[string]bool, error) {
	actions := []string{"create", "read", "update", "delete"}
	allowed := map[string]bool{}
	for _, a := range actions {
		// Check user-specific overrides first
		if val, isCustom, err := CheckUserCustomPermissions(userID, permissionName, a); err == nil && isCustom {
			allowed[a] = val
			continue
		}

		// Otherwise check company-scoped role first
		db, err := config.NewConnection()
		if err != nil {
			return nil, err
		}
		var user authmodels.User
		if err := db.Preload("RoleModel").Where("id = ?", userID).First(&user).Error; err != nil {
			return nil, err
		}

		if user.Role == "super_admin" {
			allowed[a] = true
			continue
		}

		found := false
		if companyID != nil {
			var cm companymodels.CompanyMember
			if err := db.Preload("Role").Where("user_id = ? AND company_id = ? AND is_active = ?", userID, *companyID, true).First(&cm).Error; err == nil {
				if cm.Role != nil {
					if perm, lErr := LoadRolePermissionsByID(cm.Role.ID); lErr == nil && perm != nil {
						if resourcePermAllowed(perm, permissionName, a) {
							allowed[a] = true
							found = true
						}
					}
				}
			}
		}
		if found {
			continue
		}

		if user.RoleModel.Name != nil {
			if perm, lErr := LoadRolePermissionsByID(user.RoleModel.ID); lErr == nil && perm != nil {
				allowed[a] = resourcePermAllowed(perm, permissionName, a)
				continue
			}
		}

		allowed[a] = false
	}
	return allowed, nil
}

// SyncUserRole synchronizes User.Role from RoleID in DB (renamed from SyncUserRoleWithCasbin)
func SyncUserRole(userID uuid.UUID) error {
	db, err := config.NewConnection()
	if err != nil {
		return err
	}
	var user authmodels.User
	if err := db.Where("id = ?", userID).First(&user).Error; err != nil {
		return err
	}
	if user.RoleID == nil {
		var def basemodels.Role
		if err := db.Where("name = ?", "user").First(&def).Error; err == nil {
			user.RoleID = &def.ID
			user.Role = "user"
			if err := db.Save(&user).Error; err != nil {
				return err
			}
		}
		return nil
	}
	var r basemodels.Role
	if err := db.Where("id = ?", user.RoleID).First(&r).Error; err != nil {
		return err
	}
	if r.Name != nil {
		user.Role = *r.Name
		if err := db.Save(&user).Error; err != nil {
			return err
		}
	}
	return nil
}

// CheckUserCustomPermissions checks user-specific overrides
func CheckUserCustomPermissions(userID uuid.UUID, resource, action string) (bool, bool, error) {
	db, err := config.NewConnection()
	if err != nil {
		return false, false, err
	}
	var perms []authmodels.UserPermission
	if err := db.Where("user_id = ? AND resource = ?", userID, resource).Order("priority DESC").Find(&perms).Error; err != nil {
		return false, false, err
	}
	now := time.Now()
	for _, p := range perms {
		if !p.IsAllowed {
			if p.TimeRestriction == nil || p.TimeRestriction.IsAllowedAtTime(now) {
				return false, true, nil
			}
			continue
		}
		if p.Action == action || p.Action == "*" {
			if p.TimeRestriction == nil || p.TimeRestriction.IsAllowedAtTime(now) {
				return true, true, nil
			}
		}
	}
	return false, false, nil
}

// CheckUserCompanyPermission checks permission via custom perms then role JSON
func CheckUserCompanyPermission(userID uuid.UUID, resource, action string, companyID *uuid.UUID) (bool, error) {
	if allowed, isCustom, err := CheckUserCustomPermissions(userID, resource, action); err != nil {
		return false, err
	} else if isCustom {
		return allowed, nil
	}
	db, err := config.NewConnection()
	if err != nil {
		return false, err
	}
	var user authmodels.User
	if err := db.Preload("RoleModel").Where("id = ?", userID).First(&user).Error; err != nil {
		return false, err
	}
	if user.Role == "super_admin" {
		return true, nil
	}
	if companyID != nil {
		var cm companymodels.CompanyMember
		if err := db.Preload("Role").Where("user_id = ? AND company_id = ? AND is_active = ?", userID, *companyID, true).First(&cm).Error; err == nil {
			if cm.Role != nil {
				if perm, lErr := LoadRolePermissionsByID(cm.Role.ID); lErr == nil && perm != nil {
					if resourcePermAllowed(perm, resource, action) {
						return true, nil
					}
				}
			}
		}
	}
	if user.RoleModel.Name != nil {
		if perm, lErr := LoadRolePermissionsByID(user.RoleModel.ID); lErr == nil && perm != nil {
			if resourcePermAllowed(perm, resource, action) {
				return true, nil
			}
		}
	}
	return false, nil
}

// CheckUserSystemPermission checks system-level permission
func CheckUserSystemPermission(userID uuid.UUID, resource, action string) (bool, error) {
	if allowed, isCustom, err := CheckUserCustomPermissions(userID, resource, action); err != nil {
		return false, err
	} else if isCustom {
		return allowed, nil
	}
	db, err := config.NewConnection()
	if err != nil {
		return false, err
	}
	var user authmodels.User
	if err := db.Preload("RoleModel").Where("id = ?", userID).First(&user).Error; err != nil {
		return false, err
	}
	if user.Role == "super_admin" {
		return true, nil
	}
	if user.RoleModel.Name != nil {
		if perm, lErr := LoadRolePermissionsByID(user.RoleModel.ID); lErr == nil && perm != nil {
			if resourcePermAllowed(perm, resource, action) {
				return true, nil
			}
		}
	}
	return false, nil
}

func resourcePermAllowed(p *basemodels.Permissions, resource, action string) bool {
	if p == nil {
		return false
	}
	switch strings.ToLower(resource) {
	case "users":
		return checkPermDetail(p.Users, action)
	case "companies":
		return checkPermDetail(p.Companies, action)
	case "branches":
		return checkPermDetail(p.Branches, action)
	case "departments":
		return checkPermDetail(p.Departments, action)
	case "roles":
		return checkPermDetail(p.Roles, action)
	case "reports":
		return checkPermDetail(p.Reports, action)
	case "settings":
		return checkPermDetail(p.Settings, action)
	default:
		if p.Custom != nil {
			if d, ok := p.Custom[resource]; ok {
				return checkPermDetail(d, action)
			}
		}
	}
	return false
}

func checkPermDetail(d *basemodels.PermissionDetail, action string) bool {
	if d == nil {
		return false
	}
	switch strings.ToLower(action) {
	case "create":
		return d.Create != nil && *d.Create
	case "read":
		return d.Read != nil && *d.Read
	case "update":
		return d.Update != nil && *d.Update
	case "delete":
		return d.Delete != nil && *d.Delete
	default:
		return false
	}
}
