document.addEventListener('DOMContentLoaded', () => {
  const API_GENERATE = '/api/generate';
  const API_UPLOAD = '/api/upload';

  const chatContainer = document.getElementById('chat-container');
  const userInput = document.getElementById('user-input');
  const sendButton = document.getElementById('send-button');
  const newChatBtn = document.getElementById('new-chat-btn');
  const attachBtn = document.getElementById('attach-btn');
  const fileInput = document.getElementById('file-input');
  const previewsArea = document.getElementById('previews-area');

  let pendingFiles = [];
  let chatHistory = [];

  const addMessage = (sender, message) => {
    const wrapper = document.createElement('div');
    wrapper.className = `msg ${sender}`;
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.textContent = message;
    wrapper.appendChild(bubble);
    chatContainer.appendChild(wrapper);
    chatContainer.scrollTop = chatContainer.scrollHeight;
  };

  const setTyping = (on) => {
    let el = document.getElementById('typing');
    if (!on && el) {
      el.remove();
      return;
    }
    if (on) {
      if (!el) {
        el = document.createElement('div');
        el.id = 'typing';
        el.className = 'msg bot';
        const b = document.createElement('div');
        b.className = 'bubble';
        b.textContent = 'digitando...';
        el.appendChild(b);
        chatContainer.appendChild(el);
        chatContainer.scrollTop = chatContainer.scrollHeight;
      }
    }
  };

  // ---------- Pré-visualização e seleção ----------
  attachBtn?.addEventListener('click', () => fileInput?.click());
  fileInput?.addEventListener('change', () => {
    previewsArea.innerHTML = '';
    pendingFiles = Array.from(fileInput.files || []);
    pendingFiles.forEach(file => {
      const url = URL.createObjectURL(file);
      const img = document.createElement('img');
      img.src = url;
      img.alt = file.name;
      img.style.maxWidth = '100px';
      img.style.marginRight = '8px';
      previewsArea.appendChild(img);
    });
  });

  async function uploadSelectedFiles() {
    if (!pendingFiles.length) return [];
    const form = new FormData();
    pendingFiles.forEach(f => form.append('photos', f));
    const resp = await fetch(API_UPLOAD, { method: 'POST', body: form });
    if (!resp.ok) throw new Error('Falha no upload de imagens');
    const data = await resp.json();
    if (!data.ok) throw new Error(data.error || 'Erro no upload');
    return (data.files || []).map(f => f.url);
  }

  async function sendPrompt() {
    const text = userInput.value.trim();
    if (!text && pendingFiles.length === 0) return;

    sendButton.disabled = true;
    addMessage('user', text || '(mensagem sem texto, apenas anexos)');
    setTyping(true);

    try {
      // 1) Enviar anexos (se houver)
      const imageUrls = await uploadSelectedFiles();

      // 2) Enviar prompt com URLs ao backend
      const resp = await fetch(API_GENERATE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: text,
          chatHistory,
          imageUrls,
        }),
      });
      const data = await resp.json();
      setTyping(false);
      if (!resp.ok || !data.ok) {
        addMessage('bot', data.error || 'Erro na geração da resposta.');
      } else {
        addMessage('bot', data.reply);
        chatHistory.push({ role: 'user', content: text });
        chatHistory.push({ role: 'assistant', content: data.reply });
      }
    } catch (e) {
      setTyping(false);
      addMessage('bot', `Erro: ${e.message}`);
    } finally {
      sendButton.disabled = false;
      userInput.value = '';
      fileInput.value = '';
      pendingFiles = [];
      previewsArea.innerHTML = '';
      userInput.focus();
    }
  }

  sendButton?.addEventListener('click', sendPrompt);
  userInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendPrompt();
    }
  });

  newChatBtn?.addEventListener('click', () => {
    chatContainer.innerHTML = '';
    chatHistory = [];
    userInput.value = '';
    fileInput.value = '';
    pendingFiles = [];
    previewsArea.innerHTML = '';
  });
});