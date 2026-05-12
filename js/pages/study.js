// js/pages/study.js

let currentSession = null;
let currentCardIndex = 0;
let currentCard = null;
let sessionCards = [];
let sessionStats = {
    correct: 0,
    total: 0,
    xpEarned: 0,
    startTime: null
};
let engine = null;
let userId = null;
let currentStreak = 0;

// Inicialización con verificación de Firebase
async function initStudy() {
    // Esperar a que Firebase esté listo
    if (typeof db === 'undefined') {
        setTimeout(initStudy, 200);
        return;
    }
    
    // Usar un ID fijo para el usuario invitado
    userId = localStorage.getItem('guestUserId');
    if (!userId) {
        userId = 'guest_' + Date.now();
        localStorage.setItem('guestUserId', userId);
    }
    
    engine = new AdaptiveEngine(userId, db);
    
    await loadUserStats();
    await generateStudySession();
    displayCurrentCard();
    setupEventListeners();
}

function showLoginPrompt() {
    const container = document.querySelector('.study-container');
    if (container) {
        container.innerHTML = `
            <div style="text-align:center; padding: 60px 20px;">
                <i data-lucide="lock" style="width: 64px; height: 64px; color: var(--accent-coral); margin-bottom: 20px;"></i>
                <h2>Inicia sesión para estudiar</h2>
                <p style="margin: 20px 0; color: var(--umbra-ash);">Necesitas una cuenta para guardar tu progreso.</p>
                <button id="tempLoginBtn" class="btn-primary" style="background: var(--accent-coral);">
                    <i data-lucide="mail"></i> Continuar como invitado
                </button>
                <button id="googleLoginBtn" class="btn-secondary">
                    <i data-lucide="chrome"></i> Iniciar con Google
                </button>
            </div>
        `;
        
        document.getElementById('tempLoginBtn')?.addEventListener('click', async () => {
            // Crear usuario temporal
            const tempId = 'temp_' + Date.now();
            userId = tempId;
            engine = new AdaptiveEngine(userId, db);
            
            await loadUserStats();
            await generateStudySession();
            displayCurrentCard();
            setupEventListeners();
            
            // Limpiar el mensaje de login
            const container = document.querySelector('.study-container');
            if (container) {
                container.innerHTML = `
                    <div class="study-header">...</div>
                    <div class="question-card">...</div>
                    <div class="explanation-panel">...</div>
                    <div class="study-navigation">...</div>
                `;
                // Recargar la UI...
                location.reload();
            }
        });
        
        document.getElementById('googleLoginBtn')?.addEventListener('click', () => {
            // Redirigir al login de Google
            window.location.href = 'login.html';
        });
        
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
}

async function loadUserStats() {
    try {
        const userRef = db.collection('users').doc(userId);
        const userDoc = await userRef.get();
        const userData = userDoc.data() || {};
        const stats = userData.stats || {};
        
        currentStreak = stats.currentStreak || 0;
        const streakEl = document.getElementById('streakDisplay');
        if (streakEl) streakEl.innerHTML = `<i data-lucide="flame"></i> Racha: ${currentStreak}`;
    } catch (error) {
        console.log('Usuario nuevo o invitado');
        currentStreak = 0;
    }
    
    if (typeof lucide !== 'undefined') lucide.createIcons();
}


async function handleAnswer(userAnswer) {
    const startResponseTime = Date.now();
    
    // Procesar respuesta con el motor adaptativo
    const result = await engine.processAnswer(
        currentCard.id,
        userAnswer,
        Date.now() - sessionStats.startTime,
        currentStreak
    );
    
    // Actualizar estadísticas de la sesión
    if (result.isCorrect) {
        sessionStats.correct++;
        sessionStats.xpEarned += result.xpEarned;
        currentStreak++;
    } else {
        currentStreak = 0;
    }
    
    sessionStats.total++;
    updateProgressDisplay();
    
    // Mostrar retroalimentación
    if (result.isCorrect) {
        showFeedback(true, result.xpEarned);
        // Avanzar a siguiente carta
        setTimeout(() => {
            currentCardIndex++;
            displayCurrentCard();
        }, 800);
    } else {
        // Mostrar explicación
        showExplanation(currentCard, userAnswer);
    }
    
    // Actualizar display de XP
    document.getElementById('xpDisplay').innerHTML = `<i data-lucide="zap"></i> ${sessionStats.xpEarned} XP`;
    
    if (typeof lucide !== 'undefined') lucide.createIcons();
    if (typeof launchParticles === 'function' && result.isCorrect) {
        launchParticles({
            amount: 10,
            symbols: ['✨', '⭐', '🎉'],
            colors: ['#4caf50', '#ffb347'],
            spread: 100
        });
    }
}

async function showExplanation(card, userAnswer) {
    const panel = document.getElementById('explanationPanel');
    const content = document.getElementById('explanationContent');
    
    // Intentar obtener explicación de la cache o generar con IA
    let explanation = card.explanation || `La respuesta correcta es: ${card.correctAnswer}`;
    
    // Si hay API de explicación, llamarla
    try {
        const response = await fetch('/api/explain-concept', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                concept: card.question,
                userAttempt: userAnswer,
                correctAnswer: card.correctAnswer,
                difficulty: card.difficulty
            })
        });
        
        if (response.ok) {
            const data = await response.json();
            explanation = data.explanation || explanation;
        }
    } catch (e) {
        console.log('Usando explicación local');
    }
    
    content.innerHTML = `
        <p><strong>Respuesta correcta:</strong> ${escapeHtml(card.correctAnswer)}</p>
        <p><strong>Explicación:</strong> ${escapeHtml(explanation)}</p>
        ${card.explanation ? `<p><strong>💡 Consejo:</strong> ${escapeHtml(card.explanation)}</p>` : ''}
    `;
    
    panel.style.display = 'block';
    
    // Botón "Entendido"
    document.getElementById('gotItBtn').onclick = () => {
        panel.style.display = 'none';
        currentCardIndex++;
        displayCurrentCard();
    };
    
    // Botón "Explícalo más fácil"
    document.getElementById('simplifyBtn').onclick = async () => {
        content.innerHTML = '<p>🔍 Generando explicación más sencilla...</p>';
        
        try {
            const response = await fetch('/api/explain-concept', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    concept: card.question,
                    userAttempt: userAnswer,
                    correctAnswer: card.correctAnswer,
                    difficulty: Math.min(5, card.difficulty + 1),
                    simplify: true
                })
            });
            
            if (response.ok) {
                const data = await response.json();
                content.innerHTML = `
                    <p><strong>📖 Explicación simplificada:</strong></p>
                    <p>${escapeHtml(data.simpleExplanation || data.explanation)}</p>
                    ${data.analogy ? `<p><strong>🎯 Analogía:</strong> ${escapeHtml(data.analogy)}</p>` : ''}
                    ${data.example ? `<p><strong>📝 Ejemplo:</strong> ${escapeHtml(data.example)}</p>` : ''}
                `;
            }
        } catch (e) {
            content.innerHTML = `
                <p><strong>Respuesta correcta:</strong> ${escapeHtml(card.correctAnswer)}</p>
                <p>Vuelve a leer el material y practica un poco más.</p>
            `;
        }
    };
}

