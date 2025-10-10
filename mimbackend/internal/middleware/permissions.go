package middleware

import (
	"net/http"

	"mimbackend/internal/services"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// ABACMiddleware checks company-scoped permissions using services.CheckUserCompanyPermission
func ABACMiddleware(resource, action string) gin.HandlerFunc {
	return func(c *gin.Context) {
		userIDVal, exists := c.Get("user_id")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
			c.Abort()
			return
		}
		userID, ok := userIDVal.(uuid.UUID)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user ID"})
			c.Abort()
			return
		}

		var companyID *uuid.UUID
		if p := c.Param("companyID"); p != "" {
			if id, err := uuid.Parse(p); err == nil {
				companyID = &id
			}
		}
		if companyID == nil {
			if q := c.Query("company_id"); q != "" {
				if id, err := uuid.Parse(q); err == nil {
					companyID = &id
				}
			}
		}
		if companyID == nil {
			if cv, ok := c.Get("company_id"); ok {
				if id, ok := cv.(uuid.UUID); ok {
					companyID = &id
				}
			}
		}

		allowed, err := services.CheckUserCompanyPermission(userID, resource, action, companyID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Permission check failed"})
			c.Abort()
			return
		}
		if !allowed {
			c.JSON(http.StatusForbidden, gin.H{"error": "Insufficient permissions"})
			c.Abort()
			return
		}
		c.Next()
	}
}

// SystemABACMiddleware checks system-wide permissions (uses user custom permissions first)
func SystemABACMiddleware(resource, action string) gin.HandlerFunc {
	return func(c *gin.Context) {
		userIDVal, exists := c.Get("user_id")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
			c.Abort()
			return
		}
		userID, ok := userIDVal.(uuid.UUID)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user ID"})
			c.Abort()
			return
		}

		// Check custom user perms first
		if allowed, isCustom, err := services.CheckUserCustomPermissions(userID, resource, action); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Custom permission check failed"})
			c.Abort()
			return
		} else if isCustom {
			if !allowed {
				c.JSON(http.StatusForbidden, gin.H{"error": "Access denied by custom permission policy"})
				c.Abort()
				return
			}
			c.Next()
			return
		}

		allowed, err := services.CheckUserSystemPermission(userID, resource, action)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Permission check failed"})
			c.Abort()
			return
		}
		if !allowed {
			c.JSON(http.StatusForbidden, gin.H{"error": "Insufficient system permissions"})
			c.Abort()
			return
		}
		c.Next()
	}
}

// RoleBasedMiddleware checks whether the user has a specific role (company-scoped if companyID present)
func RoleBasedMiddleware(role string) gin.HandlerFunc {
	return func(c *gin.Context) {
		userIDVal, exists := c.Get("user_id")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
			c.Abort()
			return
		}
		userID, ok := userIDVal.(uuid.UUID)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user ID"})
			c.Abort()
			return
		}

		var companyID *uuid.UUID
		if p := c.Param("companyID"); p != "" {
			if id, err := uuid.Parse(p); err == nil {
				companyID = &id
			}
		}
		if companyID == nil {
			if q := c.Query("company_id"); q != "" {
				if id, err := uuid.Parse(q); err == nil {
					companyID = &id
				}
			}
		}
		if companyID == nil {
			if cv, ok := c.Get("company_id"); ok {
				if id, ok := cv.(uuid.UUID); ok {
					companyID = &id
				}
			}
		}

		domain := "*"
		if companyID != nil {
			domain = services.BuildDomainID(companyID)
		}

		roles, err := services.GetRolesForUser(userID.String(), domain)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Role check failed"})
			c.Abort()
			return
		}
		has := false
		for _, r := range roles {
			if r == role {
				has = true
				break
			}
		}
		if !has {
			c.JSON(http.StatusForbidden, gin.H{"error": "Required role not found: " + role})
			c.Abort()
			return
		}
		c.Next()
	}
}

// AdminMiddleware requires admin access either system-wide or company-level
func AdminMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		userIDVal, exists := c.Get("user_id")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
			c.Abort()
			return
		}
		userID, ok := userIDVal.(uuid.UUID)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user ID"})
			c.Abort()
			return
		}

		// System admin check
		systemAllowed, err := services.CheckUserSystemPermission(userID, "*", "*")
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Admin check failed"})
			c.Abort()
			return
		}
		if systemAllowed {
			c.Next()
			return
		}

		// Company admin check
		var companyID *uuid.UUID
		if p := c.Param("companyID"); p != "" {
			if id, err := uuid.Parse(p); err == nil {
				companyID = &id
			}
		}
		if companyID == nil {
			if q := c.Query("company_id"); q != "" {
				if id, err := uuid.Parse(q); err == nil {
					companyID = &id
				}
			}
		}
		if companyID != nil {
			companyAllowed, err := services.CheckUserCompanyPermission(userID, "admin", "access", companyID)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Company admin check failed"})
				c.Abort()
				return
			}
			if companyAllowed {
				c.Next()
				return
			}
		}

		c.JSON(http.StatusForbidden, gin.H{"error": "Admin access required"})
		c.Abort()
	}
}
