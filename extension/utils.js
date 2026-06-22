(function() {
  'use strict';

  /**
   * Vietnamese diacritics removal map
   */
  const VIETNAMESE_MAP = [
    ['à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ', 'a'],
    ['À|Á|Ạ|Ả|Ã|Â|Ầ|Ấ|Ậ|Ẩ|Ẫ|Ă|Ằ|Ắ|Ặ|Ẳ|Ẵ', 'A'],
    ['è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ', 'e'],
    ['È|É|Ẹ|Ẻ|Ẽ|Ê|Ề|Ế|Ệ|Ể|Ễ', 'E'],
    ['ì|í|ị|ỉ|ĩ', 'i'],
    ['Ì|Í|Ị|Ỉ|Ĩ', 'I'],
    ['ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ', 'o'],
    ['Ò|Ó|Ọ|Ỏ|Õ|Ô|Ồ|Ố|Ộ|Ổ|Ỗ|Ơ|Ờ|Ớ|Ợ|Ở|Ỡ', 'O'],
    ['ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ', 'u'],
    ['Ù|Ú|Ụ|Ủ|Ũ|Ư|Ừ|Ứ|Ự|Ử|Ữ', 'U'],
    ['ỳ|ý|ỵ|ỷ|ỹ', 'y'],
    ['Ỳ|Ý|Ỵ|Ỷ|Ỹ', 'Y'],
    ['đ', 'd'],
    ['Đ', 'D'],
  ];

  function removeDiacritics(str) {
    let result = str;
    for (const [pattern, replacement] of VIETNAMESE_MAP) {
      result = result.replace(new RegExp(pattern, 'g'), replacement);
    }
    return result;
  }

  function parseDateToPrefix(dateStr) {
    if (!dateStr) return '';
    const match = dateStr.trim().match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (!match) return '';
    const [, dd, mm, yyyy] = match;
    return `${yyyy}${mm.padStart(2, '0')}${dd.padStart(2, '0')}`;
  }

  function sanitizeDocNumber(docNumber) {
    if (!docNumber) return '';
    return docNumber
      .trim()
      .replace(/[\/\-\s]+/g, '.')
      .replace(/\.{2,}/g, '.')
      .replace(/^\.+|\.+$/g, '');
  }

  function sanitizeFilename(rawName) {
    if (!rawName) return 'file';
    let name = decodeURIComponent(rawName);
    name = removeDiacritics(name);
    name = name
      .replace(/[%20\s]+/g, '-')
      .replace(/[^\w\-\.]/g, '-')
      .replace(/\.(?=[^.]*\.)/g, '-')
      .replace(/-{2,}/g, '-')
      .replace(/^-+|-+$/g, '');
    if (name.length > 80) {
      name = name.substring(0, 80).replace(/-+$/, '');
    }
    return name || 'file';
  }

  function buildMainFilename(issueDate, docNumber, originalFilename) {
    const datePrefix = parseDateToPrefix(issueDate);
    const docPrefix = sanitizeDocNumber(docNumber);
    const lastDot = originalFilename.lastIndexOf('.');
    const ext = lastDot > 0 ? originalFilename.substring(lastDot) : '';
    const baseName = lastDot > 0 ? originalFilename.substring(0, lastDot) : originalFilename;
    const sanitizedBase = sanitizeFilename(baseName);
    const parts = [datePrefix, docPrefix, sanitizedBase].filter(Boolean);
    return parts.join('-') + ext.toLowerCase();
  }

  function buildAttachmentFilename(issueDate, docNumber, originalFilename) {
    const datePrefix = parseDateToPrefix(issueDate);
    const docPrefix = sanitizeDocNumber(docNumber);
    const lastDot = originalFilename.lastIndexOf('.');
    const ext = lastDot > 0 ? originalFilename.substring(lastDot) : '';
    const baseName = lastDot > 0 ? originalFilename.substring(0, lastDot) : originalFilename;
    const sanitizedBase = sanitizeFilename(baseName);
    const parts = [datePrefix, docPrefix, 'kem', sanitizedBase].filter(Boolean);
    return parts.join('-') + ext.toLowerCase();
  }

  function extractUrlFromChangeFile(href) {
    if (!href) return null;
    const match = href.match(/ChangeFile\(['"](.+?)['"]\)/);
    if (!match) return null;
    let url = match[1];
    if (url.startsWith('//')) url = 'https:' + url;
    return url;
  }

  // Export via globalThis (works in service worker, popup, and content script)
  globalThis.QlvbUtils = {
    removeDiacritics,
    parseDateToPrefix,
    sanitizeDocNumber,
    sanitizeFilename,
    buildMainFilename,
    buildAttachmentFilename,
    extractUrlFromChangeFile,
  };
})();
