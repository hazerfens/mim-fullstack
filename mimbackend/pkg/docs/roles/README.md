# MimReklam Backend

MimReklam projesinin backend uygulaması. Go, Gin, GORM, MySQL ve Casbin tabanlı rol tabanlı yetkilendirme sistemi.

## Özellikler

- JWT tabanlı kimlik doğrulama
- Casbin tabanlı rol tabanlı yetkilendirme (RBAC/ABAC)
- MySQL veritabanı
- RESTful API
- Email doğrulama ve şifre sıfırlama
- OAuth entegrasyonu (Google, Facebook, Twitter)

## Gereksinimler

- Go 1.19+
- MySQL 8.0+
- Git

## Kurulum

### 1. Projeyi Klonlayın

```bash
git clone <repository-url>
cd mimreklam/mimbackend
```

### 2. Bağımlılıkları Yükleyin

```bash
go mod download
```

### 3. Veritabanını Hazırlayın

MySQL'de `mimreklam2` veritabanını oluşturun:

```sql
CREATE DATABASE mimreklam2 CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 4. Environment Dosyasını Yapılandırın

`.env` dosyasını oluşturun:

```env
ENV=development
FRONTEND_URL=http://localhost:3000
BASE_URL=http://localhost:3333
PORT=3333
API_PREFIX=/api/v1

DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=root
DB_NAME=mimreklam2

# OAuth Configuration
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

FACEBOOK_CLIENT_ID=your_facebook_client_id
FACEBOOK_CLIENT_SECRET=your_facebook_client_secret

TWITTER_CLIENT_ID=your_twitter_client_id
TWITTER_CLIENT_SECRET=your_twitter_client_secret

# SMTP Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your_email@gmail.com
SMTP_PASSWORD=your_app_password
SMTP_FROM_EMAIL=noreply@mimreklam.com
SMTP_FROM_NAME=MimReklam
```

### 5. Uygulamayı Başlatın

```bash
go run ./cmd/server
```

Migration'lar otomatik olarak çalışacak ve default roller oluşturulacak.

## Admin Kullanıcısı Oluşturma

Sistem ilk kez çalıştırıldığında otomatik olarak bir admin kullanıcısı oluşturulur:

- **Email:** admin@mimreklam.com
- **Şifre:** admin123

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

## API Kullanımı

### Kimlik Doğrulama

#### Kayıt
```bash
POST /api/v1/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123",
  "full_name": "John Doe"
}
```

#### Giriş
```bash
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

### Role Yönetimi (Admin Gerektirir)

#### Tüm Roller
```bash
GET /api/v1/roles
Authorization: Bearer <jwt_token>
```

#### Kullanıcıya Role Ata
```bash
POST /api/v1/roles/assign
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "user_id": "user-uuid",
  "role_id": "role-uuid"
}
```

## Roller ve Yetkiler

### Sistem Roller

- **super_admin**: Tüm sistem yetkileri
- **admin**: Kullanıcı ve şirket yönetimi
- **user**: Temel kullanıcı erişimi

### Şirket Roller

- **company_owner**: Şirket sahibi - tüm yetkiler
- **company_admin**: Şirket yöneticisi
- **company_manager**: Şirket müdürü
- **company_employee**: Şirket çalışanı

## Geliştirme

### Kod Çalıştırma

```bash
go run ./cmd/server
```

### Test Çalıştırma

```bash
go test ./...
```

### Migration Çalıştırma

```bash
go run ./cmd/server  # Otomatik çalışır
```

## Proje Yapısı

```
mimbackend/
├── cmd/server/          # Ana uygulama
├── internal/
│   ├── handlers/        # HTTP handlers
│   ├── models/          # Veritabanı modelleri
│   ├── routes/          # Route tanımları
│   ├── services/        # İş mantığı
│   └── middleware/      # Middleware'ler
├── config/              # Yapılandırma
├── app/                 # Uygulama başlatma
└── migrations/          # Veritabanı migration'ları
```

## Katkıda Bulunma

1. Fork edin
2. Feature branch oluşturun (`git checkout -b feature/amazing-feature`)
3. Commit edin (`git commit -m 'Add amazing feature'`)
4. Push edin (`git push origin feature/amazing-feature`)
5. Pull Request oluşturun

## Lisans

Bu proje MIT lisansı altında lisanslanmıştır.