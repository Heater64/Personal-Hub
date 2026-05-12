// api/generate-cards.js - Vercel Serverless Function
// NUNCA expone tus API keys al cliente

const PROVIDERS = {
    groq: {
        url: 'https://api.groq.com/openai/v1/chat/completions',
        model: 'llama-3.3-70b-versatile',
        getBody: (prompt) => ({
            model: 'llama-3.3-70b-versatile',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.7
        })
    },
    gemini: {
        url: (key) => `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`,
        getBody: (prompt) => ({ contents: [{ parts: [{ text: prompt }] }] })
    },
    mistral: {
        url: 'https://api.mistral.ai/v1/chat/completions',
        model: 'mistral-tiny',
        getBody: (prompt) => ({
            model: 'mistral-tiny',
            messages: [{ role: 'user', content: prompt }]
        })
    }
};

// Tus API keys están SEGURAS aquí (solo en el servidor)
const API_KEYS = {
    groq: process.env.GROQ_API_KEY,
    gemini: process.env.GEMINI_API_KEY,
    mistral: process.env.MISTRAL_API_KEY
};

const PROMPT_TEMPLATE = `Eres un profesor que crea tarjetas de estudio (flashcards). 
Basado en el siguiente texto, genera entre 5 y 10 tarjetas con formato PREGUNTA → RESPUESTA.

REGLAS:
1. Cada tarjeta debe tener una pregunta clara y una respuesta corta pero completa
2. Las preguntas deben cubrir los conceptos más importantes del texto
3. Formato EXACTO (una línea por tarjeta, separado por "→"):
   pregunta → respuesta

EJEMPLO:
¿Quién es el emisor en la comunicación? → La persona o entidad que crea y transmite el mensaje
¿Qué es el canal de comunicación? → El medio físico o digital por el que viaja el mensaje

TEXTO:
"""
%s
"""`;

export default async function handler(req, res) {
    // Solo aceptar POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método no permitido' });
    }
    
    const { text, provider = 'groq' } = req.body;
    
    if (!text) {
        return res.status(400).json({ error: 'No se proporcionó texto' });
    }
    
    const providerConfig = PROVIDERS[provider];
    const apiKey = API_KEYS[provider];
    
    if (!apiKey) {
        return res.status(500).json({ error: `API key para ${provider} no configurada` });
    }
    
    const prompt = PROMPT_TEMPLATE.replace('%s', text);
    
    try {
        let url = providerConfig.url;
        if (typeof url === 'function') {
            url = url(apiKey);
        }
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(providerConfig.getBody(prompt))
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        
        // Extraer el texto según el proveedor
        let generatedText = '';
        if (provider === 'groq' || provider === 'mistral') {
            generatedText = data.choices[0].message.content;
        } else if (provider === 'gemini') {
            generatedText = data.candidates[0].content.parts[0].text;
        }
        
        // Parsear las tarjetas del formato "pregunta → respuesta"
        const cards = [];
        const lines = generatedText.split('\n');
        
        for (const line of lines) {
            if (line.includes('→')) {
                const [question, answer] = line.split('→').map(s => s.trim());
                if (question && answer && question.length > 5 && answer.length > 2) {
                    cards.push({ question, answer });
                }
            }
        }
        
        res.status(200).json({ success: true, cards, provider: provider });
        
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: error.message });
    }
}