package middleware

import (
	"net/http"

	"mimbackend/internal/services"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// ABACMiddleware creates middleware for ABAC permission checking
func ABACMiddleware(resource, action string) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Get user ID from JWT middleware (assumes JWTMiddleware ran before this)
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

		// Get company ID from context or URL params
		var companyID *uuid.UUID

		// Try to get company ID from URL params (e.g., /api/v1/company/:companyID/...)
		companyIDParam := c.Param("companyID")
		if companyIDParam != "" {
			if id, err := uuid.Parse(companyIDParam); err == nil {
				companyID = &id
			}
		}

		// Try to get company ID from query params
		if companyID == nil {
			companyIDParam := c.Query("company_id")
			if companyIDParam != "" {
				if id, err := uuid.Parse(companyIDParam); err == nil {
					companyID = &id
				}
			}
		}

		// Try to get company ID from context (set by other middleware)
		if companyID == nil {
			if companyIDVal, exists := c.Get("company_id"); exists {
				if id, ok := companyIDVal.(uuid.UUID); ok {
					companyID = &id
				}
			}
		}

		// Check permission using ABAC service
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

		// Permission granted, continue to next handler
		c.Next()
	}
}

// SystemABACMiddleware creates middleware for system-level ABAC permission checking
func SystemABACMiddleware(resource, action string) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Get user ID from JWT middleware
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

		// First, check user-specific custom permissions (highest priority)
		customAllowed, isCustom, err := services.CheckUserCustomPermissions(userID, resource, action)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Custom permission check failed"})
			c.Abort()
			return
		}

		// If there's a custom permission defined, use it (override role permissions)
		if isCustom {
			if !customAllowed {
				c.JSON(http.StatusForbidden, gin.H{"error": "Access denied by custom permission policy"})
				c.Abort()
				return
			}
			// Custom permission allowed, continue
			c.Next()
			return
		}

		// No custom permission, check role-based system permission
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

// RoleBasedMiddleware creates middleware that checks if user has specific role
func RoleBasedMiddleware(role string) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Get user ID from JWT middleware
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

		// Get company ID from context or URL params
		var companyID *uuid.UUID

		companyIDParam := c.Param("companyID")
		if companyIDParam != "" {
			if id, err := uuid.Parse(companyIDParam); err == nil {
				companyID = &id
			}
		}

		if companyID == nil {
			companyIDParam := c.Query("company_id")
			if companyIDParam != "" {
				if id, err := uuid.Parse(companyIDParam); err == nil {
					companyID = &id
				}
			}
		}

		if companyID == nil {
			if companyIDVal, exists := c.Get("company_id"); exists {
				if id, ok := companyIDVal.(uuid.UUID); ok {
					companyID = &id
				}
			}
		}

		// Build domain string
		domain := "*"
		if companyID != nil {
			domain = "company:" + companyID.String()
		}

		// Check if user has the required role
		userStr := userID.String()
		roles, err := services.GetRolesForUser(userStr, domain)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Role check failed"})
			c.Abort()
			return
		}

		hasRole := false
		for _, r := range roles {
			if r == role {
				hasRole = true
				break
			}
		}

		if !hasRole {
			c.JSON(http.StatusForbidden, gin.H{"error": "Required role not found: " + role})
			c.Abort()
			return
		}

		c.Next()
	}
}

// AdminMiddleware checks if user has admin role (system or company level)
func AdminMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Get user ID from JWT middleware
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

		// Get company ID from context or URL params
		var companyID *uuid.UUID

		companyIDParam := c.Param("companyID")
		if companyIDParam != "" {
			if id, err := uuid.Parse(companyIDParam); err == nil {
				companyID = &id
			}
		}

		if companyID == nil {
			companyIDParam := c.Query("company_id")
			if companyIDParam != "" {
				if id, err := uuid.Parse(companyIDParam); err == nil {
					companyID = &id
				}
			}
		}

		if companyID == nil {
			if companyIDVal, exists := c.Get("company_id"); exists {
				if id, ok := companyIDVal.(uuid.UUID); ok {
					companyID = &id
				}
			}
		}

		// Check system admin permissions first (super_admin, admin)
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

		// Check company admin permissions
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
