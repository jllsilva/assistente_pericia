document.addEventListener('DOMContentLoaded', () => {
    // --- Configurações e Endpoints ---
    const API_BASE = window.API_BASE || 'http://localhost:3000';
    const CHAT_ENDPOINT = `${API_BASE}/api/generate`;
    const TITLE_ENDPOINT = `${API_BASE}/api/generate-title`;
    const STORAGE_KEY = 'assistente_pericias_conversations';

    // --- Ping inicial para "acordar" o servidor em plataformas como o Render ---
    fetch(`${API_BASE}/health`)
        .then(res => res.ok && console.log("Servidor do Assistente de Perícias está pronto."))
        .catch(err => console.warn("Ping inicial para o servidor falhou. Se estiver usando um serviço gratuito, isso pode ser normal na primeira inicialização.", err));

    // --- Elementos do DOM ---
    const chatContainer = document.getElementById('chat-container');
    const userInput = document.getElementById('user-input');
    const sendButton = document.getElementById('send-button');
    const attachBtn = document.getElementById('attach-btn');
    const fileInput = document.getElementById('file-input');
    const imagePreviewContainer = document.getElementById('image-preview-container');
    const imagePreview = document.getElementById('image-preview');
    const removeFileBtn = document.getElementById('remove-file-btn');
    const filePreviewContainer = document.getElementById('file-preview-container');
    const fileNameSpan = document.getElementById('file-name');
    const removeFileBtnGeneric = document.getElementById('remove-file-btn-generic');
    const historyBtn = document.getElementById('history-btn');
    const closeHistoryBtn = document.getElementById('close-history-btn');
    const historyPanel = document.getElementById('history-panel');
    const historyList = document.getElementById('history-list');
    const newChatBtn = document.getElementById('new-chat-btn');

    // --- Estado do Aplicativo ---
    let attachedFile = null; // { name, type, content }
    let currentConversationId = null;
    let chatHistory = [];

    // --- PROMPT DO SISTEMA (CUSTOMIZADO PARA PERÍCIA DE INCÊNDIO) ---
    const SYSTEM_PROMPT = `
Você é um assistente especialista em perícias de incêndio, desenvolvido para auxiliar peritos do Corpo de Bombeiros.

**SUAS DIRETRIZES:**

1.  **Fonte Primária de Conhecimento:** Sua base de conhecimento e fonte da verdade são os seguintes documentos:
    * **NFPA 921:** Guia de Investigação de Incêndios e Explosões.
    * **Manual de Perícia do CBMDF.**
    * **Manual Operacional de Perícia do CBMGO.**
    * **Modelos de Laudo:** Utilize como referência os modelos para incêndios em Edificação, Veículo e Vegetação.
    * **Classificação de Causas:** Consulte o documento de classificação para determinar a causa provável.

2.  **Metodologia:** Siga rigorosamente o método científico de investigação:
    * **Coleta de Dados:** Faça perguntas claras e objetivas para coletar informações sobre o sinistro.
    * **Análise de Dados:** Analise as informações e as evidências (incluindo fotos) fornecidas pelo perito.
    * **Desenvolvimento de Hipóteses:** Com base na análise, formule hipóteses sobre a área de origem, o primeiro material ignificado e a causa do incêndio.
    * **Teste de Hipóteses:** Ajude o perito a testar as hipóteses contra as evidências e os princípios científicos.

3.  **Tom e Linguagem:** Seja sempre formal, técnico, preciso e objetivo. Use a terminologia correta da área de perícia. Responda sempre em **Português do Brasil**.

4.  **Interação:** Guie o perito passo a passo. Comece perguntando o tipo de ocorrência (Edificação, Veículo ou Vegetação) para então seguir o fluxo de investigação apropriado. Ajude a estruturar os tópicos do laudo pericial.
`;

    // --- Funções Principais ---

    /** Adiciona uma mensagem à interface do chat */
    const addMessage = (sender, message, options = {}) => {
        const { isError = false, imageBase64 = null } = options;
        const wrapper = document.createElement('div');
        wrapper.className = `message-wrapper ${sender}`;
        const bubble = document.createElement('div');
        bubble.className = 'message-bubble';
        if (isError) bubble.classList.add('error');

        if (sender === 'bot') {
            const markdownContent = document.createElement('div');
            markdownContent.className = 'markdown-content';
            markdownContent.innerHTML = marked.parse(message || ' ');
            bubble.appendChild(markdownContent);
            
            const copyButton = document.createElement('button');
            copyButton.className = 'copy-button';
            copyButton.setAttribute('aria-label', 'Copiar texto');
            copyButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>`;
            copyButton.onclick = () => navigator.clipboard.writeText(message).catch(err => console.error('Falha ao copiar:', err));
            bubble.appendChild(copyButton);
        } else {
            const p = document.createElement('p');
            p.textContent = message;
            bubble.appendChild(p);
        }

        if (imageBase64) {
            const img = document.createElement('img');
            img.src = imageBase64;
            img.alt = "Imagem anexada pelo usuário";
            bubble.appendChild(img);
        }
        wrapper.appendChild(bubble);
        chatContainer.appendChild(wrapper);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    };

    /** Mostra/esconde o indicador de "digitando" */
    const toggleTypingIndicator = (show) => {
        let indicator = document.getElementById('typing-indicator');
        if (show) {
            if (indicator) return;
            indicator = document.createElement('div');
            indicator.id = 'typing-indicator';
            indicator.className = 'message-wrapper bot';
            indicator.innerHTML = `<div class="message-bubble"><div class="bot-typing"><span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span></div></div>`;
            chatContainer.appendChild(indicator);
            chatContainer.scrollTop = chatContainer.scrollHeight;
        } else {
            indicator?.remove();
        }
    };

    /** Limpa a área de anexos */
    const resetAttachments = () => {
        attachedFile = null;
        fileInput.value = '';
        imagePreviewContainer.style.display = 'none';
        filePreviewContainer.style.display = 'none';
    };

    /** Envia a mensagem do usuário para o backend */
    const sendMessage = async () => {
        const text = userInput.value.trim();
        if (!text && !attachedFile) return;
        
        sendButton.disabled = true;

        const userMessageForDisplay = text || `Analisar arquivo: ${attachedFile.name}`;
        addMessage('user', userMessageForDisplay, { imageBase64: attachedFile?.type.startsWith('image/') ? attachedFile.content : null });
        
        const userParts = [];
        if (text) {
            userParts.push({ text: text });
        }

        if (attachedFile) {
            if (attachedFile.type.startsWith('image/')) {
                userParts.push({
                    inline_data: {
                        mime_type: attachedFile.type,
                        data: attachedFile.content.split(',')[1]
                    }
                });
            } else {
                const filePrompt = `Analise o seguinte arquivo chamado "${attachedFile.name}" como contexto para a minha pergunta.\n\nCONTEÚDO DO ARQUIVO:\n${attachedFile.content}`;
                userParts.unshift({ text: filePrompt });
            }
        }
        
        chatHistory.push({ role: 'user', parts: userParts });
        
        const isFirstMessage = chatHistory.filter(m => m.role === 'user').length === 1;
        
        resetAttachments();
        userInput.value = '';
        userInput.style.height = 'auto';
        toggleTypingIndicator(true);

        try {
            const res = await fetch(CHAT_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ history: chatHistory }),
            });

            const responseData = await res.json();
            if (!res.ok) {
                throw new Error(responseData.error || `Erro ${res.status}`);
            }

            addMessage('bot', responseData.reply);
            chatHistory.push({ role: 'model', parts: [{ text: responseData.reply }] });
            await saveConversation(isFirstMessage ? userMessageForDisplay : null);

        } catch (err) {
            addMessage('bot', `Ocorreu um erro: ${err.message}`, { isError: true });
        } finally {
            toggleTypingIndicator(false);
            sendButton.disabled = false;
        }
    };
    
    /** Salva a conversa atual no localStorage */
    const saveConversation = async (firstUserMessage) => {
        try {
            const conversations = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
            if (currentConversationId) {
                const index = conversations.findIndex(c => c.id === currentConversationId);
                if (index !== -1) {
                    conversations[index].chatHistory = chatHistory;
                    conversations[index].timestamp = new Date().toISOString();
                }
            } else {
                const title = firstUserMessage ? await generateTitle(firstUserMessage) : "Nova Perícia";
                currentConversationId = Date.now();
                conversations.unshift({ id: currentConversationId, title, timestamp: new Date().toISOString(), chatHistory });
            }
            localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
            if (historyPanel.classList.contains('visible')) loadHistoryList();
        } catch (error) {
            console.error("Erro ao salvar conversa:", error);
        }
    };

    /** Gera um título para a conversa usando o backend */
    const generateTitle = async (userMessage) => {
        try {
            const res = await fetch(TITLE_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userMessage }),
            });
            if (!res.ok) return "Nova Perícia";
            return (await res.json()).title;
        } catch {
            return "Nova Perícia";
        }
    };

    /** Carrega a lista de conversas no painel de histórico */
    const loadHistoryList = () => {
        const conversations = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
        historyList.innerHTML = conversations.length === 0 
            ? '<p class="history-empty-message">Nenhuma perícia guardada.</p>'
            : conversations.map(convo => `
                <div class="history-item" data-id="${convo.id}" title="${convo.title}">
                    <div class="history-item-content">
                        <p class="history-item-title">${convo.title}</p>
                        <p class="history-item-date">${new Date(convo.timestamp).toLocaleString('pt-BR')}</p>
                    </div>
                    <div class="history-item-actions">
                        <button class="icon-button delete-convo-btn" data-id="${convo.id}" aria-label="Apagar conversa">🗑️</button>
                    </div>
                </div>`).join('');
    };

    /** Carrega uma conversa selecionada do histórico */
    const loadConversation = (id) => {
        const conversations = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
        const convo = conversations.find(c => c.id === id);
        if (convo) {
            currentConversationId = id;
            chatHistory = convo.chatHistory;
            chatContainer.innerHTML = '';
            resetAttachments();
            
            chatHistory.slice(1).forEach(turn => {
                const textPart = turn.parts.find(p => p.text);
                const imagePart = turn.parts.find(p => p.inline_data);
                const messageContent = textPart?.text || '';
                const imageBase64 = imagePart ? `data:${imagePart.inline_data.mime_type};base64,${imagePart.inline_data.data}` : null;
                addMessage(turn.role === 'model' ? 'bot' : 'user', messageContent, { imageBase64 });
            });
            historyPanel.classList.remove('visible');
        }
    };

    /** Inicia uma nova conversa limpa */
    const startNewConversation = () => {
        currentConversationId = null;
        chatHistory = [{ role: 'user', parts: [{ text: SYSTEM_PROMPT }] }];
        chatContainer.innerHTML = '';
        resetAttachments(); 
        
        const welcomeMessage = 'Olá! Sou o Assistente de Perícias de Incêndio. Como posso auxiliar na sua perícia hoje? Por favor, comece descrevendo o tipo de ocorrência (edificação, veículo ou vegetação).';
        addMessage('bot', welcomeMessage);
        chatHistory.push({ role: 'model', parts: [{ text: welcomeMessage }] });
        
        historyPanel.classList.remove('visible');
    };

    // --- Event Listeners ---
    sendButton.addEventListener('click', sendMessage);
    userInput.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } });
    attachBtn.addEventListener('click', () => fileInput.click());
    removeFileBtn.addEventListener('click', resetAttachments);
    removeFileBtnGeneric.addEventListener('click', resetAttachments);
    historyBtn.addEventListener('click', () => { loadHistoryList(); historyPanel.classList.add('visible'); });
    closeHistoryBtn.addEventListener('click', () => historyPanel.classList.remove('visible'));
    newChatBtn.addEventListener('click', startNewConversation);

    historyList.addEventListener('click', (e) => {
        const item = e.target.closest('.history-item');
        const deleteBtn = e.target.closest('.delete-convo-btn');
        if (deleteBtn) {
            e.stopPropagation();
            if (window.confirm("Tem certeza que deseja apagar esta perícia?")) {
                const id = Number(deleteBtn.dataset.id);
                let convos = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]').filter(c => c.id !== id);
                localStorage.setItem(STORAGE_KEY, JSON.stringify(convos));
                if (currentConversationId === id) startNewConversation();
                loadHistoryList();
            }
        } else if (item) {
            loadConversation(Number(item.dataset.id));
        }
    });

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        resetAttachments();

        const reader = new FileReader();
        reader.onload = (ev) => {
            attachedFile = { name: file.name, type: file.type, content: ev.target.result };
            if (file.type.startsWith('image/')) {
                imagePreview.src = attachedFile.content;
                imagePreviewContainer.style.display = 'inline-flex';
            } else {
                fileNameSpan.textContent = file.name;
                filePreviewContainer.style.display = 'inline-flex';
            }
        };

        if (file.type.startsWith('image/')) {
            reader.readAsDataURL(file);
        } else {
            reader.readAsText(file);
        }
    });

    userInput.addEventListener('input', () => {
        userInput.style.height = 'auto';
        userInput.style.height = (userInput.scrollHeight) + 'px';
    });

    // Inicia o aplicativo
    startNewConversation();
});
