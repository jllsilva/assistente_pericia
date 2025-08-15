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

    // PONTO 2: Adicionada função para detectar dispositivo móvel
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
        if (message.startsWith('Ocorreu um erro:')) {
            bubble.classList.add('error');
        }

        const textContent = document.createElement('div');
        textContent.className = 'markdown-content';
        textContent.innerHTML = marked.parse(message || ' ');
        bubble.appendChild(textContent);
        
        wrapper.appendChild(bubble);
        chatContainer.appendChild(wrapper);

        // PONTO 3: Scroll para o INÍCIO da mensagem
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
                const errorData = await response.json();
                throw new Error(errorData.error || "Ocorreu um erro no servidor.");
            }

            const responseData = await response.json();
            toggleTypingIndicator(false);
            addMessage('bot', responseData.reply);
            chatHistory.push({ role: 'model', parts: [{ text: responseData.reply }] });

        } catch (err) {
            toggleTypingIndicator(false);
            addMessage('bot', `Ocorreu um erro: ${err.message}`);
        } finally {
            sendButton.disabled = false;
            // PONTO 2: Foco condicional para não abrir o teclado no mobile
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
