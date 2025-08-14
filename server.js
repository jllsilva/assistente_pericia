import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenerativeAI } from '@langchain/google-genai';

// Importa nosso novo motor de RAG
import { initializeRAGEngine } from './rag-engine.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
  console.error('[ERRO CRÍTICO] Variável de ambiente GEMINI_API_KEY não definida.');
  process.exit(1);
}

// --- PROMPT DO SISTEMA (AGORA NO BACKEND) ---
const SYSTEM_PROMPT = `## PERFIL E DIRETRIZES DO AGENTE HÍBRIDO ##

Você é o "Assistente de Perícias CBMAL", uma ferramenta especialista de dupla função que atua como:
1.  **Redator Técnico Colaborativo:** Sua missão principal é transformar os achados de campo do Perito em textos técnicos para o laudo, seguindo os modelos oficiais.
2.  **Consultor Técnico Sob Demanda:** Sua missão secundária é responder a perguntas diretas e tirar dúvidas técnicas, consultando a base de conhecimento.

**BASE DE CONHECIMENTO:** A sua resposta DEVE ser baseada no CONTEXTO FORNECIDO e no histórico da conversa.

**REGRAS DE OPERAÇÃO:**
- Se a entrada do usuário parecer uma descrição de achados ou o nome de uma seção de laudo, ative o **MODO REDATOR**.
- Se a entrada do usuário for uma pergunta clara (contendo "?", "o que é", "qual", "como"), ative o **MODO CONSULTOR**.
- Ao responder, sempre se baseie primeiro no contexto fornecido.`;


// Variável para guardar nosso retriever
let ragRetriever;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/health', (req, res) => {
    res.status(200).send('Servidor do Assistente de Perícias está ativo e saudável.');
});

app.post('/api/generate', async (req, res) => {
  const { history } = req.body;
  if (!history || !Array.isArray(history) || history.length === 0) {
    return res.status(400).json({ error: 'O histórico da conversa é obrigatório.' });
  }

  try {
    // 1. Extrair a última mensagem/pergunta do usuário
    const latestUserMessage = history[history.length - 1].parts[0].text;
    
    // 2. Usar o RAG para buscar contexto relevante na base de conhecimento
    const contextDocs = await ragRetriever.getRelevantDocuments(latestUserMessage);
    const context = contextDocs.map(doc => doc.pageContent).join('\n---\n');

    // 3. Montar o prompt final para o Gemini
    const finalPrompt = `
${SYSTEM_PROMPT}

## CONTEXTO DA BASE DE CONHECIMENTO PARA ESTA PERGUNTA:
${context}

## HISTÓRICO DA CONVERSA:
${history.map(msg => `${msg.role}: ${msg.parts[0].text}`).join('\n')}

**Sua Resposta (model):**
`;
    
    // 4. Chamar a API do Gemini
    const model = new GoogleGenerativeAI({ apiKey: API_KEY });
    const geminiModel = model.getGenerativeModel({ model: "gemini-1.5-flash-latest" });

    const result = await geminiModel.generateContent(finalPrompt);
    const response = result.response;
    const reply = response.text();

    if (!reply) {
      throw new Error("A API retornou uma resposta válida, mas vazia.");
    }
    
    console.log(`[Sucesso] Resposta da API gerada com contexto RAG.`);
    return res.json({ reply });

  } catch (error) {
    console.error(`[ERRO] Falha ao gerar resposta:`, error);
    res.status(503).json({ error: `Ocorreu um erro ao processar sua solicitação.` });
  }
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Função para inicializar tudo e iniciar o servidor
async function startServer() {
  // Inicializa o motor RAG primeiro
  ragRetriever = await initializeRAGEngine();
  
  // Depois de tudo pronto, inicia o servidor Express
  app.listen(PORT, () => {
    console.log(`Servidor do Assistente de Perícias a rodar na porta ${PORT}.`);
  });
}

// Inicia o processo
startServer();
