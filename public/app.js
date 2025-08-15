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
    let attachedFiles = [];

    // O PROMPT MESTRE COMPLETO AGORA VIVE AQUI
    const SYSTEM_PROMPT = `## PERFIL E DIRETRIZES GERAIS ##

Você é o "Analista Assistente de Perícia CBMAL", uma ferramenta especialista.
**Modelo de IA:** Você opera utilizando o modelo gemini-pro-vision.
**Função Principal:** Sua função é dupla: guiar a coleta de dados do Perito através de um fluxo estruturado e auxiliar ativamente na redação técnica das seções do laudo.
**Diretriz de Qualidade:** Ao redigir textos técnicos, seja detalhado e aprofundado.

**Capacidade Multimodal (Análise de Imagens):**
Quando o Perito enviar imagens, sua tarefa é analisá-las em busca de vestígios e padrões de incêndio. Incorpore suas observações visuais diretamente na sua resposta, conectando-as à pergunta atual do checklist. Foco em:
- **Padrões de Queima:** Marcas em V invertido, triângulo, formato colunar, V clássico, forma de U, cone truncado.
- **Indicadores de Direção:** Formas de setas e ponteiros na queima.
- **Intensidade:** Áreas de queima limpa (clean burn) e queima "couro de jacaré" (alligatoring).
- **Vestígios Específicos:** Derretimento de polímeros termoplásticos e deformação de lâmpadas incandescentes.

---
## REGRAS DE OPERAÇÃO (FLUXO DE TRABALHO ESTRUTURADO) ##

**FASE 1: IDENTIFICAÇÃO DO TIPO DE LAUDO**
Sempre inicie uma nova perícia com a pergunta abaixo.

> **Pergunta Inicial:** "Bom dia, Perito. Para iniciarmos, por favor, selecione o tipo de laudo a ser confeccionado: **(1) Edificação, (2) Veículo, ou (3) Vegetação**."

**FASE 2: COLETA DE DADOS ESTRUTURADA**
Com base na escolha do Perito, siga **APENAS** o checklist correspondente abaixo, fazendo uma pergunta de cada vez.

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
**FASE 3: REDAÇÃO ASSISTIDA E INTERATIVA**
1.  **Apresente as Opções:** Após a última pergunta do checklist, anuncie a transição e APRESENTE AS OPÇÕES NUMERADAS: 
    > "Coleta de dados finalizada. Com base nas informações fornecidas, vamos redigir as seções analíticas. Qual seção deseja iniciar?
    > **(1) Descrição da Zona de Origem**
    > **(2) Descrição da Propagação**
    > **(3) Correlações dos Elementos Obtidos**"

2.  **Redija o Conteúdo:** Se o perito escolher "DESCRIÇÃO DA ZONA DE ORIGEM" ou "DESCRIÇÃO DA PROPAGAÇÃO", use as respostas da Fase 2 para redigir uma sugestão de texto técnico. Se escolher "CORRELAÇÕES DOS ELEMENTOS OBTIDOS", inicie a FASE 4.

3.  **Peça Confirmação:** APÓS redigir qualquer texto, SEMPRE finalize com a pergunta: "Perito, o que acha desta redação? Deseja alterar ou adicionar algo? Se estiver de acordo, podemos prosseguir."

**FASE 4: ANÁLISE DE CORRELAÇÕES E CAUSA**
Se o perito escolher "CORRELAÇÕES DOS ELEMENTOS OBTIDOS", siga RIGOROSAMENTE a estrutura de exclusão já definida.

**FASE 5: COMPILAÇÃO DO RELATÓRIO FINAL**
Se, ao final do processo, o Perito solicitar o "RELATÓRIO FINAL" ou "COMPILAR TUDO", sua tarefa é:
1.  Analisar todo o histórico da conversa.
2.  Montar um único texto coeso contendo todas as seções redigidas em ordem.
3.  Ao final, redigir uma nova seção "CONCLUSÃO", onde você analisa as hipóteses restantes, discute as probabilidades da causa do incêndio com base nos vestígios apresentados, e sugere a causa provável ou justifica a indeterminação.
`;

    const isMobileDevice = () => /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    const mobileInputHandler = () => {
        if (!window.visualViewport) return;
        const appHeight = window.visualViewport.height;
        document.documentElement.style.setProperty('--app-height', `${appHeight}px`);
        const lastMessage = chatContainer.lastElementChild;
        if (lastMessage) lastMessage.scrollIntoView({ behavior: 'smooth', block: 'end' });
    };

    const addMessage = (sender, message, images = []) => {
        const wrapper = document.createElement('div');
        wrapper.className = `message-wrapper ${sender}`;
        const bubble = document.createElement('div');
        bubble.className = 'message-bubble';
        if (message.startsWith('Houve um problema de conexão')) bubble.classList.add('error');

        const textContent = document.createElement('div');
        textContent.className = 'markdown-content';
        textContent.innerHTML = marked.parse(message || ' ');
        bubble.appendChild(textContent);

        if (images.length > 0) {
            const imagesContainer = document.createElement('div');
            imagesContainer.className = 'message-images-container';
            images.forEach(imgBase64 => {
                const img = document.createElement('img');
                img.src = imgBase64;
                imagesContainer.appendChild(img);
            });
            bubble.appendChild(imagesContainer);
        }

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
                    setTimeout(() => { copyBtn.innerHTML = originalCopyIcon; copyBtn.classList.remove('copied'); }, 2000);
                });
            };
            const shareBtn = document.createElement('button');
            shareBtn.className = 'message-action-btn';
            shareBtn.title = 'Compartilhar';
            shareBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg>`;
            shareBtn.onclick = () => {
                if (navigator.share) navigator.share({ text: message });
                else alert('A função de compartilhar não é suportada neste navegador.');
            };
            actionsWrapper.appendChild(copyBtn);
            if (navigator.share) actionsWrapper.appendChild(shareBtn);
            bubble.appendChild(actionsWrapper);
        }
        
        wrapper.appendChild(bubble);
        chatContainer.appendChild(wrapper);
        wrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const sendMessage = async () => {
        const text = userInput.value.trim();
        if (!text && attachedFiles.length === 0) return;

        sendButton.disabled = true;
        
        const imageContents = attachedFiles.map(file => file.content);
        addMessage('user', text, imageContents);

        const userParts = [];
        if(text) userParts.push({ text: text });
        attachedFiles.forEach(file => {
            userParts.push({ inline_data: { mime_type: file.type, data: file.content.split(',')[1] } });
        });
        
        chatHistory.push({ role: 'user', parts: userParts });
        
        userInput.value = '';
        userInput.style.height = 'auto';
        resetAttachments();
        toggleTypingIndicator(true);

        try {
            const response = await fetch(API_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ history: chatHistory }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                if (errorText.includes('<!DOCTYPE')) throw new Error("SERVER_HTML_ERROR");
                const errorData = JSON.parse(errorText);
                throw new Error(errorData.error?.message || "Ocorreu um erro no servidor.");
            }

            const responseData = await response.json();
            toggleTypingIndicator(false);
            addMessage('bot', responseData.reply);
            chatHistory.push({ role: 'model', parts: [{ text: responseData.reply }] });

        } catch (err) {
            toggleTypingIndicator(false);
            if (err.message === "SERVER_HTML_ERROR") addMessage('bot', "Houve um problema de conexão com o servidor. Por favor, aguarde alguns segundos e tente enviar sua mensagem novamente.");
            else addMessage('bot', `Ocorreu um erro: ${err.message}`);
        } finally {
            sendButton.disabled = false;
            if (!isMobileDevice()) userInput.focus();
        }
    };

    const toggleTypingIndicator = (show) => {
        let indicator = document.getElementById('typing-indicator');
        if (show) {
            if (!indicator) {
                indicator = document.createElement('div');
                indicator.id = 'typing-indicator';
                indicator.className = 'message-wrapper bot';
                indicator.innerHTML = `<div class="message-bubble"><div class="bot-typing"><span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span></div></div>`;
                chatContainer.appendChild(indicator);
            }
            indicator.scrollIntoView({ behavior: 'smooth', block: 'end' });
        } else {
            if(indicator) indicator.remove();
        }
    };
    
    const startNewConversation = () => {
        // A lógica de inicialização agora é diferente
        chatHistory = []; // Limpa o histórico
        chatContainer.innerHTML = '';
        resetAttachments();
        
        const welcomeMessage = "Bom dia, Perito. Para iniciarmos, por favor, selecione o tipo de laudo a ser confeccionado: **(1) Edificação, (2) Veículo, ou (3) Vegetação**.";
        
        // Adiciona o prompt do sistema ao histórico, mas não exibe na tela
        chatHistory.push({ role: 'user', parts: [{ text: SYSTEM_PROMPT }] });
        
        // Adiciona a mensagem de boas-vindas na tela e no histórico
        addMessage('bot', welcomeMessage);
        chatHistory.push({ role: 'model', parts: [{ text: welcomeMessage }] });
    };

    const initializeApp = () => {
        if (window.visualViewport) {
            mobileInputHandler();
            window.visualViewport.addEventListener('resize', mobileInputHandler);
        } else {
            const doc = document.documentElement;
            doc.style.setProperty('--app-height', `${window.innerHeight}px`);
            window.addEventListener('resize', () => { doc.style.setProperty('--app-height', `${window.innerHeight}px`); });
        }
        startNewConversation();
    };

    newChatBtn.addEventListener('click', startNewConversation);
    sendButton.addEventListener('click', sendMessage);
    userInput.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } });
    
    attachBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async (e) => {
        if (!e.target.files) return;
        
        const files = Array.from(e.target.files).filter(file => file.type.startsWith('image/'));
        if (files.length === 0) return;

        previewsArea.innerHTML = `<p style="color: var(--text-secondary); font-size: 0.9rem;">Comprimindo ${files.length} imagem(ns)...</p>`;

        try {
            const compressionPromises = files.map(file => compressImage(file));
            const compressedFiles = await Promise.all(compressionPromises);
            attachedFiles.push(...compressedFiles);
            updatePreviews();
        } catch (error) {
            console.error("Erro ao comprimir imagem:", error);
            alert("Ocorreu um erro ao processar uma das imagens.");
            updatePreviews();
        }
    });

    initializeApp();
});
