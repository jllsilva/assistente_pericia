document.addEventListener('DOMContentLoaded', () => {
    // --- Configurações e Endpoints ---
    const API_BASE = window.API_BASE || 'http://localhost:3000';
    const CHAT_ENDPOINT = `${API_BASE}/api/generate`;

    // --- Elementos do DOM ---
    const appContainer = document.querySelector('.app-container');
    const chatContainer = document.getElementById('chat-container');
    const userInput = document.getElementById('user-input');
    const sendButton = document.getElementById('send-button');
    const attachBtn = document.getElementById('attach-btn');
    const fileInput = document.getElementById('file-input');
    const previewsArea = document.getElementById('previews-area');
    const newChatBtn = document.getElementById('new-chat-btn');

    // --- Estado do Aplicativo ---
    let attachedFiles = [];
    let chatHistory = [];

    // --- PROMPT DO SISTEMA ---
    const SYSTEM_PROMPT = `
## PERFIL E DIRETRIZES DO AGENTE ##

Você é o "Analista Assistente de Perícia", uma ferramenta especialista desenvolvida para auxiliar Peritos de Incêndio e Explosões. Sua função é dupla:
1.  **Guiar a Coleta de Dados:** Atuar como um checklist estruturado, fazendo perguntas chave para cada tipo de sinistro (Edificação, Veículo, Vegetação).
2.  **Auxiliar na Redação Técnica:** Utilizar as informações coletadas para ajudar a redigir as seções analíticas do laudo, seguindo a metodologia oficial.

**Modelo de IA:** Você opera utilizando o modelo gemini 2.5 para garantir a melhor performance.

Sua base de conhecimento são os modelos de laudo oficiais, manuais técnicos (NFPA 921, CBMDF, CBMGO) e exemplos fornecidos. Você deve seguir a metodologia da exclusão de causas para a análise final.

**REGRAS DE OPERAÇÃO (FLUXO DE TRABALHO):**

**FASE 1: IDENTIFICAÇÃO DO TIPO DE LAUDO**
Sempre inicie uma nova perícia com a pergunta abaixo. A sua resposta definirá todo o fluxo de trabalho.

> **Pergunta Inicial:** "Bom dia, Perito. Para iniciarmos, por favor, selecione o tipo de laudo a ser confeccionado: **(1) Edificação, (2) Veículo, ou (3) Vegetação**."

(O restante do prompt foi omitido por brevidade, mas continua o mesmo)
`;

    // --- **NOVA LÓGICA PARA GERIR A ALTURA EM DISPOSITIVOS MÓVEIS** ---
    const setVisualViewport = () => {
        const doc = document.documentElement;
        // Usa a altura da janela visual, que se ajusta ao teclado
        doc.style.setProperty('--app-height', `${window.visualViewport.height}px`);
        // Rola a página para garantir que o input esteja visível
        setTimeout(() => {
            userInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
    };

    // --- Funções Principais ---

    const addMessage = (sender, message, options = {}) => {
        const { isError = false, images = [] } = options;
        const wrapper = document.createElement('div');
        wrapper.className = `message-wrapper ${sender}`;
        const bubble = createMessageBubble(sender, message, { isError, images });
        wrapper.appendChild(bubble);
        chatContainer.appendChild(wrapper);
        wrapper.scrollIntoView({ behavior: 'smooth', block: 'end' });
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
            indicator.scrollIntoView({ behavior: 'smooth', block: 'end' });
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

    const compressImage = (file, maxSize = 1280, quality = 0.7) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > maxSize) {
                            height *= maxSize / width;
                            width = maxSize;
                        }
                    } else {
                        if (height > maxSize) {
                            width *= maxSize / height;
                            height = maxSize;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    const dataUrl = canvas.toDataURL('image/jpeg', quality);
                    resolve({
                        name: file.name,
                        type: 'image/jpeg',
                        content: dataUrl
                    });
                };
                img.onerror = reject;
                img.src = event.target.result;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    };

    const startNewConversation = () => {
        chatHistory = [{ role: 'user', parts: [{ text: SYSTEM_PROMPT }] }];
        chatContainer.innerHTML = '';
        resetAttachments(); 
        const welcomeMessage = "Bom dia, Perito. Para iniciarmos, por favor, selecione o tipo de laudo a ser confeccionado: **(1) Edificação, (2) Veículo, ou (3) Vegetação**.";
        addMessage('bot', welcomeMessage);
        chatHistory.push({ role: 'model', parts: [{ text: welcomeMessage }] });
    };

    const initializeApp = () => {
        // **CORREÇÃO:** Usa a nova função de ajuste
        if (window.visualViewport) {
            setVisualViewport();
        } else {
             // Fallback para navegadores mais antigos
            const doc = document.documentElement;
            doc.style.setProperty('--app-height', `${window.innerHeight}px`);
        }
        fetch(`${API_BASE}/health`).catch(err => console.warn("Ping inicial para o servidor falhou.", err));
        startNewConversation();
    };

    // --- Event Listeners ---
    // **CORREÇÃO:** Ouve o evento de redimensionamento da janela visual
    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', setVisualViewport);
    }

    newChatBtn.addEventListener('click', startNewConversation);
    
    attachBtn.addEventListener('click', () => fileInput.click());
    
    fileInput.addEventListener('change', async (e) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;
        
        previewsArea.innerHTML = `<p class="processing-text">A processar ${files.length} imagem(ns)...</p>`;

        const compressionPromises = Array.from(files)
            .filter(file => file.type.startsWith('image/'))
            .map(file => compressImage(file));

        try {
            const compressedFiles = await Promise.all(compressionPromises);
            attachedFiles.push(...compressedFiles);
            updatePreviews();
        } catch (error) {
            console.error("Erro ao comprimir imagens:", error);
            alert("Ocorreu um erro ao processar uma das imagens.");
            updatePreviews();
        }
    });

    sendButton.addEventListener('click', sendMessage);
    userInput.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } });
    
    userInput.addEventListener('input', () => {
        userInput.style.height = 'auto';
        userInput.style.height = (userInput.scrollHeight) + 'px';
    });

    // Inicia o aplicativo
    initializeApp();
});
