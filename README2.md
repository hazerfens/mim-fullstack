# MimReklam Role & Permission Sistemi# MimReklam Backend

MimReklam projesinin rol tabanlı yetkilendirme sistemi. Casbin tabanlı ABAC (Attribute-Based Access Control) implementasyonu ile gelişmiş yetkilendirme sağlar.MimReklam projesinin backend uygulaması. Go, Gin, GORM, MySQL ve Casbin tabanlı rol tabanlı yetkilendirme sistemi.

## 🚀 Özellikler## Özellikler

- **ABAC Yetkilendirme**: Casbin v2 ile attribute tabanlı erişim kontrolü- JWT tabanlı kimlik doğrulama

- **Veritabanı Tabanlı Roller**: MySQL'de saklanan dinamik roller- Casbin tabanlı rol tabanlı yetkilendirme (RBAC/ABAC)

- **JSON Yetkiler**: Structured permission'lar ile detaylı kontrol- MySQL veritabanı

- **JWT Entegrasyonu**: Güvenli API erişimi- RESTful API

- **Middleware Desteği**: Otomatik yetkilendirme kontrolü- Email doğrulama ve şifre sıfırlama

- OAuth entegrasyonu (Google, Facebook, Twitter)

## 📋 Sistem Mimarisi

## Gereksinimler

### ABAC Model Yapısı

- Go 1.19+

Casbin model dosyası (`config/casbin_model.conf`):- MySQL 8.0+

- Git

````

[request_definition]## Kurulum

r = sub, obj, act

### 1. Projeyi Klonlayın

[policy_definition]

p = sub, obj, act, eft```bash

git clone <repository-url>

[role_definition]cd mimreklam/mimbackend

g = _, _```



[policy_effect]### 2. Bağımlılıkları Yükleyin

e = some(where (p.eft == allow))

```bash

[matchers]go mod download

m = g(r.sub, p.sub) && r.obj == p.obj && r.act == p.act```

````

### 3. Veritabanını Hazırlayın

### Yetkilendirme Akışı

MySQL'de `mimreklam2` veritabanını oluşturun:

1. **Request**: `user_role, resource, action`

2. **Policy Check**: Casbin model ile yetkilendirme kontrolü```sql

3. **Role Mapping**: User role → Casbin policyCREATE DATABASE mimreklam2 CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

4. **Decision**: Allow/Deny```

## 🎯 Roller ve Yetkiler### 4. Environment Dosyasını Yapılandırın

### Sistem Roller`.env` dosyasını oluşturun:

| Role | Açıklama | Yetkiler |```env

|------|----------|----------|ENV=development

| `super_admin` | Sistem süper yöneticisi | Tüm sistem yetkileri |FRONTEND_URL=http://localhost:3000

| `admin` | Sistem yöneticisi | Kullanıcı ve şirket yönetimi |BASE_URL=http://localhost:3333

| `user` | Normal kullanıcı | Temel erişim |PORT=3333

API_PREFIX=/api/v1

### Şirket Roller

DB_HOST=localhost

| Role | Açıklama | Yetkiler |DB_PORT=3306

|------|----------|----------|DB_USER=root

| `company_owner` | Şirket sahibi | Şirketinde tüm yetkiler |DB_PASSWORD=root

| `company_admin` | Şirket yöneticisi | Çoğu şirket yetkisi |DB_NAME=mimreklam2

| `company_manager` | Şirket müdürü | Departman yönetimi |

| `company_employee` | Şirket çalışanı | Temel şirket erişimi |# OAuth Configuration

GOOGLE_CLIENT_ID=your_google_client_id

### Permission YapısıGOOGLE_CLIENT_SECRET=your_google_client_secret

Her rol için JSON formatında detaylı yetkiler:FACEBOOK_CLIENT_ID=your_facebook_client_id

FACEBOOK_CLIENT_SECRET=your_facebook_client_secret

````json

{TWITTER_CLIENT_ID=your_twitter_client_id

  "users": {TWITTER_CLIENT_SECRET=your_twitter_client_secret

    "create": true,

    "read": true,# SMTP Configuration

    "update": true,SMTP_HOST=smtp.gmail.com

    "delete": falseSMTP_PORT=587

  },SMTP_USERNAME=your_email@gmail.com

  "companies": {SMTP_PASSWORD=your_app_password

    "create": true,SMTP_FROM_EMAIL=noreply@mimreklam.com

    "read": true,SMTP_FROM_NAME=MimReklam

    "update": true,```

    "delete": true

  },### 5. Uygulamayı Başlatın

  "roles": {

    "create": true,```bash

    "read": true,go run ./cmd/server

    "update": true,```

    "delete": true

  }Migration'lar otomatik olarak çalışacak ve default roller oluşturulacak.

}

