# Soft Delete & Company Owner Role Implementation

## 📋 Genel Bakış

Bu dokümantasyon, sistemdeki **Soft Delete Logging** ve **Company Owner Role** özelliklerini açıklar.

## 🎯 Özellikler

### 1. Company Owner Role

#### Ne Değişti?
- Yeni `company_owner` rolü eklendi
- Company oluşturan kullanıcı otomatik olarak `company_owner` rolü ile üye oluyor
- `company_owner` rolü tam yetkiye sahip (super admin gibi ama company-specific)

#### Migration
```go
// app/migrations/company_owner_role_migration.go
func CreateCompanyOwnerRole(db *gorm.DB) error
```

**Çalıştırma:**
```bash
# Migration otomatik çalışır, manuel trigger gerekmez
go run ./cmd/server
```

#### Company Creation Flow
```
User Creates Company
    ↓
1. Company kaydı oluşturulur
    ↓
2. company_owner rolü bulunur (yoksa admin, yoksa super_admin)
    ↓
3. CompanyMember kaydı oluşturulur:
   - UserID: Oluşturan kullanıcı
   - CompanyID: Yeni company
   - RoleID: company_owner role ID
   - IsOwner: true
   - IsActive: true
    ↓
4. User'ın active_company_id'si set edilir
```

#### Code Locations
- **Migration**: `app/migrations/company_owner_role_migration.go`
- **Service**: `internal/services/company.go` → `CreateCompany()`
- **Handler**: `internal/handlers/company.go` → `CreateCompanyHandler()`

---

### 2. Soft Delete with Logging

#### Ne Değişti?
Tüm silme işlemleri artık:
- Kaydı veritabanından tamamen silmiyor (soft delete)
- `deleted_at` alanına timestamp yazıyor
- `deleted_by` alanına silen kullanıcının ID'sini yazıyor
- İşlemi loglara yazıyor

#### Affected Models
Tüm modellerde `BaseModel` kullanıldığı için otomatik destekleniyor:
```go
type BaseModel struct {
    ID        uuid.UUID      `gorm:"type:varchar(36);primaryKey;not null" json:"id"`
    CreatedAt time.Time      `gorm:"autoCreateTime" json:"created_at"`
    UpdatedAt time.Time      `gorm:"autoUpdateTime" json:"updated_at"`
    DeletedAt gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`
    DeletedBy *uuid.UUID     `gorm:"type:varchar(36);index" json:"deleted_by,omitempty"`
}
```

#### Implemented Operations

##### 1. **Company Deletion**
```go
// internal/services/company.go
func DeleteCompany(id uuid.UUID, deletedBy uuid.UUID) error {
    updates := map[string]interface{}{
        "is_active":  false,
        "deleted_at": time.Now(),
        "deleted_by": deletedBy,
    }
    // ... update işlemi
    log.Printf("✅ Company deleted: company_id=%s, deleted_by=%s", id, deletedBy)
}
```

**API Endpoint:**
```http
DELETE /api/v1/company/:id
Authorization: Bearer <token>
```

**Handler Update:**
```go
// internal/handlers/company.go
func DeleteCompanyHandler(c *gin.Context) {
    // ...
    if err := services.DeleteCompany(companyID, userID); err != nil {
        // error handling
    }
}
```

##### 2. **Member Removal**
```go
// internal/services/member.go
func RemoveCompanyMember(companyID, memberID, requestUserID uuid.UUID) error {
    now := time.Now()
    if err := db.Model(&member).Updates(map[string]interface{}{
        "deleted_at": now,
        "deleted_by": requestUserID,
    }).Error; err != nil {
        return fmt.Errorf("failed to remove member: %w", err)
    }
    
    log.Printf("✅ Member removed: member_id=%s, company_id=%s, removed_by=%s", 
        memberID, companyID, requestUserID)
}
```

**API Endpoint:**
```http
DELETE /api/v1/company/:id/members/:memberId
Authorization: Bearer <token>
```

##### 3. **Invitation Cancellation**
```go
// internal/services/member.go
func CancelInvitation(companyID, invitationID, requestUserID uuid.UUID) error {
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
}
```

**API Endpoint:**
```http
DELETE /api/v1/company/:id/invitations/:invitationId
Authorization: Bearer <token>
```

**New Invitation Status:**
```go
const (
    InvitationPending   InvitationStatus = "pending"
    InvitationAccepted  InvitationStatus = "accepted"
    InvitationRejected  InvitationStatus = "rejected"
    InvitationExpired   InvitationStatus = "expired"
    InvitationCancelled InvitationStatus = "cancelled" // ✨ NEW
)
```

---

## 🔒 Permission System

### super_admin Special Permissions

`super_admin` rolüne sahip kullanıcılar **company member olmasa bile**:
- ✅ Herhangi bir company'ye davet gönderebilir
- ✅ Herhangi bir company'nin üyelerini çıkarabilir
- ✅ Herhangi bir company'nin davetlerini iptal edebilir

#### Implementation
```go
// internal/services/invitation.go
func CreateCompanyInvitation(...) {
    var user authmodels.User
    db.Where("id = ?", invitedBy).First(&user)
    
    isSuperAdmin := user.Role == "super_admin"
    
    if !isSuperAdmin {
        // Check company membership
        var membership companymodels.CompanyMember
        if err := db.Where("company_id = ? AND user_id = ? AND is_active = ?",
            companyID, invitedBy, true).First(&membership).Error; err != nil {
            return nil, errors.New("only company members can invite others")
        }
    }
}
```

### Company Owner vs Admin vs Manager

| Permission | super_admin | company_owner | admin | manager | user |
|------------|-------------|---------------|-------|---------|------|
| Davet gönder | ✅ (tüm companies) | ✅ | ✅ | ❌ | ❌ |
| Üye çıkar | ✅ (tüm companies) | ✅ | ✅ | ❌ | ❌ |
| Davet iptal et | ✅ (tüm companies) | ✅ | ✅ | ❌ | ❌ |
| Company sil | ✅ | ✅ | ❌ | ❌ | ❌ |
| Company düzenle | ✅ | ✅ | ✅ | ❌ | ❌ |

---

## 📊 Audit & Monitoring

### Log Formats

Tüm silme işlemleri aşağıdaki formatta loglanır:

```
✅ Company deleted: company_id=<uuid>, deleted_by=<uuid>
✅ Member removed: member_id=<uuid>, company_id=<uuid>, removed_by=<uuid>
✅ Invitation cancelled: invitation_id=<uuid>, company_id=<uuid>, cancelled_by=<uuid>
```

### Database Queries

**Son silme işlemlerini görüntüle:**
```sql
SELECT 
    'company' as entity_type,
    c.id as entity_id,
    c.adi as entity_name,
    c.deleted_at,
    u.email as deleted_by
