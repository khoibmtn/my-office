/**
 * Extension popup logic
 * - Shows today's submission history as a table (at bottom)
 * - Skips duplicate warning if doc was already sent today
 * - Shows in-progress items in history
 * - Warns when no document popup is open
 */

const DEFAULT_API_URL = 'http://localhost:3000';
let currentMetadata = null;

const els = {
  loadingOverlay: () => document.getElementById('loading-overlay'),
  error: () => document.getElementById('error'),
  errorMsg: () => document.getElementById('error-msg'),
  mainForm: () => document.getElementById('main-form'),
  docNumber: () => document.getElementById('docNumber'),
  issueDate: () => document.getElementById('issueDate'),
  deadline: () => document.getElementById('deadline'),
  handler: () => document.getElementById('handler'),
  sender: () => document.getElementById('sender'),
  priority: () => document.getElementById('priority'),
  title: () => document.getElementById('title'),
  notes: () => document.getElementById('notes'),
  fileList: () => document.getElementById('file-list'),
  btnSubmit: () => document.getElementById('btn-submit'),
  progress: () => document.getElementById('progress'),
  progressFill: () => document.getElementById('progress-fill'),
  progressText: () => document.getElementById('progress-text'),
  apiUrl: () => document.getElementById('apiUrl'),
  btnSaveSettings: () => document.getElementById('btn-save-settings'),
  dupWarning: () => document.getElementById('duplicate-warning'),
  dupMsg: () => document.getElementById('duplicate-msg'),
  dupList: () => document.getElementById('duplicate-list'),
  btnCancelDup: () => document.getElementById('btn-cancel-dup'),
  btnForceAdd: () => document.getElementById('btn-force-add'),
  historySection: () => document.getElementById('history-section'),
  historyBody: () => document.getElementById('history-body'),
};

// ========== INITIALIZATION ==========

document.addEventListener('DOMContentLoaded', async () => {
  const settings = await chrome.storage.local.get(['apiUrl']);
  els.apiUrl().value = settings.apiUrl || DEFAULT_API_URL;

  els.btnSaveSettings().addEventListener('click', async () => {
    const url = els.apiUrl().value.replace(/\/+$/, ''); // trim trailing slash
    els.apiUrl().value = url;
    await chrome.storage.local.set({ apiUrl: url });
    els.btnSaveSettings().textContent = '✓ Đã lưu';
    setTimeout(() => { els.btnSaveSettings().textContent = 'Lưu'; }, 1500);
  });

  els.btnSubmit().addEventListener('click', handleSubmit);

  els.btnCancelDup().addEventListener('click', () => window.close());
  els.btnForceAdd().addEventListener('click', () => {
    els.dupWarning().style.display = 'none';
    els.btnSubmit().disabled = false;
  });

  const updatePriorityBg = () => {
    const prio = els.priority();
    const val = prio.value;
    prio.style.color = '#1a1a2e';
    if (val === 'express' || val === 'express_scheduled') {
      prio.style.backgroundColor = '#fef08a';
      prio.style.borderColor = '#eab308';
    } else if (val === 'very_urgent') {
      prio.style.backgroundColor = '#fed7aa';
      prio.style.borderColor = '#f97316';
    } else if (val === 'urgent') {
      prio.style.backgroundColor = '#fecaca';
      prio.style.borderColor = '#ef4444';
    } else {
      prio.style.backgroundColor = '#fff';
      prio.style.borderColor = '#cbd5e1';
    }
  };
  els.priority().addEventListener('change', updatePriorityBg);
  
  // Expose it globally so displayMetadata can call it
  window.updatePriorityBg = updatePriorityBg;

  els.loadingOverlay().style.display = 'flex';

  // Extract data and render history in parallel
  await Promise.all([
    extractFromCurrentTab(),
    renderTodayHistory()
  ]);

  els.loadingOverlay().style.display = 'none';
});

// ========== HISTORY ==========

function getTodayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

async function getTodayHistory() {
  const key = getTodayKey();
  const data = await chrome.storage.local.get(['submissionHistory']);
  const history = data.submissionHistory || {};
  return history[key] || [];
}

