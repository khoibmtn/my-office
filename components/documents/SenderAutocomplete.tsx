'use client'

import React, { useState, useMemo, useEffect, useRef } from 'react'
import { X, Building2 } from 'lucide-react'
import { useDocuments } from '@/hooks/useDocuments'
import { useOrgNames } from '@/hooks/useOrgNames'

interface SenderAutocompleteProps {
  value: string
  onChange: (value: string) => void
  className?: string
}

export function SenderAutocomplete({ value, onChange, className }: SenderAutocompleteProps) {
  const [isFocused, setIsFocused] = useState(false)
  const [search, setSearch] = useState(value)
  // Track the "committed" value so ESC/X can revert
  const committedRef = useRef(value)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const { documents } = useDocuments()
  const { orgNames } = useOrgNames()

  // Sync external value changes
  useEffect(() => {
    setSearch(value)
    committedRef.current = value
  }, [value])

  // All unique senders from documents
  const allSenders = useMemo(() => {
    const set = new Set<string>()
    documents.forEach(d => {
      if (d.sender?.trim()) set.add(d.sender.trim())
    })
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'vi'))
  }, [documents])

  // Org name strings (for priority sorting)
  const orgNameStrings = useMemo(() => orgNames.map(n => n.name), [orgNames])

  // Filtered suggestions: org names first, then other senders
  const suggestions = useMemo(() => {
    const q = search.toLowerCase().trim()
    
    // Org names that match
    const matchedOrg = orgNameStrings.filter(name => 
      !q || name.toLowerCase().includes(q)
    )
    
    // Other senders (not in org names) that match
    const orgNamesLower = new Set(orgNameStrings.map(n => n.toLowerCase()))
    const matchedOther = allSenders.filter(s => {
      if (orgNamesLower.has(s.toLowerCase())) return false
      return !q || s.toLowerCase().includes(q)
    })

    return { orgNames: matchedOrg, others: matchedOther }
  }, [search, orgNameStrings, allSenders])

  const hasSuggestions = suggestions.orgNames.length > 0 || suggestions.others.length > 0

  // Revert to committed value
  const revert = () => {
    setSearch(committedRef.current)
    onChange(committedRef.current)
    setIsFocused(false)
  }

  // Close dropdown on click outside — also revert if user typed but didn't select
  useEffect(() => {
    if (!isFocused) return
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        // Commit whatever is typed (don't revert on click-away)
        committedRef.current = search
        setIsFocused(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [isFocused, search])

  const selectSender = (name: string) => {
    setSearch(name)
    onChange(name)
    committedRef.current = name
    setIsFocused(false)
  }

  // Handle keyboard
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      revert()
      inputRef.current?.blur()
    }
  }

  // Commit on blur (when focus leaves via Tab, etc.)
  const handleBlur = () => {
    // Small delay to allow dropdown click to register first
    setTimeout(() => {
      if (!wrapperRef.current?.contains(document.activeElement)) {
        committedRef.current = search
        setIsFocused(false)
      }
    }, 150)
  }

  return (
    <div ref={wrapperRef} className={`relative ${className || ''}`}>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            onChange(e.target.value)
            if (!isFocused) setIsFocused(true)
          }}
          onFocus={() => setIsFocused(true)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder="Nhập hoặc chọn cơ quan ban hành..."
          className="w-full h-9 text-xs pl-3 pr-8 border border-slate-200 rounded-md bg-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
          autoComplete="off"
        />
        {search && search !== committedRef.current && (
          <button
            type="button"
            onClick={revert}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-500 transition-colors"
            title="Hoàn tác (Esc)"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
        {search && search === committedRef.current && committedRef.current && (
          <button
            type="button"
            onClick={() => { setSearch(''); onChange(''); committedRef.current = '' }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
            title="Xóa"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Dropdown */}
      {isFocused && hasSuggestions && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-[220px] overflow-y-auto">
          {/* Org names section */}
          {suggestions.orgNames.length > 0 && (
            <>
              <div className="px-2.5 py-1.5 bg-blue-50/50 border-b border-slate-100 sticky top-0">
                <span className="text-[10px] font-semibold text-blue-600 uppercase tracking-wider flex items-center gap-1">
                  <Building2 className="w-3 h-3" /> Đơn vị
                </span>
              </div>
              {suggestions.orgNames.map(name => (
                <button
                  key={`org-${name}`}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => selectSender(name)}
                  className={`w-full text-left px-3 py-1.5 text-xs hover:bg-blue-50 transition-colors ${
                    committedRef.current === name ? 'bg-blue-50 font-semibold text-blue-700' : 'text-slate-700'
                  }`}
                >
                  {name}
                </button>
              ))}
            </>
          )}

          {/* Other senders */}
          {suggestions.others.length > 0 && (
            <>
              <div className="px-2.5 py-1.5 bg-slate-50 border-b border-slate-100 sticky top-0">
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Cơ quan khác</span>
              </div>
              {suggestions.others.map(name => (
                <button
                  key={`other-${name}`}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => selectSender(name)}
                  className={`w-full text-left px-3 py-1.5 text-xs hover:bg-slate-50 transition-colors ${
                    committedRef.current === name ? 'bg-blue-50 font-semibold text-blue-700' : 'text-slate-700'
                  }`}
                >
                  {name}
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}
