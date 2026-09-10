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
  {
    name: 'Kiểm tra an toàn phẫu thuật (Surgical Safety Checklist)',
    description: 'Bảng kiểm an toàn phẫu thuật theo chuẩn WHO (Sign In, Time Out, Sign Out)',
    category: 'Ngoại khoa & GMHS',
    defaults: {
      priority: 'urgent',
      departmentId: null,
      tagIds: [],
    },
    createdBy: 'system',
    steps: [
      { order: 1, title: 'Sign In (Trước khi gây mê): Xác nhận danh tính NB, vị trí phẫu thuật, cam kết, kiểm tra máy mê & dị ứng', description: null, defaultAssigneeRole: 'Bác sĩ GMHS / Điều dưỡng', estimatedMinutes: 10, dependsOnStepOrder: null },
      { order: 2, title: 'Time Out (Trước khi rạch da): Toàn kíp dừng lại xác nhận tên người bệnh, phẫu thuật viên, dự kiến thời gian & kháng sinh dự phòng', description: null, defaultAssigneeRole: 'Kíp mổ', estimatedMinutes: 5, dependsOnStepOrder: 1 },
      { order: 3, title: 'Sign Out (Trước khi rời phòng mổ): Đếm gạc & dụng cụ, dán nhãn bệnh phẩm, ghi nhận sự cố & kế hoạch hồi tỉnh', description: null, defaultAssigneeRole: 'Điều dưỡng dụng cụ', estimatedMinutes: 10, dependsOnStepOrder: 2 },
    ],
  },
  {
    name: 'Báo cáo sự cố y khoa & hành động khắc phục',
    description: 'Quy trình tiếp nhận, xác minh, đánh giá mức độ và xử lý sự cố y khoa theo Thông tư 43/BYT',
    category: 'Quản lý chất lượng',
    defaults: {
      priority: 'high',
      departmentId: null,
      tagIds: [],
    },
    createdBy: 'system',
    steps: [
      { order: 1, title: 'Tiếp nhận phiếu báo cáo sự cố & ghi nhận thông tin ban đầu', description: null, defaultAssigneeRole: 'Tổ QLCL', estimatedMinutes: 20, dependsOnStepOrder: null },
      { order: 2, title: 'Xác minh hiện trường, phỏng vấn nhân chứng & thu thập hồ sơ bệnh án', description: null, defaultAssigneeRole: 'Chuyên viên QLCL', estimatedMinutes: 60, dependsOnStepOrder: 1 },
      { order: 3, title: 'Họp hội đồng chuyên môn phân tích nguyên nhân gốc rễ (RCA)', description: null, defaultAssigneeRole: 'Hội đồng chuyên môn', estimatedMinutes: 90, dependsOnStepOrder: 2 },
      { order: 4, title: 'Ban hành kết luận, biện pháp khắc phục & báo cáo Ban Giám đốc', description: null, defaultAssigneeRole: 'Trưởng phòng KHNV', estimatedMinutes: 45, dependsOnStepOrder: 3 },
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
