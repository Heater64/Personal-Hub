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

// Inicialización
async function initStudy() {
    // Verificar autenticación
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            userId = user.uid;
            engine = new AdaptiveEngine(userId, db);
            
            // Cargar estadísticas del usuario
            await loadUserStats();
            
            // Generar plan de estudio
            await generateStudySession();
            
            // Mostrar primera tarjeta
            displayCurrentCard();
            
            // Configurar eventos
            setupEventListeners();
        } else {
            // Redirigir a login
            window.location.href = 'login.html';
        }
    });
}

async function loadUserStats() {
    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();
    const userData = userDoc.data() || {};
    const stats = userData.stats || {};
    
    currentStreak = stats.currentStreak || 0;
    document.getElementById('streakDisplay').innerHTML = `<i data-lucide="flame"></i> Racha: ${currentStreak}`;
    
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

async function generateStudySession() {
    // Buscar deck o generar plan general
    const urlParams = new URLSearchParams(window.location.search);
    const deckId = urlParams.get('deck');
    
    const plan = await engine.generateStudyPlan(deckId, 15);
    sessionCards = plan.cards;
    sessionStats = {
        correct: 0,
        total: sessionCards.length,
        xpEarned: 0,
        startTime: Date.now()
    };
    
    currentCardIndex = 0;
    updateProgressDisplay();
}

function displayCurrentCard() {
    if (currentCardIndex >= sessionCards.length) {
        endSession();
        return;
    }
    
    currentCard = sessionCards[currentCardIndex];
    
    // Actualizar UI
    document.getElementById('questionText').innerHTML = escapeHtml(currentCard.question);
    document.getElementById('questionTopic').textContent = currentCard.topic || 'General';
    
    // Mostrar dificultad
    const difficultyEl = document.getElementById('questionDifficulty');
    if (currentCard.difficulty <= 2) {
        difficultyEl.innerHTML = '<i data-lucide="coffee"></i> Fácil';
    } else if (currentCard.difficulty <= 4) {
        difficultyEl.innerHTML = '<i data-lucide="zap"></i> Media';
    } else {
        difficultyEl.innerHTML = '<i data-lucide="flame"></i> Difícil';
    }
    
    // Mostrar según tipo de pregunta
    if (currentCard.type === 'multiple_choice' && currentCard.options) {
        document.getElementById('optionsContainer').style.display = 'grid';
        document.getElementById('openInputContainer').style.display = 'none';
        
        document.getElementById('optionsContainer').innerHTML = 
            currentCard.options.map(opt => `
                <button class="option-btn" data-option="${escapeHtml(opt)}">
                    ${escapeHtml(opt)}
                </button>
            `).join('');
        
        // Añadir eventos a las opciones
        document.querySelectorAll('.option-btn').forEach(btn => {
            btn.addEventListener('click', () => handleAnswer(btn.dataset.option));
        });
        
    } else {
        document.getElementById('optionsContainer').style.display = 'none';
        document.getElementById('openInputContainer').style.display = 'flex';
        document.getElementById('openAnswer').value = '';
        document.getElementById('openAnswer').focus();
    }
    
    // Ocultar panel de explicación
    document.getElementById('explanationPanel').style.display = 'none';
    
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