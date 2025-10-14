package middleware

import (
	"mimbackend/internal/services"
	"net/http"
	"time"

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

		// Get company_id from query param or context
		var companyID *uuid.UUID
		if companyIDStr := c.Query("company_id"); companyIDStr != "" {
			if cid, err := uuid.Parse(companyIDStr); err == nil {
				companyID = &cid
			}
		}

		// Check permission (include client IP and current time for conditional rules)
		clientIP := c.ClientIP()
		allowed, err := services.CheckUserCompanyPermissionWithContext(userID, resource, action, companyID, clientIP, time.Now())
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

		// Check system permission (include client IP and current time for conditional rules)
		clientIP := c.ClientIP()
		allowed, err := services.CheckUserCompanyPermissionWithContext(userID, resource, action, nil, clientIP, time.Now())
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

		// Get company_id from query param or context
		var companyID *uuid.UUID
		if companyIDStr := c.Query("company_id"); companyIDStr != "" {
			if cid, err := uuid.Parse(companyIDStr); err == nil {
				companyID = &cid
			}
		}

		domain := services.BuildDomainID(companyID)
		userSubject := "user:" + userID.String()

		// Get enforcer and check if user has the required role
		enforcer := services.GetEnforcer()
		if enforcer == nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Permission system not initialized"})
			c.Abort()
			return
		}

		roles, err := enforcer.GetRolesForUser(userSubject, domain)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get user roles"})
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
			c.JSON(http.StatusForbidden, gin.H{"error": "Required role not found"})
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

		// Check JWT role claim first (simpler and more reliable)
		userRoleVal, roleExists := c.Get("user_role")
		if roleExists {
			userRole, ok := userRoleVal.(string)
			if ok && (userRole == "admin" || userRole == "super_admin") {
				c.Next()
				return
			}
		}

		// Fallback to Casbin role check if JWT role check fails
		// Get company_id from query param or context
		var companyID *uuid.UUID
		if companyIDStr := c.Query("company_id"); companyIDStr != "" {
			if cid, err := uuid.Parse(companyIDStr); err == nil {
				companyID = &cid
			}
		}

		domain := services.BuildDomainID(companyID)
		userSubject := "user:" + userID.String()

		// Get enforcer and check if user has admin or super_admin role
		enforcer := services.GetEnforcer()
		if enforcer == nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Permission system not initialized"})
			c.Abort()
			return
		}

		roles, err := enforcer.GetRolesForUser(userSubject, domain)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get user roles"})
			c.Abort()
			return
		}

		isAdmin := false
		for _, r := range roles {
			if r == "admin" || r == "super_admin" {
				isAdmin = true
				break
			}
		}

		if !isAdmin {
			c.JSON(http.StatusForbidden, gin.H{"error": "Admin access required"})
			c.Abort()
			return
		}

		c.Next()
	}
}
