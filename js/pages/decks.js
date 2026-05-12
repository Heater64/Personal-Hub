// decks.js - Gestión de decks y generación con IA

let decks = [];

// Cargar decks desde localStorage (o Firebase)
function loadDecks() {
    const saved = localStorage.getItem('study_decks');
    if (saved) {
        try {
            decks = JSON.parse(saved);
        } catch(e) {}
    }
    renderDecks();
}

function saveDecks() {
    localStorage.setItem('study_decks', JSON.stringify(decks));
    document.getElementById('deckCount').innerText = `${decks.length} decks`;
}

async function generateCardsWithAI(text, provider) {
    const loadingMsg = showMessage('🔄 Generando tarjetas con IA...');
    
    try {
        const response = await fetch('/api/generate-cards', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, provider })
        });
        
        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error);
        }
        
        showMessage(`✨ Se generaron ${data.cards.length} tarjetas usando ${data.provider}`);
        return data.cards;
        
    } catch (error) {
        showMessage(`❌ Error: ${error.message}`, true);
        return [];
    }
}

function createDeck(name, cards, sourceType = 'ai') {
    const newDeck = {
        id: Date.now().toString(),
        name: name,
        cards: cards,
        createdAt: new Date().toISOString(),
        sourceType: sourceType,
        cardCount: cards.length
    };
    
    decks.unshift(newDeck);
    saveDecks();
    renderDecks();
    return newDeck;
}

function deleteDeck(deckId) {
    if (confirm('¿Eliminar este deck? No se puede deshacer.')) {
        decks = decks.filter(d => d.id !== deckId);
        saveDecks();
        renderDecks();
        showMessage('Deck eliminado');
    }
}

function renderDecks() {
    const grid = document.getElementById('decksGrid');
    if (!grid) return;
    
    if (decks.length === 0) {
        grid.innerHTML = `
            <div class="empty-state" style="grid-column: 1/-1; text-align: center; padding: 60px;">
                <i data-lucide="layers" style="width: 64px; height: 64px; color: var(--umbra-ash); margin-bottom: 16px;"></i>
                <p>No tienes decks aún</p>
                <p style="font-size: 0.8rem;">Haz clic en "Crear deck" para empezar</p>
            </div>
        `;
        if (typeof lucide !== 'undefined') lucide.createIcons();
        return;
    }
    
    grid.innerHTML = decks.map(deck => `
        <div class="deck-card" data-id="${deck.id}">
            <div class="deck-icon">
                <i data-lucide="${deck.sourceType === 'ai' ? 'wand-2' : 'edit-3'}"></i>
            </div>
            <div class="deck-title">${escapeHtml(deck.name)}</div>
            <div class="deck-stats">
                <span><i data-lucide="layers"></i> ${deck.cards.length} tarjetas</span>
                <span><i data-lucide="calendar"></i> ${new Date(deck.createdAt).toLocaleDateString()}</span>
            </div>
            <div class="deck-actions">
                <button class="deck-btn study-btn" data-id="${deck.id}">
                    <i data-lucide="play"></i> Estudiar
                </button>
                <button class="deck-btn delete-btn" data-id="${deck.id}">
                    <i data-lucide="trash-2"></i>
                </button>
            </div>
        </div>
    `).join('');
    
    if (typeof lucide !== 'undefined') lucide.createIcons();
    
    // Event listeners
    document.querySelectorAll('.study-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = btn.dataset.id;
            window.location.href = `deck.html?id=${id}`;
        });
    });
    
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteDeck(btn.dataset.id);
        });
    });
    
    document.querySelectorAll('.deck-card').forEach(card => {
        card.addEventListener('click', (e) => {
            if (!e.target.closest('.deck-actions')) {
                const id = card.dataset.id;
                window.location.href = `deck.html?id=${id}`;
            }
        });
    });
}

// Modal logic
let currentMethod = 'paste';

function showModal() {
    document.getElementById('createModal').style.display = 'flex';
    document.getElementById('deckName').value = '';
    document.getElementById('sourceText').value = '';
}

function hideModal() {
    document.getElementById('createModal').style.display = 'none';
}

async function handleCreateDeck() {
    const name = document.getElementById('deckName').value.trim();
    if (!name) {
        showMessage('Escribe un nombre para el deck', true);
        return;
    }
    
    if (currentMethod === 'manual') {
        // Recolectar tarjetas manuales
        const cards = [];
        const manualCards = document.querySelectorAll('.manual-card');
        for (const cardEl of manualCards) {
            const question = cardEl.querySelector('.manual-question').value.trim();
            const answer = cardEl.querySelector('.manual-answer').value.trim();
            if (question && answer) {
                cards.push({ question, answer });
            }
        }
        if (cards.length === 0) {
            showMessage('Añade al menos una tarjeta', true);
            return;
        }
        createDeck(name, cards, 'manual');
        hideModal();
    } else {
        // Generar con IA
        const text = document.getElementById('sourceText').value.trim();
        if (!text) {
            showMessage('Pega algún texto para generar tarjetas', true);
            return;
        }
        
        const provider = document.getElementById('providerSelect').value;
        const cards = await generateCardsWithAI(text, provider);
        
        if (cards.length > 0) {
            createDeck(name, cards, 'ai');
            hideModal();
        }
    }
}

function setupModalEvents() {
    document.getElementById('createDeckBtn').addEventListener('click', showModal);
    document.getElementById('closeModalBtn').addEventListener('click', hideModal);
    document.getElementById('cancelBtn').addEventListener('click', hideModal);
    document.getElementById('confirmCreateBtn').addEventListener('click', handleCreateDeck);
    
    document.querySelectorAll('.method-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            currentMethod = btn.dataset.method;
            document.querySelectorAll('.method-section').forEach(section => {
                section.style.display = 'none';
            });
            document.getElementById(`${currentMethod}Section`).style.display = 'block';
        });
    });
    
    document.getElementById('addManualCardBtn').addEventListener('click', () => {
        const container = document.getElementById('manualCardsList');
        const newCard = document.createElement('div');
        newCard.className = 'manual-card';
        newCard.innerHTML = `
            <input type="text" placeholder="Pregunta..." class="manual-question">
            <input type="text" placeholder="Respuesta..." class="manual-answer">
            <button class="remove-card-btn">✕</button>
        `;
        newCard.querySelector('.remove-card-btn').addEventListener('click', () => {
            newCard.remove();
        });
        container.appendChild(newCard);
    });
}

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    loadDecks();
    setupModalEvents();
    if (typeof lucide !== 'undefined') lucide.createIcons();
});