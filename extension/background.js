/**
 * Background service worker for My Office QLVB Helper extension.
 * Handles file downloads and API submission IN THE BACKGROUND
 * so the user can close the popup and keep working.
 */

// === Inline utilities (avoid importScripts conflicts) ===

function _removeDiacritics(str) {
  const map = [
    ['à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ', 'a'],
    ['À|Á|Ạ|Ả|Ã|Â|Ầ|Ấ|Ậ|Ẩ|Ẫ|Ă|Ằ|Ắ|Ặ|Ẳ|Ẵ', 'A'],
    ['è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ', 'e'],['È|É|Ẹ|Ẻ|Ẽ|Ê|Ề|Ế|Ệ|Ể|Ễ', 'E'],
    ['ì|í|ị|ỉ|ĩ', 'i'],['Ì|Í|Ị|Ỉ|Ĩ', 'I'],
    ['ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ', 'o'],['Ò|Ó|Ọ|Ỏ|Õ|Ô|Ồ|Ố|Ộ|Ổ|Ỗ|Ơ|Ờ|Ớ|Ợ|Ở|Ỡ', 'O'],
    ['ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ', 'u'],['Ù|Ú|Ụ|Ủ|Ũ|Ư|Ừ|Ứ|Ự|Ử|Ữ', 'U'],
    ['ỳ|ý|ỵ|ỷ|ỹ', 'y'],['Ỳ|Ý|Ỵ|Ỷ|Ỹ', 'Y'],
    ['đ', 'd'],['Đ', 'D'],
  ];
  let r = str;
  for (const [p, rep] of map) r = r.replace(new RegExp(p, 'g'), rep);
  return r;
}

function _parseDateToPrefix(d) {
  if (!d) return '';
  const m = d.trim().match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  return m ? `${m[3]}${m[2].padStart(2,'0')}${m[1].padStart(2,'0')}` : '';
}

function _sanitizeDocNumber(n) {
  if (!n) return '';
  return n.trim().replace(/[\/\-\s]+/g, '.').replace(/\.{2,}/g, '.').replace(/^\.+|\.+$/g, '');
}

function _sanitizeFilename(raw) {
  if (!raw) return 'file';
  let n = decodeURIComponent(raw);
  n = _removeDiacritics(n);
  n = n.replace(/[\s]+/g,'-').replace(/[^\w\-\.]/g,'-').replace(/\.(?=[^.]*\.)/g,'-').replace(/-{2,}/g,'-').replace(/^-+|-+$/g,'');
  if (n.length > 80) n = n.substring(0, 80).replace(/-+$/, '');
  return n || 'file';
}

function _buildFilename(issueDate, docNumber, originalFilename, isAttachment) {
  const dp = _parseDateToPrefix(issueDate);
  const dn = _sanitizeDocNumber(docNumber);
  const li = originalFilename.lastIndexOf('.');
  const ext = li > 0 ? originalFilename.substring(li) : '';
  const base = _sanitizeFilename(li > 0 ? originalFilename.substring(0, li) : originalFilename);
  const parts = [dp, dn, isAttachment ? 'kem' : null, base].filter(Boolean);
  return parts.join('-') + ext.toLowerCase();
}

// === End inline utilities ===

/**
 * Download a file from qlvb.hpnet.vn using browser cookies
 */
async function downloadFile(url) {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error(`Download failed: ${res.status} ${res.statusText}`);
  const blob = await res.blob();
  
  if (blob.size < 100) {
    const text = await blob.text();
    throw new Error(`Server trả về "${text}" (${blob.size} bytes). Có thể chưa đăng nhập qlvb.hpnet.vn.`);
  }
  
  return blob;
}

/**
 * Get user's Firebase ID token from chrome.storage.local.
 * If the token is expired, automatically refresh it using the stored refresh token.
 */
async function getUserToken() {
  const data = await chrome.storage.local.get(['myoffice_token', 'myoffice_refresh_token']);
  let idToken = data.myoffice_token || null;
  const refreshToken = data.myoffice_refresh_token || null;

  if (!idToken) return null;

  // Check if token is expired by decoding the JWT payload
  if (isTokenExpired(idToken)) {
    if (!refreshToken) {
      console.log('[Background] Token expired and no refresh token available');
      return null;
    }

    console.log('[Background] Token expired, auto-refreshing...');
    try {
      idToken = await refreshIdToken(refreshToken);
      // Store the new token
      await chrome.storage.local.set({ myoffice_token: idToken });
      console.log('[Background] Token refreshed successfully');
    } catch (err) {
      console.log('[Background] Token refresh failed:', err.message);
      return null;
    }
  }

  return idToken;
}

/**
 * Check if a JWT token is expired (with 60s buffer)
 */
