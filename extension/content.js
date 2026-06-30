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

  // All files from dropdown
  const fileItemSelectors = [
    prefix + 'file-item a',
    '#' + prefix.replace('.', '') + 'file-items a',
  ];
  const fileItems = document.querySelectorAll(fileItemSelectors.join(', '));
  const allFiles = [];
  fileItems.forEach((a) => {
    const href = a.getAttribute('href') || '';
    const fileName = a.textContent.trim();
    
    // Extract URL from javascript:ChangeFile('...')
    const match = href.match(/ChangeFile\(['"](.+?)['"]\)/);
    if (match) {
      let url = match[1];
      if (url.startsWith('//')) url = 'https:' + url;
      allFiles.push({ url, fileName });
    } else if (href && href !== '#' && !href.startsWith('javascript:')) {
      let url = href;
      if (url.startsWith('//')) url = 'https:' + url;
      allFiles.push({ url, fileName });
    }
  });

  // Separate main file from attachments
  const attachments = allFiles.length > 1 ? allFiles.slice(1) : [];

  // If no main file URL from download link, use first file from dropdown
  if (!mainFileUrl && allFiles.length > 0) {
    mainFileUrl = allFiles[0].url;
    mainFileName = allFiles[0].fileName;
  }

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
