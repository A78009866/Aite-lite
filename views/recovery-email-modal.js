// Recovery Email Modal - Self-contained script
// Checks if user has a recovery email set. If not, shows a modal popup.
// Dismissed modals reappear on next page load until user sets an email.
(function() {
  'use strict';

  // Only run on authenticated pages (check for session cookie or known auth indicator)
  function init() {
    fetch('/api/recovery-email', { credentials: 'include' })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data.ok && !data.has_recovery_email) {
          showModal();
        }
      })
      .catch(function() { /* silently ignore - user may not be logged in */ });
  }

  function showModal() {
    // Don't show if already showing
    if (document.getElementById('recoveryEmailModal')) return;

    var overlay = document.createElement('div');
    overlay.id = 'recoveryEmailModal';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.7);backdrop-filter:blur(5px);-webkit-backdrop-filter:blur(5px);display:flex;align-items:center;justify-content:center;padding:20px;animation:recModalFadeIn 0.3s ease;';

    overlay.innerHTML = '<style>' +
      '@keyframes recModalFadeIn{from{opacity:0}to{opacity:1}}' +
      '@keyframes recModalSlideUp{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}' +
      '</style>' +
      '<div style="background:rgba(20,20,20,0.95);border:1px solid rgba(255,255,255,0.1);border-radius:20px;padding:28px;max-width:400px;width:100%;animation:recModalSlideUp 0.3s ease;box-shadow:0 20px 60px rgba(0,0,0,0.6);">' +
        '<div style="text-align:center;margin-bottom:20px;">' +
          '<div style="width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,#3982f7,#2b61b8);display:flex;align-items:center;justify-content:center;margin:0 auto 12px;">' +
            '<i class="fas fa-envelope" style="color:#fff;font-size:22px;"></i>' +
          '</div>' +
          '<h3 style="color:#fff;font-size:18px;font-weight:700;margin:0 0 6px;">أضف بريد الاستعادة</h3>' +
          '<p style="color:#9ca3af;font-size:13px;margin:0;">أضف بريدك الإلكتروني لاستعادة حسابك في حال نسيت كلمة المرور</p>' +
        '</div>' +
        '<div id="recEmailError" style="background:rgba(255,0,0,0.06);border:1px solid rgba(255,0,0,0.12);padding:8px;border-radius:8px;color:#ffdddd;display:none;margin-bottom:12px;font-size:13px;text-align:center;"></div>' +
        '<div id="recEmailSuccess" style="background:rgba(0,200,0,0.06);border:1px solid rgba(0,200,0,0.12);padding:8px;border-radius:8px;color:#ddffdd;display:none;margin-bottom:12px;font-size:13px;text-align:center;"></div>' +
        '<input type="email" id="recEmailInput" placeholder="example@email.com" dir="ltr" style="width:100%;padding:12px 16px;border-radius:12px;border:1px solid rgba(255,255,255,0.1);background:rgba(45,45,45,0.5);color:#fff;font-size:14px;outline:none;margin-bottom:12px;box-sizing:border-box;">' +
        '<button id="recEmailSaveBtn" style="width:100%;padding:12px;border-radius:12px;background:linear-gradient(135deg,#3982f7,#2b61b8);color:#fff;font-weight:700;font-size:15px;border:none;cursor:pointer;margin-bottom:8px;transition:all 0.3s;">حفظ البريد</button>' +
        '<button id="recEmailDismissBtn" style="width:100%;padding:10px;border-radius:12px;background:transparent;color:#6b7280;font-size:13px;border:1px solid rgba(255,255,255,0.08);cursor:pointer;transition:all 0.3s;">لاحقاً</button>' +
      '</div>';

    document.body.appendChild(overlay);

    // Event listeners
    document.getElementById('recEmailSaveBtn').addEventListener('click', saveEmail);
    document.getElementById('recEmailDismissBtn').addEventListener('click', dismissModal);
    document.getElementById('recEmailInput').addEventListener('keypress', function(e) {
      if (e.key === 'Enter') saveEmail();
    });

    // Focus input
    setTimeout(function() { document.getElementById('recEmailInput').focus(); }, 300);
  }

  function saveEmail() {
    var input = document.getElementById('recEmailInput');
    var errorEl = document.getElementById('recEmailError');
    var successEl = document.getElementById('recEmailSuccess');
    var saveBtn = document.getElementById('recEmailSaveBtn');
    var email = (input.value || '').trim();

    errorEl.style.display = 'none';
    successEl.style.display = 'none';

    if (!email) { errorEl.textContent = 'أدخل البريد الإلكتروني.'; errorEl.style.display = 'block'; return; }
    var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) { errorEl.textContent = 'صيغة البريد غير صحيحة.'; errorEl.style.display = 'block'; return; }

    saveBtn.disabled = true;
    saveBtn.textContent = 'جاري الحفظ...';

    fetch('/api/recovery-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email: email })
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (data.ok) {
        successEl.textContent = data.message || 'تم الحفظ بنجاح!';
        successEl.style.display = 'block';
        setTimeout(dismissModal, 1500);
      } else {
        errorEl.textContent = data.error || 'حدث خطأ.';
        errorEl.style.display = 'block';
        saveBtn.disabled = false;
        saveBtn.textContent = 'حفظ البريد';
      }
    })
    .catch(function() {
      errorEl.textContent = 'فشل في الاتصال.';
      errorEl.style.display = 'block';
      saveBtn.disabled = false;
      saveBtn.textContent = 'حفظ البريد';
    });
  }

  function dismissModal() {
    var modal = document.getElementById('recoveryEmailModal');
    if (modal) {
      modal.style.opacity = '0';
      modal.style.transition = 'opacity 0.3s';
      setTimeout(function() { modal.remove(); }, 300);
    }
  }

  // Initialize after page loads with a delay to not interfere with page load
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(init, 2000);
  } else {
    window.addEventListener('DOMContentLoaded', function() { setTimeout(init, 2000); });
  }
})();
