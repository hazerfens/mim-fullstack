package services

import (
	"errors"
	"fmt"
	"log"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"mimbackend/config"
	authmodels "mimbackend/internal/models/auth"
	basemodels "mimbackend/internal/models/basemodels"
	companymodels "mimbackend/internal/models/company"
)

// CreateCompanyInvitation creates a new company invitation
func CreateCompanyInvitation(companyID, invitedBy uuid.UUID, email, roleName string) (*companymodels.CompanyInvitation, error) {
	db, err := config.NewConnection()
	if err != nil {
		return nil, err
	}

	// Check if company exists
	var company companymodels.Company
	if err := db.Where("id = ?", companyID).First(&company).Error; err != nil {
		return nil, errors.New("company not found")
	}

	// Check if inviter is member of the company OR super_admin
	var user authmodels.User
	if err := db.Where("id = ?", invitedBy).First(&user).Error; err != nil {
		return nil, errors.New("user not found")
	}

	// super_admin can invite anyone to any company, others must be company members
	isSuperAdmin := user.Role == "super_admin"

	if !isSuperAdmin {
		var membership companymodels.CompanyMember
		if err := db.Where("company_id = ? AND user_id = ? AND is_active = ?",
			companyID, invitedBy, true).First(&membership).Error; err != nil {
			return nil, errors.New("only company members can invite others")
		}
	}

	// Check if user is already a member
	var existingUser authmodels.User
	if err := db.Where("email = ?", email).First(&existingUser).Error; err == nil {
		// User exists, check if already a member
		var existingMember companymodels.CompanyMember
		if err := db.Where("company_id = ? AND user_id = ?", companyID, existingUser.ID).
			First(&existingMember).Error; err == nil {
			return nil, errors.New("user is already a member of this company")
		}
	}

	// Check if there's a pending invitation
	var pending companymodels.CompanyInvitation
	if err := db.Where("company_id = ? AND email = ? AND status = ?",
		companyID, email, companymodels.InvitationPending).First(&pending).Error; err == nil {
		if !pending.IsExpired() {
			return nil, errors.New("there is already a pending invitation for this email")
		}
		// Expire old invitation
		db.Model(&pending).Update("status", companymodels.InvitationExpired)
	}

	// Create invitation with explicit ID generation
	invitation := &companymodels.CompanyInvitation{
		CompanyID: companyID,
		Email:     email,
		RoleName:  roleName,
		InvitedBy: invitedBy,
		Status:    companymodels.InvitationPending,
		ExpiresAt: time.Now().Add(7 * 24 * time.Hour), // 7 days
	}

	// Generate UUID for ID (BaseModel.BeforeCreate might not work properly)
	if invitation.ID == uuid.Nil {
		invitation.ID = uuid.New()
	}

	// Look up role by name - prefer company-scoped role, fallback to global role
	var role basemodels.Role
	if err := db.Where("name = ? AND company_id = ?", roleName, companyID).First(&role).Error; err != nil {
		// fallback to global role
		if err := db.Where("name = ? AND company_id IS NULL", roleName).First(&role).Error; err != nil {
			log.Printf("Warning: Role '%s' not found, invitation will be created without role_id: %v", roleName, err)
		} else {
			invitation.RoleID = &role.ID
			log.Printf("✅ Global role found: %s (ID: %s)", roleName, role.ID)
		}
	} else {
		invitation.RoleID = &role.ID
		log.Printf("✅ Company-scoped role found: %s (ID: %s)", roleName, role.ID)
	}

	if err := db.Create(invitation).Error; err != nil {
		return nil, fmt.Errorf("failed to create invitation: %w", err)
	}

	log.Printf("✅ Invitation created: ID=%s, Email=%s, Role=%s, RoleID=%v",
		invitation.ID, invitation.Email, invitation.RoleName, invitation.RoleID)

	// Reload with relations
	if err := db.Preload("Company").Preload("Inviter").Preload("Role").First(invitation, invitation.ID).Error; err != nil {
		log.Printf("Warning: failed to reload invitation relations: %v", err)
	}

	// Send invitation email
	emailService := NewEmailService()
	inviterName := "Bilinmeyen Kullanıcı"
	inviterEmail := ""
	if invitation.Inviter.ID != uuid.Nil {
		if invitation.Inviter.FullName != nil && *invitation.Inviter.FullName != "" {
			inviterName = *invitation.Inviter.FullName
		}
		inviterEmail = invitation.Inviter.Email
	}

	companyName := "Şirket"
	if invitation.Company.Name != nil && *invitation.Company.Name != "" {
		companyName = *invitation.Company.Name
	}

	companyEmail := ""
	companyPhone := ""
	companyWebsite := ""
	if invitation.Company.Email != nil {
		companyEmail = *invitation.Company.Email
	}
	if invitation.Company.Phone != nil {
		companyPhone = *invitation.Company.Phone
	}
	if invitation.Company.URL != nil {
		companyWebsite = *invitation.Company.URL
	}

	// Format expiration date
	expiresAt := invitation.ExpiresAt.Format("02.01.2006 15:04")

	if err := emailService.SendInvitationEmail(
		invitation.Email,
		companyName,
		inviterName,
		inviterEmail,
		invitation.RoleName,
		invitation.Token,
		expiresAt,
		companyEmail,
		companyPhone,
		companyWebsite,
	); err != nil {
		// Log error but don't fail the invitation creation
		fmt.Printf("Failed to send invitation email: %v\n", err)
	}

	return invitation, nil
}

