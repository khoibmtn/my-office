'use client'

import React, { useState, useRef, useEffect, useMemo } from 'react'
import { X, Search, ChevronDown, User, Check, Users } from 'lucide-react'
import type { StaffMember } from '@/types'

interface CoAssigneePickerProps {
  allStaff: StaffMember[]
  mainAssigneeId?: string
  value: string[] // Array of staff IDs
  onChange: (newCoAssigneeIds: string[]) => void
  disabled?: boolean
  readOnly?: boolean
  placeholder?: string
}

export function CoAssigneePicker({
  allStaff,
  mainAssigneeId,
  value = [],
  onChange,
  disabled = false,
  readOnly = false,
  placeholder = 'Tìm và chọn người phối hợp...',
}: CoAssigneePickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Filter available active staff (exclude main assignee)
  const availableStaff = useMemo(() => {
    return allStaff.filter(s => s.isActive && s.id !== mainAssigneeId)
  }, [allStaff, mainAssigneeId])

  // Selected staff objects
  const selectedStaff = useMemo(() => {
    return value
      .map(id => allStaff.find(s => s.id === id))
      .filter((s): s is StaffMember => Boolean(s))
  }, [value, allStaff])

  // Filtered dropdown options based on search query
  const filteredStaff = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return availableStaff
    return availableStaff.filter(s =>
      s.shortName.toLowerCase().includes(q) ||
      s.fullName.toLowerCase().includes(q) ||
      (s.nickname && s.nickname.toLowerCase().includes(q)) ||
      (s.position && s.position.toLowerCase().includes(q)) ||
      (s.title && s.title.toLowerCase().includes(q))
    )
  }, [availableStaff, search])

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleToggleStaff = (staffId: string) => {
    if (disabled || readOnly) return
    const isSelected = value.includes(staffId)
    const next = isSelected
      ? value.filter(id => id !== staffId)
      : [...value, staffId]
    onChange(next)
    setSearch('')
    // Keep focus on input to allow quickly picking multiple staff
    if (inputRef.current) {
      inputRef.current.focus()
    }
  }

  const handleRemove = (staffId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    if (disabled || readOnly) return
    onChange(value.filter(id => id !== staffId))
  }

  if (readOnly) {
    if (selectedStaff.length === 0) {
      return <span className="text-xs text-slate-400 italic">Chưa có người phối hợp</span>
    }
    return (
      <div className="flex flex-wrap gap-1.5 py-1">
        {selectedStaff.map(s => (
          <span
            key={s.id}
            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-medium bg-blue-50 text-blue-800 border border-blue-200"
          >
            <User className="w-3 h-3 text-blue-500" />
            <span>{s.shortName}</span>
          </span>
        ))}
      </div>
    )
  }

  return (
    <div ref={containerRef} className="relative w-full flex flex-col gap-1.5">
      {/* Selected Tag Pills Area */}
      {selectedStaff.length > 0 && (
        <div className="flex flex-wrap gap-1.5 p-1.5 rounded-md bg-slate-50 border border-slate-200/80 min-h-[34px] items-center">
          {selectedStaff.map(s => (
            <span
              key={s.id}
              className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded text-xs font-semibold bg-white text-blue-700 border border-blue-200 shadow-2xs group transition-all"
            >
              <span className="truncate max-w-[120px]">{s.shortName}</span>
              {!disabled && (
                <button
                  type="button"
                  onClick={(e) => handleRemove(s.id, e)}
                  className="p-0.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                  title={`Gỡ ${s.shortName}`}
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </span>
          ))}
          <span className="text-[11px] text-slate-400 ml-auto font-mono px-1">
            ({selectedStaff.length})
          </span>
        </div>
      )}

      {/* Combobox Search Input & Trigger */}
      <div
        onClick={() => {
          if (!disabled) {
            setIsOpen(true)
            inputRef.current?.focus()
          }
        }}
        className={`flex items-center gap-2 px-2.5 py-1.5 bg-white border rounded-md text-xs cursor-text transition-colors shadow-2xs ${
          isOpen
            ? 'border-blue-500 ring-1 ring-blue-500/20'
            : 'border-slate-200 hover:border-slate-300'
        } ${disabled ? 'bg-slate-50 opacity-60 cursor-not-allowed' : ''}`}
      >
        <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={search}
          disabled={disabled}
          onChange={(e) => {
            setSearch(e.target.value)
            if (!isOpen) setIsOpen(true)
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={selectedStaff.length === 0 ? placeholder : '+ Thêm người khác...'}
          className="flex-1 bg-transparent border-none outline-none text-xs text-slate-800 placeholder:text-slate-400 min-w-[100px]"
        />
        {search && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setSearch('')
            }}
            className="p-0.5 text-slate-400 hover:text-slate-600"
          >
            <X className="w-3 h-3" />
          </button>
        )}
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform ${
            isOpen ? 'rotate-180 text-blue-600' : ''
          }`}
        />
      </div>

      {/* Dropdown List */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-52 overflow-y-auto p-1 flex flex-col gap-0.5 animate-in fade-in-50 duration-100">
          {filteredStaff.length === 0 ? (
            <div className="px-3 py-3 text-xs text-slate-400 text-center italic">
              {search ? 'Không tìm thấy nhân viên' : 'Không có nhân viên khả dụng'}
            </div>
          ) : (
            filteredStaff.map(s => {
              const isSelected = value.includes(s.id)
              return (
                <div
                  key={s.id}
                  onClick={() => handleToggleStaff(s.id)}
                  className={`flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs cursor-pointer select-none transition-colors ${
                    isSelected
                      ? 'bg-blue-50 text-blue-800 font-medium'
                      : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div
                      className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                        isSelected ? 'bg-blue-200 text-blue-800' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {s.shortName.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="truncate font-semibold">{s.shortName}</span>
                      <span className="text-[10px] text-slate-400 truncate">{s.fullName}</span>
                    </div>
                  </div>

                  {isSelected ? (
                    <span className="inline-flex items-center gap-1 text-[11px] text-blue-600 font-bold shrink-0 ml-2">
                      <Check className="w-3.5 h-3.5" />
                      <span>Đã chọn</span>
                    </span>
                  ) : (
                    <span className="text-[11px] text-slate-400 group-hover:text-slate-600 shrink-0 ml-2">
                      + Chọn
                    </span>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