FROM companies c
LEFT JOIN users u ON c.deleted_by = u.id
WHERE c.deleted_at IS NOT NULL
ORDER BY c.deleted_at DESC;
```

**Tüm soft deleted kayıtlar (audit log):**
```bash
# test-soft-delete.sql dosyasında #8 numaralı sorguyu kullanın
```

---

## 🧪 Testing

### Test Scenarios

#### 1. Company Owner Role
```bash
# 1. Yeni bir company oluştur
POST /api/v1/company
{
  "name": "Test Company",
  "slug": "test-company"
}

# 2. Company members listesini kontrol et
GET /api/v1/company/:id/members

# Beklenen sonuç:
# - Oluşturan kullanıcı listede görünmeli
# - is_owner: true
# - role_name: "company_owner"
```

#### 2. Soft Delete - Company
```bash
# 1. Company sil
DELETE /api/v1/company/:id

# 2. Database'de kontrol et
SELECT * FROM companies WHERE id = ':id';
# Beklenen:
# - deleted_at: NOT NULL
# - deleted_by: <user_id>
# - is_active: false
```

#### 3. Soft Delete - Member
```bash
# 1. Üyeyi çıkar
DELETE /api/v1/company/:id/members/:memberId

# 2. Database'de kontrol et
SELECT * FROM company_members WHERE id = ':memberId';
# Beklenen:
# - deleted_at: NOT NULL
# - deleted_by: <user_id>
```

#### 4. Soft Delete - Invitation
```bash
# 1. Daveti iptal et
DELETE /api/v1/company/:id/invitations/:invitationId

# 2. Database'de kontrol et
SELECT * FROM company_invitations WHERE id = ':invitationId';
# Beklenen:
# - deleted_at: NOT NULL
# - deleted_by: <user_id>
# - status: "cancelled"
```

#### 5. super_admin Permissions
```bash
# super_admin kullanıcısıyla giriş yap
# Member olmadığı bir company'ye davet göndermeyi dene
POST /api/v1/company/:id/invitations
{
  "email": "test@example.com",
  "role_name": "manager"
}

