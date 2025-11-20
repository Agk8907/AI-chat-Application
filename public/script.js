// This works for both localhost AND Render automatically.
//const API_URL = '/api';
// ... (API_URL and state vars same as before)
const API_URL = '/api';
let currentConversationId = null; 
let isEditingTitle = false;
let isRegisteringMode = false;

document.addEventListener('DOMContentLoaded', () => {
    if (window.lucide) lucide.createIcons();

    // DOM Elements
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    const mainSidebarToggle = document.getElementById('main-sidebar-toggle');
    const closeSidebarBtn = document.getElementById('close-sidebar-btn');
    
    // ... (Keep other element selections) ...
    const chatForm = document.getElementById('chat-form');
    const userInput = document.getElementById('user-input');
    const conversationList = document.getElementById('conversation-list');
    const newChatBtn = document.getElementById('new-chat-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const chatContainer = document.getElementById('chat-container');
    const authScreen = document.getElementById('auth-screen');
    const appLayout = document.getElementById('app-layout');
    const emptyState = document.getElementById('empty-state');
    const loadingIndicator = document.getElementById('loading-indicator');
    const userDisplay = document.getElementById('user-display');
    const voiceBtn = document.getElementById('voice-btn');
    const settingsBtn = document.getElementById('settings-btn');
    const settingsModal = document.getElementById('settings-modal');
    const closeSettingsBtn = document.getElementById('close-settings');
    const settingsForm = document.getElementById('settings-form');
    const authForm = document.getElementById('auth-form');
    const toggleAuthBtn = document.getElementById('toggle-auth-mode');
    const authSubmitBtn = authForm ? authForm.querySelector('button') : null;

    // --- DRAWER TOGGLE LOGIC ---
    function openSidebar() {
        sidebar.classList.remove('-translate-x-full');
        backdrop.classList.remove('hidden');
        setTimeout(() => backdrop.classList.remove('opacity-0'), 10); // Fade in
    }

    function closeSidebar() {
        sidebar.classList.add('-translate-x-full');
        backdrop.classList.add('opacity-0');
        setTimeout(() => backdrop.classList.add('hidden'), 300); // Fade out
    }

    if (mainSidebarToggle) {
        mainSidebarToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            openSidebar();
        });
    }

    if (closeSidebarBtn) {
        closeSidebarBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            closeSidebar();
        });
    }
    
    if (backdrop) {
        backdrop.addEventListener('click', closeSidebar);
    }

    // --- AUTH CHECK ---
    const token = localStorage.getItem('token');
    if (token) {
        initApp(localStorage.getItem('username'), token);
    } else {
        document.getElementById('auth-screen').classList.remove('hidden');
        document.getElementById('app-layout').classList.add('hidden');
    }

    function initApp(username, tkn) {
        document.getElementById('auth-screen').classList.add('hidden');
        document.getElementById('app-layout').classList.remove('hidden');
        document.getElementById('user-display').innerText = username;
        loadConversations(tkn);
    }

    // ... (Rest of logic: Auth handlers, Chat loading, etc. keep EXACTLY as previous) ...
    // Paste the rest of the functions from the previous working script here.
    
    // Example for loadConversations (Make sure to include):
    async function loadConversations(token) {
        try {
            const res = await fetch(API_URL + '/conversations', { headers: { 'Authorization': token } });
            if (res.status === 401) { localStorage.clear(); location.reload(); return; }
            if (!res.ok) return;
            const conversations = await res.json();
            renderConversationList(conversations, token);
        } catch (err) { console.error("Load error", err); }
    }

    function renderConversationList(conversations, token) {
        if (!conversationList) return;
        conversationList.innerHTML = '';
        const groups = { 'Today': [], 'Yesterday': [], 'Older': [] };
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);

        conversations.forEach(convo => {
            const date = new Date(convo.updatedAt);
            const cDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
            if (cDate.getTime() === today.getTime()) groups['Today'].push(convo);
            else if (cDate.getTime() === yesterday.getTime()) groups['Yesterday'].push(convo);
            else groups['Older'].push(convo);
        });

        for (const [label, convos] of Object.entries(groups)) {
            if (convos.length > 0) {
                const header = document.createElement('div');
                header.className = 'convo-header';
                header.innerText = label;
                conversationList.appendChild(header);
                convos.forEach(convo => {
                    const btn = document.createElement('div');
                    btn.className = 'convo-item group';
                    if (convo._id === currentConversationId) btn.classList.add('active');
                    const safeTitle = convo.title.replace(/</g, "&lt;").replace(/>/g, "&gt;");
                    btn.innerHTML = `
                        <div class="convo-info">
                            <i data-lucide="message-square" class="w-4 h-4 flex-shrink-0 text-gray-400"></i>
                            <span class="convo-text" title="${safeTitle}" id="title-${convo._id}">${safeTitle}</span>
                        </div>
                        <div class="convo-actions">
                            <button class="convo-action-btn" onclick="editConversation('${convo._id}', event)" title="Rename"><i data-lucide="pencil" class="w-3 h-3"></i></button>
                            <button class="convo-action-btn delete" onclick="deleteConversation('${convo._id}', event)" title="Delete"><i data-lucide="trash-2" class="w-3 h-3"></i></button>
                        </div>`;
                    btn.onclick = (e) => {
                        if (!e.target.closest('.convo-action-btn') && !e.target.closest('input') && !isEditingTitle) {
                            selectConversation(convo._id, token);
                            // Close sidebar on mobile/desktop after select
                            closeSidebar();
                        }
                    };
                    conversationList.appendChild(btn);
                });
            }
        }
        if (window.lucide) lucide.createIcons();
    }
    
    // ... (Keep Chat Submit, Voice, Settings, Helper functions) ...
    // IMPORTANT: Include the fillSearchInput logic for suggestions
    
    // Chat Submit Logic
    if (chatForm) {
        chatForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const text = userInput.value.trim();
            const token = localStorage.getItem('token');
            if (!text || !token) return;
            if (!currentConversationId) {
                try {
                    const res = await fetch(API_URL + '/conversations', { method: 'POST', headers: { 'Authorization': token } });
                    const newConvo = await res.json();
                    currentConversationId = newConvo._id;
                } catch(err) { return; }
            }
            userInput.value = '';
            addMessage(text, 'user');
            scrollToBottom();
            if(emptyState) emptyState.style.display = 'none';
            const botMessageBubble = addMessage("", 'model');
            const botContentDiv = botMessageBubble.querySelector('.msg-bot');
            try {
                const response = await fetch(API_URL + '/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': token },
                    body: JSON.stringify({ text, conversationId: currentConversationId })
                });
                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let fullText = "";
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    const chunk = decoder.decode(value, { stream: true });
                    fullText += chunk;
                    if (typeof marked !== 'undefined') {
                        botContentDiv.innerHTML = marked.parse(fullText);
                        if (window.Prism) Prism.highlightAllUnder(botContentDiv);
                        injectCopyButtons(botContentDiv);
                    } else {
                        botContentDiv.innerText = fullText;
                    }
                    scrollToBottom();
                }
                loadConversations(token);
            } catch (err) { botContentDiv.innerText = "Error connecting to server."; }
        });
    }

    if (newChatBtn) {
        newChatBtn.addEventListener('click', async () => {
            const token = localStorage.getItem('token');
            try {
                const res = await fetch(API_URL + '/conversations', { method: 'POST', headers: { 'Authorization': token } });
                const newConvo = await res.json();
                selectConversation(newConvo._id, token);
                closeSidebar();
            } catch (err) {}
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.clear();
            location.reload();
        });
    }

    // Settings
    if (settingsBtn && settingsModal) {
        settingsBtn.addEventListener('click', () => settingsModal.classList.remove('hidden'));
        closeSettingsBtn.addEventListener('click', () => settingsModal.classList.add('hidden'));
        settingsForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('settings-username').value;
            const password = document.getElementById('settings-password').value;
            const token = localStorage.getItem('token');
            try {
                const res = await fetch(`${API_URL}/user`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', 'Authorization': token },
                    body: JSON.stringify({ username, password })
                });
                if (res.ok) {
                    alert("Updated!");
                    settingsModal.classList.add('hidden');
                    if(username) {
                        localStorage.setItem('username', username);
                        userDisplay.innerText = username;
                    }
                }
            } catch (err) { alert("Update failed"); }
        });
    }
    
    // Auth Handlers
    if (toggleAuthBtn) {
        toggleAuthBtn.addEventListener('click', (e) => {
            e.preventDefault();
            isRegisteringMode = !isRegisteringMode;
            toggleAuthBtn.textContent = isRegisteringMode ? "Have an account? Sign In" : "Need an account? Register";
            if(authSubmitBtn) authSubmitBtn.textContent = isRegisteringMode ? "Register" : "Sign In";
        });
    }

    if (authForm) {
        authForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('auth-username').value.trim();
            const password = document.getElementById('auth-password').value.trim();
            if (!username || !password) return alert("Please fill in all fields");
            const endpoint = isRegisteringMode ? '/register' : '/login';
            authSubmitBtn.textContent = "Processing...";
            authSubmitBtn.disabled = true;
            try {
                const res = await fetch(API_URL + endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || "Auth failed");
                if (isRegisteringMode) {
                    alert("Registered! Please sign in.");
                    isRegisteringMode = false;
                    toggleAuthBtn.click();
                } else {
                    localStorage.setItem('token', data.token);
                    localStorage.setItem('username', data.username);
                    initApp(data.username, data.token);
                }
            } catch (err) { alert(err.message); } 
            finally { authSubmitBtn.textContent = isRegisteringMode ? "Register" : "Sign In"; authSubmitBtn.disabled = false; }
        });
    }

    function addMessage(text, role) {
        const isBot = role === 'model';
        const div = document.createElement('div');
        div.className = `flex w-full ${isBot ? 'justify-start' : 'justify-end'} animate-in fade-in slide-in-from-bottom-2`;
        let formattedText = text;
        if (typeof marked !== 'undefined' && text) formattedText = marked.parse(text);
        div.innerHTML = `
            <div class="flex gap-3 max-w-[85%] ${isBot ? 'flex-row' : 'flex-row-reverse'}">
                <div class="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center ${isBot ? 'bg-indigo-600' : 'bg-slate-700'}">
                    <i data-lucide="${isBot ? 'bot' : 'user'}" class="text-white w-4 h-4"></i>
                </div>
                <div class="msg-bubble ${isBot ? 'msg-bot' : 'msg-user'}">
                    ${formattedText}
                </div>
            </div>
        `;
        if(chatContainer) chatContainer.appendChild(div);
        if(window.lucide) lucide.createIcons();
        if(isBot && window.Prism && text) {
            injectCopyButtons(div);
            Prism.highlightAllUnder(div);
        }
        return div;
    }

    function injectCopyButtons(element) {
        element.querySelectorAll('pre').forEach(pre => {
            if (pre.querySelector('.copy-code-btn')) return;
            const btn = document.createElement('button');
            btn.className = 'copy-code-btn';
            btn.innerText = 'Copy';
            btn.onclick = () => {
                navigator.clipboard.writeText(pre.querySelector('code').innerText);
                btn.innerText = 'Copied!';
                setTimeout(() => btn.innerText = 'Copy', 2000);
            };
            pre.appendChild(btn);
        });
    }
    
    async function selectConversation(id, token) {
        if (isEditingTitle) return;
        currentConversationId = id;
        if(emptyState) emptyState.style.display = 'none';
        if(chatContainer) chatContainer.innerHTML = ''; 
        document.querySelectorAll('.convo-item').forEach(el => el.classList.remove('active'));
        loadConversations(token); 
        try {
            const res = await fetch(`${API_URL}/chat/${id}`, { headers: { 'Authorization': token } });
            const messages = await res.json();
            messages.forEach(msg => addMessage(msg.text, msg.role));
            scrollToBottom();
        } catch (err) {}
    }

    function scrollToBottom() {
        if(chatContainer) chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    if (voiceBtn) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            const recognition = new SpeechRecognition();
            recognition.continuous = false;
            recognition.lang = 'en-US';
            recognition.interimResults = true;
            let initialInputValue = '';
            recognition.onstart = () => {
                initialInputValue = userInput.value;
                voiceBtn.classList.add('mic-active');
                userInput.placeholder = "Listening...";
            };
            recognition.onend = () => {
                voiceBtn.classList.remove('mic-active');
                userInput.placeholder = "Message AGK AI...";
            };
            recognition.onresult = (event) => {
                let transcript = '';
                for (let i = event.resultIndex; i < event.results.length; i++) {
                    transcript += event.results[i][0].transcript;
                }
                if (transcript) userInput.value = (initialInputValue ? initialInputValue + ' ' : '') + transcript;
            };
            voiceBtn.addEventListener('click', (e) => {
                e.preventDefault();
                voiceBtn.classList.contains('mic-active') ? recognition.stop() : recognition.start();
            });
        } else { voiceBtn.style.display = 'none'; }
    }
});

