/**
 * TaskTemplate queries, mutations, and default templates.
 */

import {
  collection, doc, getDocs, query, where, orderBy,
  addDoc, updateDoc, serverTimestamp, type Query, type DocumentData
} from 'firebase/firestore'
import { db } from '../firebase'
import type { TaskTemplate } from '@/types/tasks'

const TEMPLATES_COLLECTION = 'taskTemplates'

export const DEFAULT_TEMPLATES: Omit<TaskTemplate, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: 'Xử lý công văn đến',
    description: 'Quy trình tiếp nhận, xử lý và phúc đáp công văn theo tiêu chuẩn hành chính bệnh viện',
    category: 'Hành chính',
    defaults: {
      priority: 'normal',
      departmentId: null,
      tagIds: [],
    },
    createdBy: 'system',
    steps: [
      { order: 1, title: 'Tiếp nhận & vào sổ công văn đến', description: null, defaultAssigneeRole: 'Văn thư', estimatedMinutes: 15, dependsOnStepOrder: null },
      { order: 2, title: 'Báo cáo Lãnh đạo cho ý kiến chỉ đạo', description: null, defaultAssigneeRole: 'Văn thư', estimatedMinutes: 30, dependsOnStepOrder: 1 },
      { order: 3, title: 'Chuyển giao cho khoa/phòng chuyên môn', description: null, defaultAssigneeRole: 'Chuyên viên', estimatedMinutes: 15, dependsOnStepOrder: 2 },
      { order: 4, title: 'Dự thảo văn bản xử lý / trả lời', description: null, defaultAssigneeRole: 'Chuyên viên', estimatedMinutes: 45, dependsOnStepOrder: 3 },
      { order: 5, title: 'Trình ký, đóng dấu & phát hành', description: null, defaultAssigneeRole: 'Văn thư', estimatedMinutes: 15, dependsOnStepOrder: 4 },
    ],
  },
  {
    name: 'Tổng hợp báo cáo giao ban tuần',
    description: 'Thu thập số liệu, biên soạn và chuẩn bị báo cáo phục vụ giao ban đầu tuần',
    category: 'Báo cáo',
    defaults: {
      priority: 'high',
      departmentId: null,
      tagIds: [],
    },
    createdBy: 'system',
    steps: [
      { order: 1, title: 'Đôn đốc các khoa/phòng nộp báo cáo số liệu', description: null, defaultAssigneeRole: null, estimatedMinutes: 20, dependsOnStepOrder: null },
      { order: 2, title: 'Tổng hợp số liệu khám chữa bệnh & sự cố', description: null, defaultAssigneeRole: null, estimatedMinutes: 30, dependsOnStepOrder: 1 },
      { order: 3, title: 'Biên soạn slide trình chiếu giao ban', description: null, defaultAssigneeRole: null, estimatedMinutes: 25, dependsOnStepOrder: 2 },
      { order: 4, title: 'Trưởng phòng duyệt nội dung báo cáo', description: null, defaultAssigneeRole: 'Trưởng phòng', estimatedMinutes: 15, dependsOnStepOrder: 3 },
    ],
  },
  {
    name: 'Kiểm tra an toàn & kiểm soát nhiễm khuẩn',
    description: 'Quy trình kiểm tra định kỳ tuân thủ an toàn người bệnh và quy chế vô khuẩn',
    category: 'Chuyên môn',
    defaults: {
      priority: 'normal',
      departmentId: null,
      tagIds: [],
    },
    createdBy: 'system',
    steps: [
      { order: 1, title: 'Lập danh mục checklist kiểm tra theo khoa', description: null, defaultAssigneeRole: null, estimatedMinutes: 30, dependsOnStepOrder: null },
      { order: 2, title: 'Kiểm tra thực tế tại buồng bệnh & phòng thủ thuật', description: null, defaultAssigneeRole: null, estimatedMinutes: 90, dependsOnStepOrder: 1 },
      { order: 3, title: 'Lập biên bản ghi nhận và phản hồi khoa phòng', description: null, defaultAssigneeRole: null, estimatedMinutes: 30, dependsOnStepOrder: 2 },
      { order: 4, title: 'Theo dõi tiến độ khắc phục tồn tại', description: null, defaultAssigneeRole: null, estimatedMinutes: 30, dependsOnStepOrder: 3 },
    ],
  },
]

export function queryActiveTemplates(): Query<DocumentData> {
  return query(
    collection(db(), TEMPLATES_COLLECTION),
    orderBy('createdAt', 'desc')
  )
}

export async function fetchOrCreateDefaultTemplates(): Promise<TaskTemplate[]> {
  try {
    const snap = await getDocs(queryActiveTemplates())
    if (!snap.empty) {
      return snap.docs.map(d => ({ id: d.id, ...d.data() })) as TaskTemplate[]
    }
  } catch (e) {
    // If order index fails or first load, fallback to simple getDocs
    const fallbackSnap = await getDocs(collection(db(), TEMPLATES_COLLECTION))
    if (!fallbackSnap.empty) {
      return fallbackSnap.docs.map(d => ({ id: d.id, ...d.data() })) as TaskTemplate[]
    }
  }

  // Seed defaults
  const created: TaskTemplate[] = []
  for (const def of DEFAULT_TEMPLATES) {
    const docRef = await addDoc(collection(db(), TEMPLATES_COLLECTION), {
      ...def,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    created.push({ id: docRef.id, ...def } as any)
  }
  return created
}
