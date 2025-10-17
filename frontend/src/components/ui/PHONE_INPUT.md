# PhoneInput Component

Türk telefon numaraları için otomatik formatlama sağlayan component.

## Format

- **Pattern**: `+xx xxx xxx xx xx`
- **Örnek**: `+90 532 123 45 67`
- **Max Digit**: 12 (ülke kodu + numara)
- **Display Format**: Otomatik olarak formatlanır, veriler temiz şekilde kaydedilir

## Kullanım

### 1. Temel PhoneInput (UI Component)

```tsx
import { PhoneInput } from '@/components/ui/phone-input'

function MyForm() {
  const [phone, setPhone] = useState('')

  return (
    <PhoneInput
      value={phone}
      onChange={(e) => setPhone(e.target.value)}
      placeholder="+90 5XX XXX XX XX"
      disabled={false}
    />
  )
}
```

### 2. PhoneInputField (Form Field with Label & Description)

```tsx
import { PhoneInputField } from '@/features/components/inputs'

function MyForm() {
  return (
    <PhoneInputField
      label="Telefon Numarası"
      description="Sabit hat numarası"
      placeholder="+90 3XX XXX XX XX"
      required
      disabled={false}
    />
  )
}
```

### 3. React Hook Form Entegrasyonu

```tsx
import { useForm, Controller } from 'react-hook-form'
import { PhoneInput } from '@/components/ui/phone-input'

function MyForm() {
  const { control, handleSubmit } = useForm({
    defaultValues: {
      phone: '+905321234567'
    }
  })

  return (
    <form onSubmit={handleSubmit((data) => console.log(data))}>
      <Controller
        name="phone"
        control={control}
        render={({ field }) => (
          <PhoneInput
            {...field}
            placeholder="+90 5XX XXX XX XX"
          />
        )}
      />
      <button type="submit">Submit</button>
    </form>
  )
}
```

### 4. Company Details Form'da Kullanım

```tsx
import { PhoneInput } from '@/components/ui/phone-input'
import { regContact } from 'form-hook'

<Field orientation="vertical">
  <FieldContent>
    <FieldLabel>Telefon</FieldLabel>
    <PhoneInput 
      {...regContact('phone')} 
      placeholder="+90 3XX XXX XX XX"
      disabled={isPending}
    />
    <FieldDescription>Sabit hat numarası</FieldDescription>
  </FieldContent>
</Field>
```

## Özellikleri

✅ Otomatik formatlama (+90 532 123 45 67)
✅ Plus işareti başında sabit
✅ Sadece rakamları kabul et
✅ Max 12 digit sınırlaması
✅ React Hook Form uyumlu
✅ Disabled state desteği
✅ Accessibility (aria-invalid vb.)
✅ TypeScript support

## Return Value

- **Display**: `+90 532 123 45 67` (formatted)
- **Value**: `+905321234567` (clean, spaces removed)
- **Storage**: Boşluksuz versiyonu backend'e kaydedilir

## Dosyalar

- **UI Component**: `src/components/ui/phone-input.tsx`
- **Field Wrapper**: `src/features/components/inputs/phone-input-field.tsx`
- **Exports**: `src/features/components/inputs/index.ts`