// GLOBAL HANDLERS
window.deleteConversation = async (id, event) => {
    event.stopPropagation(); 
    if (!confirm("Delete this chat?")) return;
    const token = localStorage.getItem('token');
    try {
        const res = await fetch(`${API_URL}/conversations/${id}`, { method: 'DELETE', headers: { 'Authorization': token } });
        if(res.ok) location.reload();
    } catch (err) {}
};

window.editConversation = (id, event) => {
    event.stopPropagation();
    isEditingTitle = true; 
    const span = document.getElementById(`title-${id}`);
    const currentTitle = span.innerText;
    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentTitle;
    input.className = 'convo-edit-input';
    input.onclick = (e) => e.stopPropagation(); 
    const save = async () => {
        const newTitle = input.value.trim();
        input.remove(); 
        span.style.display = 'block'; 
        if (newTitle && newTitle !== currentTitle) {
            const token = localStorage.getItem('token');
            span.innerText = newTitle;
            try {
                await fetch(`${API_URL}/conversations/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', 'Authorization': token },
                    body: JSON.stringify({ title: newTitle })
                });
            } catch(e) { span.innerText = currentTitle; alert("Failed"); }
        } else { span.innerText = currentTitle; }
        setTimeout(() => { isEditingTitle = false; }, 100);
    };
    input.addEventListener('blur', save);
    input.addEventListener('keypress', (e) => { if(e.key === 'Enter') input.blur(); });
    span.style.display = 'none';
    span.parentNode.insertBefore(input, span);
    input.focus();
};

// NEW: FILL SEARCH INPUT (POPULATE ONLY)
window.fillSearchInput = (text) => {
    const input = document.getElementById('user-input');
    if(input) {
        input.value = text;
        input.focus();
    }
};