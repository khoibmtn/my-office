/**
 * Content script for qlvb.hpnet.vn
 * Extracts document metadata and file URLs from the popup view.
 * 
 * Supports all document types (VB đến, VB đi, VB dự thảo, etc.)
 * by auto-detecting which popup modal is currently showing data.
 *
 * Known prefixes:
 *   vanban-     → VB đến (incoming)
 *   vanbandi-   → VB đi (outgoing)
 */

function extractText(selector, removeLabel) {
  const el = document.querySelector(selector);
  if (!el) return '';
  let text = el.textContent.trim();
  if (removeLabel) {
    const colonIdx = text.indexOf(':');
    if (colonIdx >= 0) {
      text = text.substring(colonIdx + 1).trim();
    }
  }
  return text;
}

/**
 * Try multiple selectors, return the first one that has non-empty text.
 */
function extractTextMulti(selectors, removeLabel) {
  for (const sel of selectors) {
    const val = extractText(sel, removeLabel);
    if (val) return val;
  }
  return '';
}

/**
 * Auto-detect which prefix has actual populated data.
 * Both modals exist in the DOM at all times, but only one is populated.
 */
function detectActivePrefix() {
  const prefixes = ['vanban-', 'vanbandi-'];

  for (const p of prefixes) {
    const el = document.querySelector('.' + p + 'sokykieu:not(.' + p + 'ngaybanhanh):not(.' + p + 'tinhtranxuly)');
    if (el) {
      let text = el.textContent.trim();
      const colonIdx = text.indexOf(':');
      if (colonIdx >= 0) {
        text = text.substring(colonIdx + 1).trim();
      }
      // Remove "(số đến: ...)" suffix
      const parenIdx = text.indexOf('(');
      if (parenIdx >= 0) {
        text = text.substring(0, parenIdx).trim();
      }
      if (text.length > 0) {
        return { prefix: '.' + p, docNumber: text };
      }
    }
  }
  return null;
}

