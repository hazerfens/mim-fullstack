# MimReklam Auth System

## 📋 Genel Bakış

MimReklam Auth sistemi, kullanıcı kimlik doğrulama ve yetkilendirme işlemlerini yöneten kapsamlı bir modüler sistemdir. JWT tabanlı token yönetimi, email doğrulama, şifre sıfırlama ve OAuth entegrasyonu gibi özellikleri içerir.

## ✨ Özellikler

### 🔐 Temel Kimlik Doğrulama
- **Kullanıcı Kaydı**: Email ve şifre ile yeni kullanıcı hesabı oluşturma
- **Giriş Yapma**: JWT token tabanlı güvenli giriş
- **Token Yenileme**: Access token'ları güvenli bir şekilde yenileme
- **Çıkış Yapma**: Güvenli oturum sonlandırma

### 📧 Email Doğrulama Sistemi
- **Doğrulama Kodu Gönderme**: 6 haneli rastgele kod ile email doğrulama
- **Email Doğrulama**: Gönderilen kod ile hesap doğrulama
- **Kod Yeniden Gönderme**: Süresi dolmuş kodlar için yeniden gönderme

### 🔑 Şifre Yönetimi
- **Şifre Sıfırlama**: Email üzerinden şifre sıfırlama bağlantısı gönderme
- **Şifre Güncelleme**: Güvenli token tabanlı şifre güncelleme
- **Şifre Hashleme**: bcrypt ile güvenli şifre hashleme

### 🌐 OAuth Entegrasyonu
- **Google OAuth**: Google hesapları ile giriş
- **Facebook OAuth**: Facebook hesapları ile giriş
- **GitHub OAuth**: GitHub hesapları ile giriş
- **OAuth Callback**: OAuth sağlayıcılarından gelen callback yönetimi

### 🛡️ Güvenlik Özellikleri
- **JWT Token**: Güvenli token tabanlı kimlik doğrulama
- **Şifre Hashleme**: bcrypt algoritması ile şifre güvenliği
- **Token Expiration**: Otomatik token süresi dolma
- **Rate Limiting**: API çağrılarını sınırlama
- **CORS Protection**: Cross-Origin Resource Sharing koruması

## 🚀 Kurulum ve Yapılandırma

### Gereksinimler
- Go 1.24+
- PostgreSQL
- SMTP sunucusu (email gönderme için)

### Environment Variables

```bash
# Database
DATABASE_URL=postgres://user:password@localhost:5432/MimReklam?sslmode=disable

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# SMTP Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-app-password

# Server
PORT=3333
API_PREFIX=/api/v1
BASE_URL=http://localhost:3333

# OAuth (Optional)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
FACEBOOK_CLIENT_ID=your-facebook-client-id
FACEBOOK_CLIENT_SECRET=your-facebook-client-secret
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
```

### Veritabanı Migrasyonları

```bash
# Migration'ları çalıştır
go run migrations/migrate.go
```

## 📡 API Endpoints

### Temel Kimlik Doğrulama

#### Kullanıcı Kaydı
```http
POST /api/v1/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securepassword123"
}
```

**Response (201):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "full_name": null,
    "role": "user"
  }
}
```

#### Giriş Yapma
```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securepassword123"
}
```

#### Token Yenileme
```http
POST /api/v1/auth/refresh
Content-Type: application/json

