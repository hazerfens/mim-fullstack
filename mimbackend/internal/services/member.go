package services

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"mimbackend/config"
	"mimbackend/internal/cache"
	authmodels "mimbackend/internal/models/auth"
	basemodels "mimbackend/internal/models/basemodels"
	companymodels "mimbackend/internal/models/company"
)

// GetCompanyMembers retrieves all members of a company
func GetCompanyMembers(companyID uuid.UUID) ([]companymodels.CompanyMember, error) {
	// Try cache first
	ctx := context.Background()
	if data, cErr := cache.GetCompanyMembersCache(ctx, companyID); cErr == nil && len(data) > 0 {
		var members []companymodels.CompanyMember
		if uErr := json.Unmarshal(data, &members); uErr == nil {
			return members, nil
		}
		// fallthrough to DB on unmarshal error
	}

	db, err := config.NewConnection()
	if err != nil {
		return nil, err
	}

	var members []companymodels.CompanyMember
	if err := db.Where("company_id = ?", companyID).
		Preload("User").
		Preload("Role").
		Order("is_owner DESC, created_at ASC").
		Find(&members).Error; err != nil {
		return nil, fmt.Errorf("failed to get company members: %w", err)
	}

	// Cache the serialized result for a short period
	if raw, mErr := json.Marshal(members); mErr == nil {
		_ = cache.SetCompanyMembersCache(ctx, companyID, raw, 30*time.Second)
	}

	return members, nil
}

// RemoveCompanyMember removes a member from a company
func RemoveCompanyMember(companyID, memberID, requestUserID uuid.UUID) error {
	db, err := config.NewConnection()
	if err != nil {
		return err
	}

	// Check if the member exists
	var member companymodels.CompanyMember
	if err := db.Where("id = ? AND company_id = ?", memberID, companyID).
		First(&member).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return errors.New("member not found")
		}
		return fmt.Errorf("failed to find member: %w", err)
	}

	// Check if request user is super_admin (can do anything)
	var requestUser authmodels.User
	if err := db.Where("id = ?", requestUserID).First(&requestUser).Error; err != nil {
		return errors.New("user not found")
	}

	isSuperAdmin := requestUser.Role == "super_admin"

	// Prevent non-super_admins from removing the company owner. Super admins may remove owners.
	if member.IsOwner && !isSuperAdmin {
		return errors.New("cannot remove company owner")
	}

	// If not super_admin, check company membership and role
	if !isSuperAdmin {
		var requestMember companymodels.CompanyMember
		if err := db.Where("company_id = ? AND user_id = ?", companyID, requestUserID).
			Preload("Role").
			First(&requestMember).Error; err != nil {
			return errors.New("only admins can remove members")
		}

		// Check if request user is admin or owner
		isAdmin := requestMember.IsOwner
		if requestMember.Role != nil && requestMember.Role.Name != nil {
			roleName := *requestMember.Role.Name
			isAdmin = isAdmin || roleName == "admin" || roleName == "company_owner"
		}

		if !isAdmin {
			return errors.New("only admins can remove members")
		}
	}

	// Delete the member (soft delete with deleted_by tracking)
	now := time.Now()
	if err := db.Model(&member).Updates(map[string]interface{}{
		"deleted_at": now,
		"deleted_by": requestUserID,
	}).Error; err != nil {
		return fmt.Errorf("failed to remove member: %w", err)
	}

	log.Printf("✅ Member removed: member_id=%s, company_id=%s, removed_by=%s",
		memberID, companyID, requestUserID)

	// Invalidate cached member list for the company
	_ = cache.InvalidateCompanyMembersCache(context.Background(), companyID)

	return nil
}