# Beklenen: ✅ Başarılı (member olmasa bile izin verilmeli)
```

---

## 🔧 Maintenance

### Soft Deleted Kayıtları Temizleme

**30 gün öncesindeki soft deleted kayıtları kalıcı olarak sil:**
```sql
DELETE FROM companies 
WHERE deleted_at < DATE_SUB(NOW(), INTERVAL 30 DAY);

DELETE FROM company_members 
WHERE deleted_at < DATE_SUB(NOW(), INTERVAL 30 DAY);

DELETE FROM company_invitations 
WHERE deleted_at < DATE_SUB(NOW(), INTERVAL 30 DAY);
```

**Cron Job Önerisi:**
```bash
# Her ay 1'inde saat 03:00'te çalışsın
0 3 1 * * /path/to/cleanup-soft-deleted.sh
```

---

## 📝 Migration Checklist

- [x] `company_owner` role migration oluşturuldu
- [x] `CreateCompany` servisi güncellendi (company_owner rolü kullanıyor)
- [x] `DeleteCompany` servisi soft delete + logging eklemeleri yapıldı
- [x] `RemoveCompanyMember` servisi soft delete + logging eklemeleri yapıldı
- [x] `CancelInvitation` servisi soft delete + logging eklemeleri yapıldı
- [x] `super_admin` permission checks eklendi (invitation, member, invitation cancel)
- [x] `InvitationCancelled` status eklendi
- [x] `DeleteCompanyHandler` güncellendi (deletedBy parametresi)
- [x] Import'lar eklendi (`log`, `time`)
- [x] Test SQL script'i oluşturuldu

---

## 🚀 Deployment

1. **Backend'i güncelleyin:**
```bash
cd mimbackend
go mod tidy
go run ./cmd/server
```

2. **Migration otomatik çalışacak:**
```
Creating company_owner role...
company_owner role created successfully!
```

3. **Loglarda kontrol edin:**
```bash
tail -f logs/app.log | grep "company_owner\|deleted\|removed\|cancelled"
```

4. **Test edin:**
```bash
# Test SQL script'ini çalıştırın
mysql -u root -p your_database < test-soft-delete.sql
```

---

## 💡 Best Practices

1. **Soft Delete Kullanımı:**
   - Kritik veriler için soft delete kullanın
   - `deleted_by` alanını her zaman doldurun
   - Log mesajlarını açık ve tutarlı tutun

2. **Audit Trail:**
   - Tüm silme işlemlerini loglayın
   - Database'de `deleted_at` ve `deleted_by` alanlarını indeksleyin
   - Periyodik olarak audit log'ları inceleyin

3. **Permission Checks:**
   - Her operasyonda authorization kontrol edin
   - `super_admin` exception'larını açık bir şekilde dokümante edin
   - Company membership kontrollerini önce yapın

4. **Database Maintenance:**
   - Eski soft deleted kayıtları periyodik olarak temizleyin
   - Backup almadan önce soft deleted kayıtları arşivleyin
   - Önemli veriler için GDPR compliance kontrol edin

---

## 🐛 Troubleshooting

### "only company members can invite others" hatası
**Sorun:** super_admin kullanıcısı davet gönderemiyor
**Çözüm:** Backend'i yeniden başlatın, user.Role field'ının "super_admin" olduğunu kontrol edin

### "company_owner role not found" hatası
**Sorun:** Migration çalışmamış
**Çözüm:** 
```bash
go run ./cmd/server  # Migration otomatik çalışır
# veya manuel SQL:
INSERT INTO roles (id, name, description, company_id, created_at, updated_at)
VALUES (UUID(), 'company_owner', 'Company owner with full permissions', NULL, NOW(), NOW());
```

### deleted_by alanı NULL
**Sorun:** Eski kod hala kullanılıyor
**Çözüm:** Backend'i güncelleyin ve yeniden deploy edin

---

## 📚 Related Documentation

- [TESTING.md](./TESTING.md) - Comprehensive testing guide
- [QUICK_TEST.md](./QUICK_TEST.md) - Quick smoke test checklist
- [SUMMARY.md](./SUMMARY.md) - Complete project summary
- [test-soft-delete.sql](./test-soft-delete.sql) - SQL testing queries

---

**Son Güncelleme:** October 2, 2025
**Versiyon:** 1.0.0
