document.addEventListener('DOMContentLoaded', () => {
    // --- Configurações e Endpoints ---
    const API_BASE = window.API_BASE || 'http://localhost:3000';
    const CHAT_ENDPOINT = `${API_BASE}/api/generate`;
    const TITLE_ENDPOINT = `${API_BASE}/api/generate-title`;
    const STORAGE_KEY = 'assistente_pericias_conversations';

    // --- Elementos do DOM ---
    const chatContainer = document.getElementById('chat-container');
    const userInput = document.getElementById('user-input');
    const sendButton = document.getElementById('send-button');
    const attachBtn = document.getElementById('attach-btn');
    const fileInput = document.getElementById('file-input');
    const previewsArea = document.getElementById('previews-area');
    const historyBtn = document.getElementById('history-btn');
    const closeHistoryBtn = document.getElementById('close-history-btn');
    const historyPanel = document.getElementById('history-panel');
    const historyList = document.getElementById('history-list');
    const newChatBtn = document.getElementById('new-chat-btn');

    // --- Estado do Aplicativo ---
    let attachedFiles = [];
    let currentConversationId = null;
    let chatHistory = [];

    // --- PROMPT DO SISTEMA ---
    const SYSTEM_PROMPT = `
## PERFIL E DIRETRIZES DO AGENTE ##

Você é o "Analista Assistente de Perícia", uma ferramenta especialista desenvolvida para auxiliar Peritos de Incêndio e Explosões. Sua função é dupla:
1.  **Guiar a Coleta de Dados:** Atuar como um checklist estruturado, fazendo perguntas chave para cada tipo de sinistro (Edificação, Veículo, Vegetação).
2.  **Auxiliar na Redação Técnica:** Utilizar as informações coletadas para ajudar a redigir as seções analíticas do laudo, seguindo a metodologia oficial.

Sua base de conhecimento são os modelos de laudo oficiais, manuais técnicos (NFPA 921, CBMDF, CBMGO) e exemplos fornecidos. Você deve seguir a metodologia da exclusão de causas para a análise final.

**REGRAS DE OPERAÇÃO (FLUXO DE TRABALHO):**

**FASE 1: IDENTIFICAÇÃO DO TIPO DE LAUDO**
Sempre inicie uma nova perícia com a pergunta abaixo. A sua resposta definirá todo o fluxo de trabalho.

> **Pergunta Inicial:** "Bom dia, Perito. Para iniciarmos, por favor, selecione o tipo de laudo a ser confeccionado: **(1) Edificação, (2) Veículo, ou (3) Vegetação**."

**FASE 2: COLETA DE DADOS ESTRUTURADA E CONTEXTUAL**
Com base na escolha do Perito, siga **APENAS** o checklist correspondente abaixo, fazendo UMA pergunta de cada vez e aguardando a resposta. Não faça todas as perguntas de uma vez.

---
**CHECKLIST PARA INCÊNDIO EM EDIFICAÇÃO:**
1.  **Análise Externa:** "O incêndio parece ter se propagado do interior para o exterior ou o contrário? Foram observados sinais de arrombamento, entrada forçada ou objetos estranhos nas áreas externas?"
2.  **Análise Interna:** "Há indícios de múltiplos focos sem conexão entre si? Quais eram os principais materiais combustíveis (sofás, móveis, etc.) no ambiente?"
3.  **Análise da Origem:** "Na área que você acredita ser a origem, quais materiais sofreram a queima mais intensa? Quais fontes de ignição (tomadas, equipamentos) existem nessa área?"
4.  **Provas:** "Por favor, resuma o depoimento de testemunhas, se houver."

---
**CHECKLIST PARA INCÊNDIO EM VEÍCULO:**
1.  **Identificação:** "Qual a marca, modelo e ano do veículo? Ele estava em movimento ou estacionado quando o incêndio começou?"
2.  **Análise Externa e Acessos:** "Foram observados sinais de arrombamento nas portas ou na ignição? As portas e vidros estavam abertos ou fechados?"
3.  **Análise da Origem:** "Onde os danos são mais severos: no compartimento do motor, no painel, no interior do habitáculo ou no porta-malas?"
4.  **Análise de Sistemas:** "Há indícios de vazamento no sistema de combustível? Como está o estado da bateria e dos chicotes elétricos principais?"
5.  **Provas:** "Por favor, resuma o depoimento do proprietário/testemunhas."

---
**CHECKLIST PARA INCÊNDIO EM VEGETAÇÃO:**
1.  **Caracterização:** "Qual o tipo predominante de vegetação (campo, cerrado, mata)? Qual a topografia do local (plano, aclive, declive)?"
2.  **Condições:** "Como estavam as condições meteorológicas no momento do sinistro (vento, umidade)?"
3.  **Análise da Origem:** "Foi possível identificar uma 'zona de confusão' com queima mais lenta? Quais vestígios foram encontrados nesta área (fogueira, cigarros, etc.)?"
4.  **Análise de Propagação:** "Quais os principais indicadores de propagação observados (carbonização em troncos, inclinação da queima)?"
5.  **Provas:** "Por favor, resuma o depoimento de testemunhas, se houver."

---
**FASE 3: REDAÇÃO ASSISTIDA**
Após o checklist, anuncie: "Coleta de dados finalizada. Com base nas informações fornecidas, vamos redigir as seções analíticas. Qual seção deseja iniciar? (Ex: DESCRIÇÃO DA ZONA DE ORIGEM, CORRELAÇÕES, etc.)"

**FASE 4: ANÁLISE DE CORRELAÇÕES E CAUSA**
Se o perito escolher "CORRELAÇÕES DOS ELEMENTOS OBTIDOS", siga **RIGOROSAMENTE** esta estrutura de exclusão.
`;

    // --- Funções Principais ---

    const addMessage = (sender, message, options = {}) => {
        const { isError = false, images = [], messageId = null } = options;
        if (messageId) {
            const existingWrapper = document.getElementById(messageId);
            if (existingWrapper) {
                existingWrapper.innerHTML = '';
                const bubble = createMessageBubble(sender, message, { isError, images });
                existingWrapper.appendChild(bubble);
                return;
            }
        }
        const wrapper = document.createElement('div');
        wrapper.className = `message-wrapper ${sender}`;
        if (messageId) wrapper.id = messageId;
        const bubble = createMessageBubble(sender, message, { isError, images });
        wrapper.appendChild(bubble);
        chatContainer.appendChild(wrapper);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    };

    const createMessageBubble = (sender, message, options = {}) => {
        const { isError = false, images = [] } = options;
        const bubble = document.createElement('div');
        bubble.className = 'message-bubble';
        if (isError) bubble.classList.add('error');
        const textContent = document.createElement('div');
        textContent.className = 'markdown-content';
        textContent.innerHTML = marked.parse(message || ' ');
        bubble.appendChild(textContent);
        if (sender === 'bot' && !isError) {
            const copyButton = document.createElement('button');
            copyButton.className = 'copy-button';
            copyButton.setAttribute('aria-label', 'Copiar texto');
            copyButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>`;
            copyButton.onclick = () => navigator.clipboard.writeText(message).catch(err => console.error('Falha ao copiar:', err));
            textContent.appendChild(copyButton);
        }
        if (images.length > 0) {
            const imagesContainer = document.createElement('div');
            imagesContainer.className = 'message-images-container';
            images.forEach(imgBase64 => {
                const img = document.createElement('img');
                img.src = imgBase64;
                img.alt = "Imagem anexada";
                imagesContainer.appendChild(img);
            });
            bubble.appendChild(imagesContainer);
        }
        return bubble;
    };

    const resetAttachments = () => {
        attachedFiles = [];
        fileInput.value = '';
        previewsArea.innerHTML = '';
    };

    const sendMessage = async () => {
        const text = userInput.value.trim();
        if (!text && attachedFiles.length === 0) return;
        sendButton.disabled = true;
        const userMessageForDisplay = text || `Analisar ${attachedFiles.length} imagem(s)`;
        const imageContents = attachedFiles.map(file => file.content);
        addMessage('user', userMessageForDisplay, { images: imageContents });
        const userParts = [];
        if (text) {
            userParts.push({ text: text });
        }
        attachedFiles.forEach(file => {
            userParts.push({ inline_data: { mime_type: file.type, data: file.content.split(',')[1] } });
        });
        chatHistory.push({ role: 'user', parts: userParts });
        const isFirstUserMessageInHistory = chatHistory.filter(m => m.role === 'user').length === 1;
        resetAttachments();
        userInput.value = '';
        userInput.style.height = 'auto';
        toggleTypingIndicator(true);
        try {
            const response = await fetch(CHAT_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ history: chatHistory }),
            });
            const contentType = response.headers.get("content-type");
            if (!response.ok || !contentType || !contentType.includes("application/json")) {
                const errorText = await response.text();
                throw new Error(errorText || "O servidor retornou uma resposta inválida.");
            }
            const responseData = await response.json();
            toggleTypingIndicator(false);
            addMessage('bot', responseData.reply);
            chatHistory.push({ role: 'model', parts: [{ text: responseData.reply }] });
            await saveConversation(isFirstUserMessageInHistory ? userMessageForDisplay : null);
        } catch (err) {
            toggleTypingIndicator(false);
            addMessage('bot', `Ocorreu um erro: ${err.message}`, { isError: true });
        } finally {
            sendButton.disabled = false;
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
            chatContainer.scrollTop = chatContainer.scrollHeight;
        } else {
            indicator?.remove();
        }
    };

    const updatePreviews = () => {
        previewsArea.innerHTML = '';
        attachedFiles.forEach((file, index) => {
            const wrapper = document.createElement('div');
            wrapper.className = 'preview-wrapper';
            const img = document.createElement('img');
            img.src = file.content;
            const removeBtn = document.createElement('button');
            removeBtn.className = 'remove-btn';
            removeBtn.innerHTML = '&times;';
            removeBtn.onclick = () => {
                attachedFiles.splice(index, 1);
                updatePreviews();
            };
            wrapper.appendChild(img);
            wrapper.appendChild(removeBtn);
            previewsArea.appendChild(wrapper);
        });
    };

    // --- Funções de Histórico ---

    const saveConversation = async (firstUserMessage) => {
        try {
            const conversations = getConversationsFromStorage();
            if (currentConversationId) {
                const index = conversations.findIndex(c => c.id === currentConversationId);
                if (index !== -1) {
                    conversations[index].chatHistory = chatHistory;
                    conversations[index].timestamp = new Date().toISOString();
                } else {
                    // Se o ID atual não for encontrado, cria uma nova conversa para evitar perda de dados
                    currentConversationId = null; 
                }
            }
            
            if (!currentConversationId) {
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

    const generateTitle = async (userMessage) => {
        try {
            const res = await fetch(TITLE_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userMessage }) });
            if (!res.ok) return "Nova Perícia";
            return (await res.json()).title;
        } catch { return "Nova Perícia"; }
    };

    const getConversationsFromStorage = () => {
        try {
            const conversationsJSON = localStorage.getItem(STORAGE_KEY);
            if (!conversationsJSON) return [];
            const conversations = JSON.parse(conversationsJSON);
            return Array.isArray(conversations) ? conversations : [];
        } catch (e) {
            localStorage.setItem(STORAGE_KEY, '[]');
            return [];
        }
    };

    const loadHistoryList = () => {
        const conversations = getConversationsFromStorage();
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

    const loadConversation = (id) => {
        const conversations = getConversationsFromStorage();
        const convo = conversations.find(c => c.id === id);
        if (convo) {
            currentConversationId = id;
            chatHistory = convo.chatHistory;
            chatContainer.innerHTML = '';
            resetAttachments();
            chatHistory.slice(1).forEach(turn => { // Pula o prompt do sistema
                const textPart = turn.parts.find(p => p.text);
                const imageParts = turn.parts.filter(p => p.inline_data);
                const images = imageParts.map(p => `data:${p.inline_data.mime_type};base64,${p.inline_data.data}`);
                addMessage(turn.role === 'model' ? 'bot' : 'user', textPart?.text || '', { images });
            });
            historyPanel.classList.remove('visible');
        }
    };

    const startNewConversation = () => {
        currentConversationId = null;
        chatHistory = [{ role: 'user', parts: [{ text: SYSTEM_PROMPT }] }];
        chatContainer.innerHTML = '';
        resetAttachments(); 
        const startupMessageId = `status-${Date.now()}`;
        addMessage('bot', 'Aguarde, o assistente está a iniciar...', { messageId: startupMessageId });
        fetch(CHAT_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ history: chatHistory }),
        })
        .then(response => {
            const contentType = response.headers.get("content-type");
            if (!response.ok || !contentType || !contentType.includes("application/json")) {
                return response.text().then(text => {
                    const match = text.match(/<pre>(.*?)<\/pre>/);
                    throw new Error(match ? match[1] : "O servidor retornou uma resposta inesperada (HTML).");
                });
            }
            return response.json();
        })
        .then(data => {
            addMessage('bot', data.reply, { messageId: startupMessageId });
            chatHistory.push({ role: 'model', parts: [{ text: data.reply }] });
        })
        .catch(err => {
            const errorMessage = err.message || "Não foi possível conectar ao assistente. Tente novamente mais tarde.";
            addMessage('bot', errorMessage, { isError: true, messageId: startupMessageId });
        });
        historyPanel.classList.remove('visible');
    };

    // --- LÓGICA DE INICIALIZAÇÃO ---
    const initializeApp = () => {
        const conversations = getConversationsFromStorage();
        if (conversations.length > 0) {
            // Se houver conversas, carrega a mais recente
            loadConversation(conversations[0].id);
        } else {
            // Se não houver histórico, inicia uma nova conversa
            startNewConversation();
        }
    };

    // --- Event Listeners ---
    attachBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
        const files = e.target.files;
        if (!files) return;
        attachedFiles = []; 
        Array.from(files).forEach(file => {
            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    attachedFiles.push({ name: file.name, type: file.type, content: ev.target.result });
                    updatePreviews();
                };
                reader.readAsDataURL(file);
            }
        });
    });
    sendButton.addEventListener('click', sendMessage);
    userInput.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } });
    historyBtn.addEventListener('click', () => { loadHistoryList(); historyPanel.classList.add('visible'); });
    closeHistoryBtn.addEventListener('click', () => historyPanel.classList.remove('visible'));
    newChatBtn.addEventListener('click', startNewConversation);
    historyList.addEventListener('click', (e) => {
        const item = e.target.closest('.history-item');
        const deleteBtn = e.target.closest('.delete-convo-btn');
        if (deleteBtn) {
            e.stopPropagation();
            const id = Number(deleteBtn.dataset.id);
            let convos = getConversationsFromStorage().filter(c => c.id !== id);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(convos));
            if (currentConversationId === id) startNewConversation();
            loadHistoryList();
        } else if (item) {
            loadConversation(Number(item.dataset.id));
        }
    });
    userInput.addEventListener('input', () => {
        userInput.style.height = 'auto';
        userInput.style.height = (userInput.scrollHeight) + 'px';
    });

    // Inicia o aplicativo
    initializeApp();
});
