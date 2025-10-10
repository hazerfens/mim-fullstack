# Multi-Tenancy SaaS Invitation System - Test Documentation

## Test Environment
- **Backend**: http://localhost:3333
- **Frontend**: http://localhost:3000
- **Database**: MariaDB/MySQL

## Test Scenarios

### Scenario 1: Company Creation & Owner Assignment
**Objective**: Verify that when a company is created, the creator becomes the owner

**Steps**:
1. Login as a user (admin/super_admin role)
2. Navigate to company creation page
3. Fill in all company details (name, slug, logo, etc.)
4. Submit the form
5. Verify success message
6. Check database: `SELECT * FROM company_members WHERE company_id = ?`

**Expected Results**:
- ✅ Company created successfully
- ✅ CompanyMember record created with `is_owner = true`
- ✅ User's `active_company_id` set to new company
- ✅ Redirect to dashboard

**SQL Verification**:
```sql
-- Check company created
SELECT * FROM companies WHERE slug = 'test-company';

-- Check owner assigned
SELECT cm.*, u.email, r.name as role_name 
FROM company_members cm
JOIN users u ON cm.user_id = u.id
LEFT JOIN roles r ON cm.role_id = r.id
WHERE cm.company_id = 'COMPANY_ID' AND cm.is_owner = true;
```

---

### Scenario 2: Send Invitation Email
**Objective**: Verify invitation creation and email sending

**Steps**:
1. Login as company owner
2. Navigate to `/dashboard/company/members`
3. Click "Üye Davet Et" button
4. Enter email: `test-user@example.com`
5. Select role: "Yönetici" (admin)
6. Click "Davet Gönder"

**Expected Results**:
- ✅ Success message shown
- ✅ Invitation created in database
- ✅ Email sent (check console in development)
- ✅ Token generated (UUID format)
- ✅ Expiration date set (7 days from now)
- ✅ Status = "pending"

**SQL Verification**:
```sql
-- Check invitation created
SELECT ci.*, c.name as company_name, u.email as inviter_email
FROM company_invitations ci
JOIN companies c ON ci.company_id = c.id
JOIN users u ON ci.invited_by = u.id
WHERE ci.email = 'test-user@example.com'
ORDER BY ci.created_at DESC
LIMIT 1;
```

**Console Output (Development)**:
```
[DEV] Email to test-user@example.com
Subject: CompanyName - Şirket Daveti
Body: [HTML content with invitation details]
```

---

### Scenario 3: View Pending Invitations
**Objective**: Verify invitations list in members page

**Steps**:
1. Stay logged in as company owner
2. Navigate to "Bekleyen Davetler" tab
3. Verify invitation appears in the list

**Expected Results**:
- ✅ Invitation shown with:
  - Email address
  - Role badge (colored)
  - Inviter name
  - Expiration date
  - 3-dot menu with "Daveti İptal Et" option

---

### Scenario 4: Cancel Invitation
**Objective**: Verify invitation cancellation

**Steps**:
1. In "Bekleyen Davetler" tab
2. Click 3-dot menu on an invitation
3. Click "Daveti İptal Et"
4. Confirm deletion

**Expected Results**:
- ✅ Confirmation dialog appears
- ✅ Invitation deleted from database
- ✅ List refreshes
- ✅ Invitation no longer visible

**SQL Verification**:
```sql
-- Invitation should be deleted
SELECT * FROM company_invitations 
WHERE id = 'INVITATION_ID';
-- Result: 0 rows
```

---

### Scenario 5: Accept Invitation (New User)
**Objective**: Verify invitation acceptance flow for new users

**Prerequisites**:
- Valid invitation token
- User not yet registered

**Steps**:
1. Logout (clear session)
2. Navigate to: `http://localhost:3000/accept-invitation/{TOKEN}`
3. View invitation details page
4. Register a new account with the invited email
5. Login with new account
6. Navigate back to invitation link
7. Click "Daveti Kabul Et"

**Expected Results**:
- ✅ Invitation details displayed:
  - Company name & logo
  - Role badge
  - Inviter information
  - Expiration date
- ✅ After login, accept button works
- ✅ CompanyMember created
- ✅ User's active_company_id set to invited company
- ✅ Redirect to dashboard with success message
- ✅ Invitation status changed to "accepted"

**SQL Verification**:
```sql
-- Check member created
SELECT * FROM company_members 
WHERE user_id = 'USER_ID' AND company_id = 'COMPANY_ID';

-- Check invitation accepted
SELECT * FROM company_invitations 
WHERE token = 'TOKEN' AND status = 'accepted';

-- Check active company set
SELECT active_company_id FROM users WHERE id = 'USER_ID';
```

