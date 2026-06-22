import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function parseFileNameFromUrl(url: string, defaultName: string = 'File đính kèm'): string {
  if (!url) return defaultName;
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    
    if (pathname && pathname !== '/') {
      const parts = pathname.split('/').filter(Boolean);
      let lastPart = parts[parts.length - 1];
      
      // If it's a Drive link or similar where the last part is just 'view' or 'edit', we might want to go one level up
      if ((lastPart === 'view' || lastPart === 'edit' || lastPart === 'preview') && parts.length > 1) {
        lastPart = parts[parts.length - 2];
      }
      
      if (lastPart) {
        const decoded = decodeURIComponent(lastPart).split('?')[0];
        // If it looks like a Google Drive ID (25-40 chars, alphanumeric/dash/underscore, no dot)
        if (/^[a-zA-Z0-9_-]{25,40}$/.test(decoded) && !decoded.includes('.')) {
          return defaultName;
        }
        return decoded;
      }
    }
    return defaultName;
  } catch {
    return defaultName;
  }
}

export function getStructuredMainFileName(doc: any): string {
  if (doc.issueDate && doc.docNumber) {
    const d = doc.issueDate.toDate();
    const dateStr = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
    const safeDocNum = doc.docNumber.replace(/[\/\-]/g, '.');
    
    let ext = '';
    if (doc.mimeType) {
      if (doc.mimeType.includes('pdf')) ext = '.pdf';
      else if (doc.mimeType.includes('word')) ext = '.docx';
      else if (doc.mimeType.includes('excel') || doc.mimeType.includes('spreadsheet')) ext = '.xlsx';
    }
    
    return `${dateStr}-${safeDocNum}${ext}`;
  }
  return 'File chính';
}
