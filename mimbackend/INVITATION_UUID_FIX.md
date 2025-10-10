# Invitation UUID and Role ID Issues - Fix Guide

## 🐛 Identified Problems

### Problem 1: Zero UUID
```sql
id = '00000000-0000-0000-0000-000000000000'
```
**Cause:** `BaseModel.BeforeCreate` hook not generating UUID properly

**Symptoms:**
- Invitations created with null/zero UUID
- "Bekleyen Davetler (0)" shows no invitations
- Database queries fail to match invitations

### Problem 2: NULL role_id
```sql
role_name = 'admin' BUT role_id = NULL
```
**Cause:** Role lookup not populating `role_id` field

**Symptoms:**
- Invitation has `role_name` string but no foreign key reference
- Preload("Role") returns NULL
- Frontend can't display role details

## ✅ Solutions Implemented

### Backend Fix 1: Explicit UUID Generation
```go
// internal/services/invitation.go

invitation := &companymodels.CompanyInvitation{
    CompanyID: companyID,
    Email:     email,
    RoleName:  roleName,
    InvitedBy: invitedBy,
    Status:    companymodels.InvitationPending,
    ExpiresAt: time.Now().Add(7 * 24 * time.Hour),
}

// ✅ Generate UUID explicitly
if invitation.ID == uuid.Nil {
    invitation.ID = uuid.New()
}

if err := db.Create(invitation).Error; err != nil {
    return nil, fmt.Errorf("failed to create invitation: %w", err)
}
```

### Backend Fix 2: Role ID Lookup
**TODO:** Add role_id lookup in CreateCompanyInvitation
```go
// After creating invitation, populate role_id
var role basemodels.Role
if err := db.Where("name = ? AND company_id IS NULL", roleName).First(&role).Error; err == nil {
    invitation.RoleID = &role.ID
    db.Save(invitation)
}
```

### Backend Fix 3: Enhanced Preload
```go
// Reload with better error handling
if err := db.Preload("Company").Preload("Inviter").Preload("Role").
    First(invitation, invitation.ID).Error; err != nil {
    log.Printf("Warning: failed to reload invitation relations: %v", err)
}
```

## 🔧 Database Cleanup Steps

### Step 1: Check Current State
```bash
mysql -u root -p your_database < fix-invitation-issues.sql
```

Run queries 1-3 to see:
- Invitations with zero UUID
- Invitations with NULL role_id
- Available roles in database

### Step 2: Create Missing Roles (if needed)
```sql
-- Run the INSERT statements from fix-invitation-issues.sql
-- This creates admin, manager, user roles if missing
```

### Step 3: Fix NULL role_id
```sql
-- Update invitations to have proper role_id references
-- See OPTION 3 in fix-invitation-issues.sql
```

### Step 4: Remove Bad Records
```sql
-- Soft delete invitations with zero UUID
UPDATE company_invitations 
SET deleted_at = NOW(), status = 'expired'
WHERE id = '00000000-0000-0000-0000-000000000000';
```

### Step 5: Verify
```sql
-- Check all pending invitations are valid
SELECT * FROM company_invitations 
WHERE status = 'pending' 
  AND deleted_at IS NULL;
```

## 🧪 Testing Procedure

### Test 1: Create New Invitation
```bash
# Backend'i yeniden başlat
cd mimbackend
go run ./cmd/server

# Frontend'den yeni bir davet gönder
POST /api/v1/company/:id/invitations
{
  "email": "test@example.com",
  "role_name": "admin"
}

# Database'de kontrol et
SELECT id, email, role_name, role_id, status 
FROM company_invitations 
WHERE email = 'test@example.com';

# ✅ Expected:
# - id: Valid UUID (NOT 00000000-0000-0000-0000-000000000000)
# - role_id: Valid UUID (NOT NULL)
# - status: pending
```

### Test 2: Frontend Display
```bash
# /dashboard/company/members sayfasına git
# "Bekleyen Davetler" sekmesine tıkla

# ✅ Expected:
# - Invitation görünür olmalı
# - Email doğru gösterilmeli
# - Role badge doğru renk ve isimde olmalı
# - Davet eden kişi bilgisi görünmeli
# - Son geçerlilik tarihi görünmeli
```

### Test 3: Invitation Link
```bash
# Email'den gelen linke tıkla
# http://localhost:3000/accept-invitation/{token}

# ✅ Expected:
# - Company bilgileri görünmeli
# - Role doğru gösterilmeli
# - Inviter bilgisi görünmeli
# - Kabul Et / Reddet butonları çalışmalı
```

