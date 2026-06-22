/**
 * Content script for My Office app (localhost:3000)
 * Reads google_access_token from localStorage and stores in chrome.storage.local
 * This runs automatically when the user visits the My Office app.
 */
(function() {
  function syncToken() {
    const token = localStorage.getItem('google_access_token');
    if (token) {
      chrome.storage.local.set({ myoffice_token: token });
    }
  }

  // Sync on load
  syncToken();

  // Re-sync periodically (token may update after login)
  setInterval(syncToken, 5000);

  // Listen for storage events (token updated by another tab)
  window.addEventListener('storage', (e) => {
    if (e.key === 'google_access_token') {
      syncToken();
    }
  });
})();
