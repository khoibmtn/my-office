/**
 * Content script for My Office app (localhost:3000)
 * Reads google_access_token from localStorage and stores in chrome.storage.local
 * This runs automatically when the user visits the My Office app.
 */
(function() {
  let intervalId;

  function syncToken() {
    const token = localStorage.getItem('google_access_token');
    if (token) {
      try {
        if (chrome && chrome.storage && chrome.storage.local) {
          chrome.storage.local.set({ myoffice_token: token });
        }
      } catch (err) {
        if (err.message.includes('Extension context invalidated')) {
          clearInterval(intervalId);
        }
      }
    }
  }

  // Sync on load
  syncToken();

  // Re-sync periodically (token may update after login)
  intervalId = setInterval(syncToken, 5000);

  // Listen for storage events (token updated by another tab)
  window.addEventListener('storage', (e) => {
    if (e.key === 'google_access_token') {
      syncToken();
    }
  });
})();
