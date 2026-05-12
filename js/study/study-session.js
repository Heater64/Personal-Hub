// js/study/study-session.js - Gestión de sesiones de estudio

class StudySession {
    constructor(userId, db) {
        this.userId = userId;
        this.db = db;
        this.currentSession = null;
        this.sessionCards = [];
        this.currentIndex = 0;
        this.stats = {
            correct: 0,
            total: 0,
            xpEarned: 0,
            startTime: null,
            endTime: null
        };
        this.activeCallbacks = [];
    }
    
    // Iniciar nueva sesión
    async startSession(deckId, cardLimit = 20) {
        const cards = await this.getCardsForSession(deckId, cardLimit);
        
        if (cards.length === 0) {
            showMessage('No hay cartas para estudiar en este momento', true);
            return false;
        }
        
        this.sessionCards = cards;
        this.currentIndex = 0;
        this.stats = {
            correct: 0,
            total: cards.length,
            xpEarned: 0,
            startTime: new Date(),
            endTime: null
        };
        
        this.currentSession = {
            id: Date.now().toString(),
            deckId: deckId,
            cards: cards.map(c => c.id),
            startedAt: new Date(),
            responses: []
        };
        
        return true;
    }
    
    async getCardsForSession(deckId, limit) {
        let query = this.db.collection('cards').where('userId', '==', this.userId);
        if (deckId) query = query.where('deckId', '==', deckId);
        
        const snapshot = await query.get();
        const now = new Date();
        
        const cards = [];
        for (const doc of snapshot.docs) {
            const card = doc.data();
            const nextReview = card.adaptive?.nextReview;
            
            if (!nextReview || new Date(nextReview) <= now) {
                cards.push({ id: doc.id, ...card });
            }
        }
        
        // Ordenar por prioridad
        cards.sort((a, b) => {
            const aPriority = (a.adaptive?.consecutiveWrong || 0) * 2;
            const bPriority = (b.adaptive?.consecutiveWrong || 0) * 2;
            return bPriority - aPriority;
        });
        
        return cards.slice(0, limit);
    }
    
    // Obtener carta actual
    getCurrentCard() {
        if (this.currentIndex >= this.sessionCards.length) {
            return null;
        }
        return this.sessionCards[this.currentIndex];
    }
    
    // Avanzar a siguiente carta
    nextCard() {
        if (this.currentIndex < this.sessionCards.length - 1) {
            this.currentIndex++;
            return this.getCurrentCard();
        }
        return null;
    }
    
    // Evaluar respuesta
    async recordAnswer(isCorrect, responseTimeMs) {
        const card = this.getCurrentCard();
        if (!card) return null;
        
        // Guardar respuesta en la sesión
        this.currentSession.responses.push({
            cardId: card.id,
            correct: isCorrect,
            responseTime: responseTimeMs,
            timestamp: new Date()
        });
        
        if (isCorrect) {
            this.stats.correct++;
            this.stats.xpEarned += this.calculateXP(responseTimeMs);
        }
        
        this.stats.total++;
        
        // Notificar a los callbacks
        this.activeCallbacks.forEach(cb => cb({
            card,
            isCorrect,
            responseTimeMs,
            progress: this.getProgress()
        }));
        
        // Avanzar
        this.nextCard();
        
        // Verificar si la sesión terminó
        if (this.isComplete()) {
            await this.endSession();
        }
        
        return this.getProgress();
    }
    
    calculateXP(responseTimeMs) {
        const timeSec = responseTimeMs / 1000;
        let xp = 10;
        if (timeSec < 5) xp += 5;
        else if (timeSec < 10) xp += 2;
        return xp;
    }
    
    getProgress() {
        return {
            current: this.currentIndex,
            total: this.sessionCards.length,
            correct: this.stats.correct,
            remaining: this.sessionCards.length - this.currentIndex,
            percentage: (this.stats.correct / this.stats.total) * 100,
            xpEarned: this.stats.xpEarned
        };
    }
    
    isComplete() {
        return this.currentIndex >= this.sessionCards.length;
    }
    
    // Finalizar sesión y guardar en Firestore
    async endSession() {
        this.stats.endTime = new Date();
        const durationMinutes = Math.round((this.stats.endTime - this.stats.startTime) / 1000 / 60);
        const accuracy = (this.stats.correct / this.stats.total) * 100;
        
        const sessionData = {
            userId: this.userId,
            deckId: this.currentSession.deckId,
            cardsReviewed: this.stats.total,
            cardsCorrect: this.stats.correct,
            accuracy: accuracy,
            xpEarned: this.stats.xpEarned,
            durationMinutes: durationMinutes,
            timestamp: new Date(),
            responses: this.currentSession.responses
        };
        
        try {
            await this.db.collection('study_sessions').add(sessionData);
            showMessage(`🎉 Sesión completada! ${this.stats.correct}/${this.stats.total} - +${this.stats.xpEarned} XP`);
        } catch (error) {
            console.error('Error guardando sesión:', error);
        }
        
        // Actualizar estadísticas del usuario
        await this.updateUserStats();
        
        return sessionData;
    }
    
    async updateUserStats() {
        const userRef = this.db.collection('users').doc(this.userId);
        const userDoc = await userRef.get();
        const userData = userDoc.data() || {};
        const stats = userData.stats || {};
        
        stats.totalXP = (stats.totalXP || 0) + this.stats.xpEarned;
        stats.totalQuestionsAnswered = (stats.totalQuestionsAnswered || 0) + this.stats.total;
        stats.correctAnswers = (stats.correctAnswers || 0) + this.stats.correct;
        stats.totalStudyTime = (stats.totalStudyTime || 0) + Math.round((this.stats.endTime - this.stats.startTime) / 1000 / 60);
        stats.level = Math.floor(stats.totalXP / 500) + 1;
        
        await userRef.set({ stats }, { merge: true });
    }
    
    // Obtener sesiones anteriores
    async getPastSessions(limit = 10) {
        const snapshot = await this.db.collection('study_sessions')
            .where('userId', '==', this.userId)
            .orderBy('timestamp', 'desc')
            .limit(limit)
            .get();
        
        const sessions = [];
        snapshot.forEach(doc => sessions.push({ id: doc.id, ...doc.data() }));
        return sessions;
    }
    
    // Obtener estadísticas de progreso por tema
    async getTopicProgress() {
        const cardsRef = this.db.collection('cards').where('userId', '==', this.userId);
        const snapshot = await cardsRef.get();
        
        const topicsMap = new Map();
        
        for (const doc of snapshot.docs) {
            const card = doc.data();
            const topic = card.topic || 'general';
            
            if (!topicsMap.has(topic)) {
                topicsMap.set(topic, { total: 0, correct: 0 });
            }
            
            const history = card.adaptive?.history || [];
            const correctCount = history.filter(h => h.correct).length;
            const totalCount = history.length;
            
            const topicData = topicsMap.get(topic);
            topicData.total += totalCount;
            topicData.correct += correctCount;
        }
        
        const progress = [];
        for (const [topic, data] of topicsMap) {
            const accuracy = data.total > 0 ? (data.correct / data.total) * 100 : 0;
            progress.push({ topic, accuracy, totalQuestions: data.total });
        }
        
        return progress.sort((a, b) => a.accuracy - b.accuracy);
    }
    
    // Suscribirse a actualizaciones de sesión
    onProgress(callback) {
        this.activeCallbacks.push(callback);
        return () => {
            const index = this.activeCallbacks.indexOf(callback);
            if (index > -1) this.activeCallbacks.splice(index, 1);
        };
    }
}

// Exportar
window.StudySession = StudySession;