// js/study/adaptive-engine.js

class AdaptiveEngine {
    constructor(userId, db) {
        this.userId = userId;
        this.db = db;
        
        // Umbrales de dificultad
        this.difficultyThresholds = {
            easy: 0.85,      // 85%+ aciertos → subir dificultad
            medium: 0.65,    // 65-85% → mantener
            hard: 0.45       // <45% → bajar dificultad
        };
    }

    // ========== ALGORITMO SM-2 (Repetición Espaciada) ==========
    calculateNextReview(card, quality) {
        // quality: 0=error, 1=difícil, 2=bien, 3=muy bien, 4=perfecto
        const { easiness = 2.5, repetitions = 0, interval = 0 } = card.adaptive || {};
        
        let newEasiness = easiness;
        let newRepetitions = repetitions;
        let newInterval = interval;
        
        // Actualizar factor de facilidad (SM-2)
        newEasiness = easiness + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
        if (newEasiness < 1.3) newEasiness = 1.3;
        
        if (quality >= 3) {
            // Respuesta correcta
            newRepetitions++;
            
            if (newRepetitions === 1) {
                newInterval = 1;
            } else if (newRepetitions === 2) {
                newInterval = 6;
            } else {
                newInterval = Math.round(interval * newEasiness);
            }
            
            newInterval = Math.min(newInterval, 365); // Máximo 1 año
            
        } else {
            // Respuesta incorrecta
            newRepetitions = 0;
            newInterval = 0;
            newEasiness = Math.max(1.3, easiness - 0.2);
        }
        
        const nextReview = newInterval === 0 
            ? new Date() 
            : new Date(Date.now() + newInterval * 24 * 60 * 60 * 1000);
        
        return {
            easiness: newEasiness,
            repetitions: newRepetitions,
            interval: newInterval,
            nextReview: nextReview,
            consecutiveCorrect: quality >= 3 ? (card.adaptive?.consecutiveCorrect || 0) + 1 : 0,
            consecutiveWrong: quality < 3 ? (card.adaptive?.consecutiveWrong || 0) + 1 : 0
        };
    }

    // ========== CALIDAD DE RESPUESTA (0-4) ==========
    calculateQuality(isCorrect, responseTimeMs) {
        if (!isCorrect) return 0;
        
        const timeSec = responseTimeMs / 1000;
        if (timeSec < 3) return 4;      // Muy rápido
        if (timeSec < 6) return 3;      // Rápido
        if (timeSec < 12) return 2;     // Normal
        return 1;                        // Lento pero correcto
    }

    // ========== AJUSTAR DIFICULTAD ==========
    adjustDifficulty(card) {
        const history = card.adaptive?.history || [];
        if (history.length < 5) return card.difficulty || 3;
        
        const recentAccuracy = history.slice(-10).filter(h => h.correct).length / Math.min(10, history.length);
        
        if (recentAccuracy >= this.difficultyThresholds.easy && (card.difficulty || 3) < 5) {
            return Math.min(5, (card.difficulty || 3) + 0.3);
        }
        if (recentAccuracy <= this.difficultyThresholds.hard && (card.difficulty || 3) > 1) {
            return Math.max(1, (card.difficulty || 3) - 0.3);
        }
        return card.difficulty || 3;
    }

    // ========== CALCULAR XP ==========
    calculateXP(isCorrect, responseTimeMs, streakBonus = 0) {
        if (!isCorrect) return 5;
        
        const timeSec = responseTimeMs / 1000;
        let xp = 10; // Base
        
        if (timeSec < 5) xp += 5;
        else if (timeSec < 10) xp += 2;
        
        xp += streakBonus * 2;
        
        return xp;
    }

    // ========== PROCESAR RESPUESTA ==========
    async processAnswer(cardId, userAnswer, responseTimeMs, currentStreak = 0) {
        const cardRef = this.db.collection('cards').doc(cardId);
        const cardDoc = await cardRef.get();
        const card = cardDoc.data();
        
        const isCorrect = this.checkAnswer(card, userAnswer);
        const quality = this.calculateQuality(isCorrect, responseTimeMs);
        const newSchedule = this.calculateNextReview(card, quality);
        const newDifficulty = this.adjustDifficulty(card);
        const xpEarned = this.calculateXP(isCorrect, responseTimeMs, currentStreak);
        
        // Actualizar historial
        const newHistory = [
            ...(card.adaptive?.history || []),
            { correct: isCorrect, responseTime: responseTimeMs, timestamp: new Date(), quality }
        ].slice(-50); // Mantener últimos 50 registros
        
        // Guardar cambios
        await cardRef.update({
            'adaptive.easiness': newSchedule.easiness,
            'adaptive.repetitions': newSchedule.repetitions,
            'adaptive.interval': newSchedule.interval,
            'adaptive.nextReview': newSchedule.nextReview,
            'adaptive.consecutiveCorrect': newSchedule.consecutiveCorrect,
            'adaptive.consecutiveWrong': newSchedule.consecutiveWrong,
            'adaptive.history': newHistory,
            'adaptive.lastReview': new Date(),
            difficulty: newDifficulty,
            lastResponse: { isCorrect, responseTime: responseTimeMs, timestamp: new Date() }
        });
        
        // Actualizar estadísticas del usuario
        await this.updateUserStats(isCorrect, xpEarned);
        
        // Detectar temas débiles
        const weakTopics = await this.detectWeakTopics();
        
        return {
            isCorrect,
            quality,
            xpEarned,
            newDifficulty,
            nextReview: newSchedule.nextReview,
            weakTopics
        };
    }

