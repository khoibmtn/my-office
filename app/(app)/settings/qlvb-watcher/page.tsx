'use client'

import { useCallback, useEffect, useState } from 'react'
import { getFirebaseAuth } from '@/lib/firebase'
import { useRole } from '@/hooks/useRole'
import { Button } from '@/components/ui/button'
import {
  BellRing, Save, Loader2, Send, KeyRound, Link2, RefreshCw, Unlock, Plus, Trash2, Activity,
} from 'lucide-react'

interface Field {
  key: string
  label: string
  secret: boolean
  hint: string
  source: 'override' | 'secret' | 'none'
  display: string
}
interface Rule { id: number; text: string }
interface ConfigView {
  fields: Field[]
  watch: { status: number; label: string }[]
  rules: Rule[]
  status: {
    lastRunAt: string | null
    lastRunText: string | null
    lastOkAt: number | null
    hasCookie: boolean
    loginFailAt: number | null
    pending: number
    successRate20: number | null
  }
  workerUrl: string
}

const WATCH_OPTIONS = [
  { status: 18, label: 'Chờ xử lý' },
  { status: 12, label: 'VB thông báo' },
  { status: 13, label: 'VB phối hợp' },
]

function vnTime(ms: number | string | null) {
  if (!ms) return 'chưa có'
  return new Date(ms).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })
}

