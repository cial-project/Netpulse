/**
 * sidebar.js  –  Shared mobile sidebar toggle for NetPulse
 * Attach this script to every page that uses the sidebar.
 */
(function () {
    'use strict';

    document.addEventListener('DOMContentLoaded', function () {
        const toggleBtn = document.getElementById('sidebar-mobile-toggle');
        const overlay = document.getElementById('sidebar-overlay');
        const sidebar = document.querySelector('.sidebar');

        if (!toggleBtn || !sidebar) return;

        function openSidebar() {
            sidebar.classList.add('open');
            if (overlay) {
                overlay.style.display = 'block';
                // Force reflow so transition fires
                overlay.getBoundingClientRect();
                overlay.classList.add('active');
            }
            toggleBtn.innerHTML = '<i class="fas fa-times"></i>';
            document.body.style.overflow = 'hidden';
        }

        function closeSidebar() {
            sidebar.classList.remove('open');
            if (overlay) {
                overlay.classList.remove('active');
                // Wait for fade-out then hide
                overlay.addEventListener('transitionend', function handler() {
                    overlay.style.display = 'none';
                    overlay.removeEventListener('transitionend', handler);
                });
            }
            toggleBtn.innerHTML = '<i class="fas fa-bars"></i>';
            document.body.style.overflow = '';
        }

        toggleBtn.addEventListener('click', function () {
            if (sidebar.classList.contains('open')) {
                closeSidebar();
            } else {
                openSidebar();
            }
        });

        if (overlay) {
            overlay.addEventListener('click', closeSidebar);
        }

        // Close sidebar on nav link click (mobile UX)
        sidebar.querySelectorAll('.nav-item a').forEach(function (link) {
            link.addEventListener('click', function () {
                if (window.innerWidth <= 768) {
                    closeSidebar();
                }
            });
        });

        // Close sidebar on resize to desktop
        window.addEventListener('resize', function () {
            if (window.innerWidth > 768 && sidebar.classList.contains('open')) {
                sidebar.classList.remove('open');
                if (overlay) {
                    overlay.classList.remove('active');
                    overlay.style.display = 'none';
                }
                toggleBtn.innerHTML = '<i class="fas fa-bars"></i>';
                document.body.style.overflow = '';
            }
        });
    });
})();
