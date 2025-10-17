# PhoneInput Component - Modüler Yapı Dokümantasyonu

## 📋 Genel Bakış

Türk telefon numaraları için otomatik formatlama sağlayan, sistem genelinde kullanılabilir modüler component yapısı.

**Format**: `+xx xxx xxx xx xx`  
**Örnek**: `+90 532 123 45 67`  
**Max Digit**: 12 (ülke kodu + numara)

---

## 📂 Dosya Yapısı

```
frontend/
├── src/
│   ├── components/ui/
│   │   ├── phone-input.tsx              ✨ Base UI Component
│   │   ├── PHONE_INPUT.md              📖 UI Component Doc
│   │   └── [diğer components...]
│   │
│   ├── features/
│   │   ├── components/
│   │   │   ├── inputs/
│   │   │   │   ├── phone-input-field.tsx    🎯 Field Wrapper
│   │   │   │   ├── index.ts                 📤 Exports
│   │   │   │   └── README.md                📖 Inputs Doc
│   │   │   │
│   │   │   ├── company/
│   │   │   │   └── company-details-form.tsx ✅ Kullanım Örneği
│   │   │   │
│   │   │   └── [diğer components...]
│   │
│   └── app/
│       ├── phone-input-demo/
│       │   └── page.tsx                     🧪 Demo/Test Sayfası
│       └── [diğer sayfalar...]
│
└── [diğer dosyalar...]
```

---

## 🎯 Component Katmanları

### 1️⃣ **UI Layer** - `src/components/ui/phone-input.tsx`

**Sorumluluk**: Temel UI ve formatlama mantığı

```tsx
import { PhoneInput } from '@/components/ui/phone-input'

<PhoneInput 
  value={phone}
  onChange={handleChange}
  placeholder="+90 5XX XXX XX XX"
  disabled={false}
/>
```

**Özellikleri**:
- Otomatik formatlama (+90 532 123 45 67)
- Plus işareti başında sabit
- Sadece rakamları kabul et
- Max 12 digit
- React Hook Form uyumlu
- Boşluksuz değer return et

### 2️⃣ **Field Layer** - `src/features/components/inputs/phone-input-field.tsx`

**Sorumluluk**: Business logic + shadcn/ui Field wrapper

```tsx
import { PhoneInputField } from '@/features/components/inputs'

<PhoneInputField
  label="Telefon Numarası"
  description="Sabit hat numarası"
  required
  disabled={isPending}
  value={phone}
  onChange={handleChange}
/>
```

**Özellikleri**:
- Label, description, error desteği
- shadcn/ui Field layout'u
- react-hook-form entegrasyonu
- Accessibility attributes

### 3️⃣ **Application Layer** - `src/features/components/company/`

**Sorumluluk**: Gerçek uygulamada kullanım

```tsx
import { PhoneInput } from '@/components/ui/phone-input'
import { Field, FieldContent, FieldLabel, FieldDescription } from '@/components/ui/field'

<Field orientation="vertical">
  <FieldContent>
    <FieldLabel>Telefon</FieldLabel>
    <PhoneInput 
      {...regContact('phone')} 
      placeholder="+90 312 123 45 67"
      disabled={isPending}
    />
    <FieldDescription>Sabit hat numarası</FieldDescription>
  </FieldContent>
</Field>
```

---

## 🚀 Kullanım Örnekleri

### Örnek 1: Temel Kullanım (UI Component)

```tsx
import { PhoneInput } from '@/components/ui/phone-input'

function MyForm() {
  const [phone, setPhone] = useState('')

  return (
    <PhoneInput
      value={phone}
      onChange={(e) => setPhone(e.target.value)}
      placeholder="+90 5XX XXX XX XX"
    />
  )
}
```

### Örnek 2: Field Wrapper ile

```tsx
import { PhoneInputField } from '@/features/components/inputs'

function ContactForm() {
  const [phone, setPhone] = useState('')

  return (
    <PhoneInputField
      label="Telefon Numarası"
      description="Lütfen geçerli bir telefon numarası girin"
      required
      value={phone}
      onChange={(e) => setPhone(e.target.value)}
    />
  )
}
```

### Örnek 3: React Hook Form ile

