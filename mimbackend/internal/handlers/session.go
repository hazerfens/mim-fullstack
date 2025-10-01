package handlers

import (
	"fmt"
	"mimbackend/internal/services"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// GetUserSessionsHandler returns all active sessions for the authenticated user
// @Summary Get user sessions
// @Description Get all active sessions for the current user
// @Tags Sessions
// @Accept json
// @Produce json
// @Security BearerAuth
// @Success 200 {array} authmodels.UserSession
// @Failure 401 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /user/sessions [get]
func GetUserSessionsHandler(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	uid, ok := userID.(uuid.UUID)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid user ID"})
		return
	}

	sessionService, err := services.NewSessionService()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to initialize session service"})
		return
	}

	sessions, err := sessionService.GetUserActiveSessions(uid)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get user sessions"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"sessions": sessions,
		"count":    len(sessions),
	})
}

// GetUserSessionHistoryHandler returns session history for the authenticated user
// @Summary Get user session history
// @Description Get session history for the current user
// @Tags Sessions
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param limit query int false "Limit number of results" default(50)
// @Success 200 {array} authmodels.UserSession
// @Failure 401 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /user/sessions/history [get]
func GetUserSessionHistoryHandler(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	uid, ok := userID.(uuid.UUID)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid user ID"})
		return
	}

	// Get limit from query param
	limitStr := c.DefaultQuery("limit", "50")
	limit, err := strconv.Atoi(limitStr)
	if err != nil || limit < 1 {
		limit = 50
	}

	sessionService, err := services.NewSessionService()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to initialize session service"})
		return
	}

	sessions, err := sessionService.GetUserSessionHistory(uid, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get session history"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"sessions": sessions,
		"count":    len(sessions),
	})
}

// RevokeUserSessionHandler revokes a specific session
// @Summary Revoke a session
// @Description Revoke a specific session by session ID
// @Tags Sessions
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param session_id path string true "Session ID"
// @Success 200 {object} map[string]string
// @Failure 400 {object} map[string]interface{}
// @Failure 401 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /user/sessions/{session_id} [delete]
func RevokeUserSessionHandler(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	uid, ok := userID.(uuid.UUID)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid user ID"})
		return
	}

	sessionID := c.Param("session_id")
	if sessionID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Session ID is required"})
		return
	}

	sessionService, err := services.NewSessionService()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to initialize session service"})
		return
	}

	if err := sessionService.RevokeSession(sessionID, uid); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to revoke session"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Session revoked successfully"})
}

// GetUserSessionStatsHandler returns session statistics for the authenticated user
// @Summary Get session statistics
// @Description Get session statistics for the current user
// @Tags Sessions
// @Accept json
// @Produce json
// @Security BearerAuth
// @Success 200 {object} map[string]interface{}
// @Failure 401 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /user/sessions/stats [get]
func GetUserSessionStatsHandler(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	uid, ok := userID.(uuid.UUID)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid user ID"})
		return
	}

	sessionService, err := services.NewSessionService()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to initialize session service"})
		return
	}

	stats, err := sessionService.GetSessionStats(uid)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get session stats"})
		return
	}

	c.JSON(http.StatusOK, stats)
}

// MarkSessionSuspiciousHandler marks a session as suspicious (admin only)
// @Summary Mark session as suspicious
// @Description Mark a specific session as suspicious (admin only)
// @Tags Sessions
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param session_id path string true "Session ID"
// @Param reason body map[string]string true "Reason"
// @Success 200 {object} map[string]string
// @Failure 400 {object} map[string]interface{}
// @Failure 401 {object} map[string]interface{}
// @Failure 403 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /admin/sessions/{session_id}/suspicious [post]
func MarkSessionSuspiciousHandler(c *gin.Context) {
	// Check if user is admin (should be done by middleware)
	role, exists := c.Get("role")
	if !exists || (role != "admin" && role != "super_admin") {
		c.JSON(http.StatusForbidden, gin.H{"error": "Admin access required"})
		return
	}

	sessionID := c.Param("session_id")
	if sessionID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Session ID is required"})
		return
	}

	var payload struct {
		Reason string `json:"reason" binding:"required"`
	}
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Reason is required"})
		return
	}

	sessionService, err := services.NewSessionService()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to initialize session service"})
		return
	}

	if err := sessionService.MarkSessionSuspicious(sessionID, payload.Reason); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to mark session as suspicious"})
		return
	}

	fmt.Printf("⚠️  Session %s marked as suspicious: %s\n", sessionID, payload.Reason)

	c.JSON(http.StatusOK, gin.H{"message": "Session marked as suspicious"})
}
