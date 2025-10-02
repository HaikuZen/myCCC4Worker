/**
 * GDPR Cookie Consent Management
 * Handles cookie consent, preferences, and compliance
 */

// Cookie consent state
const cookieConsent = {
  essential: true, // Always enabled
  analytics: false,
  preferences: false
};

// Initialize cookie consent on page load
function initializeCookieConsent() {
  console.log('🍪 Initializing cookie consent...');
  
  // Check if user has already made a choice
  const savedConsent = getCookieConsentPreferences();
  
  if (savedConsent) {
    // User has already consented
    applyCookiePreferences(savedConsent);
    console.log('✅ Cookie preferences loaded:', savedConsent);
  } else {
    // Show consent banner
    showCookieConsentBanner();
  }
}

// Show cookie consent banner
function showCookieConsentBanner() {
  const banner = document.getElementById('cookieConsent');
  if (banner) {
    setTimeout(() => {
      banner.classList.add('show');
    }, 1000); // Show after 1 second
  }
}

// Hide cookie consent banner
function hideCookieConsentBanner() {
  const banner = document.getElementById('cookieConsent');
  if (banner) {
    banner.classList.remove('show');
  }
}

// Show cookie settings panel
function showCookieSettings() {
  const simple = document.getElementById('cookieBannerSimple');
  const settings = document.getElementById('cookieSettings');
  
  if (simple && settings) {
    simple.classList.add('hidden');
    settings.classList.remove('hidden');
    
    // Load current preferences into toggles
    loadCookiePreferencesIntoToggles();
  }
}

// Hide cookie settings panel
function hideCookieSettings() {
  const simple = document.getElementById('cookieBannerSimple');
  const settings = document.getElementById('cookieSettings');
  
  if (simple && settings) {
    settings.classList.add('hidden');
    simple.classList.remove('hidden');
  }
}

// Accept all cookies
function acceptAllCookies() {
  console.log('✅ Accepting all cookies');
  
  cookieConsent.essential = true;
  cookieConsent.analytics = true;
  cookieConsent.preferences = true;
  
  saveCookieConsent();
  applyCookiePreferences(cookieConsent);
  hideCookieConsentBanner();
  
  showNotification('All cookies accepted', 'success');
}

// Accept only essential cookies
function acceptEssentialCookies() {
  console.log('✅ Accepting essential cookies only');
  
  cookieConsent.essential = true;
  cookieConsent.analytics = false;
  cookieConsent.preferences = false;
  
  saveCookieConsent();
  applyCookiePreferences(cookieConsent);
  hideCookieConsentBanner();
  
  showNotification('Essential cookies accepted', 'info');
}

// Reject all non-essential cookies
function rejectAllCookies() {
  console.log('❌ Rejecting all non-essential cookies');
  
  cookieConsent.essential = true;
  cookieConsent.analytics = false;
  cookieConsent.preferences = false;
  
  saveCookieConsent();
  applyCookiePreferences(cookieConsent);
  clearNonEssentialCookies();
  hideCookieConsentBanner();
  
  showNotification('Non-essential cookies rejected', 'warning');
}

// Save custom cookie preferences
function saveCustomCookiePreferences() {
  console.log('💾 Saving custom cookie preferences');
  
  const analyticsToggle = document.getElementById('analyticsToggle');
  const preferencesToggle = document.getElementById('preferencesToggle');
  
  cookieConsent.essential = true; // Always true
  cookieConsent.analytics = analyticsToggle ? analyticsToggle.checked : false;
  cookieConsent.preferences = preferencesToggle ? preferencesToggle.checked : false;
  
  saveCookieConsent();
  applyCookiePreferences(cookieConsent);
  hideCookieConsentBanner();
  
  showNotification('Cookie preferences saved', 'success');
}

// Update cookie category (used by toggles in settings)
function updateCookieCategory(category, enabled) {
  console.log(`🔄 Updating ${category} cookies:`, enabled);
  cookieConsent[category] = enabled;
}

// Save cookie consent to localStorage and cookie
function saveCookieConsent() {
  const consentData = {
    ...cookieConsent,
    timestamp: new Date().toISOString(),
    version: '1.0'
  };
  
  // Save to localStorage
  localStorage.setItem('cookie_consent', JSON.stringify(consentData));
  
  // Save consent cookie (expires in 1 year)
  const expires = new Date();
  expires.setFullYear(expires.getFullYear() + 1);
  document.cookie = `cookie_consent=${JSON.stringify(consentData)}; expires=${expires.toUTCString()}; path=/; SameSite=Strict`;
  
  console.log('✅ Cookie consent saved:', consentData);
}

