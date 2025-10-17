import React from "react"
import { PhoneInput } from "@/components/ui/phone-input"
import {
  Field,
  FieldContent,
  FieldLabel,
  FieldDescription,
  FieldError,
} from "@/components/ui/field"

interface PhoneInputFieldProps
  extends Omit<React.ComponentProps<typeof PhoneInput>, "name" | "ref"> {
  label?: string
  description?: string
  error?: string
  required?: boolean
}

/**
 * PhoneInputField Component
 * 
 * react-hook-form ile entegreli telefon input field'ı.
 * shadcn/ui Field layout'u ile form entegrasyonu sağlar.
 * 
 * @example
 * ```tsx
 * <Controller
 *   name="phone"
 *   control={control}
 *   render={({ field }) => (
 *     <PhoneInputField
 *       {...field}
 *       label="Telefon Numarası"
 *       description="Sabit hat numarası"
 *       disabled={isPending}
 *     />
 *   )}
 * />
 * ```
 */
const PhoneInputField = React.forwardRef<
  HTMLInputElement,
  PhoneInputFieldProps
>(
  (
    {
      label,
      description,
      error,
      required = false,
      disabled = false,
      ...props
    },
    ref
  ) => {
    return (
      <Field orientation="vertical">
        <FieldContent>
          {label && (
            <FieldLabel>
              {label}
              {required && <span className="text-destructive ml-1">*</span>}
            </FieldLabel>
          )}
          <PhoneInput
            ref={ref}
            disabled={disabled}
            aria-invalid={!!error}
            {...props}
          />
          {description && !error && (
            <FieldDescription>{description}</FieldDescription>
          )}
          {error && <FieldError>{error}</FieldError>}
        </FieldContent>
      </Field>
    )
  }
)

PhoneInputField.displayName = "PhoneInputField"

export { PhoneInputField }
