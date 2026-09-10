'use client'

import React, { useState, useRef, useEffect, useMemo } from 'react'
import { X, Search, ChevronDown, Building2 } from 'lucide-react'
import type { Department } from '@/types/departments'

interface CoDepartmentPickerProps {
  departments: Department[]
  mainDepartmentId?: string | null
  value: string[] // Array of department IDs
  onChange: (newCoDeptIds: string[]) => void
  disabled?: boolean
  readOnly?: boolean
  placeholder?: string
}

export function CoDepartmentPicker({
  departments,
  mainDepartmentId,
  value = [],
  onChange,
  disabled = false,
  readOnly = false,
  placeholder = 'Tìm và chọn đơn vị phối hợp...',
}: CoDepartmentPickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Filter available departments (exclude main department AND already-selected ones)
  const availableDepts = useMemo(() => {
    return departments.filter(
      d => d.id !== mainDepartmentId && !value.includes(d.id)
    )
  }, [departments, mainDepartmentId, value])

  // Selected department objects
  const selectedDepts = useMemo(() => {
    return value
      .map(id => departments.find(d => d.id === id))
      .filter((d): d is Department => Boolean(d))
  }, [value, departments])

  // Filtered dropdown options based on search query
  const filteredDepts = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return availableDepts
    return availableDepts.filter(d =>
      d.name.toLowerCase().includes(q) ||
      (d.code && d.code.toLowerCase().includes(q))
    )
  }, [availableDepts, search])

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

  const handleAddDept = (deptId: string) => {
    if (disabled || readOnly) return
    if (!value.includes(deptId)) {
      onChange([...value, deptId])
    }
    setSearch('')
    if (inputRef.current) {
      inputRef.current.focus()
    }
  }

  const handleRemove = (deptId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    if (disabled || readOnly) return
    onChange(value.filter(id => id !== deptId))
  }

  if (readOnly) {
    if (selectedDepts.length === 0) {
      return <span className="text-xs text-slate-400 italic">Chưa có đơn vị phối hợp</span>
    }
    return (
      <div className="flex flex-wrap gap-1.5 py-1">
        {selectedDepts.map(d => (
          <span
            key={d.id}
            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-medium bg-indigo-50 text-indigo-800 border border-indigo-200"
          >
            <Building2 className="w-3 h-3 text-indigo-500" />
            <span>{d.name}</span>
          </span>
        ))}
      </div>
    )
  }

  return (
    <div ref={containerRef} className="relative w-full flex flex-col gap-1.5">
      {/* Selected Pills */}
      {selectedDepts.length > 0 && (
        <div className="flex flex-wrap gap-1.5 p-1.5 rounded-md bg-slate-50 border border-slate-200/80 min-h-[34px] items-center">
          {selectedDepts.map(d => (
            <span
              key={d.id}
              className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded text-xs font-semibold bg-white text-indigo-700 border border-indigo-200 shadow-2xs group transition-all"
            >
              <span className="truncate max-w-[150px]">{d.name}</span>
              {!disabled && (
                <button
                  type="button"
                  onClick={(e) => handleRemove(d.id, e)}
                  className="p-0.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer"
                  title={`Gỡ ${d.name}`}
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </span>
          ))}
          <span className="text-[11px] text-slate-400 ml-auto font-mono px-1">
            ({selectedDepts.length})
          </span>
        </div>
      )}

      {/* Search Input & Trigger */}
      <div
        onClick={() => {
          if (!disabled) {
            setIsOpen(true)
            inputRef.current?.focus()
          }
        }}
        className={`flex items-center gap-2 px-2.5 py-1.5 bg-white border rounded-md text-xs cursor-text transition-colors shadow-2xs ${
          isOpen
            ? 'border-indigo-500 ring-1 ring-indigo-500/20'
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
          placeholder={selectedDepts.length === 0 ? placeholder : '+ Thêm đơn vị khác...'}
          className="flex-1 bg-transparent border-none outline-none text-xs text-slate-800 placeholder:text-slate-400 min-w-[100px]"
        />
        {search && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setSearch('')
            }}
            className="p-0.5 text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <X className="w-3 h-3" />
          </button>
        )}
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform ${
            isOpen ? 'rotate-180 text-indigo-600' : ''
          }`}
        />
      </div>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-56 overflow-y-auto p-1 flex flex-col gap-0.5 animate-in fade-in-50 duration-100">
          {filteredDepts.length === 0 ? (
            <div className="px-3 py-2.5 text-xs text-slate-400 text-center italic">
              {search ? 'Không tìm thấy đơn vị phù hợp' : 'Đã chọn tất cả đơn vị'}
            </div>
          ) : (
            filteredDepts.map(d => (
              <div
                key={d.id}
                onClick={() => handleAddDept(d.id)}
                className="shrink-0 min-h-[32px] flex items-center px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer select-none transition-colors text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 leading-normal"
              >
                <span className="truncate">{d.name}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
