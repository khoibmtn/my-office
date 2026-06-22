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
        const decoded = decodeURIComponent(lastPart);
        // Remove trailing query params if any somehow got stuck
        return decoded.split('?')[0];
      }
    }
    return defaultName;
  } catch {
    return defaultName;
  }
}
