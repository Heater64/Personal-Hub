// js/study/spaced-repetition.js
// Basado en el algoritmo SuperMemo 2 (SM-2) con adaptaciones

class SpacedRepetition {
  
  // Calcular próximo intervalo según resultado
  static calculateNextReview(card, quality) {
    // quality: 0=error grave, 1=error, 2=difícil, 3=bien, 4=fácil, 5=muy fácil
    const { easiness, repetitions, interval } = card.adaptive;
    
    let newEasiness = easiness;
    let newRepetitions = repetitions;
    let newInterval = interval;
    
    // Actualizar factor de facilidad
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
      
      // Límite máximo de 365 días
      if (newInterval > 365) newInterval = 365;
      
    } else {
      // Respuesta incorrecta
      newRepetitions = 0;
      newInterval = 0; // Repasar hoy mismo
      
      // Reducir factor de facilidad más agresivamente
      newEasiness = Math.max(1.3, easiness - 0.2);
    }
    
    return {
      easiness: newEasiness,
      repetitions: newRepetitions,
      interval: newInterval,
      nextReview: newInterval === 0 
        ? new Date() 
        : new Date(Date.now() + newInterval * 24 * 60 * 60 * 1000)
    };
  }
  
  // Obtener cartas para estudiar hoy
  static getCardsToStudy(cards, limit = 20) {
    const now = new Date();
    
    return cards
      .filter(card => new Date(card.adaptive.nextReview) <= now)
      .sort((a, b) => {
        // Priorizar cartas con más fallos consecutivos
        const aPenalty = a.adaptive.consecutiveWrong * 2;
        const bPenalty = b.adaptive.consecutiveWrong * 2;
        return (bPenalty - aPenalty) || (a.adaptive.nextReview - b.adaptive.nextReview);
      })
      .slice(0, limit);
  }
  
  // Detectar temas débiles automáticamente
  static detectWeakTopics(cards, minSampleSize = 5) {
    const topicsMap = new Map();
    
    for (const card of cards) {
      if (!card.adaptive.history || card.adaptive.history.length < minSampleSize) continue;
      
      const accuracy = card.adaptive.history.filter(h => h.correct).length / card.adaptive.history.length;
      const avgTime = card.adaptive.history.reduce((sum, h) => sum + h.responseTime, 0) / card.adaptive.history.length;
      
      if (!topicsMap.has(card.topic)) {
        topicsMap.set(card.topic, { cards: [], totalAccuracy: 0, totalTime: 0 });
      }
      
      const topicData = topicsMap.get(card.topic);
      topicData.cards.push(card);
      topicData.totalAccuracy += accuracy;
      topicData.totalTime += avgTime;
    }
    
    const weakTopics = [];
    for (const [topic, data] of topicsMap) {
      const avgAccuracy = data.totalAccuracy / data.cards.length;
      const avgTime = data.totalTime / data.cards.length;
      
      if (avgAccuracy < 0.7 || avgTime > 10) { // Umbrales ajustables
        weakTopics.push({
          topic,
          strength: avgAccuracy,
          averageResponseTime: avgTime,
          cardCount: data.cards.length
        });
      }
    }
    
    return weakTopics.sort((a, b) => a.strength - b.strength);
  }
  
  // Generar plan de estudio adaptativo
  static generateStudyPlan(weakTopics, availableCards, dailyGoal = 20) {
    const plan = {
      priorityCards: [],
      reviewCards: [],
      newCards: [],
      totalCards: 0
    };
    
    // 1. Priorizar cartas de temas débiles
    for (const topic of weakTopics) {
      const cardsInTopic = availableCards.filter(c => c.topic === topic.topic);
      const failedCards = cardsInTopic.filter(c => 
        c.adaptive.consecutiveWrong > 0 || 
        (c.adaptive.history?.filter(h => !h.correct).length || 0) > 2
      );
      plan.priorityCards.push(...failedCards);
    }
    
    // 2. Cartas para repaso (vencidas por SM-2)
    plan.reviewCards = SpacedRepetition.getCardsToStudy(availableCards, dailyGoal);
    
    // 3. Limitar según objetivo diario
    const totalNeeded = Math.min(dailyGoal, plan.priorityCards.length + plan.reviewCards.length);
    plan.totalCards = totalNeeded;
    
    return plan;
  }
}