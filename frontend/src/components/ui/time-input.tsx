"use client"

import * as React from "react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Clock } from "lucide-react"

interface TimeInputProps extends Omit<React.ComponentProps<typeof Input>, 'onChange'> {
  id?: string
  label?: string
  value?: string
  defaultValue?: string
  step?: number | string
  onChange?: (value: string) => void
}

export function TimeInput({ id, label, value, defaultValue, step = '60', onChange, className, ...rest }: TimeInputProps) {
  return (
    <div className={"w-full"}>
      {label && (
        <Label htmlFor={id} className="mb-1 block text-sm">
          {label}
        </Label>
      )}

      <div className="relative">
        <div className="text-muted-foreground pointer-events-none absolute inset-y-0 left-0 flex items-center justify-center pl-3 peer-disabled:opacity-50">
          <Clock className="size-4" />
          <span className="sr-only">time</span>
        </div>

        <Input
          id={id}
          type="time"
          step={String(step)}
          value={value}
          defaultValue={defaultValue}
          onChange={(e) => onChange?.(e.target.value)}
          className={"peer bg-background appearance-none pl-9 [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none " + (className ?? '')}
          {...rest}
        />
      </div>
    </div>
  )
}

export default TimeInput