```## Admin Kullanıcısı Oluşturma



## 🔐 ABAC ÖrnekleriSistem ilk kez çalıştırıldığında otomatik olarak bir admin kullanıcısı oluşturulur:



### 1. Temel Role Yetkilendirmesi- **Email:** admin@mimreklam.com

- **Şifre:** admin123

```go

// Kullanıcı listesi görüntüleme### Manuel Admin Oluşturma

user := User{Role: "admin"}

resource := "users"Eğer mevcut bir kullanıcıyı admin yapmak istiyorsanız:

action := "read"

1. Super admin role ID'sini bulun:

// Casbin kontrolü```sql

enforcer.Enforce(user.Role, resource, action) // trueSELECT id, name FROM roles WHERE name = 'super_admin';

````

### 2. Attribute Tabanlı Yetkilendirme2. Kullanıcıyı super admin yapın:

````sql

```goUPDATE users

// Şirket sahibi kendi şirketini düzenleyebilirSET role_id = 'super_admin_role_id',

user := User{Role: "company_owner", CompanyID: "123"}    role = 'super_admin'

resource := "company"WHERE id = 'user_id';

action := "update"```

companyID := "123"

Örnek:

// Özel matcher ile kontrol```sql

enforcer.Enforce(user.Role, resource, action, user.CompanyID, companyID)UPDATE users

```SET role_id = '98ddff71-5449-4e32-b371-7e20b6c57dfb',

    role = 'super_admin'

### 3. Middleware KullanımıWHERE id = 'c2f29d1c-bea8-4422-88c3-bb2efbcd1be7';

````

````go

// API endpoint koruması## API Kullanımı

func AdminMiddleware() gin.HandlerFunc {

    return func(c *gin.Context) {### Kimlik Doğrulama

        userRole := c.GetString("user_role")

        resource := c.Request.URL.Path#### Kayıt

        action := c.Request.Method```bash

POST /api/v1/auth/register

        if !enforcer.Enforce(userRole, resource, action) {Content-Type: application/json

            c.AbortWithStatusJSON(403, gin.H{"error": "Access denied"})

            return{

        }  "email": "user@example.com",

        c.Next()  "password": "password123",

    }  "full_name": "John Doe"

}}

````

## 🛠 Kurulum ve Yapılandırma#### Giriş

````bash

### 1. Veritabanı HazırlığıPOST /api/v1/auth/login

Content-Type: application/json

```sql

-- Veritabanı oluşturma{

CREATE DATABASE mimreklam2 CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;  "email": "user@example.com",

  "password": "password123"

-- Migration çalıştırma (otomatik)}

go run ./cmd/server```

````

### Role Yönetimi (Admin Gerektirir)

### 2. Default Roller

#### Tüm Roller

Sistem aşağıdaki rolleri otomatik oluşturur:```bash

GET /api/v1/roles

```````sqlAuthorization: Bearer <jwt_token>

-- Sistem roller```

INSERT INTO roles (name, permissions) VALUES

('super_admin', '{"users":{"create":true,"read":true,"update":true,"delete":true},"companies":{"create":true,"read":true,"update":true,"delete":true},"roles":{"create":true,"read":true,"update":true,"delete":true}}'),#### Kullanıcıya Role Ata

('admin', '{"users":{"create":true,"read":true,"update":true,"delete":true},"companies":{"create":true,"read":true,"update":true,"delete":true}}'),```bash

