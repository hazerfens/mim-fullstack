package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// HomeHandler returns basic API info
func HomeHandler(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"message": "MimReklam Backend API",
		"status":  "running",
		"version": "1.0.0",
	})
}

// HealthHandler returns health status
func HealthHandler(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"status": "healthy"})
}
