package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"mimbackend/internal/services"
)

// CreateInvitationRequest davet oluşturma isteği
type CreateInvitationRequest struct {
	Email    string `json:"email" binding:"required,email"`
	RoleName string `json:"role_name" binding:"required"` // admin, manager, member, viewer
}

// CreateCompanyInvitationHandler şirkete yeni üye davet eder
// @Summary Create company invitation
// @Description Invite a new member to the company
// @Tags Company
// @Accept json
// @Produce json
// @Param id path string true "Company ID"
// @Param request body CreateInvitationRequest true "Invitation details"
// @Success 201 {object} object
// @Failure 400 {object} object{error=string}
// @Failure 401 {object} object{error=string}
// @Router /api/v1/company/{id}/invitations [post]
func CreateCompanyInvitationHandler(c *gin.Context) {
	companyIDStr := c.Param("id")
	companyID, err := uuid.Parse(companyIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid company ID"})
		return
	}

	userIDVal, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	userID, ok := userIDVal.(uuid.UUID)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user ID"})
		return
	}

	var req CreateInvitationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	invitation, err := services.CreateCompanyInvitation(companyID, userID, req.Email, req.RoleName)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// TODO: Send invitation email
	// services.SendInvitationEmail(invitation)

	c.JSON(http.StatusCreated, invitation)
}

// GetInvitationHandler daveti token ile getirir
// @Summary Get invitation by token
// @Description Retrieve invitation details by token
// @Tags Invitation
// @Produce json
// @Param token path string true "Invitation Token"
// @Success 200 {object} object
// @Failure 404 {object} object{error=string}
// @Router /api/v1/invitations/{token} [get]
func GetInvitationHandler(c *gin.Context) {
	token := c.Param("token")

	invitation, err := services.GetInvitationByToken(token)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, invitation)
}

// AcceptInvitationHandler daveti kabul eder
// @Summary Accept invitation
// @Description Accept a company invitation
// @Tags Invitation
// @Produce json
// @Param token path string true "Invitation Token"
// @Success 200 {object} object{message=string}
// @Failure 400 {object} object{error=string}
// @Failure 401 {object} object{error=string}
// @Router /api/v1/invitations/{token}/accept [post]
func AcceptInvitationHandler(c *gin.Context) {
	token := c.Param("token")

	userIDVal, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	userID, ok := userIDVal.(uuid.UUID)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user ID"})
		return
	}

	if err := services.AcceptInvitation(token, userID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Invitation accepted successfully"})
}

// RejectInvitationHandler daveti reddeder
// @Summary Reject invitation
// @Description Reject a company invitation
// @Tags Invitation
// @Produce json
// @Param token path string true "Invitation Token"
// @Success 200 {object} object{message=string}
// @Failure 400 {object} object{error=string}
// @Failure 401 {object} object{error=string}
// @Router /api/v1/invitations/{token}/reject [post]
func RejectInvitationHandler(c *gin.Context) {
	token := c.Param("token")

	userIDVal, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	userID, ok := userIDVal.(uuid.UUID)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user ID"})
		return
	}

	if err := services.RejectInvitation(token, userID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Invitation rejected successfully"})
}

// GetUserInvitationsHandler kullanıcının davetlerini listeler
// @Summary Get user pending invitations
// @Description Get all pending invitations for the current user
// @Tags Invitation
// @Produce json
// @Success 200 {array} object
// @Failure 401 {object} object{error=string}
// @Router /api/v1/invitations/me [get]
func GetUserInvitationsHandler(c *gin.Context) {
	userIDVal, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	userID, ok := userIDVal.(uuid.UUID)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user ID"})
		return
	}

	// Get user email
	user, err := services.GetUserByID(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get user"})
		return
	}

	invitations, err := services.GetUserPendingInvitations(user.Email)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, invitations)
}

// GetCompanyInvitationsHandler şirketin davetlerini listeler
// @Summary Get company invitations
// @Description Get all invitations for a company
// @Tags Company
// @Produce json
// @Param id path string true "Company ID"
// @Success 200 {array} object
// @Failure 400 {object} object{error=string}
// @Router /api/v1/company/{id}/invitations [get]
func GetCompanyInvitationsHandler(c *gin.Context) {
	companyIDStr := c.Param("id")
	companyID, err := uuid.Parse(companyIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid company ID"})
		return
	}

	invitations, err := services.GetCompanyInvitations(companyID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, invitations)
}