async function api<T = any>(path: string, body?: unknown): Promise<T> {
  const user = getFirebaseAuth().currentUser
  if (!user) throw new Error('Chưa đăng nhập')
  const token = await user.getIdToken()
  const res = await fetch(`/api/qlvb-watcher/${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({ ok: false, message: `HTTP ${res.status}` }))
  if (!res.ok && data?.message) throw new Error(data.message)
  return data
}

const SOURCE_BADGE: Record<Field['source'], { text: string; cls: string }> = {
  override: { text: 'đã đặt tại đây', cls: 'bg-blue-50 text-blue-700' },
  secret: { text: 'secret Cloudflare', cls: 'bg-gray-100 text-gray-600' },
  none: { text: 'chưa đặt', cls: 'bg-red-50 text-red-700' },
}

export default function QlvbWatcherSettingsPage() {
  const { isAdmin, loading: roleLoading } = useRole()
  const [view, setView] = useState<ConfigView | null>(null)
  const [values, setValues] = useState<Record<string, string>>({})
  const [watch, setWatch] = useState<number[]>([])
  const [newRule, setNewRule] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [flash, setFlash] = useState<{ ok: boolean; text: string } | null>(null)

  const load = useCallback(async () => {
    try {
      const v = await api<ConfigView>('config')
      setView(v)
      setWatch(v.watch.map((w) => w.status))
    } catch (e) {
      setFlash({ ok: false, text: (e as Error).message })
    }
  }, [])

  useEffect(() => {
    if (isAdmin) load()
  }, [isAdmin, load])

  const run = async (label: string, fn: () => Promise<{ ok?: boolean; message?: string }>) => {
    setBusy(label)
    setFlash(null)
    try {
      const r = await fn()
      setFlash({ ok: r.ok !== false, text: r.message || 'Xong' })
      await load()
    } catch (e) {
      setFlash({ ok: false, text: (e as Error).message })
    } finally {
      setBusy(null)
    }
  }

  if (roleLoading) return <div className="p-6 text-gray-500">Đang tải…</div>
  if (!isAdmin) return <div className="p-6 text-gray-500">Chỉ admin được cấu hình QLVB Watcher.</div>

  const save = () =>
    run('save', async () => {
      const r = await api('config', { values, watch })
      setValues({})
      return r
    })
  const action = (a: string) => run(a, () => api('action', { action: a }))
  const s = view?.status
  const rate = s?.successRate20

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><BellRing className="w-6 h-6 text-blue-600" /> QLVB Watcher</h1>
        <p className="text-gray-500 mt-1">
          Theo dõi văn bản mới trên qlvb.hpnet.vn, báo qua Telegram, đẩy sang My Office. Chạy trên Cloudflare Worker, kiểm mỗi 2 phút (giờ hành chính).
        </p>
      </div>

      {flash && (
        <div className={`rounded-lg px-4 py-3 text-sm whitespace-pre-wrap ${flash.ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>{flash.text}</div>
      )}

      {/* Trạng thái */}
      <section className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="font-semibold flex items-center gap-2 mb-3"><Activity className="w-4 h-4 text-blue-600" /> Trạng thái</h2>
        {!view ? (
          <div className="text-gray-400 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Đang tải…</div>
        ) : (
          <div className="grid grid-cols-2 gap-y-2 text-sm">
            <div className="text-gray-500">Lần kiểm gần nhất</div><div>{vnTime(s!.lastRunAt)}</div>
            <div className="text-gray-500">Kết nối QLVB thành công gần nhất</div><div>{vnTime(s!.lastOkAt)}</div>
            <div className="text-gray-500">Tỷ lệ kết nối (20 lần gần nhất)</div>
            <div className={rate !== null && rate! < 30 ? 'text-red-600 font-medium' : ''}>{rate === null ? '—' : `${rate}%`}</div>
            <div className="text-gray-500">Phiên QLVB</div>
            <div>{s!.hasCookie ? 'Đang có phiên' : 'Chưa có'}{s!.loginFailAt ? <span className="text-red-600 font-medium"> · đăng nhập thất bại lúc {vnTime(s!.loginFailAt)}</span> : null}</div>
            <div className="text-gray-500">Việc chờ</div><div>{s!.pending}</div>
            {s!.lastRunText && <pre className="col-span-2 mt-2 bg-gray-50 rounded-md p-3 text-xs whitespace-pre-wrap font-sans text-gray-700">{s!.lastRunText}</pre>}
          </div>
        )}
      </section>

      {/* Thông số */}
      <section className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="font-semibold mb-1">Thông số</h2>
        <p className="text-xs text-gray-500 mb-4">Ô để trống = giữ nguyên giá trị hiện tại. Mật khẩu và token chỉ hiện 4 ký tự cuối.</p>
        <div className="space-y-4">
          {view?.fields.map((f) => (
            <div key={f.key}>
              <div className="flex items-center gap-2">
                <label htmlFor={f.key} className="font-medium text-sm">{f.label}</label>
                <span className={`text-[11px] px-2 py-0.5 rounded-full ${SOURCE_BADGE[f.source].cls}`}>{SOURCE_BADGE[f.source].text}</span>
                <code className="text-xs text-gray-500">{f.display}</code>
              </div>
              <input
                id={f.key}
                type={f.secret ? 'password' : 'text'}
                autoComplete="off"
                placeholder="để trống = giữ nguyên"
                value={values[f.key] ?? ''}
                onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
              <p className="text-xs text-gray-500 mt-1">{f.hint}</p>
            </div>
          ))}
          <div>
            <div className="font-medium text-sm">Mục theo dõi</div>
            <div className="flex gap-4 mt-1">
              {WATCH_OPTIONS.map((o) => (
                <label key={o.status} className="flex items-center gap-1.5 text-sm">
                  <input
                    type="checkbox"
                    checked={watch.includes(o.status)}
                    onChange={(e) => setWatch((w) => (e.target.checked ? [...w, o.status] : w.filter((x) => x !== o.status)))}
                  />
                  {o.label}
                </label>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-1">Mục mới bật sẽ được ghi nhận ở lần kiểm tới, không báo lại văn bản cũ.</p>
          </div>
        </div>
        <Button className="mt-4" onClick={save} disabled={!!busy}>
          {busy === 'save' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />} Lưu
        </Button>
      </section>

      {/* Kiểm tra */}
      <section className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="font-semibold mb-3">Kiểm tra</h2>
        <div className="flex flex-wrap gap-2">
          {[
            { a: 'test-telegram', label: 'Thử Telegram', icon: Send },
            { a: 'test-login', label: 'Thử đăng nhập QLVB', icon: KeyRound },
            { a: 'run', label: 'Kiểm tra ngay', icon: RefreshCw },
            { a: 'setup-webhook', label: 'Đăng ký lại webhook', icon: Link2 },
            { a: 'clear-backoff', label: 'Xoá hãm đăng nhập', icon: Unlock },
          ].map(({ a, label, icon: Icon }) => (
            <Button key={a} variant="outline" onClick={() => action(a)} disabled={!!busy}>
              {busy === a ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Icon className="w-4 h-4 mr-2" />} {label}
            </Button>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-2">Cloudflare chỉ kết nối được QLVB khoảng một nửa số lần (lỗi 522). Gặp lỗi kết nối thì bấm lại sau ít phút.</p>
      </section>

      {/* Rules */}
      <section className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="font-semibold mb-1">Rules tự động</h2>
        <p className="text-xs text-gray-500 mb-3">
          Khi văn bản mới khớp rule: tự đẩy sang My Office (push), gửi PDF qua Telegram (pdf) hoặc cả hai (both).
          Ví dụ: <code>sender=&quot;Sở Y tế&quot; kw=&quot;khám sức khỏe|KSK&quot; action=both</code> ·{' '}
          <code>prio=express,very_urgent action=push</code>
        </p>
        <ul className="space-y-1.5 mb-3">
          {view?.rules.length === 0 && <li className="text-sm text-gray-400">Chưa có rule nào.</li>}
          {view?.rules.map((r) => (
            <li key={r.id} className="flex items-start justify-between gap-2 text-sm bg-gray-50 rounded-md px-3 py-2">
              <span>{r.text}</span>
              <button className="text-gray-400 hover:text-red-600" title="Xoá" onClick={() => run('del' + r.id, () => api('rules', { del: r.id }))}>
                <Trash2 className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <input
            value={newRule}
            onChange={(e) => setNewRule(e.target.value)}
            placeholder='sender="Sở Y tế" kw="báo cáo" action=push'
            className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm"
          />
          <Button
            variant="outline"
            disabled={!newRule.trim() || !!busy}
            onClick={() => run('add-rule', async () => { const r = await api('rules', { add: newRule }); setNewRule(''); return r })}
          >
            <Plus className="w-4 h-4 mr-1" /> Thêm
          </Button>
        </div>
      </section>

      {/* Hướng dẫn */}
      <section className="bg-white border border-gray-200 rounded-xl p-5 text-sm space-y-3">
        <h2 className="font-semibold">Quy trình khi cần thay đổi</h2>
        <div>
          <div className="font-medium">QLVB bắt đổi mật khẩu</div>
          <ol className="list-decimal ml-5 text-gray-600">
            <li>Đổi mật khẩu trên qlvb.hpnet.vn như bình thường.</li>
            <li>Nhập mật khẩu mới vào ô &quot;Mật khẩu QLVB&quot; → Lưu.</li>
            <li>Bấm &quot;Xoá hãm đăng nhập&quot; rồi &quot;Thử đăng nhập QLVB&quot; → phải báo thành công.</li>
          </ol>
        </div>
        <div>
          <div className="font-medium">Cấp lại token hoặc đổi bot Telegram</div>
          <ol className="list-decimal ml-5 text-gray-600">
            <li>@BotFather → <code>/token</code> (cấp lại) hoặc <code>/newbot</code> (bot mới) → copy token.</li>
            <li>Dán vào &quot;Telegram bot token&quot; → Lưu → &quot;Đăng ký lại webhook&quot; → &quot;Thử Telegram&quot;.</li>
            <li>Bot dùng chung với Apps Script nhắc lịch: cập nhật cả Script Properties <code>TELEGRAM_BOT_TOKEN</code> bên Apps Script.</li>
            <li>Đổi người nhận: nhắn bot một tin, bot trả về chat_id → cập nhật ô &quot;Telegram chat id&quot;.</li>
          </ol>
        </div>
        {view?.workerUrl && <p className="text-xs text-gray-400">Worker: {view.workerUrl} · trong Telegram gõ /admin để mở trang cấu hình dự phòng.</p>}
      </section>
    </div>
  )
}
