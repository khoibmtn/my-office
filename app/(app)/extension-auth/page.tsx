'use client'

import { useEffect, useState } from 'react'

/**
 * /extension-auth page
 * 
 * Extension mở trang này trong background.
 * Trang đọc google_access_token từ localStorage, 
 * gửi qua URL fragment cho extension đọc.
 */
export default function ExtensionAuthPage() {
  const [status, setStatus] = useState('Đang lấy token...')

  useEffect(() => {
    const token = localStorage.getItem('google_access_token')
    if (token) {
      // Post token back to opener (extension popup)
      if (window.opener) {
        window.opener.postMessage({ type: 'myoffice-token', token }, '*')
        setStatus('✅ Đã gửi token. Cửa sổ này sẽ tự đóng.')
        setTimeout(() => window.close(), 1000)
      } else {
        // If opened via extension, store in URL hash for reading
        setStatus('✅ Token sẵn sàng.')
        // Broadcast via BroadcastChannel
        const channel = new BroadcastChannel('myoffice-extension')
        channel.postMessage({ type: 'token', token })
        channel.close()
        setTimeout(() => window.close(), 1000)
      }
    } else {
      setStatus('❌ Chưa đăng nhập. Hãy đăng nhập My Office trước.')
    }
  }, [])

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      fontFamily: 'system-ui',
      fontSize: '16px',
      color: '#333',
    }}>
      <p>{status}</p>
    </div>
  )
}
