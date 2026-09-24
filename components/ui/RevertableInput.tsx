'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { X } from 'lucide-react'

/**
 * RevertableInput — text input that reverts to the "committed" (saved) value
 * when the user presses ESC or clicks the X button while editing.
 * 
 * The "committed" value is the `value` prop at the time the input first gained focus.
 * If the user hasn't changed the value from the committed value, X clears the field.
 */
export function RevertableInput({
  value,
  onChange,
  placeholder,
  className = '',
  id,
  required,
  type = 'text',
  multiline = false,
  rows = 1,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
  id?: string
  required?: boolean
  type?: string
  multiline?: boolean
  rows?: number
}) {
  const [committedValue, setCommittedValue] = useState(value)
  const [isFocused, setIsFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null)

  // Update committed value when value changes from outside (e.g. form data loaded)
  useEffect(() => {
    if (!isFocused) {
      setCommittedValue(value)
    }
  }, [value, isFocused])

  const handleFocus = useCallback(() => {
    setIsFocused(true)
    setCommittedValue(value) // snapshot at focus time
  }, [value])

  const handleBlur = useCallback(() => {
    setIsFocused(false)
    setCommittedValue(value) // accept whatever we have
  }, [value])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      if (value !== committedValue) {
        // Revert to committed value
        onChange(committedValue)
      } else {
        // Already at committed value, just blur
        inputRef.current?.blur()
      }
    }
  }, [value, committedValue, onChange])

  const handleClear = useCallback(() => {
    if (value !== committedValue && committedValue) {
      // Revert to committed value
      onChange(committedValue)
    } else {
      // Clear the field
      onChange('')
    }
  }, [value, committedValue, onChange])

  const showClear = value.length > 0

  const baseClassName = `w-full text-xs border border-slate-200 rounded-md bg-white px-2.5 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all ${className}`

  if (multiline) {
    return (
      <div className="relative">
        <textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          required={required}
          rows={rows}
          className={`${baseClassName} py-2 pr-7 resize-none leading-snug`}
          style={{ minHeight: '36px', overflow: 'hidden' }}
          onInput={(e) => {
            const el = e.target as HTMLTextAreaElement
            el.style.height = 'auto'
            el.style.height = el.scrollHeight + 'px'
          }}
        />
        {showClear && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2 top-2 text-slate-400 hover:text-slate-600 transition-colors"
            title={value !== committedValue && committedValue ? 'Khôi phục giá trị trước đó' : 'Xóa'}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="relative">
      <input
        ref={inputRef as React.RefObject<HTMLInputElement>}
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        required={required}
        className={`${baseClassName} h-9 pr-7`}
      />
      {showClear && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
          title={value !== committedValue && committedValue ? 'Khôi phục giá trị trước đó' : 'Xóa'}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  )
}