## 📋 Root Cause Analysis

### Why Zero UUID?

1. **GORM BeforeCreate Hook Issue:**
   ```go
   // basemodels/base.go
   func (b *BaseModel) BeforeCreate(tx *gorm.DB) error {
       if b.ID == uuid.Nil || b.ID.String() == "00000000-0000-0000-0000-000000000000" {
           b.ID = uuid.New()
       }
       return nil
   }
   ```
   - Hook may not execute in all cases
   - Struct initialization timing issues
   - Better to generate explicitly

2. **Struct Initialization:**
   ```go
   // ❌ BAD - ID not set
   invitation := &CompanyInvitation{
       CompanyID: companyID,
       Email: email,
   }
   
   // ✅ GOOD - ID explicitly set
   invitation := &CompanyInvitation{
       CompanyID: companyID,
       Email: email,
   }
   invitation.ID = uuid.New()
   ```

### Why NULL role_id?

1. **Missing Role Lookup:**
   - We set `role_name` (string) but not `role_id` (foreign key)
   - Frontend sends `role_name: "admin"`
   - Backend doesn't lookup role table

2. **Solution:**
   ```go
   // Look up role by name
   var role basemodels.Role
   db.Where("name = ?", roleName).First(&role)
   invitation.RoleID = &role.ID
   ```

## 🔄 Migration Strategy

### For Existing Invitations

**Option A: Keep and Fix**
```sql
-- Update role_id based on role_name
UPDATE company_invitations ci
JOIN roles r ON ci.role_name = r.name AND r.company_id IS NULL
SET ci.role_id = r.id
WHERE ci.role_id IS NULL;
```

**Option B: Clean Slate**
```sql
-- Delete all bad invitations
UPDATE company_invitations 
SET deleted_at = NOW(), status = 'expired'
WHERE id = '00000000-0000-0000-0000-000000000000'
   OR role_id IS NULL;

-- Users will need to be re-invited
```

**Recommendation:** Use Option A if invitations are recent and important. Use Option B for fresh start.

## 📊 Monitoring

### Health Check Query
```sql
-- Run this periodically to check invitation health
SELECT 
    'Total Active' as metric,
    COUNT(*) as count
FROM company_invitations 
WHERE deleted_at IS NULL AND status = 'pending'

UNION ALL

SELECT 
    'Zero UUID' as metric,
    COUNT(*) as count
FROM company_invitations 
WHERE id = '00000000-0000-0000-0000-000000000000'

UNION ALL

SELECT 
    'NULL role_id' as metric,
    COUNT(*) as count
FROM company_invitations 
WHERE role_id IS NULL AND deleted_at IS NULL

UNION ALL

SELECT 
    'Healthy' as metric,
    COUNT(*) as count
FROM company_invitations 
WHERE id != '00000000-0000-0000-0000-000000000000'
  AND role_id IS NOT NULL
  AND deleted_at IS NULL
  AND status = 'pending';
```

### Expected Output (Healthy System):
```
+--------------+-------+
| metric       | count |
+--------------+-------+
| Total Active |    5  |
| Zero UUID    |    0  |  ← Should be 0
| NULL role_id |    0  |  ← Should be 0
| Healthy      |    5  |  ← Should match Total Active
+--------------+-------+
```

## 🚨 Prevention

### Code Review Checklist
- [ ] All structs with BaseModel explicitly set ID
- [ ] Foreign key fields populated before Create()
- [ ] Preload() calls include error handling
- [ ] Test with actual database (not mocks)

### CI/CD Checks
```bash
# Add to test suite
func TestInvitationCreation(t *testing.T) {
    invitation := CreateInvitation(...)
    
    assert.NotEqual(t, uuid.Nil, invitation.ID)
    assert.NotEqual(t, "00000000-0000-0000-0000-000000000000", invitation.ID.String())
    assert.NotNil(t, invitation.RoleID)
}
```

## 📚 Related Files

- ✅ `internal/services/invitation.go` - Fixed UUID generation
- ⚠️ `internal/services/invitation.go` - TODO: Add role_id lookup
- ✅ `fix-invitation-issues.sql` - Database cleanup script
- ✅ `internal/models/basemodels/base.go` - BeforeCreate hook
- ✅ `internal/models/company/invitation.go` - Model definition

---

**Status:** Partial Fix Applied
**Next Steps:**
1. Add role_id lookup in CreateCompanyInvitation
2. Run database cleanup script
3. Test new invitation creation
4. Monitor for 24 hours

**Last Updated:** October 2, 2025
