package handlers

import (
	"mimbackend/internal/services"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// AddPolicyHandler adds a new ABAC policy
func AddPolicyHandler(c *gin.Context) {
	var req struct {
		Subject string `json:"subject" binding:"required"`
		Object  string `json:"object" binding:"required"`
		Action  string `json:"action" binding:"required"`
		Domain  string `json:"domain" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ok, err := services.AddPolicy(req.Subject, req.Object, req.Action, req.Domain)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": ok, "message": "Policy added successfully"})
}

// RemovePolicyHandler removes an ABAC policy
func RemovePolicyHandler(c *gin.Context) {
	var req struct {
		Subject string `json:"subject" binding:"required"`
		Object  string `json:"object" binding:"required"`
		Action  string `json:"action" binding:"required"`
		Domain  string `json:"domain" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ok, err := services.RemovePolicy(req.Subject, req.Object, req.Action, req.Domain)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": ok, "message": "Policy removed successfully"})
}

// AddRoleForUserHandler adds a role for a user in a domain
func AddRoleForUserHandler(c *gin.Context) {
	var req struct {
		User   string `json:"user" binding:"required"`
		Role   string `json:"role" binding:"required"`
		Domain string `json:"domain" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ok, err := services.AddRoleForUser(req.User, req.Role, req.Domain)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": ok, "message": "Role added successfully"})
}

// DeleteRoleForUserHandler removes a role from a user in a domain
func DeleteRoleForUserHandler(c *gin.Context) {
	var req struct {
		User   string `json:"user" binding:"required"`
		Role   string `json:"role" binding:"required"`
		Domain string `json:"domain" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ok, err := services.DeleteRoleForUser(req.User, req.Role, req.Domain)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": ok, "message": "Role removed successfully"})
}

// GetRolesForUserHandler gets all roles for a user in a domain
func GetRolesForUserHandler(c *gin.Context) {
	user := c.Query("user")
	domain := c.Query("domain")

	if user == "" || domain == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "user and domain parameters are required"})
		return
	}

	roles, err := services.GetRolesForUser(user, domain)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"roles": roles})
}

// GetUsersForRoleHandler gets all users for a role in a domain
func GetUsersForRoleHandler(c *gin.Context) {
	role := c.Query("role")
	domain := c.Query("domain")

	if role == "" || domain == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "role and domain parameters are required"})
		return
	}

	users, err := services.GetUsersForRole(role, domain)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"users": users})
}

// GetAllPoliciesHandler gets all policies
func GetAllPoliciesHandler(c *gin.Context) {
	policies, err := services.GetAllPolicies()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"policies": policies})
}

// CheckPermissionHandler checks if a subject has permission to perform an action on an object
func CheckPermissionHandler(c *gin.Context) {
	var req struct {
		Subject string `json:"subject" binding:"required"`
		Object  string `json:"object" binding:"required"`
		Action  string `json:"action" binding:"required"`
		Domain  string `json:"domain" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	allowed, err := services.CheckPermission(req.Subject, req.Object, req.Action, req.Domain)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"allowed": allowed})
}

// CheckUserPermissionHandler checks user permissions using user ID
func CheckUserPermissionHandler(c *gin.Context) {
	userIDVal, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	userID, ok := userIDVal.(uuid.UUID)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user ID"})
		return
	}

	var req struct {
		Resource  string     `json:"resource" binding:"required"`
		Action    string     `json:"action" binding:"required"`
		CompanyID *uuid.UUID `json:"company_id,omitempty"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	allowed, err := services.CheckUserCompanyPermission(userID, req.Resource, req.Action, req.CompanyID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"allowed": allowed})
}