{
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### Çıkış Yapma
```http
POST /api/v1/auth/logout
Content-Type: application/json

{
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### Email Doğrulama

#### Doğrulama Kodu Gönderme
```http
POST /api/v1/auth/send-verification
Content-Type: application/json

{
  "email": "user@example.com"
}
```

#### Email Doğrulama
```http
POST /api/v1/auth/verify-email
Content-Type: application/json

{
  "email": "user@example.com",
  "code": "123456"
}
```

#### Kod Yeniden Gönderme
```http
POST /api/v1/auth/resend-verification
Content-Type: application/json

{
  "email": "user@example.com"
}
```

### Şifre Yönetimi

#### Şifre Sıfırlama Email'i
```http
POST /api/v1/auth/forgot-password
Content-Type: application/json

{
  "email": "user@example.com"
}
```

#### Şifre Sıfırlama
```http
POST /api/v1/auth/reset-password
Content-Type: application/json

{
  "token": "reset-token-here",
  "password": "newsecurepassword123"
}
```

### OAuth Entegrasyonu

#### Google OAuth Başlatma
```http
GET /api/v1/auth/google
```

#### Facebook OAuth Başlatma
```http
GET /api/v1/auth/facebook
```

#### GitHub OAuth Başlatma
```http
GET /api/v1/auth/github
```

## 🔧 Kullanım Örnekleri

### Go Client Örneği

```go
package main

import (
    "bytes"
    "encoding/json"
    "fmt"
    "net/http"
)

type RegisterRequest struct {
    Email    string `json:"email"`
    Password string `json:"password"`
}

type AuthResponse struct {
    AccessToken  string `json:"access_token"`
    RefreshToken string `json:"refresh_token"`
    User         struct {
        ID       string `json:"id"`
        Email    string `json:"email"`
        FullName *string `json:"full_name"`
        Role     string `json:"role"`
    } `json:"user"`
}

func main() {
    // Kullanıcı kaydı
    registerData := RegisterRequest{
        Email:    "user@example.com",
        Password: "securepassword123",
    }

    jsonData, _ := json.Marshal(registerData)

    resp, err := http.Post(
        "http://localhost:3333/api/v1/auth/register",
        "application/json",
        bytes.NewBuffer(jsonData),
    )
    if err != nil {
        panic(err)
    }
    defer resp.Body.Close()

    var authResp AuthResponse
    json.NewDecoder(resp.Body).Decode(&authResp)

    fmt.Printf("Access Token: %s\n", authResp.AccessToken)
    fmt.Printf("User ID: %s\n", authResp.User.ID)
}
```

### JavaScript/TypeScript Client Örneği

```javascript
// Kullanıcı kaydı
async function register(email, password) {
    const response = await fetch('/api/v1/auth/register', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            email: email,
            password: password,
        }),
    });

    if (!response.ok) {
        throw new Error('Registration failed');
    }

    const data = await response.json();
    // Access token'ı localStorage'a kaydet
    localStorage.setItem('accessToken', data.access_token);
    localStorage.setItem('refreshToken', data.refresh_token);

    return data;
}

// API çağrılarında token kullanma
async function apiCall(endpoint, options = {}) {
    const token = localStorage.getItem('accessToken');

    const response = await fetch(endpoint, {
        ...options,
        headers: {
            ...options.headers,
            'Authorization': `Bearer ${token}`,
        },
    });

    // Token süresi dolmuşsa yenile
    if (response.status === 401) {
        await refreshToken();
        return apiCall(endpoint, options);
    }

    return response;
}

// Token yenileme
async function refreshToken() {
    const refreshToken = localStorage.getItem('refreshToken');

    const response = await fetch('/api/v1/auth/refresh', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            refresh_token: refreshToken,
        }),
    });

    if (!response.ok) {
        // Refresh token da geçersiz, yeniden giriş yap
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
        return;
    }

    const data = await response.json();
    localStorage.setItem('accessToken', data.access_token);
    localStorage.setItem('refreshToken', data.refresh_token);
}
```

### cURL Örnekleri

```bash
# Kullanıcı kaydı
curl -X POST http://localhost:3333/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "securepassword123"
  }'

# Giriş yapma
curl -X POST http://localhost:3333/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "securepassword123"
  }'

# Email doğrulama
curl -X POST http://localhost:3333/api/v1/auth/verify-email \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "code": "123456"
  }'

# Şifre sıfırlama
curl -X POST http://localhost:3333/api/v1/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com"
  }'
