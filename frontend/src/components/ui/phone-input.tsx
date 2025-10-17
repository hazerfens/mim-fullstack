import * as React from "react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

/**
 * Telefon numarası formatlama utility
 * Format: +xx xxx xxx xx xx
 * Örnek: +90 532 123 45 67
 */
const formatPhoneNumber = (value: string): string => {
  // Sadece rakamları al
  const digits = value.replace(/\D/g, "")

  // Eğer + ile başlıyorsa, onu da koru
  const hasPlus = value.startsWith("+")

  if (!digits) return hasPlus ? "+" : ""

  // Max 12 digit kabul et (ülke kodu 2-3 digit + 9-10 digit numara)
  const truncated = digits.slice(0, 12)

  if (truncated.length <= 2) {
    return hasPlus ? "+" + truncated : truncated
  } else if (truncated.length <= 5) {
    const part1 = truncated.slice(0, 2)
    const part2 = truncated.slice(2)
    return hasPlus ? `+${part1} ${part2}` : `${part1} ${part2}`
  } else if (truncated.length <= 8) {
    const part1 = truncated.slice(0, 2)
    const part2 = truncated.slice(2, 5)
    const part3 = truncated.slice(5)
    return hasPlus ? `+${part1} ${part2} ${part3}` : `${part1} ${part2} ${part3}`
  } else if (truncated.length <= 10) {
    const part1 = truncated.slice(0, 2)
    const part2 = truncated.slice(2, 5)
    const part3 = truncated.slice(5, 8)
    const part4 = truncated.slice(8)
    return hasPlus ? `+${part1} ${part2} ${part3} ${part4}` : `${part1} ${part2} ${part3} ${part4}`
  } else {
    const part1 = truncated.slice(0, 2)
    const part2 = truncated.slice(2, 5)
    const part3 = truncated.slice(5, 8)
    const part4 = truncated.slice(8, 10)
    const part5 = truncated.slice(10)
    return hasPlus ? `+${part1} ${part2} ${part3} ${part4} ${part5}` : `${part1} ${part2} ${part3} ${part4} ${part5}`
  }
}

export interface PhoneInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  value?: string
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
}

/**
 * PhoneInput Component
 * 
 * Türk telefon numaraları için otomatik formatlama sağlar.
 * Format: +90 5XX XXX XX XX
 * 
 * @example
 * ```tsx
 * <PhoneInput value={phone} onChange={handlePhoneChange} />
 * ```
 */
const PhoneInput = React.forwardRef<HTMLInputElement, PhoneInputProps>(
  ({ value, onChange, onBlur, className, ...props }, ref) => {
    const [displayValue, setDisplayValue] = React.useState(value || "")

    React.useEffect(() => {
      setDisplayValue(value || "")
    }, [value])

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      let inputValue = e.target.value

      // Eğer silme işlemi değilse + ile başlat
      if (!inputValue && displayValue) {
        // Silme işlemi
        setDisplayValue("")
        onChange?.(e)
        return
      }

      // + ile başlıyorsa kontrol et
      if (!inputValue.startsWith("+") && inputValue.length > 0) {
        inputValue = "+" + inputValue
      }

      const formatted = formatPhoneNumber(inputValue)
      setDisplayValue(formatted)

      // onChange'e sadece rakamları ve + işaretini ilet
      const cleanValue = formatted.replace(/\s/g, "")
      e.target.value = cleanValue
      onChange?.(e)
    }

    return (
      <Input
        ref={ref}
        {...props}
        value={displayValue}
        onChange={handleChange}
        onBlur={onBlur}
        placeholder="+90 5XX XXX XX XX"
        type="tel"
        className={cn("", className)}
      />
    )
  }
)

PhoneInput.displayName = "PhoneInput"

export { PhoneInput, formatPhoneNumber }
