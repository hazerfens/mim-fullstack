package services

import (
	"encoding/json"
	"fmt"
	"time"

	"mimbackend/config"
	basemodels "mimbackend/internal/models/basemodels"

	"github.com/google/uuid"
)

// StartExportJob builds export JSON for the company based on requested models,
// stores it in the in-memory export store and emails the download link to the user.
func StartExportJob(companyID, userID uuid.UUID, models []string) (string, error) {
	// Build list set
	set := map[string]bool{}
	for _, m := range models {
		set[m] = true
	}
	includeAll := len(set) == 0

	// Fetch company
	company, err := GetCompanyByID(companyID)
	if err != nil {
		return "", fmt.Errorf("failed to fetch company: %w", err)
	}

	exportObj := map[string]interface{}{}

	if includeAll || set["company"] {
		exportObj["company"] = company
	}

	if includeAll || set["members"] {
		members, _ := GetCompanyMembers(companyID)
		exportObj["members"] = members
	}

	if includeAll || set["invitations"] {
		invites, _ := GetCompanyInvitations(companyID)
		exportObj["invitations"] = invites
	}

	if includeAll || set["roles"] {
		// Query DB directly for roles in company
		db, err := config.NewConnection()
		if err == nil {
			var roles []basemodels.Role
			_ = db.Where("company_id = ?", companyID).Find(&roles).Error
			exportObj["roles"] = roles
		}
	}

	if includeAll || set["branches"] {
		exportObj["branches"] = company.Branches
	}

	if includeAll || set["departments"] {
		exportObj["departments"] = company.Departments
	}

	body, err := json.MarshalIndent(exportObj, "", "  ")
	if err != nil {
		return "", fmt.Errorf("failed to marshal export: %w", err)
	}

	filename := fmt.Sprintf("company-%s-export-%d.json", companyID.String(), time.Now().Unix())
	rec := ExportRecord{
		CompanyID: companyID,
		UserID:    userID,
		Filename:  filename,
		Data:      body,
		ExpiresAt: time.Now().Add(24 * time.Hour),
	}
	token := SaveExport(rec)

	// Send email with link (best-effort)
	emailSvc := NewEmailService()
	to := ""
	if company.User != nil {
		to = company.User.Email
	}
	if to == "" {
		// fallback: try to lookup user
		if user, err := GetUserByID(userID); err == nil {
			to = user.Email
		}
	}
	if to != "" {
		link := fmt.Sprintf("%s/dashboard/company/settings/export/download?token=%s", emailSvc.frontendURL, token)
		compName := "Şirket"
		if company.Name != nil && *company.Name != "" {
			compName = *company.Name
		} else if company.Title != nil && *company.Title != "" {
			compName = *company.Title
		}
		subject := fmt.Sprintf("%s için dışa aktarma hazır", compName)
		bodyHTML := fmt.Sprintf("<p>Merhaba,</p><p>İstediğiniz şirket dışa aktarma hazır. İndirmek için tıklayın: <a href=\"%s\">İndir</a></p>", link)
		_ = emailSvc.sendEmail(to, subject, bodyHTML)
	}

	return token, nil
}
