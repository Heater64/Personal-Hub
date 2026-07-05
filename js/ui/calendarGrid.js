// js/ui/calendarGrid.js
// Renderiza la cuadrícula del calendario con nombres visibles

export function renderCalendarGrid({ container, calendarMapping, dayMeta, visibleDays, onDayClick }) {
    if (!container) return;

    container.innerHTML = '';

    for (let day = 1; day <= visibleDays; day++) {
        const dayStr = String(day);
        const meta = dayMeta[dayStr] || { state: 'locked', giftId: null, title: '', unlockDate: '', type: '' };
        
        const hasGift = calendarMapping && calendarMapping[dayStr] !== undefined;
        const isOpened = meta.state === 'opened';
        const isAvailable = meta.state === 'available';
        const isLocked = meta.state === 'locked' || !hasGift;

        // Obtener el tipo y título del regalo
        const giftType = meta.type || '';
        const giftTitle = meta.title || '';
        
        let typeIcon = '✨';
        let typeLabel = 'Sorpresa';
        
        // En la sección donde se define el tipo de regalo
switch(giftType) {
    case 'letter':
        typeIcon = '✉️';
        typeLabel = 'Carta';
        break;
    case 'cassette':
        typeIcon = '🎵';
        typeLabel = 'Música';
        break;
    case 'giftBox':
        typeIcon = '🎁';
        typeLabel = 'Regalo';
        break;
    case 'polaroid':
        typeIcon = '📷';
        typeLabel = 'Recuerdo';
        break;
    case 'clickStar':
    case 'game':
        typeIcon = '🎮';
        typeLabel = 'Juego';
        break;
    // ========== NUEVOS TIPOS ==========
    case 'surprise':
        typeIcon = '🎊';
        typeLabel = 'Sorpresa';
        break;
    case 'video':
        typeIcon = '🎬';
        typeLabel = 'Video';
        break;
    case 'quiz':
        typeIcon = '🤔';
        typeLabel = 'Pregunta';
        break;
    case 'wishlist':
        typeIcon = '📝';
        typeLabel = 'Deseos';
        break;
    default:
        typeIcon = '✨';
        typeLabel = 'Sorpresa';
}

        const card = document.createElement('button');
        card.className = `day-card ${isOpened ? 'opened' : ''} ${isLocked ? 'locked' : ''} ${isAvailable ? 'available' : ''}`;
        card.dataset.day = day;
        card.dataset.giftId = meta.giftId || '';
        card.disabled = isLocked;

        // ==========================================
        // FORZAR ESTILOS INLINE SEGÚN ESTADO
        // ==========================================
        if (isAvailable) {
            card.style.background = 'radial-gradient(circle at top right, rgba(76, 175, 80, 0.25), transparent 60%), rgba(76, 175, 80, 0.08)';
            card.style.border = '2px solid #4caf50';
            card.style.boxShadow = '0 0 30px rgba(76, 175, 80, 0.25), inset 0 0 20px rgba(76, 175, 80, 0.05)';
            card.style.opacity = '1';
            card.style.filter = 'none';
            card.style.cursor = 'pointer';
        } else if (isOpened) {
            card.style.background = 'radial-gradient(circle at top right, rgba(198, 90, 58, 0.25), transparent 50%), rgba(255, 255, 255, 0.05)';
            card.style.border = '2px solid var(--accent-coral)';
            card.style.boxShadow = '0 0 20px rgba(198, 90, 58, 0.15)';
            card.style.opacity = '1';
            card.style.filter = 'none';
        } else if (isLocked) {
            card.style.background = 'rgba(255, 255, 255, 0.02)';
            card.style.border = '1px solid rgba(255, 255, 255, 0.06)';
            card.style.opacity = '0.4';
            card.style.filter = 'grayscale(0.3)';
            card.style.cursor = 'not-allowed';
        }

        // Número del día
        const num = document.createElement('span');
        num.className = 'day-number';
        num.textContent = day;
        card.appendChild(num);

        // ==========================================
        // NOMBRE DEL REGALO (visible siempre que tenga título)
        // ==========================================
        if (hasGift && giftTitle) {
            const nameEl = document.createElement('div');
            nameEl.className = 'day-gift-name';
            // Truncar si es muy largo
            const shortName = giftTitle.length > 20 ? giftTitle.substring(0, 18) + '…' : giftTitle;
            nameEl.textContent = shortName;
            // Estilos inline
            nameEl.style.fontSize = '0.55rem';
            nameEl.style.color = isLocked ? 'rgba(255,255,255,0.2)' : 'var(--umbra-light)';
            nameEl.style.fontWeight = '400';
            nameEl.style.maxWidth = '90%';
            nameEl.style.overflow = 'hidden';
            nameEl.style.textOverflow = 'ellipsis';
            nameEl.style.whiteSpace = 'nowrap';
            nameEl.style.marginTop = '2px';
            nameEl.style.padding = '0 4px';
            nameEl.style.opacity = isLocked ? '0.3' : '0.8';
            card.appendChild(nameEl);
        }

        // Badge de tipo (solo si está disponible y no bloqueado)
        if (hasGift && !isLocked && giftType) {
            const badge = document.createElement('span');
            badge.className = 'day-type-badge';
            badge.textContent = `${typeIcon} ${typeLabel}`;
            badge.style.display = 'inline-block';
            badge.style.background = isAvailable ? 'rgba(76, 175, 80, 0.2)' : 'rgba(198, 90, 58, 0.2)';
            badge.style.border = isAvailable ? '1px solid rgba(76, 175, 80, 0.4)' : '1px solid var(--accent-coral)';
            badge.style.borderRadius = '20px';
            badge.style.padding = '2px 10px';
            badge.style.fontSize = '0.55rem';
            badge.style.color = isAvailable ? '#81c784' : 'var(--accent-coral)';
            badge.style.marginTop = '2px';
            badge.style.whiteSpace = 'nowrap';
            badge.style.maxWidth = '90%';
            badge.style.overflow = 'hidden';
            badge.style.textOverflow = 'ellipsis';
            card.appendChild(badge);
        }

        // Estado (icono)
        const status = document.createElement('span');
        status.className = 'day-status';
        if (!hasGift) {
            status.textContent = '·';
            status.style.color = 'var(--umbra-ash)';
        } else if (isOpened) {
            status.textContent = '♥';
            status.style.color = 'var(--accent-coral)';
            status.style.fontSize = '1.2rem';
        } else if (isAvailable) {
            status.textContent = '✨';
            status.style.color = '#4caf50';
            status.style.fontSize = '1.2rem';
        } else {
            status.textContent = '🔒';
            status.style.fontSize = '1.5rem';
            status.style.color = 'rgba(255,255,255,0.15)';
        }
        card.appendChild(status);

        // Evento click
        card.addEventListener('click', () => {
            if (!hasGift || isLocked) {
                if (isLocked && hasGift) {
                    showToast('🔒 Aún no disponible', false);
                } else {
                    showToast('📅 Este día no tiene sorpresa', false);
                }
                return;
            }
            if (onDayClick) {
                onDayClick({
                    day: day,
                    giftId: meta.giftId,
                    disabled: isLocked
                });
            }
        });

        container.appendChild(card);
    }
}

function showToast(message, isError = false) {
    if (typeof window.showToast === 'function') {
        window.showToast(message, isError);
        return;
    }
    let toast = document.querySelector('.toast-message');
    if (toast) toast.remove();
    toast = document.createElement('div');
    toast.className = 'toast-message';
    toast.textContent = message;
    if (isError) toast.style.borderLeftColor = '#dc3545';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}