---

### Scenario 6: Accept Invitation (Existing User)
**Objective**: Verify invitation acceptance for already registered users

**Prerequisites**:
- Valid invitation token
- User already registered with different email

**Steps**:
1. Login as existing user
2. Navigate to: `http://localhost:3000/accept-invitation/{TOKEN}`
3. Verify invitation details match your email
4. Click "Daveti Kabul Et"

**Expected Results**:
- ✅ If email matches: Accept works
- ✅ If email doesn't match: Error message
- ✅ CompanyMember created with correct role
- ✅ User can switch between companies in TeamSwitcher

---

### Scenario 7: Reject Invitation
**Objective**: Verify invitation rejection

**Steps**:
1. Navigate to invitation acceptance page
2. Click "Daveti Reddet" button
3. Confirm rejection

**Expected Results**:
- ✅ Invitation status = "rejected"
- ✅ Redirect to home page
- ✅ Message: "Davet reddedildi"
- ✅ Cannot accept same invitation again

---

### Scenario 8: Expired Invitation
**Objective**: Verify handling of expired invitations

**Manual Test**:
```sql
-- Manually expire an invitation
UPDATE company_invitations 
SET expires_at = DATE_SUB(NOW(), INTERVAL 1 DAY)
WHERE token = 'TOKEN';
```

**Steps**:
1. Navigate to expired invitation link
2. Attempt to view/accept

**Expected Results**:
- ✅ Redirect to dashboard
- ✅ Error message: "Süresi dolmuş davet"
- ✅ Cannot accept expired invitation

---

### Scenario 9: View Company Members
**Objective**: Verify members list displays correctly

**Steps**:
1. Login as company owner/admin
2. Navigate to `/dashboard/company/members`
3. View "Üyeler" tab

**Expected Results**:
- ✅ All members displayed
- ✅ Owner shown with Crown icon
- ✅ Active members shown with CheckCircle icon
- ✅ Avatar displayed (or initials)
- ✅ Role badges colored correctly
- ✅ Join date displayed
- ✅ Owner cannot be removed (no 3-dot menu)

---

### Scenario 10: Remove Member
**Objective**: Verify member removal

**Prerequisites**:
- Multiple members in company
- Logged in as admin/owner

**Steps**:
1. In members list
2. Click 3-dot menu on a non-owner member
3. Click "Üyeyi Çıkar"
4. Confirm deletion

**Expected Results**:
- ✅ Confirmation dialog appears
- ✅ Member deleted from company_members
- ✅ List refreshes
- ✅ Member no longer visible
- ✅ Owner cannot be removed (protection)

**SQL Verification**:
```sql
-- Member should be deleted
SELECT * FROM company_members 
WHERE id = 'MEMBER_ID';
-- Result: 0 rows
```

---

### Scenario 11: Multi-Company Switching
**Objective**: Verify user can switch between companies

**Prerequisites**:
- User is member of multiple companies

**Steps**:
1. Login as user with multiple company memberships
2. Click company name in sidebar (TeamSwitcher)
3. Select different company
4. Verify active company changed

**Expected Results**:
- ✅ Dropdown shows all user's companies
- ✅ Active company highlighted
- ✅ Click switches active company
- ✅ router.refresh() called (no full page reload)
- ✅ Dashboard updates with new company data

**SQL Verification**:
```sql
-- Check active company updated
SELECT active_company_id FROM users WHERE id = 'USER_ID';
```

---

### Scenario 12: Permission Checks
**Objective**: Verify role-based permissions

**Test Cases**:

#### A. User with "user" role:
- ✅ Cannot access /dashboard (middleware redirect)
- ✅ Redirected to /unauthorized
- ✅ Cannot invite members
- ✅ Cannot remove members

#### B. User with "manager" role:
- ✅ Can access /dashboard
- ✅ Cannot invite members (not admin)
- ✅ Cannot remove members

#### C. User with "admin" role:
- ✅ Can access /dashboard
- ✅ Can invite members
- ✅ Can remove members
- ✅ Cannot remove owner

#### D. User with "company_owner" role:
- ✅ Can access /dashboard
- ✅ Can invite members
- ✅ Can remove members
- ✅ Cannot be removed

---

## API Endpoint Testing

### Using cURL or Postman:

#### 1. Get Company Members
```bash
curl -X GET http://localhost:3333/api/v1/company/{COMPANY_ID}/members \
  -H "Authorization: Bearer {JWT_TOKEN}"
```

#### 2. Create Invitation
```bash
curl -X POST http://localhost:3333/api/v1/company/{COMPANY_ID}/invitations \
  -H "Authorization: Bearer {JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@example.com",
    "role_name": "admin"
  }'
```