async function renderTodayHistory() {
  let items = await getTodayHistory();
  
  // Filter: if a doc has a 'done' entry, remove its 'failed' entries
  const doneDocNumbers = new Set(items.filter(i => i.status === 'done').map(i => i.docNumber));
  items = items.filter(item => {
    if (item.status === 'failed' && doneDocNumbers.has(item.docNumber)) return false;
    return true;
  });
  
  // Sort descending by timestamp
  items.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

  if (items.length === 0) {
    els.historySection().style.display = 'none';
    return;
  }

  els.historySection().style.display = 'block';
  const tbody = els.historyBody();
  tbody.innerHTML = '';

  items.forEach((item, i) => {
    const tr = document.createElement('tr');
    
    const tdIdx = document.createElement('td');
    tdIdx.textContent = i + 1;

    const tdTime = document.createElement('td');
    if (item.timestamp) {
      const d = new Date(item.timestamp);
      tdTime.textContent = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth()+1).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    } else {
      tdTime.textContent = '—';
    }
    
    const tdDoc = document.createElement('td');
    tdDoc.textContent = item.docNumber || '—';
    tdDoc.style.fontWeight = '600';
    
    const tdStatus = document.createElement('td');
    const badge = document.createElement('span');
    badge.className = 'status-badge';
    
    if (item.status === 'sending') {
      badge.className += ' sending';
      badge.textContent = '⏳ Đang gửi...';
    } else if (item.status === 'done') {
      badge.className += ' done';
      badge.textContent = '✓ Xong';
    } else if (item.status === 'failed') {
      badge.className += ' failed';
      badge.textContent = '✗ Lỗi';
    }
    
    tdStatus.appendChild(badge);

    const tdAction = document.createElement('td');
    const btnDel = document.createElement('button');
    btnDel.innerHTML = '🗑️';
    btnDel.style.background = 'none';
    btnDel.style.border = 'none';
    btnDel.style.cursor = 'pointer';
    btnDel.style.fontSize = '12px';
    btnDel.title = 'Xóa task / file rác';
    btnDel.onclick = async () => {
      if (confirm('Bạn có chắc muốn xóa task này khỏi danh sách?')) {
        const data = await chrome.storage.local.get(['submissionHistory']);
        const h = data.submissionHistory || {};
        const key = getTodayKey();
        if (h[key]) {
          h[key].splice(i, 1);
          await chrome.storage.local.set({ submissionHistory: h });
          renderTodayHistory();
        }
      }
    };
    tdAction.appendChild(btnDel);

    tr.appendChild(tdIdx);
    tr.appendChild(tdTime);
    tr.appendChild(tdDoc);
    tr.appendChild(tdStatus);
    tr.appendChild(tdAction);
    tbody.appendChild(tr);
  });
}

async function isAlreadySentToday(docNumber) {
  const items = await getTodayHistory();
  return items.some(item => 
    item.docNumber && item.docNumber.trim() === docNumber.trim() && item.status === 'done'
  );
}

// ========== DATA EXTRACTION ==========

async function extractFromCurrentTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab || !tab.url || !tab.url.includes('qlvb.hpnet.vn')) {
      // Not on qlvb page -> Hide form
      els.mainForm().style.display = 'none';
      return;
    }

    let response;
    try {
      response = await chrome.tabs.sendMessage(tab.id, { action: 'extract-data' });
    } catch (connErr) {
      console.log('Content script not loaded, injecting...');
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js'],
        });
        await new Promise(r => setTimeout(r, 300));
        response = await chrome.tabs.sendMessage(tab.id, { action: 'extract-data' });
      } catch (injectErr) {
        // Injection failed -> Hide form
        els.mainForm().style.display = 'none';
        return;
      }
    }
    
    if (!response || !response.success || response.data._noDocument || !response.data.docNumber) {
      // No valid document extracted -> Hide form
      els.mainForm().style.display = 'none';
      return;
    }

    currentMetadata = response.data;
    displayMetadata(currentMetadata);
    
    els.mainForm().style.display = 'block';

    // Always check duplicate from database
    if (currentMetadata.docNumber) {
      await checkDuplicate(currentMetadata.docNumber);
    }
  } catch (err) {
    showError(err.message || 'Lỗi khi đọc trang.');
  }
}

// ========== DISPLAY ==========

function displayMetadata(data) {
  els.docNumber().value = data.docNumber || '';
  els.issueDate().value = data.issueDate || '';
  els.deadline().value = data.deadline || '';
  els.handler().value = data.handler || '';
  els.sender().value = data.sender || '';
  els.priority().value = data.priority || 'normal';
  if (window.updatePriorityBg) window.updatePriorityBg();
  
  els.title().value = data.summary || '';
  els.notes().value = data.notes || '';

  const fileListEl = els.fileList();
  fileListEl.innerHTML = '';

  if (data.mainFileName) {
    fileListEl.appendChild(createFileItem(data.mainFileName, 'main', true));
  }

  (data.attachments || []).forEach((att, i) => {
    fileListEl.appendChild(createFileItem(att.fileName, 'attachment', true, i));
  });
}

function createFileItem(fileName, type, checked, index) {
  const div = document.createElement('div');
  div.className = 'file-item';

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = checked;
  checkbox.dataset.type = type;
  if (index !== undefined) checkbox.dataset.index = index;

  const nameSpan = document.createElement('span');
  nameSpan.className = 'file-name';
  nameSpan.textContent = fileName;
  nameSpan.title = fileName;

  const badge = document.createElement('span');
  badge.className = `file-badge ${type}`;
  badge.textContent = type === 'main' ? 'Chính' : 'Đính kèm';

  div.appendChild(checkbox);
  div.appendChild(nameSpan);
  div.appendChild(badge);
  return div;
}

