// js/pages/dashboard.js

let userId = null;
let chart = null;

async function initDashboard() {
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            userId = user.uid;
            await loadDashboardData();
        } else {
            window.location.href = 'login.html';
        }
    });
}

async function loadDashboardData() {
    // Cargar estadísticas del usuario
    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();
    const userData = userDoc.data() || {};
    const stats = userData.stats || {};
    
    // Actualizar UI
    document.getElementById('totalXP').innerText = stats.totalXP || 0;
    document.getElementById('currentStreak').innerText = stats.currentStreak || 0;
    document.getElementById('accuracy').innerText = stats.totalQuestionsAnswered > 0 
        ? Math.round((stats.correctAnswers / stats.totalQuestionsAnswered) * 100) + '%'
        : '0%';
    document.getElementById('studyTime').innerText = Math.round((stats.totalStudyTime || 0) / 60) + 'h';
    
    // Nivel y progreso
    const level = stats.level || 1;
    const xpForNextlevel = level * 500;
    const xpInLevel = (stats.totalXP || 0) % 500;
    const progressPercent = (xpInLevel / 500) * 100;
    
    document.getElementById('xpProgress').innerHTML = `
        <div class="progress-bar">
            <div class="progress-fill" style="width: ${progressPercent}%"></div>
        </div>
        <span>Nivel ${level} · ${xpInLevel}/500 XP para nivel ${level + 1}</span>
    `;
    
    // Cargar temas débiles
    const weakTopics = userData.weakTopics || [];
    const weakList = document.getElementById('weakTopicsList');
    if (weakTopics.length === 0) {
        weakList.innerHTML = '<div class="empty-state">¡Buen trabajo! No hay temas débiles detectados.</div>';
    } else {
        weakList.innerHTML = weakTopics.map(topic => `
            <div class="weak-topic ${topic.priority}">
                <div class="topic-name">${escapeHtml(topic.topic)}</div>
                <div class="topic-stats">
                    <span>Precisión: ${topic.accuracy}%</span>
                    <span>${topic.cardCount} tarjetas</span>
                </div>
                <button class="study-topic-btn" data-topic="${escapeHtml(topic.topic)}">
                    <i data-lucide="play"></i> Reforzar
                </button>
            </div>
        `).join('');
    }
    
    // Cargar sesiones recientes para gráfico
    const sessionsSnapshot = await db.collection('study_sessions')
        .where('userId', '==', userId)
        .orderBy('timestamp', 'desc')
        .limit(14)
        .get();
    
    const sessions = [];
    sessionsSnapshot.forEach(doc => sessions.push(doc.data()));
    sessions.reverse();
    
    // Crear gráfico
    const ctx = document.getElementById('progressChart').getContext('2d');
    if (chart) chart.destroy();
    
    chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: sessions.map(s => new Date(s.timestamp.toDate()).toLocaleDateString()),
            datasets: [{
                label: 'Precisión (%)',
                data: sessions.map(s => s.accuracy || 0),
                borderColor: '#c65a3a',
                backgroundColor: 'rgba(198, 90, 58, 0.1)',
                tension: 0.3,
                fill: true
            }, {
                label: 'XP ganados',
                data: sessions.map(s => s.xpEarned || 0),
                borderColor: '#ffb347',
                backgroundColor: 'rgba(255, 179, 71, 0.1)',
                tension: 0.3,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { position: 'bottom' }
            }
        }
    });
    
    // Cargar logros
    const achievements = calculateAchievements(stats);
    const achievementsList = document.getElementById('achievementsList');
    achievementsList.innerHTML = achievements.map(ach => `
        <div class="achievement ${ach.unlocked ? 'unlocked' : 'locked'}">
            <i data-lucide="${ach.icon}"></i>
            <div class="achievement-info">
                <div class="achievement-name">${ach.name}</div>
                <div class="achievement-description">${ach.description}</div>
            </div>
            ${!ach.unlocked ? `<div class="achievement-progress">${ach.progress}/${ach.required}</div>` : ''}
        </div>
    `).join('');
    
    // Objetivo diario
    const dailyGoal = 20;
    const todaySessions = sessions.filter(s => {
        const sessionDate = s.timestamp.toDate().toDateString();
        const todayDate = new Date().toDateString();
        return sessionDate === todayDate;
    });
    const todayCards = todaySessions.reduce((sum, s) => sum + (s.cardsReviewed || 0), 0);
    const goalPercent = Math.min(100, (todayCards / dailyGoal) * 100);
    
    document.getElementById('dailyGoalText').innerHTML = `<i data-lucide="target"></i> ${todayCards}/${dailyGoal} tarjetas`;
    document.getElementById('goalFill').style.width = `${goalPercent}%`;
    document.getElementById('dailyProgressText').innerHTML = goalPercent === 100 ? '🎉 ¡Objetivo cumplido!' : `${Math.round(goalPercent)}% completado`;
    
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function calculateAchievements(stats) {
    return [
        { name: 'Primer paso', description: 'Completa tu primera sesión', icon: 'award', unlocked: stats.totalQuestionsAnswered > 0, progress: stats.totalQuestionsAnswered, required: 1 },
        { name: 'Racha de 7 días', description: 'Estudia 7 días seguidos', icon: 'flame', unlocked: stats.longestStreak >= 7, progress: stats.longestStreak || 0, required: 7 },
        { name: '100 preguntas', description: 'Responde 100 preguntas', icon: 'target', unlocked: stats.totalQuestionsAnswered >= 100, progress: stats.totalQuestionsAnswered || 0, required: 100 },
        { name: 'Nivel 5', description: 'Alcanza el nivel 5', icon: 'trophy', unlocked: stats.level >= 5, progress: stats.level || 1, required: 5 },
        { name: 'Maestro de precisión', description: '90% de precisión', icon: 'check-circle', unlocked: stats.correctAnswers / stats.totalQuestionsAnswered >= 0.9, progress: Math.round((stats.correctAnswers / stats.totalQuestionsAnswered) * 100) || 0, required: 90 }
    ];
}

document.addEventListener('DOMContentLoaded', initDashboard);