('user', '{"users":{"read":true},"companies":{"read":true}}');POST /api/v1/roles/assign

Authorization: Bearer <jwt_token>

-- Şirket rollerContent-Type: application/json

INSERT INTO roles (name, permissions) VALUES

('company_owner', '{"branches":{"create":true,"read":true,"update":true,"delete":true},"departments":{"create":true,"read":true,"update":true,"delete":true},"users":{"create":true,"read":true,"update":true,"delete":true}}'),{

('company_admin', '{"branches":{"create":true,"read":true,"update":true,"delete":false},"departments":{"create":true,"read":true,"update":true,"delete":false},"users":{"create":true,"read":true,"update":true,"delete":false}}');  "user_id": "user-uuid",

```  "role_id": "role-uuid"

}

### 3. Admin Kullanıcısı```



İlk çalıştırmada otomatik admin oluşturulur:## Roller ve Yetkiler



```sql### Sistem Roller

-- Default admin

INSERT INTO users (email, password_hash, role, role_id, is_verified)- **super_admin**: Tüm sistem yetkileri

VALUES ('admin@mimreklam.com', '$2a$...', 'super_admin', 'super_admin_uuid', true);- **admin**: Kullanıcı ve şirket yönetimi

```- **user**: Temel kullanıcı erişimi



## 📡 API Kullanımı### Şirket Roller



### Kimlik Doğrulama- **company_owner**: Şirket sahibi - tüm yetkiler

- **company_admin**: Şirket yöneticisi

```bash- **company_manager**: Şirket müdürü

# Giriş- **company_employee**: Şirket çalışanı

POST /api/v1/auth/login

{## Geliştirme

  "email": "admin@mimreklam.com",

  "password": "admin123"### Kod Çalıştırma

}

``````bash

go run ./cmd/server

### Role Yönetimi```



```bash### Test Çalıştırma

# Tüm roller

GET /api/v1/roles```bash

Authorization: Bearer <jwt_token>go test ./...

```````

# Role oluşturma

POST /api/v1/roles### Migration Çalıştırma

{

"name": "custom_role",```bash

"description": "Özel rol",go run ./cmd/server # Otomatik çalışır

"permissions": {```

    "users": {"read": true, "update": false},

    "reports": {"create": true, "read": true}## Proje Yapısı

}

}```

mimbackend/

# Kullanıcıya role atama├── cmd/server/ # Ana uygulama

POST /api/v1/roles/assign├── internal/

{│ ├── handlers/ # HTTP handlers

"user_id": "user-uuid",│ ├── models/ # Veritabanı modelleri

"role_id": "role-uuid"│ ├── routes/ # Route tanımları

}│ ├── services/ # İş mantığı

````│ └── middleware/      # Middleware'ler

├── config/              # Yapılandırma

## 🔍 Yetkilendirme Senaryoları├── app/                 # Uygulama başlatma

└── migrations/          # Veritabanı migration'ları

### Senaryo 1: Admin Kullanıcı Yönetimi```



```go## Katkıda Bulunma

// Admin tüm kullanıcıları görebilir

enforcer.AddPolicy("admin", "users", "read")     // ✅ Allow1. Fork edin

enforcer.AddPolicy("admin", "users", "create")   // ✅ Allow2. Feature branch oluşturun (`git checkout -b feature/amazing-feature`)

enforcer.AddPolicy("admin", "users", "delete")   // ❌ Deny3. Commit edin (`git commit -m 'Add amazing feature'`)

4. Push edin (`git push origin feature/amazing-feature`)

// Kontrol5. Pull Request oluşturun

allowed := enforcer.Enforce("admin", "users", "read") // true

```## Lisans



### Senaryo 2: Şirket Sahibi KısıtlamasıBu proje MIT lisansı altında lisanslanmıştır.

```go
// Şirket sahibi sadece kendi şirketini yönetebilir
func CheckCompanyOwnership(userID, companyID string) bool {
    // Veritabanından kullanıcının şirketini kontrol et
    userCompany := getUserCompany(userID)
    return userCompany == companyID
}

// Middleware'de kullanım
if user.Role == "company_owner" && !CheckCompanyOwnership(user.ID, requestedCompanyID) {
    return errors.New("Access denied: Not company owner")
}
````

### Senaryo 3: Departman Yetkilendirmesi

```go
// Manager sadece kendi departmanını yönetebilir
func DepartmentAccessControl(userID, departmentID string) error {
    userDept := getUserDepartment(userID)
    if userDept != departmentID && !isAdmin(userID) {
        return errors.New("Access denied: Department restriction")
    }
    return nil
}
```

## 🧪 Test Örnekleri

### Unit Test

```go
func TestRoleEnforcement(t *testing.T) {
    enforcer := casbin.NewEnforcer("config/casbin_model.conf")

    // Policy ekleme
    enforcer.AddPolicy("admin", "users", "read")

    // Test
    assert.True(t, enforcer.Enforce("admin", "users", "read"))
    assert.False(t, enforcer.Enforce("user", "users", "delete"))
}
```

### Integration Test

```go
func TestUserRoleAssignment(t *testing.T) {
    // User oluştur
    user := createTestUser("test@example.com", "user")

    // Role ata
    assignRole(user.ID, "admin")

    // Kontrol et
    updatedUser := getUserByID(user.ID)
    assert.Equal(t, "admin", updatedUser.Role)

    // Yetkilendirme kontrolü
    assert.True(t, enforcer.Enforce("admin", "users", "read"))
}
```

## 📊 Veritabanı Şeması

### Roles Tablosu

```sql
CREATE TABLE roles (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    permissions JSON,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### Users Tablosu

```sql
CREATE TABLE users (
    id VARCHAR(36) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'user',
    role_id VARCHAR(36),
    is_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (role_id) REFERENCES roles(id)
);
```

## 🔧 Gelişmiş Konfigürasyon

### Casbin Model Genişletme

```conf
[request_definition]
r = sub, obj, act, env

[policy_definition]
p = sub, obj, act, env, eft

[matchers]
m = g(r.sub, p.sub) && r.obj == p.obj && r.act == p.act && r.env == p.env
```

### Özel Yetkilendirme Fonksiyonları

```go
// Zaman tabanlı yetkilendirme
func TimeBasedAccess(userID string, resource string) bool {
    now := time.Now()
    businessHours := now.Hour() >= 9 && now.Hour() <= 17

    if !businessHours && !isAdmin(userID) {
        return false
    }
    return true
}

// IP tabanlı kısıtlama
func IPBasedAccess(clientIP string, allowedIPs []string) bool {
    for _, ip := range allowedIPs {
        if clientIP == ip {
            return true
        }
    }
    return false
}
```

### Manuel Admin Oluşturma

Eğer mevcut bir kullanıcıyı admin yapmak istiyorsanız:

1. Super admin role ID'sini bulun:

```sql
SELECT id, name FROM roles WHERE name = 'super_admin';
```

2. Kullanıcıyı super admin yapın:

```sql
UPDATE users
SET role_id = 'super_admin_role_id',
    role = 'super_admin'
WHERE id = 'user_id';
```

Örnek:

```sql
UPDATE users
SET role_id = '98ddff71-5449-4e32-b371-7e20b6c57dfb',
    role = 'super_admin'
WHERE id = 'c2f29d1c-bea8-4422-88c3-bb2efbcd1be7';
```

## 📚 Referanslar

- [Casbin Documentation](https://casbin.org/docs/)
- [ABAC Overview](https://en.wikipedia.org/wiki/Attribute-based_access_control)
- [Gin Framework](https://gin-gonic.com/)

## 🤝 Katkıda Bulunma

Role ve permission sistemi ile ilgili geliştirmeler için:

1. Issue açın
2. Feature branch oluşturun
3. Test yazın
4. Pull request gönderin

## 📄 Lisans

MIT License
