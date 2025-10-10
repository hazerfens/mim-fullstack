# Invitation Flow - Ideal Implementation Plan

## 🎯 Problem Statement
Kullanıcı daveti kabul etmek istediğinde iki durum var:
1. **Kayıtlı Kullanıcı**: Login yapıp daveti kabul edebilmeli
2. **Yeni Kullanıcı**: Önce kayıt olup sonra otomatik olarak daveti kabul etmeli

## 📋 Implementation Steps

### Step 1: Middleware Update
`/accept-invitation/[token]` sayfası için özel middleware:
- ✅ Kullanıcı login ise → Daveti göster
- ❌ Kullanıcı login değilse → `/auth/register?invitation_token={token}` redirect

### Step 2: Registration Page Enhancement
`/auth/register` sayfasını güncelle:
- Token query parameter varsa:
  - Invitation bilgilerini fetch et
  - Email input'u pre-fill et ve disable et
  - Kullanıcıya "Şirket davetine yanıt veriyorsunuz" mesajı göster
  - Kayıt sonrası invitation'ı otomatik kabul et

### Step 3: Login Page Enhancement  
`/auth/login` sayfasını güncelle:
- Token query parameter varsa:
  - Login sonrası `/accept-invitation/[token]` redirect
  - "Daveti kabul etmek için giriş yapın" mesajı göster

### Step 4: Backend Enhancement
- `AcceptInvitation` API'sini güncelle:
  - Email ile kullanıcı kontrolü
  - Eğer kullanıcı yoksa: "User not found" yerine detaylı mesaj

## 🛠️ Implementation Details

### 1. Accept Invitation Page (Server Component)
```typescript
// src/app/accept-invitation/[token]/page.tsx
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

export default async function AcceptInvitationPage({ params }) {
  const { token } = await params;
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("access_token")?.value;

  // Check if user is logged in
  if (!sessionToken) {
    // Not logged in - check if invitation exists first
    const result = await getInvitationByToken(token);
    
    if (!result.success || !result.data) {
      redirect("/?error=invalid_invitation");
    }

    const invitation = result.data;
    
    // Check if user already exists with this email
    const userExists = await checkUserExists(invitation.email);
    
    if (userExists) {
      // User has account - redirect to login
      redirect(`/auth/login?invitation_token=${token}&email=${invitation.email}`);
    } else {
      // New user - redirect to register
      redirect(`/auth/register?invitation_token=${token}&email=${invitation.email}`);
    }
  }

  // User is logged in - show invitation details
  const result = await getInvitationByToken(token);
  // ... rest of the code
}
```

### 2. Registration Page Update
```typescript
// src/app/(auth)/auth/register/page.tsx
"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function RegisterPage() {
  const searchParams = useSearchParams();
  const invitationToken = searchParams.get("invitation_token");
  const emailParam = searchParams.get("email");
  
  const [invitation, setInvitation] = useState(null);
  const [email, setEmail] = useState(emailParam || "");

  useEffect(() => {
    if (invitationToken) {
      // Fetch invitation details
      getInvitationByToken(invitationToken).then((result) => {
        if (result.success) {
          setInvitation(result.data);
          setEmail(result.data.email);
        }
      });
    }
  }, [invitationToken]);

  const handleSubmit = async (formData) => {
    // Register user
    const result = await registerUser(formData);
    
    if (result.success) {
      // If there's an invitation, auto-accept it
      if (invitationToken) {
        await acceptInvitation(invitationToken, email);
      }
      
      // Redirect to dashboard
      router.push("/dashboard?welcome=true");
    }
  };

  return (
    <div>
      {invitation && (
        <Alert className="mb-4">
          <AlertDescription>
            <Building2 className="h-4 w-4 inline mr-2" />
            <strong>{invitation.company?.name}</strong> şirketine davet edildiniz!
            Kayıt olduktan sonra otomatik olarak ekleneceksiniz.
          </AlertDescription>
        </Alert>
      )}
      
      <input
        type="email"
        value={email}
        disabled={!!invitationToken}
        // ... other props
      />
      
      {/* Rest of the form */}
    </div>
  );
}
```

### 3. Login Page Update
```typescript
// src/app/(auth)/auth/login/page.tsx
"use client";

import { useSearchParams } from "next/navigation";

export default function LoginPage() {
  const searchParams = useSearchParams();
  const invitationToken = searchParams.get("invitation_token");
  const emailParam = searchParams.get("email");

  const handleSubmit = async (formData) => {
    const result = await loginUser(formData);
    
    if (result.success) {
      if (invitationToken) {
        // Redirect to invitation acceptance page
        router.push(`/accept-invitation/${invitationToken}`);
      } else {
        router.push("/dashboard");
      }
    }
  };

  return (
    <div>
      {invitationToken && (
        <Alert className="mb-4">
          <AlertDescription>
            Şirket davetini kabul etmek için giriş yapın
          </AlertDescription>
        </Alert>
      )}
      
      <input
        type="email"
        defaultValue={emailParam || ""}
        // ... other props
      />
      
      {/* Rest of the form */}
    </div>
  );
}
```