function extractDocumentData() {
  const detected = detectActivePrefix();
  if (!detected) {
    return { _noDocument: true };
  }

  const { prefix, docNumber } = detected;

  // Issue date: try to get it from the sibling/parent of CQBH first (includes time)
  let issueDate = '';
  const cqbhEl = document.querySelector(prefix + 'coquanbanhanh');
  if (cqbhEl && cqbhEl.parentElement) {
    const match = cqbhEl.parentElement.textContent.match(/\d{1,2}\/\d{1,2}\/\d{4}\s+\d{1,2}:\d{2}(?::\d{2})?/);
    if (match) issueDate = match[0];
  }
  // Fallback to top bar "Ban hành: 24/04/2026"
  if (!issueDate) {
    issueDate = extractText(prefix + 'ngaybanhanh', true);
  }

  // Summary (trích yếu) — try active prefix, fallback to other
  let summary = '';
  const trichyeuEl = document.querySelector(prefix + 'trichyeu');
  if (trichyeuEl) {
    summary = trichyeuEl.textContent.trim();
    const match = summary.match(/^Trích yếu\s*:\s*/i);
    if (match) {
      summary = summary.substring(match[0].length).trim();
    }
  }

  // Deadline — different selectors per type, try all
  const deadline = extractTextMulti([
    prefix + 'thoihan',
    prefix + 'thoihanhoibao',
    '.vanban-thoihan',
    '.vanbandi-thoihanhoibao',
  ], true);

  // Handler (người thực hiện / người soạn thảo)
  let handler = extractTextMulti([
    prefix + 'chuyenvien',
    '.vanban-chuyenvien',
    '.vanbandi-chuyenvien',
  ], true);
  handler = handler.replace(/\s*ⓘ.*$/, '').trim();

  // Leader (lãnh đạo / người ký)
  let leader = extractTextMulti([
    prefix + 'lanhdao',
    prefix + 'nguoiky',
    '.vanban-lanhdao',
    '.vanbandi-nguoiky',
  ], true);
  leader = leader.replace(/\s*ⓘ.*$/, '').trim();

  // Sender (CQBH)
  const sender = extractText(prefix + 'coquanbanhanh', true);

  // Main file URL + name — try active prefix download link
  let mainFileUrl = '';
  let mainFileName = '';
  const downloadLink = document.querySelector(prefix + 'link');
  if (downloadLink) {
    let href = downloadLink.getAttribute('href') || '';
    if (href.startsWith('//')) href = 'https:' + href;
    if (href && href !== '#') {
      mainFileUrl = href;
      const linkText = downloadLink.textContent.trim();
      const dlMatch = linkText.match(/Tải xuống văn bản:\s*(.+)/i);
      mainFileName = dlMatch ? dlMatch[1].trim() : href.split('/').pop() || 'file';
    }
  }

  // All files from dropdown or file menu
  // On qlvb.hpnet.vn:
  // - VB đến modal often uses .vanban-...
  // - VB đi modal uses .vanbandi-... or a .btn-group containing "Chọn file"
  const pClean = prefix.replace('.', '');
  const fileItemSelectors = [
    prefix + 'file-item a',
    '#' + pClean + 'file-items a',
    '.' + pClean + 'file-items a',
    '#' + pClean + 'danhsachtep a',
    '.' + pClean + 'danhsachtep a',
    // Specific to VB đi & bootstrap button dropdowns:
    '.vanbandi-file-item a',
    '#vanbandi-file-items a',
    '.dropdown-menu a',
    '.btn-group ul a',
    'a[onclick*="ChangeFile"]',
    'a[href*="ChangeFile"]',
    'a[href*="/upload/"]',
    'a[href*="download"]',
    'a[href*=".pdf"]',
    'a[href*=".doc"]',
    'a[href*=".docx"]',
  ];

  const candidateLinks = Array.from(document.querySelectorAll(fileItemSelectors.join(', ')));

  // Also specifically find any button with "Chọn file" and inspect its sibling dropdown menu
  document.querySelectorAll('button, a').forEach((btn) => {
    if (btn.textContent.includes('Chọn file')) {
      const parent = btn.parentElement;
      if (parent) {
        parent.querySelectorAll('a').forEach(a => candidateLinks.push(a));
      }
    }
  });

  const allFiles = [];
  const seenUrls = new Set();

  candidateLinks.forEach((a) => {
    const href = a.getAttribute('href') || '';
    const onclick = a.getAttribute('onclick') || '';
    let fileName = a.textContent.trim();
    let url = '';
    
    // 1. Extract URL from ChangeFile('...') in href or onclick
    const match = (href + ' ' + onclick).match(/ChangeFile\(['"](.+?)['"]\)/i);
    if (match) {
      url = match[1];
    } else if (href && href !== '#' && !href.startsWith('javascript:')) {
      // 2. Direct link to file or download
      if (href.includes('.') || href.includes('download') || href.includes('action=')) {
        url = href;
      }
    }

    if (url) {
      if (url.startsWith('//')) url = 'https:' + url;
      else if (url.startsWith('/')) url = window.location.origin + url;

      // Clean up file name if blank or generic
      if (!fileName || fileName === 'Chọn file' || fileName.length < 3) {
        const urlParts = url.split('/');
        fileName = decodeURIComponent(urlParts[urlParts.length - 1] || 'file').split('?')[0];
      }

      if (!seenUrls.has(url)) {
        seenUrls.add(url);
        allFiles.push({ url, fileName });
      }
    }
  });

  // If downloadLink wasn't in allFiles, add it as main file
  if (mainFileUrl && !seenUrls.has(mainFileUrl)) {
    allFiles.unshift({ url: mainFileUrl, fileName: mainFileName || 'Văn bản chính' });
    seenUrls.add(mainFileUrl);
  }

  // If no main file URL from download link, use first file from dropdown
  if (!mainFileUrl && allFiles.length > 0) {
    mainFileUrl = allFiles[0].url;
    mainFileName = allFiles[0].fileName;
  }

  // Separate main file from attachments
  const attachments = allFiles.length > 1 ? allFiles.slice(1) : [];

  // Extract priority by looking at the main table
  let priority = 'normal';
  try {
    const parentDoc = window.parent ? window.parent.document : document;
    if (docNumber && parentDoc) {
      const rows = parentDoc.querySelectorAll('tr');
      for (const row of rows) {
        if (row.textContent.includes(docNumber)) {
          const labelEl = row.querySelector('.label');
          if (labelEl) {
            const labelText = labelEl.textContent.toLowerCase().trim();
            if (labelText.includes('hỏa tốc hẹn giờ')) priority = 'express_scheduled';
            else if (labelText.includes('hỏa tốc')) priority = 'express';
            else if (labelText.includes('thượng khẩn')) priority = 'very_urgent';
            else if (labelText.includes('khẩn')) priority = 'urgent';
          }
          break;
        }
      }
    }
  } catch(e) {
    // Ignore cross-origin errors
  }

  return {
    docNumber,
    issueDate,
    summary,
    deadline,
    handler,
    leader,
    sender,
    priority,
    mainFileUrl,
    mainFileName,
    attachments,
    pageUrl: window.location.href,
  };
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extract-data') {
    try {
      const data = extractDocumentData();
      sendResponse({ success: true, data });
    } catch (err) {
      sendResponse({ success: false, error: err.message });
    }
  }
  return true; // Keep channel open for async
});
