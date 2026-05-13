// sentimientos-nav.js - Barra de navegación centrada para todas las páginas

function addSentimentsNav() {
    if (document.getElementById('sentimentsNav')) return;
    
    const currentPage = window.location.pathname.split('/').pop();
    
    const pages = [
        { id: 'hub', name: 'Hub', url: 'sentimientos.html', icon: 'grid', isHub: true },
        { id: 'razones', name: 'Razones', url: 'razones.html', icon: 'sparkles' },
        { id: 'openwhen', name: 'Open When', url: 'openwhen.html', icon: 'mail' },
        { id: 'calendario', name: 'Calendario', url: 'calendario.html', icon: 'calendar-days' },
        { id: 'maldia', name: 'Mal Día', url: 'maldia.html', icon: 'sun-medium' }
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
    
    // Insertar después del botón "Volver al Hub"
    const backBtn = document.querySelector('.back-btn');
    const pageContent = document.querySelector('.page-shell .page, .page, main .page, .calendario-page, .razones-main, .openwhen-container, .maldia-container');
    
    if (backBtn && backBtn.parentNode) {
        backBtn.insertAdjacentElement('afterend', navBar);
    } else if (pageContent && pageContent.parentNode) {
        pageContent.parentNode.insertBefore(navBar, pageContent);
    } else {
        const main = document.querySelector('main');
        if (main) {
            main.insertBefore(navBar, main.firstChild);
        }
    }
    
    if (typeof lucide !== 'undefined') lucide.createIcons();
    
    if (!document.getElementById('sentiments-nav-styles')) {
        const styles = document.createElement('style');
        styles.id = 'sentiments-nav-styles';
        styles.textContent = `
            .sentiments-nav-bar {
                background: rgba(15, 15, 16, 0.85);
                backdrop-filter: blur(16px);
                border: 1px solid rgba(255, 255, 255, 0.08);
                border-radius: 60px;
                padding: 6px 12px;
                margin: 0 auto 28px auto;
                width: fit-content;
                max-width: 95%;
                overflow-x: auto;
            }
            
            .sentiments-nav-container {
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
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
                color: var(--umbra-ash);
                text-decoration: none;
                transition: all 0.2s ease;
                font-size: 0.85rem;
                font-weight: 400;
                white-space: nowrap;
            }
            
            .sentiments-nav-link i {
                width: 16px;
                height: 16px;
            }
            
            .sentiments-nav-link:hover {
                background: rgba(198, 90, 58, 0.12);
                color: var(--accent-coral);
            }
            
            .sentiments-nav-link.active {
                background: linear-gradient(135deg, rgba(198, 90, 58, 0.2), rgba(198, 90, 58, 0.08));
                border: 1px solid rgba(198, 90, 58, 0.3);
                color: var(--accent-coral);
            }
            
            /* Ocultar scrollbar pero mantener funcionalidad en móvil */
            .sentiments-nav-bar::-webkit-scrollbar {
                display: none;
            }
            
            .sentiments-nav-bar {
                -ms-overflow-style: none;
                scrollbar-width: none;
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
                
                .sentiments-nav-links {
                    flex-wrap: nowrap;
                }
                
                .sentiments-nav-link {
                    padding: 6px 12px;
                    font-size: 0.75rem;
                }
                
                .sentiments-nav-link i {
                    width: 14px;
                    height: 14px;
                }
            }
            
            @media (max-width: 550px) {
                .sentiments-nav-link span {
                    display: none;
                }
                
                .sentiments-nav-link {
                    padding: 8px 10px;
                }
                
                .sentiments-nav-link i {
                    width: 18px;
                    height: 18px;
                }
            }
            
            @media (min-width: 701px) {
                .sentiments-nav-bar {
                    min-width: 480px;
                }
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