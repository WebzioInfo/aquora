import React, { useState, useEffect, useRef } from 'react'

export interface EnterpriseNumberInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: number | string | null | undefined
  onChange?: (e: any) => void
  onValueChange?: (val: number | string) => void
  label?: string
  error?: string
  icon?: React.ReactNode
  allowDecimals?: boolean
  allowNegative?: boolean
  clearOnFocusIfZero?: boolean
}

export const EnterpriseNumberInput = React.forwardRef<HTMLInputElement, EnterpriseNumberInputProps>(
  (
    {
      value,
      onChange,
      onValueChange,
      label,
      error,
      icon,
      allowDecimals = true,
      allowNegative = false,
      clearOnFocusIfZero = true,
      className = '',
      onFocus,
      onBlur,
      name,
      placeholder,
      min,
      max,
      ...props
    },
    ref
  ) => {
    const [isFocused, setIsFocused] = useState(false)
    const [displayValue, setDisplayValue] = useState<string>('')

    // Synchronize displayValue with value prop when NOT focused
    useEffect(() => {
      if (!isFocused) {
        if (value === null || value === undefined || value === '') {
          setDisplayValue('')
        } else {
          setDisplayValue(String(value))
        }
      }
    }, [value, isFocused])

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(true)
      // Auto-clear zero if configured and value is 0 or "0"
      if (clearOnFocusIfZero && (displayValue === '0' || value === 0 || value === '0')) {
        setDisplayValue('')
      }
      if (onFocus) onFocus(e)
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value

      // Validation logic: allow empty string
      if (raw === '') {
        setDisplayValue('')
        emitChange('', 0, e)
        return
      }

      // Regex validation for decimals and optional negative
      let regex: RegExp
      if (allowDecimals && allowNegative) {
        regex = /^-?\d*\.?\d*$/
      } else if (allowDecimals) {
        regex = /^\d*\.?\d*$/
      } else if (allowNegative) {
        regex = /^-?\d*$/
      } else {
        regex = /^\d*$/
      }

      if (!regex.test(raw)) {
        return // Reject invalid input like 'abc', '12..2', '--5'
      }

      setDisplayValue(raw)

      // Calculate numeric parsed value
      let numericValue: number | string = 0
      if (raw === '-' || raw === '.') {
        numericValue = 0
      } else {
        const parsed = parseFloat(raw)
        numericValue = isNaN(parsed) ? 0 : parsed
      }

      emitChange(raw, numericValue, e)
    }

    const emitChange = (strVal: string, numVal: number, originalEvent: React.ChangeEvent<HTMLInputElement>) => {
      if (onValueChange) {
        onValueChange(strVal === '' ? '' : numVal)
      }

      if (onChange) {
        // Construct a synthetic event that works both with standard e.target.value string and parsed number handlers
        const syntheticEvent = {
          ...originalEvent,
          target: {
            ...originalEvent.target,
            name: name || originalEvent.target.name,
            value: strVal === '' ? '' : strVal,
            valueAsNumber: numVal,
          },
        }
        onChange(syntheticEvent)
      }
    }

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(false)

      // Clean up trailing decimal point on blur
      let finalDisplay = displayValue
      if (finalDisplay.endsWith('.')) {
        finalDisplay = finalDisplay.slice(0, -1)
        setDisplayValue(finalDisplay)
      }

      if (finalDisplay === '' || finalDisplay === '-') {
        // If empty on blur and min or default is specified, format or leave as string
        if (props.required || (min !== undefined && Number(min) > 0)) {
          const fallback = min !== undefined ? String(min) : '0'
          setDisplayValue(fallback)
          emitChange(fallback, Number(fallback), e as any)
        }
      }

      if (onBlur) onBlur(e)
    }

    return (
      <div className="flex flex-col gap-1 w-full text-left">
        {label && (
          <label className="text-xs font-medium select-none text-[#344054]">
            {label}
          </label>
        )}
        <div className="relative group w-full">
          <input
            ref={ref}
            type="text"
            inputMode={allowDecimals ? 'decimal' : 'numeric'}
            name={name}
            value={displayValue}
            onChange={handleChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholder={placeholder ?? '0'}
            className={`w-full h-[40px] border px-3 py-2 text-sm transition-all placeholder:text-[#98A2B3] focus:outline-none focus:border-[#1A56DB] focus:ring-1 focus:ring-[#1A56DB] focus:shadow-[0_0_0_2px_rgba(26,86,219,0.15)] rounded-[8px] bg-white text-slate-900 border-[#D0D5DD] ${
              error ? 'border-red-500 ring-1 ring-red-500' : ''
            } ${icon ? 'pr-10' : ''} ${className}`}
            {...props}
          />
          {icon && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-hydro-navy transition-colors select-none">
              {icon}
            </div>
          )}
        </div>
        {error && (
          <span className="text-[10px] font-semibold text-red-500 select-none">
            {error}
          </span>
        )}
      </div>
    )
  }
)

EnterpriseNumberInput.displayName = 'EnterpriseNumberInput'

export default EnterpriseNumberInput
