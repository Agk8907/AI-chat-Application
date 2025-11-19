// This works for both localhost AND Render automatically.
const API_URL = '/api';
let isRegistering = false;
let currentConversationId = null; 
let isEditingTitle = false;
let abortController = null; // Controller for stopping generation

document.addEventListener('DOMContentLoaded', () => {
    if (window.lucide) lucide.createIcons();

    // DOM ELEMENTS
    const sidebar = document.getElementById('sidebar');
    const mainSidebarToggle = document.getElementById('main-sidebar-toggle');
    const closeSidebarBtn = document.getElementById('close-sidebar-btn');
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
    const sendBtn = document.getElementById('send-btn');
    const stopBtn = document.getElementById('stop-btn'); // NEW

    const settingsBtn = document.getElementById('settings-btn');
    const settingsModal = document.getElementById('settings-modal');
    const closeSettingsBtn = document.getElementById('close-settings');
    const settingsForm = document.getElementById('settings-form');
    const authForm = document.getElementById('auth-form');
    const toggleAuthBtn = document.getElementById('toggle-auth-mode');
    const authSubmitBtn = authForm ? authForm.querySelector('button') : null;

    // --- STOP BUTTON LOGIC ---
    if (stopBtn) {
        stopBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (abortController) {
                abortController.abort(); // Cancel request
                abortController = null;
                // Reset UI immediately
                loadingIndicator.classList.add('hidden');
                stopBtn.classList.add('hidden');
                sendBtn.classList.remove('hidden');
            }
        });
    }

    // --- SIDEBAR LOGIC ---
    function toggleSidebar() {
        const isMobile = window.innerWidth < 768;
        if (isMobile) {
            const isHidden = sidebar.classList.contains('hidden');
            if (isHidden) {
                sidebar.classList.remove('hidden');
                sidebar.classList.add('sidebar-mobile-open');
            } else {
                sidebar.classList.add('hidden');
                sidebar.classList.remove('sidebar-mobile-open');
            }
        } else {
            sidebar.classList.toggle('sidebar-hidden');
        }
    }

    if (mainSidebarToggle) mainSidebarToggle.addEventListener('click', (e) => { e.stopPropagation(); toggleSidebar(); });
    if (closeSidebarBtn) closeSidebarBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleSidebar(); });

    // --- AUTH CHECK ---
    const token = localStorage.getItem('token');
    if (token) {
        initApp(localStorage.getItem('username'), token);
    } else {
        if(authScreen) authScreen.classList.remove('hidden');
        if(appLayout) appLayout.classList.add('hidden');
    }

    function initApp(username, tkn) {
        if(authScreen) authScreen.classList.add('hidden');
        if(appLayout) appLayout.classList.remove('hidden');
        if(userDisplay) userDisplay.innerText = username;
        loadConversations(tkn);
    }

    // --- CHAT SUBMIT HANDLER (UPDATED) ---
    if (chatForm) {
        chatForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const text = userInput.value.trim();
            const token = localStorage.getItem('token');
            if (!text || !token) return;

            if (!currentConversationId) {
                try {
                    const res = await fetch(API_URL + '/conversations', {
                        method: 'POST',
                        headers: { 'Authorization': token }
                    });
                    const newConvo = await res.json();
                    currentConversationId = newConvo._id;
                } catch(err) { return; }
            }

            userInput.value = '';
            addMessage(text, 'user');
            scrollToBottom();
            
            // UI: Show Stop, Hide Send
            if(emptyState) emptyState.style.display = 'none';
            loadingIndicator.classList.remove('hidden');
            sendBtn.classList.add('hidden');
            stopBtn.classList.remove('hidden');

            const botMessageBubble = addMessage("", 'model');
            const botContentDiv = botMessageBubble.querySelector('.msg-bot');
            
            // AbortController Setup
            if (abortController) abortController.abort(); // Clear any existing
            abortController = new AbortController();
            const signal = abortController.signal;

            try {
                const response = await fetch(API_URL + '/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': token },
                    body: JSON.stringify({ text, conversationId: currentConversationId }),
                    signal: signal // Pass signal to fetch
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
            } catch (err) {
                if (err.name === 'AbortError') {
                    botContentDiv.innerText += " [Stopped by user]";
                } else {
                    botContentDiv.innerText = "Error connecting to server.";
                }
            } finally {
                // Reset Buttons
                loadingIndicator.classList.add('hidden');
                stopBtn.classList.add('hidden');
                sendBtn.classList.remove('hidden');
                abortController = null; 
            }
        });
    }

    // --- REST OF FUNCTIONS (Keep exactly as before) ---
    
    // AUTH HANDLERS
    if (toggleAuthBtn) {
        toggleAuthBtn.addEventListener('click', (e) => {
            e.preventDefault();
            isRegistering = !isRegistering;
            toggleAuthBtn.textContent = isRegistering ? "Have an account? Sign In" : "Need an account? Register";
            if(authSubmitBtn) authSubmitBtn.textContent = isRegistering ? "Register" : "Sign In";
        });
    }

    if (authForm) {
        authForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('auth-username').value.trim();
            const password = document.getElementById('auth-password').value.trim();
            if (!username || !password) return alert("Please fill in all fields");
            const endpoint = isRegistering ? '/register' : '/login';
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
                if (isRegistering) {
                    alert("Registered! Please sign in.");
                    isRegistering = false;
                    toggleAuthBtn.click();
                } else {
                    localStorage.setItem('token', data.token);
                    localStorage.setItem('username', data.username);
                    initApp(data.username, data.token);
                }
            } catch (err) { alert(err.message); } 
            finally { authSubmitBtn.textContent = isRegistering ? "Register" : "Sign In"; authSubmitBtn.disabled = false; }
        });
    }

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
                            <i data-lucide="message-square" class="w-4 h-4 flex-shrink-0"></i>
                            <span class="convo-text" title="${safeTitle}" id="title-${convo._id}">${safeTitle}</span>
                        </div>
                        <div class="convo-actions">
                            <button class="convo-action-btn" onclick="editConversation('${convo._id}', event)" title="Rename"><i data-lucide="pencil" class="w-3 h-3"></i></button>
                            <button class="convo-action-btn delete" onclick="deleteConversation('${convo._id}', event)" title="Delete"><i data-lucide="trash-2" class="w-3 h-3"></i></button>
                        </div>`;
                    btn.onclick = (e) => {
                        if (!e.target.closest('.convo-action-btn') && !e.target.closest('input') && !isEditingTitle) {
                            selectConversation(convo._id, token);
                            if(window.innerWidth < 768) toggleSidebar();
                        }
                    };
                    conversationList.appendChild(btn);
                });
            }
        }
        if (window.lucide) lucide.createIcons();
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

    if (newChatBtn) {
        newChatBtn.addEventListener('click', async () => {
            const token = localStorage.getItem('token');
            try {
                const res = await fetch(API_URL + '/conversations', { method: 'POST', headers: { 'Authorization': token } });
                const newConvo = await res.json();
                selectConversation(newConvo._id, token);
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

    // Voice
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

    function scrollToBottom() {
        if(chatContainer) chatContainer.scrollTop = chatContainer.scrollHeight;
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