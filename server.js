import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import fetch from 'node-fetch';
import path from 'path';
import { fileURLToPath } from 'url';

// Carrega as variáveis de ambiente do ficheiro .env
dotenv.config();

// --- Configuração de Caminhos para Módulos ES ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// --- Configurações da API ---
const API_KEY = process.env.GEMINI_API_KEY;
const API_MODEL = 'gemini-2.5-flash-preview-05-20'; 
const MAX_RETRIES = 3;
const BACKOFF_BASE_MS = 300;

if (!API_KEY) {
  console.error('[ERRO CRÍTICO] Variável de ambiente GEMINI_API_KEY não definida.');
  process.exit(1);
}

// --- Middlewares ---
app.use(cors());
// **CORREÇÃO:** Aumenta o limite do corpo da requisição para 50mb
app.use(express.json({ limit: '50mb' })); 

// --- SERVIR FICHEIROS ESTÁTICOS (FRONTEND) ---
app.use(express.static(path.join(__dirname, 'public')));

// --- ROTAS DA API ---

app.get('/health', (req, res) => {
    res.status(200).send('Servidor do Assistente de Perícias está ativo e saudável.');
});

app.post('/api/generate', async (req, res) => {
  const { history } = req.body;
  if (!history || !Array.isArray(history) || history.length === 0) {
    return res.status(400).json({ error: 'O histórico da conversa é obrigatório e não pode ser vazio.' });
  }

  let lastError = null;

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

// --- ROTA FINAL (FALLBACK) ---
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Inicia o servidor
app.listen(PORT, () => {
  console.log(`Servidor do Assistente de Perícias a rodar na porta ${PORT}.`);
});
