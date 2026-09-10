'use client'

import React, { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { Task } from '@/types/tasks'
import { TaskPriorityBadge } from './TaskPriorityBadge'
import { TASK_STATUS_COLORS } from '@/lib/tasks/constants'

interface TaskCalendarProps {
  tasks: Task[]
}

function toDate(timestamp: any): Date | null {
  if (!timestamp) return null
  return timestamp.toDate ? timestamp.toDate() : new Date(timestamp.seconds * 1000)
}

function isSameDay(d1: Date, d2: Date): boolean {
  return d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
}

const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']

export function TaskCalendar({ tasks }: TaskCalendarProps) {
  const router = useRouter()
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })

  const today = new Date()

  // Build calendar grid
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear()
    const month = currentMonth.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)

    // Adjust for Monday start (0=Mon, 6=Sun)
    let startOffset = firstDay.getDay() - 1
    if (startOffset < 0) startOffset = 6

    const days: { date: Date; isCurrentMonth: boolean }[] = []

    // Previous month padding
    for (let i = startOffset - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month, -i),
        isCurrentMonth: false,
      })
    }

    // Current month
    for (let d = 1; d <= lastDay.getDate(); d++) {
      days.push({ date: new Date(year, month, d), isCurrentMonth: true })
    }

    // Next month padding (fill to 42 = 6 rows)
    const remaining = 42 - days.length
    for (let d = 1; d <= remaining; d++) {
      days.push({
        date: new Date(year, month + 1, d),
        isCurrentMonth: false,
      })
    }

    return days
  }, [currentMonth])

  // Map tasks to dates by dueDate
  const tasksByDate = useMemo(() => {
    const map = new Map<string, Task[]>()
    tasks.forEach(task => {
      const due = toDate(task.dueDate)
      if (!due) return
      const key = `${due.getFullYear()}-${due.getMonth()}-${due.getDate()}`
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(task)
    })
    return map
  }, [tasks])

  const getTasksForDate = (date: Date): Task[] => {
    const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
    return tasksByDate.get(key) ?? []
  }

  const prevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))
  const nextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))
  const goToToday = () => setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1))

  const monthLabel = currentMonth.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' })

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
            <ChevronLeft className="w-4 h-4 text-slate-500" />
          </button>
          <h2 className="text-sm font-semibold text-slate-800 capitalize w-36 text-center">{monthLabel}</h2>
          <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
            <ChevronRight className="w-4 h-4 text-slate-500" />
          </button>
        </div>
        <button
          onClick={goToToday}
          className="text-xs text-blue-600 hover:bg-blue-50 px-2 py-1 rounded-lg transition-colors"
        >
          Hôm nay
        </button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 border-b border-slate-200">
        {WEEKDAYS.map(day => (
          <div key={day} className="text-center py-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7">
        {calendarDays.map(({ date, isCurrentMonth }, idx) => {
          const dayTasks = getTasksForDate(date)
          const isToday = isSameDay(date, today)
          const isWeekend = date.getDay() === 0 || date.getDay() === 6

          return (
            <div
              key={idx}
              className={`min-h-[90px] border-b border-r border-slate-100 p-1 ${
                !isCurrentMonth ? 'bg-slate-50/50' : ''
              } ${isWeekend && isCurrentMonth ? 'bg-amber-50/30' : ''}`}
            >
              {/* Day number */}
              <div className="flex justify-end mb-0.5">
                <span className={`text-xs w-6 h-6 flex items-center justify-center rounded-full ${
                  isToday ? 'bg-blue-500 text-white font-bold' :
                  isCurrentMonth ? 'text-slate-700' : 'text-slate-300'
                }`}>
                  {date.getDate()}
                </span>
              </div>

              {/* Task chips */}
              <div className="space-y-0.5">
                {dayTasks.slice(0, 3).map(task => {
                  const colors = TASK_STATUS_COLORS[task.status]
                  return (
                    <div
                      key={task.id}
                      onClick={() => router.push(`/tasks/${task.id}`)}
                      className={`text-[10px] px-1.5 py-0.5 rounded cursor-pointer truncate font-medium transition-all hover:opacity-80 ${colors.bg} ${colors.text}`}
                      title={task.title}
                    >
                      {task.title}
                    </div>
                  )
                })}
                {dayTasks.length > 3 && (
                  <div className="text-[9px] text-slate-400 text-center">
                    +{dayTasks.length - 3} nữa
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
