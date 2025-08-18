document.addEventListener('DOMContentLoaded', () => {
    // =================================================================
    //  1. CONSTANTES E SELEÇÃO DE ELEMENTOS DO DOM
    // =================================================================
    const API_ENDPOINT = '/api/generate';

    const chatContainer = document.getElementById('chat-container');
    const userInput = document.getElementById('user-input');
    const sendButton = document.getElementById('send-button');
    const newChatBtn = document.getElementById('new-chat-btn');
    const attachBtn = document.getElementById('attach-btn');
    const fileInput = document.getElementById('file-input');
    const previewsArea = document.getElementById('previews-area');
    const appContainer = document.querySelector('.app-container'); // Adicionado para o handler mobile

    // =================================================================
    //  2. ESTADO DA APLICAÇÃO
    // =================================================================
    let chatHistory = [];
    let attachedFiles = [];

    // =================================================================
    //  3. FUNÇÕES DE MANIPULAÇÃO DO DOM E UI
    // =================================================================

    /**
     * Adiciona uma nova mensagem (do usuário ou do bot) à interface do chat.
     * @param {string} sender - 'user' ou 'bot'.
     * @param {string} message - O conteúdo de texto da mensagem.
     * @param {object} options - Opções adicionais, como imagens.
     */
    const addMessage = (sender, message, options = {}) => {
        const { images = [] } = options;
        const wrapper = document.createElement('div');
        wrapper.className = `message-wrapper ${sender}`;
        
        const bubble = document.createElement('div');
        bubble.className = 'message-bubble';
        if (message.startsWith('Houve um problema de conexão')) {
            bubble.classList.add('error');
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

        const textContent = document.createElement('div');
        textContent.className = 'markdown-content';
        textContent.innerHTML = marked.parse(message || ' ');
        bubble.appendChild(textContent);

        if (sender === 'bot') {
            const actionsWrapper = document.createElement('div');
            actionsWrapper.className = 'message-actions';

            const originalCopyIcon = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" /></svg>`;
            const copiedIcon = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>`;

            const copyBtn = document.createElement('button');
            copyBtn.className = 'message-action-btn';
            copyBtn.title = 'Copiar Texto';
            copyBtn.innerHTML = originalCopyIcon;
            copyBtn.onclick = () => {
                navigator.clipboard.writeText(message).then(() => {
                    copyBtn.innerHTML = copiedIcon;
                    copyBtn.classList.add('copied');
                    setTimeout(() => {
                        copyBtn.innerHTML = originalCopyIcon;
                        copyBtn.classList.remove('copied');
                    }, 2000);
                });
            };
            
            const shareBtn = document.createElement('button');
            shareBtn.className = 'message-action-btn';
            shareBtn.title = 'Compartilhar';
            shareBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg>`;
            shareBtn.onclick = () => {
                if (navigator.share) {
                    navigator.share({ text: message });
                } else {
                    alert('A função de compartilhar não é suportada neste navegador.');
                }
            };

            actionsWrapper.appendChild(copyBtn);
            if (navigator.share) {
                actionsWrapper.appendChild(shareBtn);
            }
            
            bubble.appendChild(actionsWrapper);
        }
        
        wrapper.appendChild(bubble);
        chatContainer.appendChild(wrapper);

        wrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    /**
     * Mostra ou esconde o indicador de "digitando..." do bot.
     * @param {boolean} show - True para mostrar, false para esconder.
     */
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

    // =================================================================
    //  4. LÓGICA DE ANEXOS E COMPRESSÃO DE IMAGENS
    // =================================================================

    /**
     * Comprime e redimensiona uma imagem.
     * @param {File} file - O ficheiro de imagem a ser processado.
     * @returns {Promise<object>} Um objeto com os dados da imagem comprimida.
     */
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
                        if (width > maxSize) { height *= maxSize / width; width = maxSize; }
                    } else {
                        if (height > maxSize) { width *= maxSize / height; height = maxSize; }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    const dataUrl = canvas.toDataURL('image/jpeg', quality);
                    resolve({
                        name: file.name,
                        type: 'image/jpeg',
                        content: dataUrl,
                        base64: dataUrl.split(',')[1]
                    });
                };
                img.onerror = reject;
                img.src = event.target.result;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    };

    /**
     * Atualiza a área de pré-visualização de imagens.
     */
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

    /**
     * Limpa a lista de ficheiros anexados e a pré-visualização.
     */
    const resetAttachments = () => {
        attachedFiles = [];
        fileInput.value = '';
        previewsArea.innerHTML = '';
    };

    // =================================================================
    //  5. LÓGICA PRINCIPAL DO CHAT
    // =================================================================

    /**
     * Envia a mensagem do usuário (com texto e/ou anexos) para o backend.
     */
    const sendMessage = async () => {
        const text = userInput.value.trim();
        if (!text && attachedFiles.length === 0) return;

        sendButton.disabled = true;

        const userMessageForDisplay = text || `Analisar ${attachedFiles.length} imagem(s)`;
        const imageContentsForDisplay = attachedFiles.map(file => file.content);
        addMessage('user', userMessageForDisplay, { images: imageContentsForDisplay });

        const userParts = [];
        if (text) {
            userParts.push({ text: text });
        }
        attachedFiles.forEach(file => {
            userParts.push({
                inline_data: { mime_type: file.type, data: file.base64 }
            });
        });

        chatHistory.push({ role: 'user', parts: userParts });

        resetAttachments();
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
                const errorText = await response.text();
                if (errorText.includes('<!DOCTYPE')) {
                    throw new Error("SERVER_HTML_ERROR");
                }
                const errorData = JSON.parse(errorText);
                throw new Error(errorData.error || "Ocorreu um erro no servidor.");
            }

            const responseData = await response.json();
            toggleTypingIndicator(false);
            addMessage('bot', responseData.reply);
            chatHistory.push({ role: 'model', parts: [{ text: responseData.reply }] });

        } catch (err) {
            toggleTypingIndicator(false);
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

    /**
     * Inicia ou reinicia uma conversa do zero.
     */
    const startNewConversation = () => {
        chatHistory = [];
        chatContainer.innerHTML = '';
        resetAttachments();
        const welcomeMessage = "Bom dia, Perito. Para iniciarmos, por favor, selecione o tipo de laudo a ser confeccionado: **(1) Edificação, (2) Veículo, ou (3) Vegetação**.";
        addMessage('bot', welcomeMessage);
        chatHistory.push({ role: 'model', parts: [{ text: welcomeMessage }] });
    };

    // =================================================================
    //  6. INICIALIZAÇÃO DA APLICAÇÃO E EVENT LISTENERS
    // =================================================================

    /**
     * Função principal que é executada quando a página carrega.
     */
    const initializeApp = () => {
        // Configura handlers para dispositivos móveis
        if (isMobileDevice()) {
            if (window.visualViewport) {
                window.visualViewport.addEventListener('resize', mobileInputHandler);
            }
        } else {
            // Fallback para desktop para manter a altura consistente
            const doc = document.documentElement;
            doc.style.setProperty('--app-height', `${window.innerHeight}px`);
            window.addEventListener('resize', () => {
                doc.style.setProperty('--app-height', `${window.innerHeight}px`);
            });
        }
        
        // Configura os listeners de eventos para os botões e inputs
        newChatBtn.addEventListener('click', startNewConversation);
        sendButton.addEventListener('click', sendMessage);
        userInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });

        attachBtn.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', async (e) => {
            const files = e.target.files;
            if (!files || files.length === 0) return;

            previewsArea.innerHTML = `<p class="processing-text">Processando imagens...</p>`;

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

        // Inicia a primeira conversa
        startNewConversation();
    };

    // Inicia a aplicação
    initializeApp();
});
