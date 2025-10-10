package services

import (
	"encoding/base64"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/google/uuid"
)

// SaveBase64Image saves a base64 encoded image to disk
// Returns the relative URL path to the saved file
func SaveBase64Image(base64Data string, companySlug string, fileType string) (string, error) {
	// Remove base64 prefix if exists (data:image/png;base64,...)
	base64Parts := strings.Split(base64Data, ",")
	if len(base64Parts) != 2 {
		return "", fmt.Errorf("invalid base64 data format")
	}

	// Get file extension from mime type
	mimeType := base64Parts[0]
	ext := ".png" // default
	if strings.Contains(mimeType, "jpeg") || strings.Contains(mimeType, "jpg") {
		ext = ".jpg"
	} else if strings.Contains(mimeType, "svg") {
		ext = ".svg"
	} else if strings.Contains(mimeType, "webp") {
		ext = ".webp"
	}

	// Decode base64 data
	imageData, err := base64.StdEncoding.DecodeString(base64Parts[1])
	if err != nil {
		return "", fmt.Errorf("failed to decode base64: %w", err)
	}

	// Create directory structure: public/companies/[slug]/logos/
	dirPath := filepath.Join("public", "companies", companySlug, "logos")
	if err := os.MkdirAll(dirPath, 0755); err != nil {
		return "", fmt.Errorf("failed to create directory: %w", err)
	}

	// Generate unique filename
	filename := fmt.Sprintf("%s_%s%s", fileType, uuid.New().String()[:8], ext)
	filePath := filepath.Join(dirPath, filename)

	// Write file to disk
	if err := os.WriteFile(filePath, imageData, 0644); err != nil {
		return "", fmt.Errorf("failed to write file: %w", err)
	}

	// Return relative URL path
	urlPath := fmt.Sprintf("/companies/%s/logos/%s", companySlug, filename)
	return urlPath, nil
}

// DeleteFile deletes a file from disk given its URL path
func DeleteFile(urlPath string) error {
	if urlPath == "" {
		return nil
	}

	// Convert URL path to file system path
	// /companies/slug/logo/file.png -> public/companies/slug/logo/file.png
	filePath := filepath.Join("public", strings.TrimPrefix(urlPath, "/"))

	// Check if file exists
	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		return nil // File doesn't exist, no error
	}

	// Delete file
	if err := os.Remove(filePath); err != nil {
		return fmt.Errorf("failed to delete file: %w", err)
	}

	return nil
}
