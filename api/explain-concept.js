// api/explain-concept.js

const PROVIDERS = {
    groq: { url: 'https://api.groq.com/openai/v1/chat/completions', model: 'llama-3.3-70b-versatile' },
    gemini: { url: (key) => `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}` },
    mistral: { url: 'https://api.mistral.ai/v1/chat/completions', model: 'mistral-tiny' }
};

const EXPLANATION_PROMPT = `Eres un tutor experto que explica conceptos de forma clara y adaptada al nivel del estudiante.

Concepto a explicar: "{concept}"
Respuesta del estudiante (incorrecta): "{userAttempt}"
Respuesta correcta: "{correctAnswer}"
Nivel de dificultad: {difficulty} (1=fácil, 5=difícil)

Genera una explicación amable y útil siguiendo este formato JSON:

{
  "explanation": "Explicación paso a paso de por qué la respuesta correcta es correcta",
  "simpleExplanation": "Versión ultra simple para principiantes",
  "analogy": "Una analogía sencilla para entender mejor el concepto",
  "example": "Un ejemplo concreto relacionado",
  "commonMistake": "Explicación del error común que cometió el estudiante",
  "tip": "Un consejo corto para recordar la respuesta la próxima vez"
}`;

export default async function handler(req, res) {
    const { concept, userAttempt, correctAnswer, difficulty = 3 } = req.body;
    
    const prompt = EXPLANATION_PROMPT
        .replace("{concept}", concept)
        .replace("{userAttempt}", userAttempt)
        .replace("{correctAnswer}", correctAnswer)
        .replace("{difficulty}", difficulty);
    
    // Llamar al proveedor (fallback automático)
    const result = await callWithFallback(prompt);
    
    res.status(200).json(JSON.parse(result));
}