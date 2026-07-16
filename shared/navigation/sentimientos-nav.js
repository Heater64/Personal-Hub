// shared/navigation/sentimientos-nav.js
// Barra de navegación centrada para Sentimientos

function addSentimentsNav() {
    if (document.getElementById('sentimentsNav')) return;

    const currentPage = window.location.pathname.split('/').pop();

    const pages = [
        { id: 'hub', name: 'Hub', url: '/features/sentimientos/sentimientos.html', icon: 'grid' },
        { id: 'razones', name: 'Razones', url: '/features/razones/razones.html', icon: 'sparkles' },
        { id: 'openwhen', name: 'Open When', url: '/features/openwhen/openwhen.html', icon: 'mail' },
        { id: 'calendario', name: 'Calendario', url: '/features/calendario/calendario.html', icon: 'calendar-days' },
        { id: 'maldia', name: 'Mal Día', url: '/features/maldia/maldia.html', icon: 'sun-medium' }
    ];

    const navBar = document.createElement('div');
    navBar.id = 'sentimentsNav';
    navBar.className = 'sentiments-nav-bar';
    navBar.innerHTML = `
        <div class="sentiments-nav-container">
            <div class="sentiments-nav-links">
                ${pages.map(page => `
                    <a href="${page.url}" class="sentiments-nav-link ${currentPage === page.url ? 'active' : ''}" data-page="${page.id}">
                        <i data-lucide="${page.icon}"></i>
                        <span>${page.name}</span>
                    </a>
                `).join('')}
            </div>
        </div>
    `;

    const backBtn = document.querySelector('.back-btn');
    const pageContent = document.querySelector('.page-shell .page, .page, main .page, .calendario-page, .razones-main, .openwhen-container, .maldia-container');

    if (backBtn && backBtn.parentNode) {
        backBtn.insertAdjacentElement('afterend', navBar);
    } else if (pageContent && pageContent.parentNode) {
        pageContent.parentNode.insertBefore(navBar, pageContent);
    } else {
        const main = document.querySelector('main');
        if (main) main.insertBefore(navBar, main.firstChild);
    }

    if (typeof lucide !== 'undefined') lucide.createIcons();

    if (!document.getElementById('sentiments-nav-styles')) {
        const styles = document.createElement('style');
        styles.id = 'sentiments-nav-styles';
        styles.textContent = `
            .sentiments-nav-bar {
                background: var(--theme-bg-secondary);
                backdrop-filter: blur(var(--blur-md));
                border: var(--theme-border-visible);
                border-radius: 60px;
                padding: 6px 12px;
                margin: 0 auto 28px auto;
                width: fit-content;
                max-width: 95%;
                overflow-x: auto;
                scrollbar-width: none;
                -ms-overflow-style: none;
            }
            .sentiments-nav-bar::-webkit-scrollbar { display: none; }
            .sentiments-nav-container { display: flex; align-items: center; justify-content: center; }
            .sentiments-nav-links {
                display: flex;
                flex-wrap: nowrap;
                gap: 4px;
                align-items: center;
                justify-content: center;
            }
            .sentiments-nav-link {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 8px 18px;
                border-radius: 40px;
                color: var(--theme-text-muted);
                text-decoration: none;
                transition: all var(--dur-fast) ease;
                font-size: var(--fs-sm);
                font-weight: 400;
                white-space: nowrap;
            }
            .sentiments-nav-link i { width: 16px; height: 16px; }
            .sentiments-nav-link:hover {
                background: var(--theme-accent-dim);
                color: var(--theme-accent-primary);
            }
            .sentiments-nav-link.active {
                background: var(--theme-accent-dim);
                border: var(--theme-border-accent);
                color: var(--theme-accent-primary);
            }
            @media (max-width: 700px) {
                .sentiments-nav-bar {
                    border-radius: 40px;
                    padding: 6px 8px;
                    width: auto;
                    max-width: 100%;
                    overflow-x: auto;
                    white-space: nowrap;
                }
                .sentiments-nav-links { flex-wrap: nowrap; }
                .sentiments-nav-link { padding: 6px 12px; font-size: var(--fs-xs); }
                .sentiments-nav-link i { width: 14px; height: 14px; }
            }
            @media (max-width: 550px) {
                .sentiments-nav-link span { display: none; }
                .sentiments-nav-link { padding: 8px 10px; }
                .sentiments-nav-link i { width: 18px; height: 18px; }
            }
            @media (min-width: 701px) {
                .sentiments-nav-bar { min-width: 480px; }
            }
        `;
        document.head.appendChild(styles);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addSentimentsNav);
} else {
    addSentimentsNav();
}