function showFeedback(isCorrect, xpEarned) {
    const feedbackDiv = document.createElement('div');
    feedbackDiv.className = `feedback-toast ${isCorrect ? 'correct' : 'wrong'}`;
    feedbackDiv.innerHTML = isCorrect 
        ? `<i data-lucide="check-circle"></i> ¡Correcto! +${xpEarned} XP`
        : `<i data-lucide="x-circle"></i> Incorrecto. Revisa la explicación.`;
    
    document.body.appendChild(feedbackDiv);
    setTimeout(() => feedbackDiv.remove(), 2000);
    
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function updateProgressDisplay() {
    const percentage = Math.round((sessionStats.correct / sessionStats.total) * 100);
    document.getElementById('accuracyDisplay').innerHTML = `<i data-lucide="target"></i> ${percentage}%`;
    document.getElementById('cardCounter').innerHTML = `Tarjeta ${currentCardIndex + 1} / ${sessionCards.length}`;
    
    // Actualizar dots de progreso
    const dotsContainer = document.getElementById('progressDots');
    if (dotsContainer && sessionCards.length > 0) {
        dotsContainer.innerHTML = sessionCards.map((_, i) => `
            <div class="progress-dot ${i === currentCardIndex ? 'active' : ''} ${i < currentCardIndex ? 'completed' : ''}"></div>
        `).join('');
    }
}

function endSession() {
    const timeSpent = Math.round((Date.now() - sessionStats.startTime) / 1000 / 60);
    const accuracy = Math.round((sessionStats.correct / sessionStats.total) * 100);
    
    showMessage(`🎉 Sesión completada! ${sessionStats.correct}/${sessionStats.total} correctas - ${sessionStats.xpEarned} XP ganados`);
    
    // Guardar sesión en Firestore
    db.collection('study_sessions').add({
        userId: userId,
        cardsReviewed: sessionStats.total,
        cardsCorrect: sessionStats.correct,
        accuracy: accuracy,
        xpEarned: sessionStats.xpEarned,
        durationMinutes: timeSpent,
        timestamp: new Date()
    });
    
    setTimeout(() => {
        window.location.href = 'dashboard.html';
    }, 3000);
}

function setupEventListeners() {
    document.getElementById('backBtn').addEventListener('click', () => {
        if (confirm('¿Salir de la sesión? Se perderá el progreso no guardado.')) {
            window.location.href = 'decks.html';
        }
    });
    
    document.getElementById('dontUnderstandBtn').addEventListener('click', () => {
        showExplanation(currentCard, '');
    });
    
    document.getElementById('submitOpenBtn')?.addEventListener('click', () => {
        const answer = document.getElementById('openAnswer').value;
        if (answer.trim()) handleAnswer(answer);
    });
    
    document.getElementById('openAnswer')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleAnswer(e.target.value);
        }
    });
}

// Iniciar
document.addEventListener('DOMContentLoaded', initStudy);