```

## 🛡️ Güvenlik

### JWT Token Güvenliği
- **Access Token**: 1 saat geçerlilik süresi
- **Refresh Token**: 30 gün geçerlilik süresi
- **Secure Storage**: Token'ları güvenli bir şekilde saklayın
- **Token Rotation**: Refresh token'ları düzenli olarak yenileyin

### Şifre Güvenliği
- **Minimum Uzunluk**: 6 karakter
- **Hash Algoritması**: bcrypt (cost factor: DefaultCost)
- **Salt**: Otomatik olarak eklenir
- **No Plain Text**: Şifreler hiçbir zaman plain text olarak saklanmaz

### Rate Limiting
- **Email Gönderme**: Dakikada maksimum 5 istek
- **API Çağrıları**: Dakikada maksimum 100 istek
- **Başarısız Giriş**: 5 başarısız giriş sonrası hesap kilitlenir

### CORS Yapılandırması
```go
// CORS middleware yapılandırması
r.Use(cors.New(cors.Config{
    AllowOrigins:     []string{"http://localhost:3000", "https://yourdomain.com"},
    AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
    AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
    ExposeHeaders:    []string{"Content-Length"},
    AllowCredentials: true,
    MaxAge:           12 * time.Hour,
}))
```

## 🚨 Hata Yönetimi

### HTTP Status Kodları

| Kod | Açıklama | Örnek Durum |
|-----|----------|-------------|
| 200 | Başarılı | Giriş başarılı |
| 201 | Oluşturuldu | Kullanıcı kaydı başarılı |
| 400 | Geçersiz İstek | Eksik veya hatalı parametre |
| 401 | Yetkisiz | Geçersiz token |
| 403 | Yasak | Yetersiz yetki |
| 404 | Bulunamadı | Kullanıcı bulunamadı |
| 409 | Çakışma | Email zaten kayıtlı |
| 422 | İşlenemeyen Entity | Validasyon hatası |
| 429 | Çok Fazla İstek | Rate limit aşıldı |
| 500 | Sunucu Hatası | Dahili sunucu hatası |

### Hata Response Formatı

```json
{
  "error": "Hata mesajı",
  "details": "Detaylı hata açıklaması",
  "code": "ERROR_CODE"
}
```

### Yaygın Hata Kodları

- `INVALID_CREDENTIALS`: Geçersiz giriş bilgileri
- `EMAIL_ALREADY_EXISTS`: Email adresi zaten kayıtlı
- `INVALID_VERIFICATION_CODE`: Geçersiz doğrulama kodu
- `EXPIRED_TOKEN`: Süresi dolmuş token
- `INVALID_RESET_TOKEN`: Geçersiz şifre sıfırlama token'ı

## 🧪 Test

### Unit Test Örnekleri

```go
func TestRegisterHandler(t *testing.T) {
    // Test setup
    router := gin.New()
    router.POST("/register", handlers.RegisterHandler)

    // Test data
    reqBody := `{
        "email": "test@example.com",
        "password": "password123"
    }`

    // Create request
    req, _ := http.NewRequest("POST", "/register", strings.NewReader(reqBody))
    req.Header.Set("Content-Type", "application/json")

    // Create response recorder
    w := httptest.NewRecorder()

    // Perform request
    router.ServeHTTP(w, req)

    // Assert response
    assert.Equal(t, 201, w.Code)

    var response map[string]interface{}
    json.Unmarshal(w.Body.Bytes(), &response)

    assert.Contains(t, response, "access_token")
    assert.Contains(t, response, "user")
}
```

### Integration Test Örneği

```go
func TestAuthFlow(t *testing.T) {
    // Setup test database
    db := setupTestDB()

    // Register user
    registerReq := RegisterRequest{
        Email:    "test@example.com",
        Password: "password123",
    }

    // Verify registration
    var user models.User
    db.Where("email = ?", registerReq.Email).First(&user)
    assert.NotNil(t, user)
    assert.Equal(t, "user", user.Role)

    // Login
    loginReq := LoginRequest{
        Email:    "test@example.com",
        Password: "password123",
    }

    // Verify login response contains tokens
    // ... test login logic
}
```

## 📊 Monitoring ve Logging

### Log Formatı

```json
{
  "timestamp": "2025-01-20T10:30:00Z",
  "level": "INFO",
  "service": "auth",
  "method": "POST /api/v1/auth/login",
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "ip": "192.168.1.100",
  "user_agent": "Mozilla/5.0...",
  "duration_ms": 150,
  "status_code": 200
}
```

### Monitoring Metrics

- **Request Count**: Dakikalık API çağrı sayısı
- **Response Time**: Ortalama yanıt süresi
- **Error Rate**: Hata oranı
- **Active Users**: Aktif kullanıcı sayısı
- **Token Usage**: Token kullanım istatistikleri

## 🔗 İlgili Dokümantasyon

- [API Reference](https://localhost:3333/swagger/index.html) - Swagger UI
- [Database Schema](./database.md) - Veritabanı şeması
- [Deployment Guide](./deployment.md) - Dağıtım rehberi
- [Troubleshooting](./troubleshooting.md) - Sorun giderme

## 🤝 Katkıda Bulunma

1. Bu dokümantasyonu forklayın
2. Feature branch oluşturun (`git checkout -b feature/amazing-feature`)
3. Değişikliklerinizi commit edin (`git commit -m 'Add amazing feature'`)
4. Branch'inizi push edin (`git push origin feature/amazing-feature`)
5. Pull Request oluşturun

## 📄 Lisans

Bu proje MIT lisansı altında lisanslanmıştır. Detaylar için [LICENSE](../LICENSE) dosyasına bakın.

---

**Son Güncelleme:** Eylül 2025
**Versiyon:** 1.0.0
**Dokümantasyon Sorumlusu:** MimReklam Development Team