function isTokenExpired(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return true;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    const now = Math.floor(Date.now() / 1000);
    // Expired if less than 60 seconds remaining
    return payload.exp && (payload.exp - now) < 60;
  } catch (e) {
    return true;
  }
}

/**
 * Refresh Firebase ID token using the refresh token via Google's securetoken API
 */
async function refreshIdToken(refreshToken) {
  const apiKey = 'AIzaSyBi0SkEEwmNpOKvshNhxhUcB_BQO04QsFE'; // NEXT_PUBLIC_FIREBASE_API_KEY

  const res = await fetch(`https://securetoken.googleapis.com/v1/token?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}`
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Refresh failed: ${res.status} ${err}`);
  }

  const data = await res.json();
  
  if (!data.id_token) {
    throw new Error('No id_token in refresh response');
  }

  // Also update the refresh token if a new one was issued
  if (data.refresh_token) {
    await chrome.storage.local.set({ myoffice_refresh_token: data.refresh_token });
  }

  return data.id_token;
}


async function uploadSingleFile(apiUrl, blob, fileName, firebaseIdToken) {
  const mimeType = blob.type || 'application/octet-stream';
  
  // 1. Get Resumable Upload URL from our Backend
  const initRes = await fetch(`${apiUrl}/api/extension/upload/init`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileName, mimeType, firebaseIdToken })
  });

  if (!initRes.ok) {
    let errText = await initRes.text();
    try {
      const parsed = JSON.parse(errText);
      errText = parsed.message || parsed.error || errText;
    } catch(e) {}
    throw new Error(`[${apiUrl}/api/extension/upload/init]: ${errText}`);
  }

  const { uploadUrl } = await initRes.json();
  if (!uploadUrl) throw new Error('Không thể khởi tạo phiên upload với Google Drive.');

  // 2. Upload file directly to Google Drive via the Resumable URL
  const putRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': mimeType },
    body: blob
  });

  if (!putRes.ok) {
    let errText = await putRes.text();
    throw new Error(`Google Drive Upload Error: ${putRes.status} ${errText}`);
  }

  // Google Drive returns the created file metadata in the response
  const driveData = await putRes.json();
  const id = driveData.id;

  return {
    driveFileId: id,
    driveViewUrl: `https://drive.google.com/file/d/${id}/preview`,
    mimeType: mimeType
  };
}

/**
 * Submit document + files to my-office API
 */