### 4. Backend Helper Function
```go
// internal/services/auth.go

func CheckUserExistsByEmail(email string) (bool, error) {
    db, err := config.NewConnection()
    if err != nil {
        return false, err
    }

    var user authmodels.User
    err = db.Where("email = ?", email).First(&user).Error
    
    if err != nil {
        if errors.Is(err, gorm.ErrRecordNotFound) {
            return false, nil
        }
        return false, err
    }
    
    return true, nil
}
```

### 5. Frontend Action
```typescript
// src/features/actions/auth-action.ts

export async function checkUserExists(email: string): Promise<{
  success: boolean;
  exists: boolean;
  error?: string;
}> {
  try {
    const response = await fetch(
      `${API_URL}/auth/check-email?email=${encodeURIComponent(email)}`,
      {
        method: "GET",
      }
    );

    if (!response.ok) {
      return { success: false, exists: false, error: "API error" };
    }

    const data = await response.json();
    return { success: true, exists: data.exists };
  } catch (error) {
    return { success: false, exists: false, error: "Network error" };
  }
}
```

### 6. Backend Handler
```go
// internal/handlers/auth.go

func CheckEmailHandler(c *gin.Context) {
    email := c.Query("email")
    if email == "" {
        c.JSON(http.StatusBadRequest, gin.H{"error": "Email is required"})
        return
    }

    exists, err := services.CheckUserExistsByEmail(email)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to check email"})
        return
    }

    c.JSON(http.StatusOK, gin.H{
        "exists": exists,
        "email":  email,
    })
}
```

### 7. Route Addition
```go
// internal/routes/router.go

// Public routes
public := router.Group("/api/v1")
{
    // ... existing routes
    public.GET("/auth/check-email", handlers.CheckEmailHandler)
}
```

## 📊 User Flow Diagram

```
┌─────────────────────────────────────────┐
│ User clicks invitation link             │
│ /accept-invitation/[token]              │
└───────────────┬─────────────────────────┘
                │
                ├─── Is user logged in?
                │
        ┌───────┴───────┐
        │               │
     YES ✓           NO ✗
        │               │
        │               ├─── Check user exists by email
        │               │
        │         ┌─────┴──────┐
        │         │            │
        │      EXISTS       NEW USER
        │         │            │
        │         │            └──→ /auth/register?invitation_token=xxx
        │         │                  ↓
        │         │                  Register + Auto-accept
        │         │                  ↓
        │         │                  Dashboard (member)
        │         │
        │         └──────────→ /auth/login?invitation_token=xxx
        │                      ↓
        │                      Login
        │                      ↓
        └──────────────────────┴──→ /accept-invitation/[token]
                                     ↓
                                     Accept/Reject
                                     ↓
                                     Dashboard (member)
```

## ✅ Advantages

1. **Seamless UX**: Kullanıcı doğru akışa yönlendiriliyor
2. **No Manual Steps**: Yeni kullanıcı kayıt sonrası otomatik üye oluyor
3. **Email Validation**: Invitation email'i ile kayıt email'i eşleşmeli
4. **Security**: Token validation her adımda yapılıyor
5. **Clear Feedback**: Her aşamada kullanıcıya net mesajlar

## 🔒 Security Considerations

1. **Token Expiration**: Her zaman token geçerliliğini kontrol et
2. **Email Matching**: Sadece doğru email ile kabul edilebilmeli
3. **One-time Use**: Kabul edilen invitation tekrar kullanılamamalı
4. **Rate Limiting**: Invitation endpoint'lerine rate limit ekle

## 📝 Additional Features (Optional)

### Email Verification After Registration
```
Register → Send verification email → Verify → Auto-accept invitation
```

### Invitation Preview
```
/invitation-preview/[token] (no auth required)
↓
Shows company name, role, inviter
↓
Login or Register buttons
```

### Multiple Invitations
```
User dashboard shows all pending invitations
↓
Accept/reject from dashboard
```

## 🧪 Testing Checklist

- [ ] Test with existing user (login flow)
- [ ] Test with new user (register flow)
- [ ] Test with expired invitation
- [ ] Test with already accepted invitation
- [ ] Test with wrong email (security)
- [ ] Test token validation
- [ ] Test edge cases (deleted company, deleted inviter, etc.)

## 📚 Files to Modify

### Frontend
- ✅ `src/app/accept-invitation/[token]/page.tsx`
- ✅ `src/app/(auth)/auth/login/page.tsx`
- ✅ `src/app/(auth)/auth/register/page.tsx`
- ✅ `src/features/actions/auth-action.ts`
- ✅ `src/features/actions/invitation-action.ts`

### Backend
- ✅ `internal/services/auth.go` (CheckUserExistsByEmail)
- ✅ `internal/handlers/auth.go` (CheckEmailHandler)
- ✅ `internal/routes/router.go` (add route)
- ✅ `internal/services/invitation.go` (update AcceptInvitation)

---

**Implementation Priority:** HIGH
**Estimated Time:** 3-4 hours
**Complexity:** Medium
