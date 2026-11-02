'use client'

import React, { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Loader2, User, Users, AlertCircle, FileText,
  Building2, Filter, ArrowRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useRole } from '@/hooks/useRole'
import {
  useTasks,
  isVisibleTask,
  computeTaskStats,
  filterTasksByParams,
  toMillis,
} from '@/hooks/useTasks'
import { useStaff } from '@/hooks/useStaff'
import { useOrganization } from '@/hooks/useOrganization'
import { useDocuments } from '@/hooks/useDocuments'
import { checkPermissionForRole } from '@/lib/permissions'
import { TaskDashboard, buildTasksFilterHref } from '@/components/tasks/TaskDashboard'
import { TaskTable } from '@/components/tasks/TaskTable'

function formatShortDate(val: unknown): string {
  const ms = toMillis(val)
  if (ms === null) return '—'
  return new Date(ms).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export default function DashboardPage() {
  const router = useRouter()
  const { role, staffId, staffName, isAdmin, isTruongPhong, isPhoPhong } = useRole()
  const { staff: staffList, getStaffName } = useStaff()
  const { departments, currentStaff, hasPermission, permissionMatrix } = useOrganization()
  const { documents } = useDocuments()
  const { tasks: allTasks, loading } = useTasks({ view: 'all' })

  // Keep `now` in state and refresh every 60s so `useMemo` hooks don't recalculate on every render
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(timer)
  }, [])

  // Check `org:manage_staff` permission for the "Quản lý nhân sự" button
  const canManageStaff = useMemo(() => {
    if (isAdmin) return true
    return (
      hasPermission('org:manage_staff') ||
      checkPermissionForRole(permissionMatrix, role, 'org:manage_staff')
    )
  }, [isAdmin, hasPermission, permissionMatrix, role])

  const isDepartmentLeader = useMemo(() => {
    return !isAdmin && (isTruongPhong || isPhoPhong || role === 'truong_phong' || role === 'pho_phong')
  }, [isAdmin, isTruongPhong, isPhoPhong, role])

  // View mode toggle: 'manager' (scoped by role) vs 'personal' (own tasks only)
  const [viewMode, setViewMode] = useState<'personal' | 'manager'>('manager')
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string>('all')

  // Current staff's department IDs (for truong_phong / pho_phong scoping, supports >=2 departments)
  const myDepartmentIds = useMemo(() => {
    const ids = new Set<string>()
    if (currentStaff?.primaryDepartmentId) ids.add(currentStaff.primaryDepartmentId)
    currentStaff?.departmentIds?.forEach((id) => {
      if (id) ids.add(id)
    })
    if (staffId) {
      departments.forEach((d) => {
        if (d.headStaffId === staffId || d.deputyStaffIds?.includes(staffId)) {
          ids.add(d.id)
        }
      })
    }
    return Array.from(ids)
  }, [currentStaff, staffId, departments])

  const isPersonalScope = viewMode === 'personal' || (!isAdmin && !isDepartmentLeader)
  const activeAssigneeParam = isPersonalScope ? staffId || '__none__' : undefined
  const activeIncludeCollaborator = isPersonalScope
  const baseDeptParam =
    !isPersonalScope && isDepartmentLeader
      ? myDepartmentIds.length > 0
        ? myDepartmentIds.join(',')
        : '__none__'
      : undefined

  // Step 1: filter visible top-level tasks (not deleted, visibleFrom <= now, parentTaskId == null)
  const visibleTasks = useMemo(() => {
    return allTasks.filter((t) => isVisibleTask(t, now))
  }, [allTasks, now])

  // Step 2: scope tasks by role using exact same filter helper as /tasks page
  const scopedTasks = useMemo(() => {
    return filterTasksByParams(
      visibleTasks,
      {
        assigneeId: activeAssigneeParam,
        includeCollaborator: activeIncludeCollaborator,
        departmentId: baseDeptParam,
      },
      now
    )
  }, [visibleTasks, activeAssigneeParam, activeIncludeCollaborator, baseDeptParam, now])

  // Scoped departments for department breakdown & filter dropdown
  const scopedDepartments = useMemo(() => {
    if (isAdmin && !isPersonalScope) {
      return departments
    }
    if (isDepartmentLeader && !isPersonalScope) {
      return departments.filter((d) => myDepartmentIds.includes(d.id))
    }
    return departments.filter(
      (d) =>
        myDepartmentIds.includes(d.id) ||
        scopedTasks.some((t) => (t.departmentId || t.assigneeDepartmentId) === d.id)
    )
  }, [departments, isAdmin, isDepartmentLeader, isPersonalScope, myDepartmentIds, scopedTasks])

  // Block 1: Main stats computed via pure helper `computeTaskStats`
  const dashboardStats = useMemo(() => {
    return computeTaskStats(scopedTasks, now)
  }, [scopedTasks, now])

  const personTableDeptParam =
    selectedDeptFilter !== 'all' ? selectedDeptFilter : baseDeptParam

  // Block 2: "Quá hạn & sắp đến hạn theo người" (người, số quá hạn, số đến hạn 7 ngày, đang mở)
  const byPersonRows = useMemo(() => {
    const activeStaff = staffList.filter((s) => {
      if (!s.isActive) return false
      if (isPersonalScope) {
        return s.id === staffId
      }
      if (isDepartmentLeader) {
        const inMyDept =
          (s.primaryDepartmentId && myDepartmentIds.includes(s.primaryDepartmentId)) ||
          Boolean(s.departmentIds?.some((d) => myDepartmentIds.includes(d))) ||
          scopedTasks.some((t) => t.assigneeId === s.id)
        if (!inMyDept) return false
      }
      if (selectedDeptFilter !== 'all') {
        return (
          s.primaryDepartmentId === selectedDeptFilter ||
          Boolean(s.departmentIds?.includes(selectedDeptFilter))
        )
      }
      return true
    })

    return activeStaff
      .map((s) => {
        const assigned = filterTasksByParams(
          visibleTasks,
          {
            assigneeId: s.id,
            includeCollaborator: activeIncludeCollaborator,
            departmentId: personTableDeptParam,
          },
          now
        )
        const sStats = computeTaskStats(assigned, now)
        const deptId = s.primaryDepartmentId || (s.departmentIds && s.departmentIds[0]) || null
        const deptName = departments.find((d) => d.id === deptId)?.name || 'Chưa xếp'

        return {
          staff: s,
          deptId,
          deptName,
          overdue: sStats.overdue,
          due7: sStats.dueIn7Days,
          open: sStats.open,
          inProgress: sStats.inProgress,
          completed: sStats.completed,
          completionRate: sStats.completionRate,
        }
      })
      .sort((a, b) => {
        if (b.overdue !== a.overdue) return b.overdue - a.overdue
        if (b.due7 !== a.due7) return b.due7 - a.due7
        return b.open - a.open
      })
  }, [
    staffList,
    isPersonalScope,
    isDepartmentLeader,
    staffId,
    myDepartmentIds,
    scopedTasks,
    selectedDeptFilter,
    visibleTasks,
    activeIncludeCollaborator,
    personTableDeptParam,
    now,
    departments,
  ])

  // Block 3: "Quá hạn & sắp đến hạn theo khoa" (dùng departmentId, fallback assigneeDepartmentId)
  const byDepartmentRows = useMemo(() => {
    return scopedDepartments
      .map((dept) => {
        const deptTasks = filterTasksByParams(
          visibleTasks,
          {
            departmentId: dept.id,
            assigneeId: activeAssigneeParam,
            includeCollaborator: activeIncludeCollaborator,
          },
          now
        )
        const dStats = computeTaskStats(deptTasks, now)
        return {
          dept,
          overdue: dStats.overdue,
          due7: dStats.dueIn7Days,
          open: dStats.open,
          inProgress: dStats.inProgress,
          completed: dStats.completed,
          total: dStats.total,
          completionRate: dStats.completionRate,
        }
      })
      .sort((a, b) => {
        if (b.overdue !== a.overdue) return b.overdue - a.overdue
        if (b.due7 !== a.due7) return b.due7 - a.due7
        return b.open - a.open
      })
  }, [scopedDepartments, visibleTasks, activeAssigneeParam, activeIncludeCollaborator, now])

  // Block 4: "Văn bản quá hạn" từ useDocuments() (deadline < now && status !== 'completed')
  const overdueDocuments = useMemo(() => {
    return documents
      .filter((doc) => {
        if (doc.status === 'completed') return false
        const deadlineMs = toMillis(doc.deadline)
        if (deadlineMs === null || deadlineMs >= now) return false

        if (isPersonalScope) {
          if (!staffId) return false
          return (
            doc.assigneeId === staffId ||
            Boolean(doc.coAssigneeIds?.includes(staffId)) ||
            Boolean(staffName && doc.assignee === staffName)
          )
        }

        if (isAdmin) return true

        if (isDepartmentLeader) {
          const checkStaffInMyDept = (sid?: string) => {
            if (!sid) return false
            const st = staffList.find((s) => s.id === sid)
            if (!st) return false
            return (
              Boolean(st.primaryDepartmentId && myDepartmentIds.includes(st.primaryDepartmentId)) ||
              Boolean(st.departmentIds?.some((d) => myDepartmentIds.includes(d)))
            )
          }
          if (checkStaffInMyDept(doc.assigneeId)) return true
          if (doc.coAssigneeIds?.some((cid) => checkStaffInMyDept(cid))) return true
          return false
        }

        return false
      })
      .sort((a, b) => (toMillis(a.deadline) ?? 0) - (toMillis(b.deadline) ?? 0))
  }, [
    documents,
    now,
    isPersonalScope,
    isAdmin,
    isDepartmentLeader,
    staffId,
    staffName,
    staffList,
    myDepartmentIds,
  ])

  // Overdue task list for quick action
  const overdueTaskList = useMemo(() => {
    return filterTasksByParams(
      scopedTasks,
      { status: 'overdue' },
      now
    )
  }, [scopedTasks, now])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header with Role Scope & View Mode Switch */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <span>📊</span>
            {isPersonalScope
              ? 'Tiến độ Công việc Cá nhân'
              : isAdmin
              ? 'Dashboard Điều hành Toàn đơn vị'
              : 'Dashboard Điều hành Khoa / Phòng'}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {isPersonalScope
              ? `Xin chào ${staffName || 'bạn'} • Theo dõi tiến độ và hạn xử lý công việc của bạn`
              : isAdmin
              ? 'Giám sát công việc quá hạn, sắp đến hạn theo nhân sự, khoa phòng và văn bản quá hạn toàn đơn vị'
              : 'Giám sát công việc quá hạn, sắp đến hạn của khoa/phòng phụ trách'}
          </p>
        </div>

        {/* View Mode Toggle — Nút "Quản lý nhân sự" chỉ hiện với quyền org:manage_staff */}
        {canManageStaff && (
          <div className="inline-flex bg-slate-100 p-1 rounded-xl border border-slate-200 self-start sm:self-auto shrink-0 shadow-2xs">
            <button
              onClick={() => setViewMode('personal')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'personal'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              Tiến độ cá nhân
            </button>
            <button
              onClick={() => setViewMode('manager')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'manager'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              Quản lý nhân sự
            </button>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* KHỐI 1: KHỐI THẺ SỐ LIỆU (Quá hạn / Đến hạn 7 ngày / Đang thực hiện / Hoàn thành tuần) */}
      {/* ========================================================================= */}
      <TaskDashboard
        stats={dashboardStats}
        assigneeId={activeAssigneeParam}
        includeCollaborator={activeIncludeCollaborator}
        departmentId={baseDeptParam}
      />

      {/* ========================================================================= */}
      {/* KHỐI 2: QUÁ HẠN & SẮP ĐẾN HẠN THEO KHOA (dùng departmentId, fallback assigneeDepartmentId) */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-indigo-600" />
              Quá hạn & sắp đến hạn theo khoa / phòng
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Bấm vào từng con số để mở danh sách công việc theo bộ lọc tương ứng
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                <th className="py-3 px-4">Khoa / Phòng</th>
                <th className="py-3 px-3 text-center">Quá hạn</th>
                <th className="py-3 px-3 text-center">Đến hạn 7 ngày</th>
                <th className="py-3 px-3 text-center">Đang mở</th>
                <th className="py-3 px-4 w-44">Tỷ lệ hoàn thành</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {byDepartmentRows.map((row) => (
                <tr key={row.dept.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-3 px-4 font-semibold text-slate-900 text-sm">
                    <Link
                      href={buildTasksFilterHref({
                        departmentId: row.dept.id,
                        assigneeId: activeAssigneeParam,
                        includeCollaborator: activeIncludeCollaborator,
                      })}
                      className="hover:text-blue-600 hover:underline"
                    >
                      {row.dept.name}
                    </Link>
                  </td>
                  <td className="py-3 px-3 text-center">
                    <Link
                      href={buildTasksFilterHref({
                        status: 'overdue',
                        departmentId: row.dept.id,
                        assigneeId: activeAssigneeParam,
                        includeCollaborator: activeIncludeCollaborator,
                      })}
                      className={`inline-block font-bold px-2.5 py-0.5 rounded-full transition-colors ${
                        row.overdue > 0
                          ? 'text-red-600 bg-red-50 border border-red-200 hover:bg-red-100'
                          : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {row.overdue}
                    </Link>
                  </td>
                  <td className="py-3 px-3 text-center">
                    <Link
                      href={buildTasksFilterHref({
                        status: 'due7',
                        departmentId: row.dept.id,
                        assigneeId: activeAssigneeParam,
                        includeCollaborator: activeIncludeCollaborator,
                      })}
                      className={`inline-block font-bold px-2.5 py-0.5 rounded-full transition-colors ${
                        row.due7 > 0
                          ? 'text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100'
                          : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {row.due7}
                    </Link>
                  </td>
                  <td className="py-3 px-3 text-center">
                    <Link
                      href={buildTasksFilterHref({
                        status: 'open',
                        departmentId: row.dept.id,
                        assigneeId: activeAssigneeParam,
                        includeCollaborator: activeIncludeCollaborator,
                      })}
                      className="inline-block font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 px-2.5 py-0.5 rounded-full transition-colors"
                    >
                      {row.open}
                    </Link>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            row.completionRate >= 80
                              ? 'bg-emerald-500'
                              : row.completionRate >= 50
                              ? 'bg-blue-600'
                              : 'bg-amber-500'
                          }`}
                          style={{ width: `${row.completionRate}%` }}
                        />
                      </div>
                      <span className="font-bold text-slate-700 min-w-[36px] text-right">
                        {row.completionRate}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
              {byDepartmentRows.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-slate-400">
                    Chưa có dữ liệu khoa/phòng trong phạm vi hiện tại
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* KHỐI 3: QUÁ HẠN & SẮP ĐẾN HẠN THEO NGƯỜI (người, số quá hạn, số đến hạn 7 ngày, đang mở) */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-600" />
              Quá hạn & sắp đến hạn theo người
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Theo dõi số việc quá hạn, đến hạn 7 ngày tới và việc đang mở của từng cán bộ
            </p>
          </div>

          {scopedDepartments.length > 1 && (
            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={selectedDeptFilter}
                onChange={(e) => setSelectedDeptFilter(e.target.value)}
                className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-slate-50 text-slate-700 font-medium"
              >
                <option value="all">Tất cả phòng ban</option>
                {scopedDepartments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                <th className="py-3 px-4">Người xử lý</th>
                <th className="py-3 px-3">Khoa / Phòng</th>
                <th className="py-3 px-3 text-center">Quá hạn</th>
                <th className="py-3 px-3 text-center">Đến hạn 7 ngày</th>
                <th className="py-3 px-3 text-center">Đang mở</th>
                <th className="py-3 px-4 w-40">Tỷ lệ hoàn thành</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {byPersonRows.map((item) => {
                return (
                  <tr key={item.staff.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4">
                      <Link
                        href={buildTasksFilterHref({
                          assigneeId: item.staff.id,
                          includeCollaborator: activeIncludeCollaborator,
                          departmentId: personTableDeptParam,
                        })}
                        className="flex items-center gap-2.5 group"
                      >
                        <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center shrink-0">
                          {item.staff.shortName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900 text-sm group-hover:text-blue-600 group-hover:underline">
                            {item.staff.fullName}
                          </div>
                          <div className="text-[11px] text-slate-400">@{item.staff.shortName}</div>
                        </div>
                      </Link>
                    </td>
                    <td className="py-3 px-3 text-slate-600 font-medium">{item.deptName}</td>
                    <td className="py-3 px-3 text-center">
                      <Link
                        href={buildTasksFilterHref({
                          status: 'overdue',
                          assigneeId: item.staff.id,
                          includeCollaborator: activeIncludeCollaborator,
                          departmentId: personTableDeptParam,
                        })}
                        className={`inline-block font-bold px-2.5 py-0.5 rounded-full transition-colors ${
                          item.overdue > 0
                            ? 'text-red-600 bg-red-50 border border-red-200 hover:bg-red-100'
                            : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {item.overdue}
                      </Link>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <Link
                        href={buildTasksFilterHref({
                          status: 'due7',
                          assigneeId: item.staff.id,
                          includeCollaborator: activeIncludeCollaborator,
                          departmentId: personTableDeptParam,
                        })}
                        className={`inline-block font-bold px-2.5 py-0.5 rounded-full transition-colors ${
                          item.due7 > 0
                            ? 'text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100'
                            : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {item.due7}
                      </Link>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <Link
                        href={buildTasksFilterHref({
                          status: 'open',
                          assigneeId: item.staff.id,
                          includeCollaborator: activeIncludeCollaborator,
                          departmentId: personTableDeptParam,
                        })}
                        className="inline-block font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 px-2.5 py-0.5 rounded-full transition-colors"
                      >
                        {item.open}
                      </Link>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              item.completionRate >= 80
                                ? 'bg-emerald-500'
                                : item.completionRate >= 50
                                ? 'bg-blue-600'
                                : 'bg-amber-500'
                            }`}
                            style={{ width: `${item.completionRate}%` }}
                          />
                        </div>
                        <span className="font-bold text-slate-700 min-w-[36px] text-right">
                          {item.completionRate}%
                        </span>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {byPersonRows.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    Không tìm thấy nhân sự phù hợp
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* KHỐI 4: VĂN BẢN QUÁ HẠN (từ useDocuments: deadline < now và status !== 'completed') */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-2xl border border-red-200 overflow-hidden shadow-2xs">
        <div className="p-4 border-b border-red-100 bg-red-50/40 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-red-700 flex items-center gap-2">
              <FileText className="w-4 h-4 text-red-600" />
              Văn bản quá hạn ({overdueDocuments.length})
            </h2>
            <p className="text-xs text-red-600/80 mt-0.5">
              Các văn bản đã quá hạn xử lý và chưa hoàn thành trong phạm vi theo dõi
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => router.push('/documents')}
            className="text-xs text-red-600 border-red-200 hover:bg-red-50"
          >
            Xem danh sách văn bản
            <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                <th className="py-3 px-4">Số hiệu / Trích yếu</th>
                <th className="py-3 px-3">Cơ quan ban hành</th>
                <th className="py-3 px-3">Người xử lý</th>
                <th className="py-3 px-3 text-right">Hạn xử lý</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {overdueDocuments.map((doc) => {
                const assigneeLabel =
                  (doc.assigneeId ? getStaffName(doc.assigneeId) : doc.assignee) || 'Chưa phân công'
                return (
                  <tr key={doc.id} className="hover:bg-red-50/30 transition-colors">
                    <td className="py-3 px-4">
                      <Link
                        href={`/documents/${doc.id}`}
                        className="font-semibold text-slate-900 hover:text-blue-600 hover:underline block"
                      >
                        {doc.docNumber ? `[${doc.docNumber}] ` : ''}
                        {doc.title}
                      </Link>
                    </td>
                    <td className="py-3 px-3 text-slate-600">{doc.sender || '—'}</td>
                    <td className="py-3 px-3">
                      {doc.assigneeId ? (
                        <Link
                          href={buildTasksFilterHref({
                            status: 'overdue',
                            assigneeId: doc.assigneeId,
                            departmentId: baseDeptParam,
                          })}
                          className="text-blue-600 font-medium hover:underline"
                        >
                          {assigneeLabel}
                        </Link>
                      ) : (
                        <span className="text-slate-600">{assigneeLabel}</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-red-600">
                      {formatShortDate(doc.deadline)}
                    </td>
                  </tr>
                )
              })}
              {overdueDocuments.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-slate-400">
                    Không có văn bản nào bị quá hạn
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Danh sách công việc quá hạn cần xử lý ngay */}
      {overdueTaskList.length > 0 && (
        <div className="bg-white rounded-2xl border border-red-200 p-4 sm:p-5 shadow-2xs">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-red-600 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600" />
              Danh sách công việc quá hạn cần đôn đốc ({overdueTaskList.length})
            </h2>
            <Link
              href={buildTasksFilterHref({
                status: 'overdue',
                assigneeId: activeAssigneeParam,
                includeCollaborator: activeIncludeCollaborator,
                departmentId: baseDeptParam,
              })}
            >
              <Button
                size="sm"
                variant="outline"
                className="text-xs text-red-600 border-red-200 hover:bg-red-50"
              >
                Xử lý ngay
              </Button>
            </Link>
          </div>
          <div className="rounded-xl border border-red-100 overflow-hidden">
            <TaskTable tasks={overdueTaskList} />
          </div>
        </div>
      )}
    </div>
  )
}
