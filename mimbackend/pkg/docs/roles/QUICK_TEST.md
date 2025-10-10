# Quick Test Scenarios

## Manual Testing Checklist

### ✅ Prerequisites
- [ ] Backend running on http://localhost:3333
- [ ] Frontend running on http://localhost:3000
- [ ] Database accessible
- [ ] At least one user account created

---

## 🧪 Test 1: Company Creation (5 min)

**Login**: Use admin/super_admin account

1. **Navigate**: `/dashboard` → Create Company button
2. **Fill Form**:
   - Ünvanı: Test Şirketi A.Ş.
   - Adı: Test Şirketi
   - Slug: test-sirketi-001
   - Email: info@test.com
   - Logo: Upload any image
   - Address: Fill all fields
3. **Submit** → Verify success
4. **Check**: Dashboard shows new company

**DB Check**:
```sql
SELECT * FROM companies WHERE slug = 'test-sirketi-001';
SELECT * FROM company_members WHERE company_id = 'COMPANY_ID' AND is_owner = true;
```

**Expected**: ✅ Company created, ✅ You are owner

---

## 🧪 Test 2: Send Invitation (3 min)

**Navigate**: `/dashboard/company/members`

1. **Click**: "Üye Davet Et" button
2. **Enter**:
   - Email: `test@example.com`
   - Rol: Yönetici
3. **Submit** → Verify success message
4. **Check**: "Bekleyen Davetler" tab shows invitation

**Console Check** (Development):
Look for email output in backend console

**DB Check**:
```sql
SELECT * FROM company_invitations WHERE email = 'test@example.com';
```

**Expected**: ✅ Invitation created, ✅ Email logged

---

## 🧪 Test 3: View Invitation Details (2 min)

**Get Token**: Copy token from database or email console output

**Navigate**: `http://localhost:3000/accept-invitation/{TOKEN}`

**Verify Page Shows**:
- ✅ Company name
- ✅ Company logo
- ✅ Role badge (colored)
- ✅ Inviter name
- ✅ Expiration date
- ✅ Accept & Reject buttons

---

## 🧪 Test 4: Accept Invitation (5 min)

### Option A: New User
1. **Logout** from current session
2. **Navigate** to invitation link
3. **Register** new account with invited email
4. **Login** with new account
5. **Navigate** to invitation link again
6. **Click** "Daveti Kabul Et"
7. **Verify** redirect to dashboard with success message

### Option B: Existing User
1. **Login** with account matching invited email
2. **Navigate** to invitation link
3. **Click** "Daveti Kabul Et"
4. **Verify** redirect to dashboard

**DB Check**:
```sql
SELECT * FROM company_members WHERE user_id = 'USER_ID' AND company_id = 'COMPANY_ID';
SELECT status FROM company_invitations WHERE token = 'TOKEN';
```

**Expected**: 
- ✅ CompanyMember created
- ✅ Invitation status = "accepted"
- ✅ User can see company in TeamSwitcher

---

## 🧪 Test 5: Multiple Company Switching (2 min)

**Prerequisites**: User must be member of 2+ companies

1. **Click** company name in sidebar
2. **Verify** dropdown shows all companies
3. **Select** different company
4. **Verify** page refreshes (router.refresh)
5. **Check** active company changed

**Expected**: ✅ Smooth switching, ✅ No full page reload

---

## 🧪 Test 6: Remove Member (3 min)

**Prerequisites**: 2+ members in company, logged in as admin/owner

**Navigate**: `/dashboard/company/members`

1. **Find** non-owner member
2. **Click** 3-dot menu
3. **Click** "Üyeyi Çıkar"
4. **Confirm** deletion
5. **Verify** member removed from list

**DB Check**:
```sql
SELECT * FROM company_members WHERE id = 'MEMBER_ID';
-- Should return 0 rows
```

**Expected**: ✅ Member deleted, ✅ Owner cannot be removed

---

## 🧪 Test 7: Cancel Invitation (2 min)

**Navigate**: `/dashboard/company/members` → "Bekleyen Davetler" tab

1. **Find** pending invitation
2. **Click** 3-dot menu
3. **Click** "Daveti İptal Et"
4. **Confirm** cancellation
5. **Verify** invitation removed from list

**DB Check**:
```sql
SELECT * FROM company_invitations WHERE id = 'INVITATION_ID';
-- Should return 0 rows
```

**Expected**: ✅ Invitation deleted

---

## 🧪 Test 8: Reject Invitation (2 min)

**Create** new invitation, get token

**Navigate**: `http://localhost:3000/accept-invitation/{TOKEN}`

1. **Click** "Daveti Reddet" button
2. **Confirm** rejection
3. **Verify** redirect to home page
4. **Verify** message shown

**DB Check**:
```sql
SELECT status FROM company_invitations WHERE token = 'TOKEN';
-- Should return 'rejected'
```

**Expected**: ✅ Invitation rejected, ✅ Cannot accept again

---

## 🧪 Test 9: Permission Check - User Role (3 min)

**Create** user with "user" role (not admin)

**Login** with that user

1. **Navigate** to `/dashboard`
2. **Verify** redirected to `/unauthorized`
3. **Verify** message: "Yetkisiz Erişim"
4. **Verify** logout button present

**Expected**: ✅ Dashboard blocked for regular users

---

## 🧪 Test 10: Expired Invitation (2 min)

**Manually expire** invitation:
```sql
UPDATE company_invitations 
SET expires_at = DATE_SUB(NOW(), INTERVAL 1 DAY)
WHERE token = 'TOKEN';
```

**Navigate**: `http://localhost:3000/accept-invitation/{TOKEN}`

**Expected**: 
- ✅ Redirect to dashboard
- ✅ Error message: "Süresi dolmuş davet"

---

## 🎯 Quick Smoke Test (All in 15 min)

If time is limited, run these critical paths:

1. ✅ Create company (Test 1)
2. ✅ Send invitation (Test 2)
3. ✅ Accept invitation (Test 4)
4. ✅ View members list
5. ✅ Switch companies

**If all pass**: System is functional! 🎉

---

## 🐛 Common Issues & Fixes

### Issue: "Oturum bulunamadı"
**Fix**: Check JWT token in cookies, re-login

### Issue: "Aktif şirket bulunamadı"
**Fix**: Create a company or switch to existing one

### Issue: Email not sending
**Fix**: Normal in development - check console logs

### Issue: Cannot remove member
**Fix**: Ensure you're admin/owner, cannot remove owner

### Issue: Invitation link broken
**Fix**: Check token is valid, not expired

---

## 📊 Success Metrics

After completing all tests:

- ✅ 0 Critical bugs
- ✅ All CRUD operations work
- ✅ Permissions enforced
- ✅ Multi-tenancy working
- ✅ Email flow complete
- ✅ UI responsive and intuitive

**Ready for production?** Consider:
- [ ] Real SMTP configuration
- [ ] Rate limiting
- [ ] Error monitoring (Sentry)
- [ ] Load testing
- [ ] Security audit
