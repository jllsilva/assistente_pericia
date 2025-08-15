document.addEventListener('DOMContentLoaded', () => {
    const API_ENDPOINT = '/api/generate';

    const chatContainer = document.getElementById('chat-container');
    const userInput = document.getElementById('user-input');
    const sendButton = document.getElementById('send-button');
    const newChatBtn = document.getElementById('new-chat-btn');
    const attachBtn = document.getElementById('attach-btn');
    const fileInput = document.getElementById('file-input');
    const previewsArea = document.getElementById('previews-area');

    let chatHistory = [];

    // --- FUNÇÕES DE APOIO ---

    const isMobileDevice = () => {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    };

    const mobileInputHandler = () => {
        if (!window.visualViewport) return;
        
        const appHeight = window.visualViewport.height;
        document.documentElement.style.setProperty('--app-height', `${appHeight}px`);
        
        const lastMessage = chatContainer.lastElementChild;
        if (lastMessage) {
            lastMessage.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }
    };

    const addMessage = (sender, message) => {
        const wrapper = document.createElement('div');
        wrapper.className = `message-wrapper ${sender}`;
        
        const bubble = document.createElement('div');
        bubble.className = 'message-bubble';
        if (message.startsWith('Houve um problema de conexão')) {
            bubble.classList.add('error');
        }

        const textContent = document.createElement('div');
        textContent.className = 'markdown-content';
        textContent.innerHTML = marked.parse(message || ' ');
        bubble.appendChild(textContent);

        // PONTO 1: Adicionar botões de ação (copiar/compartilhar) nas mensagens do bot
        if (sender === 'bot') {
            const actionsWrapper = document.createElement('div');
            actionsWrapper.className = 'message-actions';

            // Botão de Copiar
            const copyBtn = document.createElement('button');
            copyBtn.className = 'message-action-btn';
            copyBtn.title = 'Copiar Texto';
            copyBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" /></svg>`;
            copyBtn.onclick = () => navigator.clipboard.writeText(message);
            
            // Botão de Compartilhar
            const shareBtn = document.createElement('button');
            shareBtn.className = 'message-action-btn';
            shareBtn.title = 'Compartilhar';
            shareBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.19.02.38.05.57.09m0 0a2.25 2.25 0 105.364 2.186m0-2.186a2.25 2.25 0 00-5.364-2.186m0 9.75a2.25 2.25 0 005.364 2.186m-5.364-2.186a2.25 2.25 0 010-2.186" /></svg>`;
            shareBtn.onclick = () => {
                if (navigator.share) {
                    navigator.share({ text: message });
                } else {
                    alert('A função de compartilhar não é suportada neste navegador.');
                }
            };

            actionsWrapper.appendChild(copyBtn);
            // A função de compartilhar funciona melhor em mobile, então podemos escondê-la em desktop se quisermos
            if (navigator.share) {
                actionsWrapper.appendChild(shareBtn);
            }
            
            bubble.appendChild(actionsWrapper);
        }
        
        wrapper.appendChild(bubble);
        chatContainer.appendChild(wrapper);

        wrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const sendMessage = async () => {
        const text = userInput.value.trim();
        if (!text) return;

        sendButton.disabled = true;
        addMessage('user', text);

        chatHistory.push({ role: 'user', parts: [{ text }] });

        userInput.value = '';
        userInput.style.height = 'auto';
        toggleTypingIndicator(true);

        try {
            const response = await fetch(API_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ history: chatHistory }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => response.text());
                // Se a resposta for um texto (como uma página de erro HTML), errorData será esse texto
                if (typeof errorData === 'string' && errorData.includes('<!DOCTYPE')) {
                    throw new Error("SERVER_HTML_ERROR"); // Erro específico para HTML
                }
                throw new Error(errorData.error || "Ocorreu um erro no servidor.");
            }

            const responseData = await response.json();
            toggleTypingIndicator(false);
            addMessage('bot', responseData.reply);
            chatHistory.push({ role: 'model', parts: [{ text: responseData.reply }] });

        } catch (err) {
            toggleTypingIndicator(false);
            // PONTO 3: Lógica para mensagem de erro amigável
            if (err.message === "SERVER_HTML_ERROR") {
                addMessage('bot', "Houve um problema de conexão com o servidor. Por favor, aguarde alguns segundos e tente enviar sua mensagem novamente.");
            } else {
                addMessage('bot', `Ocorreu um erro: ${err.message}`);
            }
        } finally {
            sendButton.disabled = false;
            if (!isMobileDevice()) {
                userInput.focus();
            }
        }
    };

    const toggleTypingIndicator = (show) => {
        let indicator = document.getElementById('typing-indicator');
        if (show) {
            if (indicator) return;
            indicator = document.createElement('div');
            indicator.id = 'typing-indicator';
            indicator.className = 'message-wrapper bot';
            indicator.innerHTML = `<div class="message-bubble"><div class="bot-typing"><span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span></div></div>`;
            chatContainer.appendChild(indicator);
            indicator.scrollIntoView({ behavior: 'smooth', block: 'end' });
        } else {
            indicator?.remove();
        }
    };
    
    const startNewConversation = () => {
        chatHistory = [];
        chatContainer.innerHTML = '';
        if (document.getElementById('previews-area')) {
            document.getElementById('previews-area').innerHTML = '';
        }
        addMessage('bot', "Bom dia, Perito. Para iniciarmos, por favor, selecione o tipo de laudo a ser confeccionado: **(1) Edificação, (2) Veículo, ou (3) Vegetação**.");
    };

    const initializeApp = () => {
        if (window.visualViewport) {
            mobileInputHandler();
            window.visualViewport.addEventListener('resize', mobileInputHandler);
        } else {
            const doc = document.documentElement;
            doc.style.setProperty('--app-height', `${window.innerHeight}px`);
            window.addEventListener('resize', () => {
                doc.style.setProperty('--app-height', `${window.innerHeight}px`);
            });
        }
        startNewConversation();
    };

    // --- Event Listeners ---
    newChatBtn.addEventListener('click', startNewConversation);
    sendButton.addEventListener('click', sendMessage);
    userInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    initializeApp();
});
