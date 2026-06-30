/**
 * Content script for My Office app (localhost:3000 / vercel.app)
 * Reads firebase_id_token AND firebase_refresh_token from localStorage
 * and stores them in chrome.storage.local for extension background use.
 */
(function() {
  let intervalId;

  function syncToken() {
    try {
      if (!chrome || !chrome.storage || !chrome.storage.local) return;

      const idToken = localStorage.getItem('firebase_id_token');
      const refreshToken = localStorage.getItem('firebase_refresh_token');

      const updates = {};
      if (idToken) {
        updates.myoffice_token = idToken;
      }
      if (refreshToken) {
        updates.myoffice_refresh_token = refreshToken;
      }

      if (Object.keys(updates).length > 0) {
        chrome.storage.local.set(updates);
      }
    } catch (err) {
      if (err.message && err.message.includes('Extension context invalidated')) {
        clearInterval(intervalId);
      }
    }
  }

  // Sync on load
  syncToken();

  // Re-sync periodically (token may update after login)
  intervalId = setInterval(syncToken, 5000);

  // Listen for storage events (token updated by another tab)
  window.addEventListener('storage', (e) => {
    if (e.key === 'firebase_id_token' || e.key === 'firebase_refresh_token') {
      syncToken();
    }
  });
})();