// Get saved cookie consent preferences
function getCookieConsentPreferences() {
  // Try localStorage first
  const stored = localStorage.getItem('cookie_consent');
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (e) {
      console.error('Error parsing stored consent:', e);
    }
  }
  
  // Try cookie as fallback
  const cookieValue = getCookie('cookie_consent');
  if (cookieValue) {
    try {
      return JSON.parse(cookieValue);
    } catch (e) {
      console.error('Error parsing cookie consent:', e);
    }
  }
  
  return null;
}

// Load preferences into toggle switches
function loadCookiePreferencesIntoToggles() {
  const saved = getCookieConsentPreferences();
  
  if (saved) {
    const analyticsToggle = document.getElementById('analyticsToggle');
    const preferencesToggle = document.getElementById('preferencesToggle');
    
    if (analyticsToggle) analyticsToggle.checked = saved.analytics || false;
    if (preferencesToggle) preferencesToggle.checked = saved.preferences || false;
  }
}

// Apply cookie preferences (enable/disable tracking, etc.)
function applyCookiePreferences(preferences) {
  console.log('🔧 Applying cookie preferences:', preferences);
  
  // Update global state
  Object.assign(cookieConsent, preferences);
  
  // Enable/disable analytics
  if (preferences.analytics) {
    enableAnalytics();
  } else {
    disableAnalytics();
  }
  
  // Enable/disable preference cookies
  if (preferences.preferences) {
    enablePreferenceCookies();
  } else {
    disablePreferenceCookies();
  }
}

// Enable analytics tracking
function enableAnalytics() {
  console.log('📊 Analytics enabled');
  // Add analytics initialization here (e.g., Google Analytics, Plausible, etc.)
  // Example: gtag('consent', 'update', { analytics_storage: 'granted' });
}

// Disable analytics tracking
function disableAnalytics() {
  console.log('📊 Analytics disabled');
  // Disable analytics here
  // Example: gtag('consent', 'update', { analytics_storage: 'denied' });
}

// Enable preference cookies
function enablePreferenceCookies() {
  console.log('⚙️ Preference cookies enabled');
  // Preference cookies are already handled by localStorage (theme, etc.)
}

// Disable preference cookies
function disablePreferenceCookies() {
  console.log('⚙️ Preference cookies disabled');
  // Clear non-essential preference data if needed
}

// Clear non-essential cookies
function clearNonEssentialCookies() {
  console.log('🗑️ Clearing non-essential cookies');
  
  // List of non-essential cookies to clear
  const nonEssentialCookies = ['analytics_id', 'page_views', 'dashboard_layout', 'chart_preferences'];
  
  nonEssentialCookies.forEach(cookieName => {
    deleteCookie(cookieName);
  });
  
  // Clear non-essential localStorage items
  if (!cookieConsent.preferences) {
    localStorage.removeItem('dashboard_layout');
    localStorage.removeItem('chart_preferences');
  }
}

// Reopen cookie consent (from footer link)
function reopenCookieConsent() {
  console.log('🔄 Reopening cookie consent');
  showCookieConsentBanner();
  showCookieSettings(); // Go directly to settings
}

// Show privacy policy modal/page
function showPrivacyPolicy() {
  console.log('📄 Showing privacy policy');
  // TODO: Implement privacy policy modal or redirect to policy page
  alert('Privacy Policy\n\nThis will open a detailed privacy policy page or modal.');
  // You can replace this with a modal or redirect:
  // window.location.href = '/privacy-policy';
}

// Show cookie policy modal/page
function showCookiePolicy() {
  console.log('🍪 Showing cookie policy');
  // TODO: Implement cookie policy modal or redirect to policy page
  alert('Cookie Policy\n\nThis will open a detailed cookie policy page explaining all cookies used.');
  // You can replace this with a modal or redirect:
  // window.location.href = '/cookie-policy';
}

// Helper: Get cookie by name
function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    return parts.pop().split(';').shift();
  }
  return null;
}

// Helper: Delete cookie
function deleteCookie(name) {
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
  console.log(`🗑️ Deleted cookie: ${name}`);
}

// Helper: Show notification
function showNotification(message, type = 'info') {
  // Check if there's a notification system in place
  if (typeof showMessage === 'function') {
    showMessage(message, type);
  } else {
    console.log(`${type.toUpperCase()}: ${message}`);
  }
}

// Check if user has consented to a specific category
function hasConsentFor(category) {
  const saved = getCookieConsentPreferences();
  if (!saved) return false;
  return saved[category] === true;
}

// Export functions for use in other scripts
window.cookieConsentAPI = {
  hasConsentFor,
  getCookieConsentPreferences,
  reopenCookieConsent,
  acceptAllCookies,
  acceptEssentialCookies,
  rejectAllCookies
};

// Initialize on DOM load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeCookieConsent);
} else {
  initializeCookieConsent();
}

console.log('🍪 Cookie consent module loaded');
