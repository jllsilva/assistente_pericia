document.addEventListener('DOMContentLoaded', () => {
    const API_ENDPOINT = '/api/generate'; // Aponta para o nosso próprio servidor

    const chatContainer = document.getElementById('chat-container');
    const userInput = document.getElementById('user-input');
    const sendButton = document.getElementById('send-button');
    const newChatBtn = document.getElementById('new-chat-btn');
    // As variáveis de anexo de ficheiro podem ser mantidas para uso futuro
    const attachBtn = document.getElementById('attach-btn');
    const fileInput = document.getElementById('file-input');
    const previewsArea = document.getElementById('previews-area');

    let chatHistory = [];

    // --- SOLUÇÃO PARA PROBLEMA DO TECLADO MOBILE ---
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
        // Usamos a biblioteca 'marked' para renderizar Markdown
        textContent.innerHTML = marked.parse(message || ' ');
        bubble.appendChild(textContent);
        
        wrapper.appendChild(bubble);
        chatContainer.appendChild(wrapper);
        wrapper.scrollIntoView({ behavior: 'smooth', block: 'end' });
    };

    const sendMessage = async () => {
        const text = userInput.value.trim();
        if (!text) return;

        sendButton.disabled = true;
        addMessage('user', text);

        // Adiciona a mensagem do usuário ao histórico para enviar ao backend
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
            // Adiciona a resposta do bot ao histórico
            chatHistory.push({ role: 'model', parts: [{ text: responseData.reply }] });

        } catch (err) {
            toggleTypingIndicator(false);
            addMessage('bot', `Ocorreu um erro: ${err.message}`);
        } finally {
            sendButton.disabled = false;
            userInput.focus();
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
        // Limpa a área de prévias de anexos
        if (document.getElementById('previews-area')) {
            document.getElementById('previews-area').innerHTML = '';
        }
        addMessage('bot', "Bom dia, Perito. Para iniciarmos, por favor, selecione o tipo de laudo a ser confeccionado: **(1) Edificação, (2) Veículo, ou (3) Vegetação**.");
    };

    const initializeApp = () => {
        // Configuração do visualViewport para mobile
        if (window.visualViewport) {
            mobileInputHandler(); // Configuração inicial
            window.visualViewport.addEventListener('resize', mobileInputHandler);
        } else {
            // Fallback para desktop e navegadores mais antigos
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

    // Inicia o aplicativo
    initializeApp();
});
