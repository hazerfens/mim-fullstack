package handlers

import (
	"net/http"

	"log"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	// companymodels intentionally not imported here; handler builds JSON manually
	"mimbackend/internal/services"
)

// GetCompanyMembersHandler returns all members of a company
// @Summary Get company members
// @Description Get all members of a specific company
// @Tags Company Members
// @Accept json
// @Produce json
// @Param id path string true "Company ID"
// @Success 200 {object} map[string]interface{} "Company members retrieved successfully"
// @Failure 400 {object} ErrorResponse "Invalid company ID"
// @Failure 404 {object} ErrorResponse "Company not found"
// @Failure 500 {object} ErrorResponse "Internal server error"
// @Router /company/{id}/members [get]
// @Security BearerAuth
func GetCompanyMembersHandler(c *gin.Context) {
	companyIDStr := c.Param("id")
	companyID, err := uuid.Parse(companyIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid company ID"})
		return
	}

	members, err := services.GetCompanyMembers(companyID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Map members to JSON objects with lowercase keys for nested User and Role
	// so the frontend can reliably access m.user.email and m.role.name.
	resp := make([]gin.H, 0, len(members))
	for _, m := range members {
		if m.User == nil {
			// Log orphaned membership for investigation
			log.Printf("orphaned company_member found: id=%s company_id=%s user_id=%s", m.ID.String(), m.CompanyID.String(), m.UserID.String())
		}

		var userObj gin.H
		if m.User != nil {
			userObj = gin.H{
				"id":        m.User.ID,
				"email":     m.User.Email,
				"full_name": m.User.FullName,
				"image_url": m.User.ImageURL,
			}
		}

		var roleObj gin.H
		if m.Role != nil {
			roleObj = gin.H{
				"id":          m.Role.ID,
				"name":        m.Role.Name,
				"description": m.Role.Description,
			}
		}

		resp = append(resp, gin.H{
			"id":          m.ID,
			"user_id":     m.UserID,
			"company_id":  m.CompanyID,
			"role_id":     m.RoleID,
			"is_owner":    m.IsOwner,
			"is_active":   m.IsActive,
			"joined_at":   m.JoinedAt,
			"created_at":  m.CreatedAt,
			"user":        userObj,
			"role":        roleObj,
			"user_exists": m.User != nil,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"members": resp,
		"count":   len(resp),
	})
}

// RemoveMemberHandler removes a member from a company
// @Summary Remove company member
// @Description Remove a member from a company (cannot remove owner)
// @Tags Company Members
// @Accept json
// @Produce json
// @Param id path string true "Company ID"
// @Param memberId path string true "Member ID"
// @Success 200 {object} map[string]interface{} "Member removed successfully"
// @Failure 400 {object} ErrorResponse "Invalid ID or cannot remove owner"
// @Failure 404 {object} ErrorResponse "Member not found"
// @Failure 500 {object} ErrorResponse "Internal server error"
// @Router /company/{id}/members/{memberId} [delete]
// @Security BearerAuth
func RemoveMemberHandler(c *gin.Context) {
	companyIDStr := c.Param("id")
	memberIDStr := c.Param("memberId")

	companyID, err := uuid.Parse(companyIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid company ID"})
		return
	}

	memberID, err := uuid.Parse(memberIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid member ID"})
		return
	}

	// Get user ID from context (set by auth middleware)
	userIDInterface, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	userID, ok := userIDInterface.(uuid.UUID)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid user ID format"})
		return
	}

	if err := services.RemoveCompanyMember(companyID, memberID, userID); err != nil {
		if err.Error() == "cannot remove company owner" {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if err.Error() == "member not found" {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		if err.Error() == "only admins can remove members" {
			c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Member removed successfully",
	})
}

// CancelInvitationHandler cancels a pending invitation
// @Summary Cancel invitation
// @Description Cancel a pending company invitation
// @Tags Company Invitations
// @Accept json
// @Produce json
// @Param id path string true "Company ID"
// @Param invitationId path string true "Invitation ID"
// @Success 200 {object} map[string]interface{} "Invitation cancelled successfully"
// @Failure 400 {object} ErrorResponse "Invalid ID"
// @Failure 404 {object} ErrorResponse "Invitation not found"
// @Failure 500 {object} ErrorResponse "Internal server error"
// @Router /company/{id}/invitations/{invitationId} [delete]
// @Security BearerAuth
func CancelInvitationHandler(c *gin.Context) {
	companyIDStr := c.Param("id")
	invitationIDStr := c.Param("invitationId")

	companyID, err := uuid.Parse(companyIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid company ID"})
		return
	}

	invitationID, err := uuid.Parse(invitationIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid invitation ID"})
		return
	}

	// Get user ID from context (set by auth middleware)
	userIDInterface, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	userID, ok := userIDInterface.(uuid.UUID)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid user ID format"})
		return
	}

	if err := services.CancelInvitation(companyID, invitationID, userID); err != nil {
		if err.Error() == "invitation not found" {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		if err.Error() == "only admins can cancel invitations" {
			c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Invitation cancelled successfully",
	})
}

// UpdateMemberRoleHandler updates a company member's role
func UpdateMemberRoleHandler(c *gin.Context) {
	companyIDStr := c.Param("id")
	memberIDStr := c.Param("memberId")

	companyID, err := uuid.Parse(companyIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid company ID"})
		return
	}

	memberID, err := uuid.Parse(memberIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid member ID"})
		return
	}

	var req struct {
		RoleID uuid.UUID `json:"role_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Requesting user
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

	if err := services.AssignRoleToMember(companyID, memberID, userID, req.RoleID); err != nil {
		if err.Error() == "member not found" || err.Error() == "role not found or inactive" {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		if err.Error() == "only admins can change member roles" {
			c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Member role updated successfully"})
}