#### 3. Get Invitation Details
```bash
curl -X GET http://localhost:3333/api/v1/invitations/{TOKEN}
```

#### 4. Accept Invitation
```bash
curl -X POST http://localhost:3333/api/v1/invitations/{TOKEN}/accept \
  -H "Authorization: Bearer {JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@example.com"
  }'
```

#### 5. Remove Member
```bash
curl -X DELETE http://localhost:3333/api/v1/company/{COMPANY_ID}/members/{MEMBER_ID} \
  -H "Authorization: Bearer {JWT_TOKEN}"
```

#### 6. Cancel Invitation
```bash
curl -X DELETE http://localhost:3333/api/v1/company/{COMPANY_ID}/invitations/{INVITATION_ID} \
  -H "Authorization: Bearer {JWT_TOKEN}"
```

---

## Database Verification Queries

### Check System State
```sql
-- All companies
SELECT id, name, slug, is_active FROM companies;

-- All company members
SELECT 
  cm.id,
  c.name as company_name,
  u.email as user_email,
  r.name as role_name,
  cm.is_owner,
  cm.is_active,
  cm.joined_at
FROM company_members cm
JOIN companies c ON cm.company_id = c.id
JOIN users u ON cm.user_id = u.id
LEFT JOIN roles r ON cm.role_id = r.id
ORDER BY c.name, cm.is_owner DESC, cm.joined_at;

-- All pending invitations
SELECT 
  ci.id,
  c.name as company_name,
  ci.email as invited_email,
  ci.role_name,
  u.email as inviter_email,
  ci.status,
  ci.expires_at,
  ci.created_at
FROM company_invitations ci
JOIN companies c ON ci.company_id = c.id
JOIN users u ON ci.invited_by = u.id
WHERE ci.status = 'pending'
ORDER BY ci.created_at DESC;

-- User's active company
SELECT 
  u.email,
  c.name as active_company,
  c.slug
FROM users u
LEFT JOIN companies c ON u.active_company_id = c.id
WHERE u.id = 'USER_ID';
```

---

## Known Issues & Edge Cases

### 1. Duplicate Invitations
**Scenario**: Inviting same email twice
**Current Behavior**: Backend checks for pending invitations
**Expected**: Error message "Zaten bekleyen davet var"

### 2. Self-Invitation
**Scenario**: Owner invites their own email
**Expected**: Should be prevented or auto-accept

### 3. Expired Token Cleanup
**Recommendation**: Add cron job to clean up expired invitations
```sql
DELETE FROM company_invitations 
WHERE status = 'pending' AND expires_at < NOW();
```

### 4. Email Sending Failure
**Current Behavior**: Invitation created even if email fails
**Recommendation**: This is acceptable - invitation can be resent

---

## Success Criteria

### Must Have ✅
- [x] Company creation creates owner membership
- [x] Invitation email sent with correct details
- [x] Invitation acceptance creates member
- [x] Member removal works
- [x] Permission checks prevent unauthorized actions
- [x] Owner cannot be removed
- [x] Multi-company switching works

### Nice to Have 🔄
- [ ] Resend invitation feature
- [ ] Bulk invitation (CSV upload)
- [ ] Invitation analytics (sent, accepted, rejected)
- [ ] Custom invitation message
- [ ] Invitation expiry notification

---

## Performance Considerations

### Database Indexes
Ensure these indexes exist:
```sql
-- Company members
CREATE INDEX idx_company_members_company_user ON company_members(company_id, user_id);
CREATE INDEX idx_company_members_user ON company_members(user_id);

-- Invitations
CREATE INDEX idx_invitations_token ON company_invitations(token);
CREATE INDEX idx_invitations_email ON company_invitations(email);
CREATE INDEX idx_invitations_company_status ON company_invitations(company_id, status);
```

---

## Security Checklist

- [x] JWT required for all authenticated endpoints
- [x] Email validation on invitation creation
- [x] Token validation on acceptance
- [x] Permission checks (admin only for invite/remove)
- [x] Owner protection (cannot be removed)
- [x] Company membership verification
- [x] Expiration date enforcement
- [ ] Rate limiting on invitation sending
- [ ] CSRF protection on acceptance page

---

## Next Steps

1. **Casbin Integration**: Implement fine-grained permissions
2. **Email Templates**: Test with real SMTP server
3. **Error Handling**: Add more descriptive error messages
4. **Logging**: Add audit logs for member changes
5. **Notifications**: Real-time notifications for new invitations
6. **Mobile Responsive**: Test on mobile devices
