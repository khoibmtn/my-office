/**
 * Content script for qlvb.hpnet.vn
 * Extracts document metadata and file URLs from the popup view.
 * 
 * DOM selectors based on actual HTML structure:
 * - .vanban-sokykieu (first) → "Số/KH: 182/CCDSTE-DSTE (số đến: )"
 * - .vanban-ngaybanhanh → "Ban hành: 24/04/2026"
 * - .vanban-trichyeu → "Trích yếu: V/v báo cáo..."
 * - .vanban-thoihan → "Thời hạn: 05/07/2026"
 * - .vanban-chuyenvien → "Người thực hiện: Bùi Minh Khôi"
 * - .vanban-lanhdao → "Lãnh đạo: Lê Khắc Tùng"
 * - .vanban-coquanbanhanh → "CQBH: Chi cục Dân số..."
 * - .vanban-file-item a → javascript:ChangeFile('...')
 * - .vanban-link → main file download link
 */

function extractText(selector, removeLabel) {
  const el = document.querySelector(selector);
  if (!el) return '';
  let text = el.textContent.trim();
  if (removeLabel) {
    // Remove label like "Số/KH: " or "Ban hành: " etc.
    const colonIdx = text.indexOf(':');
    if (colonIdx >= 0) {
      text = text.substring(colonIdx + 1).trim();
    }
  }
  return text;
}

function extractDocumentData() {
  // Check if we're viewing a document popup (has document metadata elements)
  const hasDocView = document.querySelector('.vanban-sokykieu') || document.querySelector('.vanbanViewLeft');
  if (!hasDocView) {
    return { _noDocument: true };
  }

  // Document number: "Số/KH: 182/CCDSTE-DSTE (số đến: )" → "182/CCDSTE-DSTE"
  let docNumber = '';
  const sokhEl = document.querySelector('.vanban-sokykieu:not(.vanban-ngaybanhanh):not(.vanban-tinhtranxuly)');
  if (sokhEl) {
    let raw = sokhEl.textContent.trim();
    const colonIdx = raw.indexOf(':');
    if (colonIdx >= 0) {
      raw = raw.substring(colonIdx + 1).trim();
    }
    // Remove "(số đến: ...)" part
    const parenIdx = raw.indexOf('(');
    if (parenIdx >= 0) {
      raw = raw.substring(0, parenIdx).trim();
    }
    docNumber = raw;
  }

  // Issue date: try to get it from the sibling/parent of CQBH first (includes time)
  let issueDate = '';
  const cqbhEl = document.querySelector('.vanban-coquanbanhanh');
  if (cqbhEl && cqbhEl.parentElement) {
    const match = cqbhEl.parentElement.textContent.match(/\d{1,2}\/\d{1,2}\/\d{4}\s+\d{1,2}:\d{2}(?::\d{2})?/);
    if (match) issueDate = match[0];
  }
  // Fallback to top bar "Ban hành: 24/04/2026"
  if (!issueDate) {
    issueDate = extractText('.vanban-ngaybanhanh', true);
  }

  // Summary from right panel
  let summary = '';
  const trichyeuEl = document.querySelector('.vanban-trichyeu');
  if (trichyeuEl) {
    summary = trichyeuEl.textContent.trim();
    // Remove "Trích yếu: " prefix
    const match = summary.match(/^Trích yếu\s*:\s*/i);
    if (match) {
      summary = summary.substring(match[0].length).trim();
    }
  }

  // Deadline
  const deadline = extractText('.vanban-thoihan', true);

  // Handler
  let handler = extractText('.vanban-chuyenvien', true);
  // Remove info icon text if present
  handler = handler.replace(/\s*ⓘ.*$/, '').trim();

  // Leader
  let leader = extractText('.vanban-lanhdao', true);
  leader = leader.replace(/\s*ⓘ.*$/, '').trim();

  // Sender (CQBH)
  const sender = extractText('.vanban-coquanbanhanh', true);

  // Main file URL + name
  let mainFileUrl = '';
  let mainFileName = '';
  const downloadLink = document.querySelector('.vanban-link');
  if (downloadLink) {
    let href = downloadLink.getAttribute('href') || '';
    if (href.startsWith('//')) href = 'https:' + href;
    mainFileUrl = href;
    // Extract filename from text "Tải xuống văn bản: filename.pdf"
    const linkText = downloadLink.textContent.trim();
    const dlMatch = linkText.match(/Tải xuống văn bản:\s*(.+)/i);
    mainFileName = dlMatch ? dlMatch[1].trim() : href.split('/').pop() || 'file';
  }

  // All files from dropdown (including main + attachments)
  const fileItems = document.querySelectorAll('.vanban-file-item a');
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
    }
  });

  // Separate main file from attachments
  // First file in dropdown = main file, rest = attachments
  const attachments = allFiles.length > 1 ? allFiles.slice(1) : [];

  // If no main file URL from download link, use first file from dropdown
  if (!mainFileUrl && allFiles.length > 0) {
    mainFileUrl = allFiles[0].url;
    mainFileName = allFiles[0].fileName;
  }

  // Extract priority by looking back at the main table (if available)
  let priority = 'normal';
  try {
    const parentDoc = window.parent ? window.parent.document : document;
    if (docNumber && parentDoc) {
      const rows = parentDoc.querySelectorAll('tr');
      for (const row of rows) {
        if (row.textContent.includes(docNumber)) {
          // Look for the specific label badge to avoid false positives from document titles
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
    // Ignore cross-origin errors if any
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
