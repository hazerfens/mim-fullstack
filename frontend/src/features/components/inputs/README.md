# Modüler Input Components

Sistem genelinde kullanılabilen reusable input bileşenleri.

## Yapı

```
src/
├── components/
│   └── ui/
│       ├── phone-input.tsx          # Base UI component
│       └── PHONE_INPUT.md           # Documentation
└── features/
    └── components/
        └── inputs/
            ├── phone-input-field.tsx # Business logic wrapper
            ├── index.ts              # Exports
            └── README.md             # This file
```

## Mevcut Components

### PhoneInput (UI Component)

**Dosya**: `src/components/ui/phone-input.tsx`

Türk telefon numaraları için otomatik formatlama sağlayan temel UI component'i.

**Özellikleri**:
- Format: `+xx xxx xxx xx xx`
- Plus işareti otomatik eklenir
- Max 12 digit
- React Hook Form uyumlu
- TypeScript

**Kullanım**:
```tsx
import { PhoneInput } from '@/components/ui/phone-input'

<PhoneInput value={phone} onChange={handleChange} />
```

### PhoneInputField (Field Wrapper)

**Dosya**: `src/features/components/inputs/phone-input-field.tsx`

shadcn/ui Field layout'u ile PhoneInput'u wrap eden field component'i.

**Özellikleri**:
- Label, description, error desteği
- shadcn/ui Field entegrasyonu
- react-hook-form uyumlu
- Accessibility attributes

**Kullanım**:
```tsx
import { PhoneInputField } from '@/features/components/inputs'

<PhoneInputField
  label="Telefon"
  description="Sabit hat numarası"
  required
/>
```

## Import Yolları

```tsx
// UI Component (Base)
import { PhoneInput } from '@/components/ui/phone-input'

// Field Component (Business Logic)
import { PhoneInputField } from '@/features/components/inputs'

// Veya
import { PhoneInputField } from '@/features/components/inputs/phone-input-field'

// Utility fonksiyonları
import { formatPhoneNumber } from '@/components/ui/phone-input'
```

## Örnekler

### Örnek 1: Company Details Form'da Telefon Alanları

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

### Örnek 2: Standalone Form

```tsx
import { PhoneInputField } from '@/features/components/inputs'

function ContactForm() {
  return (
    <PhoneInputField
      label="Telefon Numarası"
      description="Lütfen geçerli bir telefon numarası girin"
      required
      placeholder="+90 5XX XXX XX XX"
    />
  )
}
```

## Yeni Component Ekleme

Yeni input component eklemek için:

1. **UI Component** oluştur: `src/components/ui/new-input.tsx`
2. **Field Wrapper** oluştur: `src/features/components/inputs/new-input-field.tsx`
3. **Export** ekle: `src/features/components/inputs/index.ts`
4. **Dokumentasyon** ekle: `src/components/ui/NEW_INPUT.md`

## Best Practices

✅ UI component'i `src/components/ui/` altında tut
✅ Business logic wrapper'ı `src/features/components/inputs/` altında tut
✅ Export'ları `index.ts` dosyasından yap
✅ Her component için dokumentasyon ekle
✅ TypeScript type'larını ekle
✅ React Hook Form uyumlu yap

## Ekip Kullanım

- **Frontend Developers**: Componenti import et ve kullan
- **Component Author**: Component'i modüler ve reusable koru
- **PR Reviewer**: Yeni component'ler bu yapıya uygunluğunu kontrol et