async function submitToMyOffice(apiUrl, metadata, mainFileBlob, mainFileName, attachmentBlobs, firebaseIdToken) {
  // 1. Upload main file individually
  const mainResult = await uploadSingleFile(apiUrl, mainFileBlob, mainFileName, firebaseIdToken);
  
  // 2. Upload attachments individually
  const attachmentResults = [];
  for (const att of attachmentBlobs) {
    const res = await uploadSingleFile(apiUrl, att.blob, att.fileName, firebaseIdToken);
    attachmentResults.push({
      id: att.fileName,
      title: att.fileName,
      originalLink: '',
      driveFileId: res.driveFileId,
      driveViewUrl: res.driveViewUrl,
      mimeType: res.mimeType,
      uploadedAt: new Date().toISOString()
    });
  }
  
  // 3. Submit metadata
  const payload = {
    title: metadata.summary || '',
    docNumber: metadata.docNumber || '',
    issueDate: metadata.issueDate || '',
    deadline: metadata.deadline || '',
    assignee: metadata.handler || '',
    sender: metadata.sender || '',
    leader: metadata.leader || '',
    originalLink: metadata.pageUrl || '',
    priority: metadata.priority || 'normal',
    notes: metadata.notes || '',
    tags: '',
    firebaseIdToken: firebaseIdToken || '',
    mainFileId: mainResult.driveFileId,
    mainFileUrl: mainResult.driveViewUrl,
    mainMimeType: mainResult.mimeType,
    attachmentsJson: JSON.stringify(attachmentResults)
  };
  
  const res = await fetch(`${apiUrl}/api/extension/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  
  if (!res.ok) {
    let errText = await res.text();
    try {
      const parsed = JSON.parse(errText);
      if (parsed.message) errText = parsed.message;
      else if (parsed.error) errText = parsed.error;
    } catch(e) {}
    throw new Error(`[${apiUrl}/api/extension/submit]: ${errText}`);
  }
  
  return res.json();
}

/**
 * Show Chrome notification
 */
function showNotification(title, message) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title: title,
    message: message,
    priority: 2,
  });
}

function setBadge(text, color) {
  chrome.action.setBadgeText({ text });
  chrome.action.setBadgeBackgroundColor({ color });
}

/**
 * Main handler
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'submit-document') {
    sendResponse({ success: true, status: 'processing' });
    handleSubmitInBackground(request);
    return false;
  }
});

async function handleSubmitInBackground(request) {
  const { metadata } = request;
  const apiUrl = (request.apiUrl || '').replace(/\/+$/, '');
  const docLabel = metadata.docNumber || 'văn bản';
  const todayKey = getTodayKey();
  
  // Smart history: reuse existing failed entry or add new sending entry
  const historyIdx = await addOrReuseHistory(todayKey, metadata.docNumber);
  
  try {
    setBadge('⏳', '#f59e0b');
    
    // 1. Download main file
    const mainBlob = await downloadFile(metadata.mainFileUrl);
    const mainFileName = _buildFilename(
      metadata.issueDate, metadata.docNumber, metadata.mainFileName, false
    );
    
    // 2. Download attachments
    const attachmentBlobs = [];
    for (const att of (metadata.attachments || [])) {
      try {
        const blob = await downloadFile(att.url);
        const fileName = _buildFilename(
          metadata.issueDate, metadata.docNumber, att.fileName, true
        );
        attachmentBlobs.push({ blob, fileName });
      } catch (err) {
        console.log(`Attachment download skipped: ${att.fileName}`);
      }
    }
    
    // 3. Get user token from chrome.storage.local
    const userToken = await getUserToken();
    if (!userToken) {
      // No token — handle inline without throwing (prevents extension error page entry)
      setBadge('!', '#f59e0b');
      showNotification('⚠️ Cần đăng nhập', 'Hãy mở My Office (localhost:3000) và đăng nhập Google để lấy token.');
      await updateHistory(todayKey, historyIdx, { status: 'failed', error: 'Chưa có token. Mở My Office và đăng nhập.' });
      setTimeout(() => setBadge('', '#f59e0b'), 30000);
      return;
    }
    
    // 4. Submit to API
    setBadge('📤', '#3b82f6');
    const result = await submitToMyOffice(apiUrl, metadata, mainBlob, mainFileName, attachmentBlobs, userToken);
    
    // 5. Success
    setBadge('✓', '#22c55e');
    showNotification('✅ Gửi thành công!', `${docLabel}: Đã upload lên Drive.`);
    
    await updateHistory(todayKey, historyIdx, { status: 'done', docId: result.docId });
    
    setTimeout(() => setBadge('', '#22c55e'), 10000);
    
  } catch (err) {
    // Use console.log to avoid showing in extension errors page
    console.log('[Background] Submit issue:', err.message);
    
    setBadge('✗', '#ef4444');
    showNotification('❌ Gửi thất bại', `${docLabel}: ${err.message}`);
    
    await updateHistory(todayKey, historyIdx, { status: 'failed', error: err.message });
    
    setTimeout(() => setBadge('', '#ef4444'), 30000);
  }
}

// === History helpers ===

function getTodayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

/**
 * Add new entry or reuse existing failed entry for the same docNumber.
 * Prevents duplicate failed entries for the same document.
 */
async function addOrReuseHistory(dayKey, docNumber) {
  const data = await chrome.storage.local.get(['submissionHistory']);
  const history = data.submissionHistory || {};
  if (!history[dayKey]) history[dayKey] = [];
  
  // Find existing failed entry for same docNumber
  const existingIdx = history[dayKey].findIndex(
    e => e.docNumber === docNumber && e.status === 'failed'
  );
  
  if (existingIdx >= 0) {
    // Reuse — update status back to sending
    history[dayKey][existingIdx].status = 'sending';
    history[dayKey][existingIdx].timestamp = Date.now();
    delete history[dayKey][existingIdx].error;
    await chrome.storage.local.set({ submissionHistory: history });
    return existingIdx;
  }
  
  // New entry
  const idx = history[dayKey].length;
  history[dayKey].push({
    docNumber,
    status: 'sending',
    timestamp: Date.now(),
  });
  
  // Clean old days
  const keys = Object.keys(history).sort();
  while (keys.length > 3) {
    delete history[keys.shift()];
  }
  
  await chrome.storage.local.set({ submissionHistory: history });
  return idx;
}

async function updateHistory(dayKey, idx, updates) {
  const data = await chrome.storage.local.get(['submissionHistory']);
  const history = data.submissionHistory || {};
  if (history[dayKey] && history[dayKey][idx]) {
    Object.assign(history[dayKey][idx], updates);
    
    // On success: remove all failed entries for same docNumber
    if (updates.status === 'done') {
      const docNumber = history[dayKey][idx].docNumber;
      history[dayKey] = history[dayKey].filter((e, i) => {
        if (i === idx) return true; // Keep the successful one
        if (e.docNumber === docNumber && e.status === 'failed') return false; // Remove failed duplicates
        return true;
      });
    }
    
    await chrome.storage.local.set({ submissionHistory: history });
  }
}