function showError(msg) {
  els.error().style.display = 'block';
  els.errorMsg().textContent = msg;
}

function setProgress(percent, text) {
  els.progress().style.display = 'block';
  els.progressFill().style.width = `${percent}%`;
  els.progressText().textContent = text;
}

// ========== SUBMIT ==========

async function handleSubmit() {
  if (!currentMetadata) return;

  const btn = els.btnSubmit();
  btn.disabled = true;
  els.error().style.display = 'none';

  const editedTitle = els.title().value.trim();
  if (editedTitle) currentMetadata.summary = editedTitle;
  
  const editedNotes = els.notes().value.trim();
  currentMetadata.notes = editedNotes;

  const checkboxes = document.querySelectorAll('.file-item input[type="checkbox"]');
  const selectedAttachments = [];
  checkboxes.forEach(cb => {
    if (cb.dataset.type === 'attachment' && cb.checked) {
      const idx = parseInt(cb.dataset.index);
      if (currentMetadata.attachments[idx]) {
        selectedAttachments.push(currentMetadata.attachments[idx]);
      }
    }
  });

  const selectedPriority = els.priority().value;

  const submissionMetadata = { 
    ...currentMetadata, 
    attachments: selectedAttachments,
    priority: selectedPriority
  };

  try {
    const settings = await chrome.storage.local.get(['apiUrl']);
    const apiUrl = (settings.apiUrl || DEFAULT_API_URL).replace(/\/+$/, '');

    chrome.runtime.sendMessage({
      action: 'submit-document',
      metadata: submissionMetadata,
      apiUrl: apiUrl,
    });

    btn.textContent = '📤 Đang xử lý nền...';
    setProgress(100, 'Đã gửi. Bạn có thể đóng popup và tiếp tục làm việc!');
    
    setTimeout(() => window.close(), 1500);
  } catch (err) {
    showError(`Lỗi: ${err.message}`);
    btn.disabled = false;
    btn.textContent = 'Gửi đến My Office';
    els.progress().style.display = 'none';
  }
}

// ========== DUPLICATE CHECK ==========

async function checkDuplicate(docNumber) {
  try {
    const settings = await chrome.storage.local.get(['apiUrl']);
    const apiUrl = (settings.apiUrl || DEFAULT_API_URL).replace(/\/+$/, '');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(`${apiUrl}/api/extension/check-duplicate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ docNumber }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) return;
    const data = await res.json();
    if (!data.exists || !data.matches?.length) return;

    const warningEl = els.dupWarning();
    const listEl = els.dupList();
    
    els.dupMsg().textContent = `⚠️ Văn bản "${docNumber}" đã có ${data.matches.length} bản trong hệ thống:`;

    listEl.innerHTML = '';
    data.matches.forEach(match => {
      const item = document.createElement('div');
      item.className = 'duplicate-item';

      const title = document.createElement('span');
      title.className = 'dup-title';
      title.textContent = match.title || match.docNumber;
      title.title = match.title;

      const date = document.createElement('span');
      date.className = 'dup-date';
      if (match.createdAt) {
        date.textContent = new Date(match.createdAt).toLocaleDateString('vi-VN');
      }

      const status = document.createElement('span');
      status.className = 'dup-status';
      const statusRaw = match.status || 'pending';
      let statusText = statusRaw === 'completed' ? 'Hoàn thành' : 'Chờ xử lý';

      if (statusRaw !== 'completed' && match.deadline) {
        const dl = new Date(match.deadline);
        dl.setHours(0,0,0,0);
        const now = new Date();
        now.setHours(0,0,0,0);
        if (dl < now) {
          statusText = 'Quá hạn';
        }
      }

      const assigneeName = match.assignee ? match.assignee : 'chưa giao';
      statusText += ` (${assigneeName})`;
      
      status.textContent = statusText;

      if (statusRaw === 'completed') {
        status.style.backgroundColor = '#dcfce7';
        status.style.color = '#166534';
      } else if (statusText.startsWith('Quá hạn')) {
        status.style.backgroundColor = '#fee2e2';
        status.style.color = '#991b1b';
      } else {
        status.style.backgroundColor = '#fef3c7';
        status.style.color = '#92400e';
      }

      item.appendChild(title);
      item.appendChild(date);
      item.appendChild(status);
      listEl.appendChild(item);
    });

    warningEl.style.display = 'block';
    els.btnSubmit().disabled = true;
  } catch (err) {
    // Silent fail — don't block user if API is unreachable
    console.log('Duplicate check skipped:', err.message);
  }
}
