/* ===================================================
   Aite - Shared Components Injector
   Dynamically injects: Desktop Sidebar, Bottom Navbar, Create Modal
   =================================================== */

(function() {
    'use strict';

    var currentPath = window.location.pathname.replace(/\/$/, '') || '/';

    // ===== SIDEBAR =====
    function injectSidebar() {
        // Don't inject if sidebar already exists
        if (document.querySelector('.desktop-sidebar')) return;

        var sidebarLinks = [
            { href: '/chat_list', icon: 'fas fa-home', label: '\u0627\u0644\u0631\u0626\u064A\u0633\u064A\u0629', page: '/chat_list' },
            { href: '/users_list', icon: 'fab fa-facebook-messenger', label: '\u0627\u0644\u0645\u062D\u0627\u062F\u062B\u0627\u062A', page: '/users_list' },
            { href: '/reels', icon: 'fas fa-clapperboard', label: '\u0631\u064A\u0644\u0632', page: '/reels' },
            { href: '/notifications', icon: 'fas fa-bell', label: '\u0627\u0644\u0625\u0634\u0639\u0627\u0631\u0627\u062A', page: '/notifications' },
            { href: '/all_users', icon: 'fas fa-users', label: '\u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645\u0648\u0646', page: '/all_users' },
            { href: '/marketplace', icon: 'fas fa-store', label: '\u0645\u062A\u062C\u0631', page: '/marketplace' },
            { href: '/profile', icon: 'fas fa-user', label: '\u0627\u0644\u0645\u0644\u0641 \u0627\u0644\u0634\u062E\u0635\u064A', page: '/profile' },
            { href: '/settings', icon: 'fas fa-cog', label: '\u0627\u0644\u0625\u0639\u062F\u0627\u062F\u0627\u062A', page: '/settings' }
        ];

        var aside = document.createElement('aside');
        aside.className = 'desktop-sidebar';

        var logoLink = document.createElement('a');
        logoLink.href = '/chat_list';
        logoLink.className = 'sidebar-logo';
        logoLink.textContent = 'Aite';
        aside.appendChild(logoLink);

        var nav = document.createElement('nav');
        nav.className = 'sidebar-nav';

        for (var i = 0; i < sidebarLinks.length; i++) {
            var item = sidebarLinks[i];
            var a = document.createElement('a');
            a.href = item.href;
            a.className = 'sidebar-link';
            a.setAttribute('data-page', item.page);

            // Set active state based on current path
            if (currentPath === item.page || currentPath.indexOf(item.page + '/') === 0) {
                a.classList.add('active');
            }
            // Special cases: create_product, edit_product, product_detail -> marketplace active
            if ((currentPath === '/create_product' || currentPath === '/edit_product' || currentPath === '/product_detail') && item.page === '/marketplace') {
                a.classList.add('active');
            }
            // create_post -> chat_list active
            if (currentPath === '/create_post' && item.page === '/chat_list') {
                a.classList.add('active');
            }
            // create_reel, create_story -> chat_list active
            if ((currentPath === '/create_reel' || currentPath === '/create_story') && item.page === '/chat_list') {
                a.classList.add('active');
            }
            // chat -> users_list active
            if (currentPath === '/chat' && item.page === '/users_list') {
                a.classList.add('active');
            }
            // edit_profile -> profile active
            if (currentPath === '/edit_profile' && item.page === '/profile') {
                a.classList.add('active');
            }
            // post -> chat_list active
            if (currentPath === '/post' && item.page === '/chat_list') {
                a.classList.add('active');
            }

            var icon = document.createElement('i');
            icon.className = item.icon;
            a.appendChild(icon);

            var span = document.createElement('span');
            span.textContent = item.label;
            a.appendChild(span);

            nav.appendChild(a);
        }

        aside.appendChild(nav);
        document.body.appendChild(aside);
    }

    // ===== BOTTOM NAVBAR =====
    function injectBottomNav() {
        // Don't inject if already exists
        if (document.getElementById('mainBottomNav')) return;

        var bottomNavItems = [
            { id: 'homeBtn', href: '/chat_list', icon: 'fas fa-home', pages: ['/chat_list', '/post', '/notifications', '/settings', '/profile', '/edit_profile', '/all_users', '/marketplace', '/create_reel', '/create_story', '/create_product', '/edit_product', '/product_detail'] },
            { id: 'searchBtn', href: '/search', icon: 'fas fa-search', pages: ['/search'] },
            { id: null, type: 'create' },
            { id: 'reelsBtn', href: '/reels', icon: 'fas fa-clapperboard', pages: [] },
            { id: 'messagesBtn', href: '/users_list', icon: 'fab fa-facebook-messenger', pages: ['/users_list', '/chat'] }
        ];

        var wrapper = document.createElement('div');
        wrapper.className = 'fixed bottom-0 left-0 right-0 z-50 glass-bottom-navbar';
        wrapper.id = 'mainBottomNav';

        // Special case: chat page hides bottom nav by default
        if (currentPath === '/chat') {
            wrapper.style.display = 'none';
        }

        var nav = document.createElement('nav');
        nav.className = 'flex items-center max-w-lg mx-auto h-16 relative';
        nav.style.justifyContent = 'space-evenly';

        for (var i = 0; i < bottomNavItems.length; i++) {
            var item = bottomNavItems[i];

            if (item.type === 'create') {
                // Create FAB button
                var fabDiv = document.createElement('div');
                fabDiv.className = 'flex flex-col items-center justify-center';
                fabDiv.style.marginTop = '-22px';

                var fabBtn = document.createElement('button');
                fabBtn.onclick = toggleCreateModal;
                fabBtn.className = 'create-fab-btn';
                fabBtn.title = '\u0625\u0646\u0634\u0627\u0621';

                var fabIcon = document.createElement('i');
                fabIcon.className = 'fas fa-plus text-lg';
                fabBtn.appendChild(fabIcon);
                fabDiv.appendChild(fabBtn);
                nav.appendChild(fabDiv);
            } else {
                var a = document.createElement('a');
                if (item.id) a.id = item.id;
                a.href = item.href;
                a.className = 'bottom-nav-item';

                // Set active state
                if (item.pages.indexOf(currentPath) !== -1) {
                    a.classList.add('active');
                }

                var circle = document.createElement('div');
                circle.className = 'nav-icon-circle';
                circle.style.position = 'relative';

                var icon = document.createElement('i');
                icon.className = item.icon + ' text-xl';
                circle.appendChild(icon);

                // Add unread messages badge to the messages button
                if (item.id === 'messagesBtn') {
                    var badge = document.createElement('span');
                    badge.id = 'msgBadge';
                    badge.style.cssText = 'display:none;position:absolute;top:-4px;left:-4px;min-width:18px;height:18px;padding:0 5px;background:#ef4444;color:#fff;font-size:11px;font-weight:700;border-radius:999px;align-items:center;justify-content:center;line-height:1;z-index:2;border:2px solid rgba(30,30,30,0.75);';
                    badge.textContent = '0';
                    circle.appendChild(badge);
                }

                a.appendChild(circle);
                nav.appendChild(a);
            }
        }

        wrapper.appendChild(nav);
        document.body.appendChild(wrapper);
    }

    // ===== CREATE MODAL =====
    function injectCreateModal() {
        // Don't inject if already exists
        if (document.getElementById('createModal')) return;

        var modalHTML = '<div id="createModal" class="create-modal-overlay" style="display:none;">'
            + '<div class="create-modal-bg" onclick="toggleCreateModal()"></div>'
            + '<div class="create-modal-sheet">'
            + '<div class="modal-handle"></div>'
            + '<h3 style="font-size:18px;font-weight:700;margin:0 0 16px;text-align:center;">\u0625\u0646\u0634\u0627\u0621</h3>'
            + '<div style="display:flex;flex-direction:column;gap:8px;">'
            + '<a href="/create_post" class="create-modal-item">'
            + '<div class="create-modal-icon" style="background:rgba(59,130,246,0.15);"><i class="fas fa-pen-to-square" style="color:#60a5fa;"></i></div>'
            + '<span>\u0645\u0646\u0634\u0648\u0631</span>'
            + '</a>'
            + '<a href="/create_story" class="create-modal-item">'
            + '<div class="create-modal-icon" style="background:rgba(168,85,247,0.15);"><i class="fas fa-circle-plus" style="color:#a855f7;"></i></div>'
            + '<span>\u0642\u0635\u0629</span>'
            + '</a>'
            + '<a href="/create_reel" class="create-modal-item">'
            + '<div class="create-modal-icon" style="background:rgba(239,68,68,0.15);"><i class="fas fa-clapperboard" style="color:#f87171;"></i></div>'
            + '<span>\u0631\u064A\u0644\u0632</span>'
            + '</a>'
            + '</div>'
            + '</div>'
            + '</div>';

        var container = document.createElement('div');
        container.innerHTML = modalHTML;
        document.body.appendChild(container.firstChild);
    }

    // ===== TOGGLE CREATE MODAL (global) =====
    window.toggleCreateModal = function() {
        var m = document.getElementById('createModal');
        if (!m) return;
        if (m.style.display === 'none' || !m.style.display) {
            m.style.display = 'flex';
            document.body.style.overflow = 'hidden';
        } else {
            m.style.display = 'none';
            document.body.style.overflow = '';
        }
    };

    // ===== INITIALIZE =====
    function init() {
        // Pages that should NOT have sidebar/bottom-nav (auth pages, fullscreen pages)
        var noNavPages = ['/login', '/register', '/forgot-password', '/reset-password', '/', '/accounts', '/admin', '/google-complete-profile', '/stories', '/reels', '/splash'];
        var isNoNavPage = noNavPages.indexOf(currentPath) !== -1;

        // Pages that have sidebar but no bottom nav
        var sidebarOnlyPages = ['/create_post', '/create_product', '/edit_product', '/product_detail'];
        var isSidebarOnly = sidebarOnlyPages.indexOf(currentPath) !== -1;

        if (!isNoNavPage) {
            injectSidebar();
            if (!isSidebarOnly) {
                injectCreateModal();
                injectBottomNav();
            }
        }
    }

    // Run when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