```tsx
import { useForm, Controller } from 'react-hook-form'
import { PhoneInput } from '@/components/ui/phone-input'

function MyForm() {
  const { control, handleSubmit } = useForm({
    defaultValues: { phone: '+905321234567' }
  })

  return (
    <form onSubmit={handleSubmit((data) => console.log(data))}>
      <Controller
        name="phone"
        control={control}
        render={({ field }) => (
          <PhoneInput {...field} placeholder="+90 5XX XXX XX XX" />
        )}
      />
      <button type="submit">Gönder</button>
    </form>
  )
}
```

### Örnek 4: Company Details Form'da (Real Usage)

```tsx
import { PhoneInput } from '@/components/ui/phone-input'
import { Field, FieldContent, FieldLabel, FieldDescription } from '@/components/ui/field'

// Contact Tab içinde
<Field orientation="vertical">
  <FieldContent>
    <FieldLabel>Telefon</FieldLabel>
    <PhoneInput 
      {...regContact('phone')} 
      placeholder="+90 312 123 45 67"
      disabled={isPending}
    />
    <FieldDescription>Sabit hat numarası</FieldDescription>
  </FieldContent>
</Field>

<Field orientation="vertical">
  <FieldContent>
    <FieldLabel>Cep Telefonu</FieldLabel>
    <PhoneInput 
      {...regContact('cellphone')} 
      placeholder="+90 532 123 45 67"
      disabled={isPending}
    />
  </FieldContent>
</Field>
```

---

## 📦 Export Yapısı

### `src/features/components/inputs/index.ts`

```typescript
export { PhoneInputField } from './phone-input-field'
```

### `src/components/ui/phone-input.tsx`

```typescript
export { PhoneInput, formatPhoneNumber }
```

---

## 🔄 Veri Akışı

```
Kullanıcı Input
    ↓
PhoneInput Component (onChange)
    ↓
formatPhoneNumber()
    ↓
Display: +90 532 123 45 67 (formatted)
Value: +905321234567 (clean)
    ↓
React Hook Form / State
    ↓
API: +905321234567 (boşluksuz kaydedilir)
```

---

## ✅ Checklist: Yeni Sistem Özellikler

- ✅ Modüler yapı (UI + Field + App layer)
- ✅ Otomatik formatlama (+90 532 123 45 67)
- ✅ Plus işareti başında sabit
- ✅ Sadece rakamları kabul et
- ✅ Max 12 digit sınırlaması
- ✅ React Hook Form uyumlu
- ✅ shadcn/ui Field entegrasyonu
- ✅ TypeScript support
- ✅ Accessibility attributes
- ✅ Boşluksuz versiyonu return et
- ✅ Komple dokumentasyon
- ✅ Demo/Test sayfası
- ✅ Company Details Form'da kullanım

---

## 📖 Dokümantasyon Dosyaları

| Dosya | Amaç | Erişim |
|-------|------|--------|
| `PHONE_INPUT.md` | UI Component detayları | `src/components/ui/` |
| `README.md` | Inputs components yapısı | `src/features/components/inputs/` |
| `phone-input-demo/page.tsx` | Interaktif demo | `http://localhost:3000/phone-input-demo` |

---

## 🧪 Test Etme

Demo sayfasını ziyaret et: `/phone-input-demo`

Orada görebilirsin:
- Temel PhoneInput kullanımı
- Varsayılan değer ile
- PhoneInputField wrapper
- Çeşitli formatlama örnekleri
- Live input ve output değerleri

---

## 💡 Best Practices

✅ UI component'i `src/components/ui/` altında tut
✅ Business logic wrapper'ı `src/features/components/` altında tut
✅ Her component için type'ları ekle
✅ React Hook Form uyumlu koru
✅ Accessibility ekle
✅ Dokumentasyon yaz
✅ Demo/test page ekle

---

## 🔗 İlişkili Dosyalar

- **Company Details Form**: `src/features/components/company/company-details-form.tsx`
- **Kullanım Örneği**: Telefon ve Cep Telefonu alanları
- **Demo**: `src/app/phone-input-demo/page.tsx`

---

## 📞 Kontrol Listesi: Entegrasyon Yapıldı

- ✅ PhoneInput component oluşturuldu
- ✅ PhoneInputField wrapper oluşturuldu
- ✅ Company Details Form'da telefon alanları güncellendi
- ✅ Tüm TypeScript hataları düzeltildi
- ✅ Modüler dosya yapısı oluşturuldu
- ✅ Kompleks dokumentasyon yazıldı
- ✅ Demo sayfası oluşturuldu

---

**Son Güncelleme**: 2025-10-17  
**Sistem**: Modüler PhoneInput Component  
**Durum**: ✅ Tamamlandı ve Entegre Edildi
