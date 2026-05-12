// js/study/tutor.js - Tutor IA con chat y memoria

const PROVIDERS = {
    groq: {
        name: 'Groq',
        url: 'https://api.groq.com/openai/v1/chat/completions',
        model: 'llama-3.3-70b-versatile',
        getHeaders: (key) => ({ 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' }),
        parseResponse: (data) => data.choices[0].message.content,
        getBody: (messages) => ({
            model: 'llama-3.3-70b-versatile',
            messages: messages,
            temperature: 0.7
        })
    },
    gemini: {
        name: 'Gemini',
        url: (key) => `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`,
        getHeaders: () => ({ 'Content-Type': 'application/json' }),
        parseResponse: (data) => data.candidates[0].content.parts[0].text,
        getBody: (messages) => ({
            contents: [{ parts: [{ text: messages.map(m => `${m.role}: ${m.content}`).join('\n') }] }]
        })
    }
};

const TUTOR_PROMPT = `Eres un tutor académico paciente y amable. Tu objetivo es ayudar al estudiante a entender conceptos, resolver dudas y explicar temas de forma clara.

REGLAS IMPORTANTES:
1. Explica de forma sencilla y usa ejemplos cuando sea útil
2. Si el estudiante no entiende, reformula tu explicación
3. Usa analogías para hacer los conceptos más accesibles
4. Sé alentador y positivo
5. No des respuestas demasiado largas, ve al grano
6. Si te preguntan por un tema que no sabes, dilo honestamente

Responde amablemente a la consulta del estudiante:`;

let chatHistory = [];
let conversations = [];
let currentConversationId = null;
let isThinking = false;

// Cargar conversaciones guardadas
function loadConversations() {
    const saved = localStorage.getItem('tutor_conversations');
    if (saved) {
        try {
            conversations = JSON.parse(saved);
        } catch(e) {}
    }
    
    if (conversations.length === 0) {
        currentConversationId = Date.now().toString();
        conversations.push({
            id: currentConversationId,
            title: 'Conversación ' + new Date().toLocaleDateString(),
            messages: [],
            createdAt: new Date().toISOString()
        });
        saveConversations();
    } else {
        currentConversationId = conversations[0].id;
        loadConversation(currentConversationId);
    }
    renderHistoryList();
}

function saveConversations() {
    localStorage.setItem('tutor_conversations', JSON.stringify(conversations));
}

function loadConversation(convId) {
    const conv = conversations.find(c => c.id === convId);
    if (conv) {
        currentConversationId = convId;
        chatHistory = [...conv.messages];
        renderMessages();
    }
}

function startNewConversation() {
    currentConversationId = Date.now().toString();
    const newConv = {
        id: currentConversationId,
        title: 'Conversación ' + new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString(),
        messages: [],
        createdAt: new Date().toISOString()
    };
    conversations.unshift(newConv);
    chatHistory = [];
    saveConversations();
    renderMessages();
    renderHistoryList();
    // Mensaje de bienvenida
    addMessage('tutor', "👋 ¡Hola! Soy tu tutor personal. ¿En qué puedo ayudarte hoy?");
}

function deleteConversation(convId) {
    conversations = conversations.filter(c => c.id !== convId);
    if (currentConversationId === convId && conversations.length > 0) {
        loadConversation(conversations[0].id);
    } else if (conversations.length === 0) {
        startNewConversation();
    }
    saveConversations();
    renderHistoryList();
    renderMessages();
}

function clearAllConversations() {
    if (confirm('¿Eliminar todas las conversaciones? Esta acción no se puede deshacer.')) {
        conversations = [];
        startNewConversation();
    }
}

function renderHistoryList() {
    const container = document.getElementById('historyList');
    if (!container) return;
    
    if (conversations.length === 0) {
        container.innerHTML = '<div class="empty-state">No hay conversaciones</div>';
        return;
    }
    
    container.innerHTML = conversations.map(conv => `
        <div class="history-item ${conv.id === currentConversationId ? 'active' : ''}" data-id="${conv.id}">
            <div class="history-question">${escapeHtml(conv.title)}</div>
            <div class="history-date">${new Date(conv.createdAt).toLocaleDateString()}</div>
        </div>
    `).join('');
    
    container.querySelectorAll('.history-item').forEach(item => {
        item.addEventListener('click', () => {
            loadConversation(item.dataset.id);
            renderHistoryList();
        });
    });
}

function addMessage(role, content) {
    const message = {
        role: role,
        content: content,
        timestamp: new Date().toISOString()
    };
    chatHistory.push(message);
    
    // Actualizar conversación
    const conv = conversations.find(c => c.id === currentConversationId);
    if (conv) {
        conv.messages = [...chatHistory];
        if (conv.messages.length > 0 && !conv.title.includes('Conversación')) {
            const firstQuestion = conv.messages.find(m => m.role === 'user');
            if (firstQuestion) {
                conv.title = firstQuestion.content.substring(0, 40) + (firstQuestion.content.length > 40 ? '...' : '');
            }
        }
        saveConversations();
        renderHistoryList();
    }
    
    renderMessages();
}

async function renderMessages() {
    const container = document.getElementById('chatMessages');
    if (!container) return;
    
    if (chatHistory.length === 0) {
        container.innerHTML = `
            <div class="message tutor">
                <div class="message-avatar"><i data-lucide="bot"></i></div>
                <div class="message-content">
                    <div class="message-text">
                        👋 ¡Hola! Soy tu tutor personal de estudio.<br>
                        Puedes preguntarme sobre cualquier tema académico.
                    </div>
                    <div class="message-time">Ahora</div>
                </div>
            </div>
        `;
        if (typeof lucide !== 'undefined') lucide.createIcons();
        return;
    }
    
    container.innerHTML = chatHistory.map(msg => `
        <div class="message ${msg.role === 'user' ? 'user' : 'tutor'}">
            <div class="message-avatar">
                <i data-lucide="${msg.role === 'user' ? 'user' : 'bot'}"></i>
            </div>
            <div class="message-content">
                <div class="message-text">${escapeHtml(msg.content)}</div>
                <div class="message-time">${new Date(msg.timestamp).toLocaleTimeString()}</div>
            </div>
        </div>
    `).join('');
    
    container.scrollTop = container.scrollHeight;
    
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

async function sendMessage() {
    const input = document.getElementById('chatInput');
    const sendBtn = document.getElementById('sendBtn');
    const statusEl = document.getElementById('chatStatus');
    const question = input.value.trim();
    
    if (!question || isThinking) return;
    
    input.value = '';
    sendBtn.disabled = true;
    isThinking = true;
    
    if (statusEl) {
        statusEl.innerHTML = '<span class="status-indicator thinking"></span><span>IA pensando...</span>';
    }
    
    // Añadir mensaje del usuario
    addMessage('user', question);
    
    try {
        // Preparar historial para contexto (últimos 10 mensajes)
        const contextMessages = [
            { role: 'system', content: TUTOR_PROMPT },
            ...chatHistory.slice(-10).map(m => ({ role: m.role, content: m.content }))
        ];
        
        const response = await callTutorAPI(contextMessages);
        
        addMessage('assistant', response);
        
        if (statusEl) {
            statusEl.innerHTML = '<span class="status-indicator"></span><span>IA lista</span>';
        }
        
    } catch (error) {
        console.error('Error:', error);
        addMessage('assistant', 'Lo siento, hubo un error. Por favor, intenta de nuevo más tarde.');
        
        if (statusEl) {
            statusEl.innerHTML = '<span class="status-indicator"></span><span>Error - Intenta de nuevo</span>';
        }
        
        setTimeout(() => {
            if (statusEl) statusEl.innerHTML = '<span class="status-indicator"></span><span>IA lista</span>';
        }, 3000);
    }
    
    isThinking = false;
    sendBtn.disabled = false;
    input.focus();
    
    // Ajustar altura del textarea
    input.style.height = 'auto';
}

async function callTutorAPI(messages) {
    // Intentar con múltiples proveedores
    const providers = ['groq', 'gemini'];
    
    for (const provider of providers) {
        try {
            const config = PROVIDERS[provider];
            if (!config) continue;
            
            // Obtener API key del localStorage
            const apiKey = localStorage.getItem(`${provider}_api_key`);
            if (!apiKey) continue;
            
            let url = config.url;
            if (typeof url === 'function') {
                url = url(apiKey);
            }
            
            const response = await fetch(url, {
                method: 'POST',
                headers: config.getHeaders(apiKey),
                body: JSON.stringify(config.getBody(messages))
            });
            
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const data = await response.json();
            return config.parseResponse(data);
            
        } catch (error) {
            console.warn(`${provider} falló:`, error);
            continue;
        }
    }
    
    // Fallback local
    return "Lo siento, no pude conectar con el servicio de IA. Por favor, verifica tu conexión o intenta más tarde.";
}

function setupTutorEvents() {
    const input = document.getElementById('chatInput');
    const sendBtn = document.getElementById('sendBtn');
    const clearHistoryBtn = document.getElementById('clearHistoryBtn');
    
    if (input) {
        input.addEventListener('input', () => {
            sendBtn.disabled = !input.value.trim() || isThinking;
            // Auto-ajuste de altura
            input.style.height = 'auto';
            input.style.height = Math.min(input.scrollHeight, 120) + 'px';
        });
        
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (!sendBtn.disabled && input.value.trim()) {
                    sendMessage();
                }
            }
        });
    }
    
    if (sendBtn) {
        sendBtn.addEventListener('click', sendMessage);
    }
    
    // Sugerencias rápidas
    document.querySelectorAll('.suggestion-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const question = chip.dataset.question;
            if (question) {
                document.getElementById('chatInput').value = question;
                sendMessage();
            }
        });
    });
    
    if (clearHistoryBtn) {
        clearHistoryBtn.addEventListener('click', clearAllConversations);
    }
    
    // Botón nueva conversación
    const newChatBtn = document.getElementById('newChatBtn');
    if (newChatBtn) {
        newChatBtn.addEventListener('click', startNewConversation);
    }
}

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    loadConversations();
    setupTutorEvents();
    
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
});