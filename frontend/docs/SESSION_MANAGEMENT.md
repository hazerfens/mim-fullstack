# Session Management Documentation

Bu proje, Zustand tabanlı güçlü bir session yönetim sistemi kullanır.

## 📁 Dosya Yapısı

```
src/
├── stores/
│   └── session-store.ts          # Zustand store (state + actions)
├── components/
│   └── providers/
│       └── session-provider.tsx  # React Context wrapper
├── lib/
│   └── session-helpers.ts        # Helper functions
├── hooks/
│   └── use-session.ts            # Unified exports
└── features/
    └── actions/
        └── auth-action.ts        # Server actions
```

## 🎯 Özellikler

- ✅ **Zustand Store**: Client-side state management
- ✅ **Persist**: LocalStorage ile session persistence
- ✅ **DevTools**: Redux DevTools entegrasyonu
- ✅ **Smart Refetch**: 5 dakika cache ile gereksiz API çağrılarını önler
- ✅ **Modüler Yapı**: Her component kendi ihtiyacına göre hook kullanabilir
- ✅ **TypeScript**: Full type safety

## 📖 Kullanım

### 1. Session Provider (Root Layout)

```tsx
import { SessionProvider } from '@/components/providers/session-provider';

export default function RootLayout({ children }) {
  const user = await getCurrentUserAction();
  
  return (
    <SessionProvider initialUser={user}>
      {children}
    </SessionProvider>
  );
}
```

### 2. Full Session Context Kullanımı

Context'ten tüm özelliklere erişim:

```tsx
'use client';
import { useSession } from '@/hooks/use-session';

export function MyComponent() {
  const { user, isLoading, error, refreshSession, clearSession } = useSession();
  
  return (
    <div>
      {isLoading && <p>Yükleniyor...</p>}
      {error && <p>Hata: {error}</p>}
      {user && <p>Hoşgeldin, {user.full_name}</p>}
      
      <button onClick={refreshSession}>
        Yenile
      </button>
      
      <button onClick={clearSession}>
        Temizle
      </button>
    </div>
  );
}
```

### 3. Sadece User Bilgisi (Performanslı)

Sadece user bilgisine ihtiyacın varsa, doğrudan store'dan al:

```tsx
'use client';
import { useUser } from '@/hooks/use-session';

export function UserGreeting() {
  const user = useUser();
  
  return <p>Merhaba, {user?.full_name || 'Misafir'}</p>;
}
```

### 4. Loading State

```tsx
'use client';
import { useIsLoading } from '@/hooks/use-session';

export function LoadingIndicator() {
  const isLoading = useIsLoading();
  
  return isLoading ? <Spinner /> : null;
}
```

### 5. Logout İşlemi

```tsx
'use client';
import { logoutAction } from '@/features/actions/auth-action';
import { clearClientSession } from '@/hooks/use-session';
import { useRouter } from 'next/navigation';

export function LogoutButton() {
  const router = useRouter();
  
  const handleLogout = async () => {
    await logoutAction();           // Server-side logout
    clearClientSession();           // Clear Zustand store
    router.push('/');               // Redirect
    router.refresh();               // Refresh page
  };
  
  return <button onClick={handleLogout}>Çıkış Yap</button>;
}
```

### 6. Force Refresh

Cache bypass ederek zorla yenile:

```tsx
'use client';
import { forceRefreshSession } from '@/hooks/use-session';

export function RefreshButton() {
  return (
    <button onClick={forceRefreshSession}>
      Force Refresh
    </button>
  );
}
```

### 7. Direkt Store Erişimi

Advanced kullanım için:

```tsx
'use client';
import { useSessionStore } from '@/hooks/use-session';

export function AdvancedComponent() {
  const store = useSessionStore();
  
  // Tüm state ve actions'a erişim
  const { user, isLoading, fetchUser, setUser } = store;
  
  return <div>...</div>;
}
```

## ⚙️ Konfigürasyon

### Cache Süresi

`session-store.ts` içinde `REFETCH_INTERVAL` değişkenini düzenle:

```typescript
const REFETCH_INTERVAL = 5 * 60 * 1000; // 5 dakika
```

### Persist Storage

Varsayılan olarak `localStorage` kullanılır. Değiştirmek için:

```typescript
persist(
  (set, get) => ({ /* ... */ }),
  {
    name: 'session-storage',
    storage: createJSONStorage(() => sessionStorage), // veya custom storage
  }
)
```

## 🔄 Akış Diyagramı

```
┌─────────────┐
│   Layout    │ → getCurrentUserAction() → initialUser
└──────┬──────┘
       │
       ▼
┌─────────────────────┐
│ SessionProvider     │ → setUser(initialUser)
│ (React Context)     │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│  Zustand Store      │
│  - user             │
│  - isLoading        │
│  - lastFetch        │
│  - error            │
│  - fetchUser()      │
│  - setUser()        │
│  - clearSession()   │
│  - shouldRefetch()  │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│  Components         │ → useSession() / useUser()
│  - NavUser          │
│  - UserStatus       │
│  - Dashboard        │
└─────────────────────┘
```

## 🚀 Performans Optimizasyonları

1. **Smart Refetch**: Son fetch'ten 5 dakika geçmemişse yeni istek atmaz
2. **Selector Hooks**: Component sadece ihtiyacı olan state değiştiğinde render olur
3. **Persist**: Sayfa yenilendiğinde user bilgisi korunur
4. **Debounce**: Concurrent fetch isteklerini engeller

## 🐛 Debugging

Redux DevTools kullanarak store'u inspect edebilirsin:

1. Redux DevTools extension'ı kur
2. Browser'da açık ol
3. "SessionStore" sekmesini aç
4. Her action'ı ve state değişimini gör

## 📝 Best Practices

1. ✅ **Public routes**: Provider'ı `disabled={true}` ile kullan
2. ✅ **Logout**: Her zaman `clearClientSession()` çağır
3. ✅ **Selective rendering**: Tam context yerine selector hooks kullan
4. ✅ **Error handling**: `error` state'ini kontrol et
5. ✅ **Loading states**: `isLoading` ile UX iyileştir

## ⚠️ Dikkat Edilmesi Gerekenler

- ❌ Server component'lerde Zustand hooks kullanma (SSR olmaz)
- ❌ Her route değişiminde force refresh yapma (cache'i kullan)
- ❌ Session store'u doğrudan mutate etme (actions kullan)
- ✅ Server actions ile backend iletişimi kur
- ✅ Client helper'ları sadece client component'lerde kullan
