import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import fetch from 'node-fetch';

// Carrega as variáveis de ambiente do arquivo .env
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// --- Configurações da API e da Estratégia de Retentativa ---
const API_KEY = process.env.GEMINI_API_KEY;
const API_MODEL = 'gemini-1.5-flash-latest';
const MAX_RETRIES = 3; // Número máximo de tentativas
const BACKOFF_BASE_MS = 300; // Tempo base para a espera exponencial

// Validação crítica: o servidor não pode iniciar sem a chave da API
if (!API_KEY) {
  console.error('[ERRO CRÍTICO] Variável de ambiente GEMINI_API_KEY não definida.');
  process.exit(1); // Encerra o processo se a chave não for encontrada
}

// --- Middlewares ---
app.use(cors()); // Habilita o CORS para permitir requisições do frontend
app.use(express.json({ limit: '10mb' })); // Aumenta o limite do corpo da requisição para aceitar arquivos

// Rota de "health check" para verificar se o servidor está online
app.get('/health', (req, res) => {
    res.status(200).send('Servidor do Assistente de Perícias está ativo e saudável.');
});

// Rota principal que lida com a conversa do chat
app.post('/api/generate', async (req, res) => {
  const { history } = req.body;
  if (!history || !Array.isArray(history) || history.length === 0) {
    return res.status(400).json({ error: 'O histórico da conversa é obrigatório e não pode ser vazio.' });
  }

  let lastError = null;

  // Lógica de retentativa com backoff exponencial
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const body = { contents: history };
      const apiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${API_MODEL}:generateContent?key=${API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!apiResponse.ok) {
        const errorText = await apiResponse.text();
        try {
            const errorData = JSON.parse(errorText);
            throw new Error(errorData.error?.message || `Erro na API: ${apiResponse.status}`);
        } catch {
            throw new Error(`Erro na API: ${apiResponse.status} - ${errorText}`);
        }
      }

      const data = await apiResponse.json();
      const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!reply) {
        throw new Error("A API retornou uma resposta válida, mas vazia.");
      }
      
      console.log(`[Sucesso] Resposta da API recebida na tentativa ${attempt}.`);
      return res.json({ reply });

    } catch (error) {
      lastError = error;
      console.warn(`[AVISO] Tentativa ${attempt}/${MAX_RETRIES} falhou: ${error.message}`);
      if (attempt < MAX_RETRIES) {
        const delay = Math.pow(2, attempt - 1) * BACKOFF_BASE_MS + Math.random() * 100;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  console.error(`[ERRO] Todas as ${MAX_RETRIES} tentativas falharam. Último erro:`, lastError);
  res.status(503).json({ error: `O modelo de IA parece estar sobrecarregado ou indisponível. Por favor, tente novamente em alguns instantes.` });
});

// Rota para gerar títulos para as conversas
app.post('/api/generate-title', async (req, res) => {
    try {
        const { userMessage } = req.body;
        if (!userMessage) return res.status(400).json({ error: 'A mensagem do usuário é obrigatória para gerar um título.'});

        const titlePrompt = `Crie um título curto e objetivo (máximo 5 palavras) para uma conversa de perícia de incêndio iniciada com a seguinte mensagem. Responda APENAS com o título, sem aspas ou qualquer outra formatação. MENSAGEM: "${userMessage}"`;
        const body = {
            contents: [{ parts: [{ text: titlePrompt }] }],
            generationConfig: { maxOutputTokens: 20 }
        };

        const apiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${API_MODEL}:generateContent?key=${API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        if (!apiResponse.ok) throw new Error('Falha ao gerar título na API.');
        
        const data = await apiResponse.json();
        const title = data.candidates?.[0]?.content?.parts?.[0]?.text.trim().replace(/"/g, '') || "Nova Perícia";
        res.json({ title });

    } catch (error) {
        console.error('[ERRO] Falha ao gerar título:', error);
        res.status(500).json({ title: "Nova Perícia" });
    }
});

// Inicia o servidor
app.listen(PORT, () => {
  console.log(`Servidor do Assistente de Perícias rodando na porta ${PORT}.`);
});
