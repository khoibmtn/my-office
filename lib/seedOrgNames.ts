// Seed default org names: Trung tâm Y tế Thủy Nguyên, Bệnh viện Đa khoa Thủy Nguyên
import { addOrgName, getOrgNames } from '@/lib/orgNames'

export async function seedOrgNames() {
  const existing = await getOrgNames()
  if (existing.length > 0) return // Already seeded

  const defaults = [
    'Trung tâm Y tế Thủy Nguyên',
    'Bệnh viện Đa khoa Thủy Nguyên',
  ]

  for (let i = 0; i < defaults.length; i++) {
    await addOrgName(defaults[i], i)
  }
}