// GetInvitationByToken retrieves invitation by token
func GetInvitationByToken(token string) (*companymodels.CompanyInvitation, error) {
	db, err := config.NewConnection()
	if err != nil {
		return nil, err
	}

	var invitation companymodels.CompanyInvitation
	if err := db.Preload("Company").Preload("Inviter").
		Where("token = ?", token).First(&invitation).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("invitation not found")
		}
		return nil, err
	}

	return &invitation, nil
}

// AcceptInvitation accepts a company invitation
func AcceptInvitation(token string, userID uuid.UUID) error {
	db, err := config.NewConnection()
	if err != nil {
		return err
	}

	// Get invitation
	invitation, err := GetInvitationByToken(token)
	if err != nil {
		return err
	}

	// Validate invitation
	if !invitation.IsValid() {
		if invitation.IsExpired() {
			db.Model(invitation).Update("status", companymodels.InvitationExpired)
			return errors.New("invitation has expired")
		}
		return fmt.Errorf("invitation is not valid (status: %s)", invitation.Status)
	}

	// Get user
	var user authmodels.User
	if err := db.Where("id = ?", userID).First(&user).Error; err != nil {
		return errors.New("user not found")
	}

	// Check if email matches
	if user.Email != invitation.Email {
		return errors.New("this invitation is for a different email address")
	}

	// Check if already a member
	var existingMember companymodels.CompanyMember
	if err := db.Where("company_id = ? AND user_id = ?", invitation.CompanyID, userID).
		First(&existingMember).Error; err == nil {
		// Already a member, just update status
		db.Model(invitation).Update("status", companymodels.InvitationAccepted)
		return nil
	}

	// Create company member
	// Find role by name - prefer company-scoped, fallback to global
	var role basemodels.Role
	if err := db.Where("name = ? AND company_id = ?", invitation.RoleName, invitation.CompanyID).First(&role).Error; err != nil {
		if err := db.Where("name = ? AND company_id IS NULL", invitation.RoleName).First(&role).Error; err != nil {
			return fmt.Errorf("role not found: %w", err)
		}
	}

	member := &companymodels.CompanyMember{
		CompanyID: invitation.CompanyID,
		UserID:    userID,
		RoleID:    role.ID,
		IsActive:  true,
		Status:    "active",
	}

	if err := db.Create(member).Error; err != nil {
		return fmt.Errorf("failed to add member: %w", err)
	}

	// Assign role for this user in the company domain (policy system removed)
	if role.ID != uuid.Nil {
		domain := BuildDomainID(&invitation.CompanyID)
		userSubject := fmt.Sprintf("user:%s", userID.String())
		roleSubject := fmt.Sprintf("role:%s", role.ID.String())
		if _, err := AddRoleForUser(userSubject, roleSubject, domain); err != nil {
			// Log error but do not fail acceptance
			log.Printf("Warning: failed to assign role for user %s in company %s: %v", userSubject, invitation.CompanyID.String(), err)
		}
	}

	// Update invitation status
	if err := db.Model(invitation).Update("status", companymodels.InvitationAccepted).Error; err != nil {
		return fmt.Errorf("failed to update invitation status: %w", err)
	}

	// Set as active company if user has no active company
	if user.ActiveCompanyID == nil {
		db.Model(&user).Update("active_company_id", invitation.CompanyID)
	}

	return nil
}

// RejectInvitation rejects a company invitation
func RejectInvitation(token string, userID uuid.UUID) error {
	db, err := config.NewConnection()
	if err != nil {
		return err
	}

	// Get invitation
	invitation, err := GetInvitationByToken(token)
	if err != nil {
		return err
	}

	// Validate invitation
	if !invitation.IsValid() {
		return errors.New("invitation is not valid")
	}

	// Get user
	var user authmodels.User
	if err := db.Where("id = ?", userID).First(&user).Error; err != nil {
		return errors.New("user not found")
	}

	// Check if email matches
	if user.Email != invitation.Email {
		return errors.New("this invitation is for a different email address")
	}

	// Update status
	if err := db.Model(invitation).Update("status", companymodels.InvitationRejected).Error; err != nil {
		return fmt.Errorf("failed to reject invitation: %w", err)
	}

	return nil
}

// GetUserPendingInvitations gets all pending invitations for a user email
func GetUserPendingInvitations(email string) ([]companymodels.CompanyInvitation, error) {
	db, err := config.NewConnection()
	if err != nil {
		return nil, err
	}

	var invitations []companymodels.CompanyInvitation
	if err := db.Preload("Company").Preload("Inviter").
		Where("email = ? AND status = ? AND expires_at > ?",
			email, companymodels.InvitationPending, time.Now()).
		Find(&invitations).Error; err != nil {
		return nil, err
	}

	return invitations, nil
}

// GetCompanyInvitations gets all invitations for a company
func GetCompanyInvitations(companyID uuid.UUID) ([]companymodels.CompanyInvitation, error) {
	db, err := config.NewConnection()
	if err != nil {
		return nil, err
	}

	var invitations []companymodels.CompanyInvitation
	if err := db.Preload("Company").
		Preload("Inviter").
		Preload("Role").
		Where("company_id = ? AND deleted_at IS NULL", companyID).
		Order("created_at DESC").
		Find(&invitations).Error; err != nil {
		return nil, err
	}

	return invitations, nil
}