    // ========== COMPROBAR RESPUESTA ==========
    checkAnswer(card, userAnswer) {
        const normalizedUser = userAnswer.toLowerCase().trim();
        const normalizedCorrect = card.correctAnswer.toLowerCase().trim();
        
        if (card.type === 'multiple_choice') {
            return normalizedUser === normalizedCorrect;
        }
        
        if (card.type === 'true_false') {
            return normalizedUser === normalizedCorrect;
        }
        
        // Para flashcards, comprobar similitud (puede mejorarse con IA)
        return normalizedUser === normalizedCorrect || 
               normalizedCorrect.includes(normalizedUser) ||
               normalizedUser.includes(normalizedCorrect);
    }

    // ========== ACTUALIZAR ESTADÍSTICAS DEL USUARIO ==========
    async updateUserStats(isCorrect, xpEarned) {
        const userRef = this.db.collection('users').doc(this.userId);
        const userDoc = await userRef.get();
        const userData = userDoc.data() || {};
        
        const stats = userData.stats || {
            totalXP: 0,
            level: 1,
            currentStreak: 0,
            longestStreak: 0,
            totalStudyTime: 0,
            totalQuestionsAnswered: 0,
            correctAnswers: 0,
            lastStudyDate: null
        };
        
        const today = new Date().toDateString();
        const lastStudy = stats.lastStudyDate ? new Date(stats.lastStudyDate).toDateString() : null;
        
        // Actualizar racha
        if (lastStudy === today) {
            // Ya estudió hoy, no cambiar racha
        } else if (lastStudy === new Date(Date.now() - 86400000).toDateString()) {
            stats.currentStreak++;
            stats.longestStreak = Math.max(stats.longestStreak, stats.currentStreak);
        } else {
            stats.currentStreak = 1;
        }
        
        stats.lastStudyDate = new Date();
        stats.totalXP += xpEarned;
        stats.totalQuestionsAnswered++;
        if (isCorrect) stats.correctAnswers++;
        stats.totalStudyTime += 30; // Asumimos 30 segundos por pregunta
        
        // Calcular nivel (cada 500 XP)
        stats.level = Math.floor(stats.totalXP / 500) + 1;
        
        await userRef.set({ stats }, { merge: true });
        
        return stats;
    }

    // ========== DETECTAR TEMAS DÉBILES ==========
    async detectWeakTopics(minCardsPerTopic = 3) {
        const cardsRef = this.db.collection('cards').where('userId', '==', this.userId);
        const cardsSnapshot = await cardsRef.get();
        
        const topicsMap = new Map();
        
        for (const doc of cardsSnapshot.docs) {
            const card = doc.data();
            const topic = card.topic || 'general';
            const history = card.adaptive?.history || [];
            
            if (!topicsMap.has(topic)) {
                topicsMap.set(topic, { cards: [], correct: 0, total: 0, avgTime: 0 });
            }
            
            const topicData = topicsMap.get(topic);
            topicData.cards.push(card);
            
            for (const response of history) {
                topicData.total++;
                if (response.correct) topicData.correct++;
                topicData.avgTime += response.responseTime || 0;
            }
        }
        
        const weakTopics = [];
        for (const [topic, data] of topicsMap) {
            if (data.cards.length < minCardsPerTopic) continue;
            
            const accuracy = data.total > 0 ? data.correct / data.total : 1;
            const avgTime = data.total > 0 ? data.avgTime / data.total : 0;
            
            if (accuracy < 0.7 || avgTime > 10000) { // Menos del 70% o más de 10 segundos
                weakTopics.push({
                    topic,
                    accuracy: Math.round(accuracy * 100),
                    avgResponseTime: Math.round(avgTime / 1000),
                    cardCount: data.cards.length,
                    priority: accuracy < 0.5 ? 'high' : 'medium'
                });
            }
        }
        
        // Guardar temas débiles en el usuario
        const userRef = this.db.collection('users').doc(this.userId);
        await userRef.set({ weakTopics }, { merge: true });
        
        return weakTopics.sort((a, b) => a.accuracy - b.accuracy);
    }

    // ========== OBTENER CARTAS PARA ESTUDIAR (Repetición Espaciada) ==========
    async getCardsToStudy(deckId = null, limit = 20) {
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
        
        // Ordenar por prioridad: más fallos consecutivos → primero
        cards.sort((a, b) => {
            const aWrong = a.adaptive?.consecutiveWrong || 0;
            const bWrong = b.adaptive?.consecutiveWrong || 0;
            return bWrong - aWrong;
        });
        
        return cards.slice(0, limit);
    }

    // ========== GENERAR PLAN DE ESTUDIO ==========
    async generateStudyPlan(deckId = null, dailyGoal = 20) {
        const dueCards = await this.getCardsToStudy(deckId, dailyGoal);
        const weakTopics = await this.detectWeakTopics();
        
        // Priorizar cartas de temas débiles
        const weakTopicNames = new Set(weakTopics.map(t => t.topic));
        const priorityCards = dueCards.filter(c => weakTopicNames.has(c.topic));
        const otherCards = dueCards.filter(c => !weakTopicNames.has(c.topic));
        
        const finalCards = [...priorityCards, ...otherCards].slice(0, dailyGoal);
        
        return {
            cards: finalCards,
            stats: {
                total: finalCards.length,
                priority: priorityCards.length,
                review: otherCards.length,
                weakTopics: weakTopics.slice(0, 3)
            },
            generatedAt: new Date()
        };
    }
}