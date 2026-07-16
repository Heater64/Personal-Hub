// ia-lab.js - Asistente IA con Groq y Mistral

let currentModel = 'groq';
let apiKeys = {};
let chatHistory = [];
let isThinking = false;
let currentAbortController = null;

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icon = { success: 'check-circle', error: 'alert-circle', warning: 'alert-triangle', info: 'info' }[type] || 'info';
    
    toast.innerHTML = `
        <i data-lucide="${icon}"></i>
        <div class="toast-content">${escapeHtml(message)}</div>
        <button class="toast-close">✕</button>
    `;
    
    container.appendChild(toast);
    if (typeof lucide !== 'undefined') lucide.createIcons();
    
    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.addEventListener('click', () => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 300);
    });
    
    setTimeout(() => {
        if (toast.parentElement) {
            toast.classList.add('fade-out');
            setTimeout(() => toast.remove(), 300);
        }
    }, 5000);
}

const PROVIDERS = {
    groq: {
        name: 'Groq',
        url: 'https://api.groq.com/openai/v1/chat/completions',
        model: 'llama-3.3-70b-versatile',
        getHeaders: (key) => ({ 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' }),
        getBody: (messages) => ({ model: 'llama-3.3-70b-versatile', messages: messages, temperature: 0.7 }),
        parseResponse: (data) => data.choices[0].message.content
    },
    mistral: {
        name: 'Mistral',
        url: 'https://api.mistral.ai/v1/chat/completions',
        model: 'mistral-tiny',
        getHeaders: (key) => ({ 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' }),
        getBody: (messages) => ({ model: 'mistral-tiny', messages: messages, temperature: 0.7 }),
        parseResponse: (data) => data.choices[0].message.content
    }
};

function loadApiKeys() {
    const saved = localStorage.getItem('ia_api_keys');
    if (saved) {
        try { apiKeys = JSON.parse(saved); } catch(e) {}
    }
    loadChatHistory();
}

function saveApiKeysToLocal() {
    localStorage.setItem('ia_api_keys', JSON.stringify(apiKeys));
}

function saveChatHistory() {
    try { localStorage.setItem('ia_chat_history', JSON.stringify(chatHistory.slice(-50))); } catch(e) {}
}

function loadChatHistory() {
    try {
        const saved = localStorage.getItem('ia_chat_history');
        if (saved) {
            chatHistory = JSON.parse(saved);
            renderMessages();
        }
    } catch(e) {}
}

function isApiKeyConfigured(model) {
    return apiKeys[model] && apiKeys[model].trim().length > 10;
}

function updateApiStatus() {
    const statusDot = document.getElementById('statusIndicator');
    const statusText = document.getElementById('statusText');
    if (!statusDot) return;
    
    if (isApiKeyConfigured(currentModel)) {
        statusDot.className = 'status-dot ready';
        statusText.textContent = `${PROVIDERS[currentModel].name} lista`;
    } else {
        statusDot.className = 'status-dot error';
        statusText.textContent = `${PROVIDERS[currentModel].name} - Configura API key`;
    }
}

async function renderMessages() {
    const container = document.getElementById('chatMessages');
    if (!container) return;
    
    if (chatHistory.length === 0) {
        container.innerHTML = `
            <div class="message ia">
                <div class="message-avatar"><i data-lucide="bot"></i></div>
                <div class="message-content">
                    <div class="message-text">
                        ✨ ¡Hola! Soy tu asistente personal.<br><br>
                        Puedo ayudarte con preguntas, consejos, información y mucho más.<br><br>
                        ¿En qué puedo ayudarte hoy?
                    </div>
                    <div class="message-time">Ahora</div>
                </div>
            </div>
        `;
        if (typeof lucide !== 'undefined') lucide.createIcons();
        return;
    }
    
    container.innerHTML = chatHistory.map(msg => {
        const isThinkingMsg = msg.isThinking;
        const content = isThinkingMsg ? 'Pensando<span class="thinking-dots"><span>.</span><span>.</span><span>.</span></span>' : escapeHtml(msg.content);
        
        return `
            <div class="message ${msg.role === 'user' ? 'user' : 'ia'}">
                <div class="message-avatar"><i data-lucide="${msg.role === 'user' ? 'user' : 'bot'}"></i></div>
                <div class="message-content">
                    <div class="message-text">${content}</div>
                    <div class="message-time">${new Date(msg.timestamp).toLocaleTimeString()}</div>
                </div>
            </div>
        `;
    }).join('');
    
    container.scrollTop = container.scrollHeight;
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

async function callAI(messages) {
    const provider = PROVIDERS[currentModel];
    const apiKey = apiKeys[currentModel];
    
    if (!apiKey) throw new Error(`API key de ${provider.name} no configurada`);
    
    if (currentAbortController) currentAbortController.abort();
    currentAbortController = new AbortController();
    
    const response = await fetch(provider.url, {
        method: 'POST',
        headers: provider.getHeaders(apiKey),
        body: JSON.stringify(provider.getBody(messages)),
        signal: currentAbortController.signal
    });
    
    if (!response.ok) {
        let errorMsg = `Error ${response.status}`;
        if (response.status === 401) errorMsg = `API key de ${provider.name} inválida`;
        else if (response.status === 429) errorMsg = 'Demasiadas peticiones, espera un momento';
        throw new Error(errorMsg);
    }
    
    const data = await response.json();
    return provider.parseResponse(data);
}

async function sendMessage() {
    const input = document.getElementById('chatInput');
    const sendBtn = document.getElementById('sendBtn');
    const question = input.value.trim();
    
    if (!question || isThinking) return;
    
    if (!isApiKeyConfigured(currentModel)) {
        showToast(`Configura la API key de ${PROVIDERS[currentModel].name} primero`, 'warning');
        openApiModal();
        return;
    }
    
    input.value = '';
    sendBtn.disabled = true;
    isThinking = true;
    
    chatHistory.push({ role: 'user', content: question, timestamp: new Date() });
    await renderMessages();
    saveChatHistory();
    
    chatHistory.push({ role: 'assistant', content: '', timestamp: new Date(), isThinking: true });
    await renderMessages();
    
    try {
        const contextMessages = [
            { role: 'system', content: 'Eres un asistente amable y útil. Responde de forma clara y concisa.' },
            ...chatHistory.filter(m => !m.isThinking).slice(-8).map(m => ({ role: m.role, content: m.content }))
        ];
        
        const response = await callAI(contextMessages);
        
        chatHistory.pop();
        chatHistory.push({ role: 'assistant', content: response, timestamp: new Date() });
        await renderMessages();
        saveChatHistory();
        
    } catch (error) {
        chatHistory.pop();
        chatHistory.push({ role: 'assistant', content: `❌ ${error.message}`, timestamp: new Date() });
        await renderMessages();
        showToast(error.message, 'error');
    }
    
    isThinking = false;
    sendBtn.disabled = false;
    input.focus();
    input.style.height = 'auto';
}

function clearChat() {
    if (confirm('¿Borrar la conversación?')) {
        chatHistory = [];
        saveChatHistory();
        renderMessages();
        showToast('Conversación limpiada', 'success');
    }
}

function openApiModal() {
    document.getElementById('groqKey').value = apiKeys.groq || '';
    document.getElementById('mistralKey').value = apiKeys.mistral || '';
    document.getElementById('apiModal').style.display = 'flex';
}

function closeApiModal() {
    document.getElementById('apiModal').style.display = 'none';
}

function saveApiKeysModal() {
    apiKeys = {
        groq: document.getElementById('groqKey').value.trim(),
        mistral: document.getElementById('mistralKey').value.trim()
    };
    saveApiKeysToLocal();
    closeApiModal();
    updateApiStatus();
    showToast('API Keys guardadas', 'success');
}

function switchModel(model) {
    if (currentAbortController) currentAbortController.abort();
    currentModel = model;
    document.querySelectorAll('.model-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.model === model);
    });
    updateApiStatus();
    showToast(`Cambiado a ${PROVIDERS[model].name}`, 'info');
}

function setupEvents() {
    const input = document.getElementById('chatInput');
    const sendBtn = document.getElementById('sendBtn');
    
    if (input) {
        input.addEventListener('input', () => {
            sendBtn.disabled = !input.value.trim() || isThinking;
            input.style.height = 'auto';
            input.style.height = Math.min(input.scrollHeight, 120) + 'px';
        });
        
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey && !sendBtn.disabled && input.value.trim() && !isThinking) {
                e.preventDefault();
                sendMessage();
            }
        });
    }
    
    document.getElementById('sendBtn')?.addEventListener('click', sendMessage);
    document.getElementById('clearBtn')?.addEventListener('click', clearChat);
    document.getElementById('configApiBtn')?.addEventListener('click', openApiModal);
    document.getElementById('saveApiBtn')?.addEventListener('click', saveApiKeysModal);
    document.getElementById('cancelApiBtn')?.addEventListener('click', closeApiModal);
    document.getElementById('closeModalBtn')?.addEventListener('click', closeApiModal);
    
    document.querySelectorAll('.model-btn').forEach(btn => {
        btn.addEventListener('click', () => switchModel(btn.dataset.model));
    });
    
    document.querySelectorAll('.suggestion').forEach(btn => {
        btn.addEventListener('click', () => {
            const prompt = btn.dataset.prompt;
            if (prompt) {
                document.getElementById('chatInput').value = prompt;
                sendMessage();
            }
        });
    });
    
    document.getElementById('apiModal')?.addEventListener('click', (e) => {
        if (e.target.id === 'apiModal') closeApiModal();
    });
}

document.addEventListener('DOMContentLoaded', () => {
    loadApiKeys();
    setupEvents();
    updateApiStatus();
    if (typeof lucide !== 'undefined') lucide.createIcons();
    document.getElementById('apiModal').style.display = 'none';
});