// AssignRoleToMember assigns a new role to a company member and updates permission grouping (legacy Casbin removed)
func AssignRoleToMember(companyID, memberID, requestUserID, newRoleID uuid.UUID) error {
	db, err := config.NewConnection()
	if err != nil {
		return err
	}

	// Load target member
	var member companymodels.CompanyMember
	if err := db.Preload("Role").Where("id = ? AND company_id = ?", memberID, companyID).First(&member).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return errors.New("member not found")
		}
		return fmt.Errorf("failed to find member: %w", err)
	}

	// Requestor checks (similar to RemoveCompanyMember)
	var requestUser authmodels.User
	if err := db.Where("id = ?", requestUserID).First(&requestUser).Error; err != nil {
		return errors.New("user not found")
	}

	isSuperAdmin := requestUser.Role == "super_admin"

	if !isSuperAdmin {
		var requestMember companymodels.CompanyMember
		if err := db.Where("company_id = ? AND user_id = ?", companyID, requestUserID).
			Preload("Role").
			First(&requestMember).Error; err != nil {
			return errors.New("only admins can change member roles")
		}

		// Determine if requestor is admin/owner
		isAdmin := requestMember.IsOwner
		if requestMember.Role != nil && requestMember.Role.Name != nil {
			rn := *requestMember.Role.Name
			if rn == "company_admin" || rn == "company_owner" {
				isAdmin = true
			}
		}

		if !isAdmin {
			return errors.New("only admins can change member roles")
		}
	}

	// Load new role and validate
	var newRole basemodels.Role
	if err := db.Where("id = ? AND company_id = ? AND is_active = ?", newRoleID, companyID, true).First(&newRole).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return errors.New("role not found or inactive")
		}
		return fmt.Errorf("failed to find role: %w", err)
	}

	// Begin transaction to update member role and permission grouping
	tx := db.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	oldRole := member.Role

	// Update member
	if err := tx.Model(&member).Update("role_id", newRole.ID).Error; err != nil {
		tx.Rollback()
		return fmt.Errorf("failed to update member role: %w", err)
	}

	// Commit DB change
	if err := tx.Commit().Error; err != nil {
		return fmt.Errorf("failed to commit role change: %w", err)
	}

	// Update permission grouping: remove old, add new
	domain := BuildDomainID(&companyID)
	userStr := member.UserID.String()

	if oldRole != nil && oldRole.Name != nil {
		if _, err := DeleteRoleForUser(userStr, *oldRole.Name, domain); err != nil {
			// Log but continue
			log.Printf("warning: failed to remove old role assignment for user %s: %v", userStr, err)
		}
	}

	if newRole.Name != nil {
		if _, err := AddRoleForUser(userStr, *newRole.Name, domain); err != nil {
			log.Printf("warning: failed to add new role assignment for user %s: %v", userStr, err)
		}
	}

	// Invalidate cached member list for the company (role changed)
	_ = cache.InvalidateCompanyMembersCache(context.Background(), companyID)

	return nil
}

// CancelInvitation cancels a pending invitation
func CancelInvitation(companyID, invitationID, requestUserID uuid.UUID) error {
	db, err := config.NewConnection()
	if err != nil {
		return err
	}

	// Check if invitation exists and belongs to the company
	var invitation companymodels.CompanyInvitation
	if err := db.Where("id = ? AND company_id = ?", invitationID, companyID).
		First(&invitation).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return errors.New("invitation not found")
		}
		return fmt.Errorf("failed to find invitation: %w", err)
	}

	// Check if request user is super_admin (can do anything)
	var requestUser authmodels.User
	if err := db.Where("id = ?", requestUserID).First(&requestUser).Error; err != nil {
		return errors.New("user not found")
	}

	isSuperAdmin := requestUser.Role == "super_admin"

	// If not super_admin, check company membership and role
	if !isSuperAdmin {
		var requestMember companymodels.CompanyMember
		if err := db.Where("company_id = ? AND user_id = ?", companyID, requestUserID).
			Preload("Role").
			First(&requestMember).Error; err != nil {
			return errors.New("only admins can cancel invitations")
		}

		// Check if request user is admin or owner
		isAdmin := requestMember.IsOwner
		if requestMember.Role != nil && requestMember.Role.Name != nil {
			roleName := *requestMember.Role.Name
			isAdmin = isAdmin || roleName == "admin" || roleName == "company_owner"
		}

		if !isAdmin {
			return errors.New("only admins can cancel invitations")
		}
	}

	// Update invitation status to cancelled or delete it (soft delete with tracking)
	now := time.Now()
	if err := db.Model(&invitation).Updates(map[string]interface{}{
		"deleted_at": now,
		"deleted_by": requestUserID,
		"status":     "cancelled",
	}).Error; err != nil {
		return fmt.Errorf("failed to cancel invitation: %w", err)
	}

	log.Printf("✅ Invitation cancelled: invitation_id=%s, company_id=%s, cancelled_by=%s",
		invitationID, companyID, requestUserID)

	return nil
}
