package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"mimbackend/internal/services"
)

// CompanyActiveMiddleware enforces that when a company is passive (is_active=false),
// only the company owner may access ID-based company endpoints.
func CompanyActiveMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Extract company id from param
		idStr := c.Param("id")
		if idStr == "" {
			c.Next()
			return
		}

		companyID, err := uuid.Parse(idStr)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "invalid company id"})
			return
		}

		company, err := services.GetCompanyByID(companyID)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusNotFound, gin.H{"error": "company not found"})
			return
		}

		// If active, allow
		if company.IsActive {
			c.Next()
			return
		}

		// If passive: only owner allowed
		userIDVal, exists := c.Get("userID")
		if !exists {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}
		userID, ok := userIDVal.(uuid.UUID)
		if !ok {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid user id"})
			return
		}

		// Allow if the user is the company's creator/owner
		if company.UserID != nil && *company.UserID == userID {
			c.Next()
			return
		}

		// Otherwise deny access when company is passive
		c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "company is passive; only owner may access"})
	}
}
