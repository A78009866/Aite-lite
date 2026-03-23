/* ===================================================
   Aite - Internationalization (i18n) System
   Arabic only
   =================================================== */

(function () {
  'use strict';

  /**
   * Return text as-is (Arabic only, no translation).
   */
  function t(text) {
    return text;
  }

  function getLang() {
    return 'ar';
  }

  function setLang() {}

  /**
   * Apply direction and lang attribute to <html>
   */
  function applyDirection() {
    var html = document.documentElement;
    html.setAttribute('lang', 'ar');
    html.setAttribute('dir', 'rtl');
  }

  /**
   * No-op since we're Arabic only.
   */
  function translatePage() {
    applyDirection();
  }

  function switchLanguage() {}

  // Apply direction immediately
  applyDirection();

  // Translate once DOM is ready
  function onReady() {
    translatePage();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onReady);
  } else {
    onReady();
  }

  // ==================== EXPORTS ====================
  window.AiteI18n = {
    t: t,
    getLang: getLang,
    setLang: setLang,
    switchLanguage: switchLanguage,
    translatePage: translatePage,
    applyDirection: applyDirection
  };

})();
