import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { initializeRAGEngine } from './rag-engine.js';
import { HumanMessage } from '@langchain/core/messages';

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

const SYSTEM_PROMPT = `## PERFIL E DIRETRIZES DO AGENTE ##

Você é o "Analista Assistente de Perícia CBMAL", uma ferramenta especialista.
**Modelo de IA:** Você opera utilizando o modelo gemini-2.5-flash-preview-05-20, com capacidade de análise de imagens (multimodal).
**Diretriz Principal:** Ao redigir textos técnicos, seja detalhado e aprofundado, utilizando a terminologia correta da base de conhecimento.

**ANÁLISE DE IMAGENS:**
Quando o usuário enviar imagens, sua principal tarefa é analisá-las em busca de vestígios e padrões de incêndio. Compare o que você "vê" com a lista abaixo e descreva suas observações no contexto da perícia.
- **Padrões de Queima:** Busque por marcas em V invertido, triângulo, formato colunar, V clássico, forma de U, cone truncado.
- **Indicadores de Direção:** Procure por formas de setas e ponteiros na queima.
- **Intensidade:** Identifique áreas de queima limpa (clean burn) e queima profunda em madeira (padrão "couro de jacaré" ou alligatoring), indicando a intensidade e duração do calor.
- **Vestígios Específicos:** Analise o derretimento de polímeros termoplásticos e a deformação de lâmpadas incandescentes para inferir a origem e propagação do calor.

**REGRAS DE OPERAÇÃO (FLUXO DE TRABALHO):**
(O restante do prompt com as FASES 1 a 5 continua exatamente o mesmo)
...
`;

let ragRetriever;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/health', (req, res) => {
    res.status(200).send('Servidor do Assistente de Perícias está ativo e saudável.');
});

// Rota de API atualizada para ser multimodal
app.post('/api/generate', async (req, res) => {
  const { history } = req.body;
  if (!history || !Array.isArray(history) || history.length === 0) {
    return res.status(400).json({ error: 'O histórico da conversa é obrigatório.' });
  }

  try {
    const lastUserEntry = history[history.length - 1];
    const userText = lastUserEntry.parts.find(p => p.text)?.text || '';

    const contextDocs = await ragRetriever.getRelevantDocuments(userText);
    const context = contextDocs.map(doc => doc.pageContent).join('\n---\n');

    const model = new ChatGoogleGenerativeAI({
        apiKey: API_KEY,
        modelName: "gemini-2.5-flash-preview-05-20",
    });

    // Constrói o histórico de mensagens para o modelo, preservando o formato multimodal
    const messages = history.map(entry => {
        const content = entry.parts.map(part => {
            if (part.text) {
                return { type: "text", text: part.text };
            }
            if (part.inline_data) {
                return {
                    type: "image_url",
                    image_url: `data:${part.inline_data.mime_type};base64,${part.inline_data.data}`
                };
            }
        });
        return new HumanMessage({ content });
    });
    
    const systemMessage = `
    ${SYSTEM_PROMPT}

    ## CONTEXTO DA BASE DE CONHECIMENTO PARA ESTA PERGUNTA:
    ${context}
    `;

    // A chamada `invoke` agora recebe o prompt do sistema e o histórico de mensagens separadamente
    const response = await model.invoke([
        new HumanMessage(systemMessage),
        ...messages
    ]);
    
    const reply = response.content;

    if (!reply) {
      throw new Error("A API retornou uma resposta válida, mas vazia.");
    }
    
    console.log(`[Sucesso] Resposta da API gerada com contexto RAG e análise de imagem.`);
    return res.json({ reply });

  } catch (error) {
    console.error(`[ERRO] Falha ao gerar resposta:`, error);
    res.status(503).json({ error: `Ocorreu um erro ao processar sua solicitação.` });
  }
});


app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

async function startServer() {
  ragRetriever = await initializeRAGEngine();
  
  app.listen(PORT, () => {
    console.log(`Servidor do Assistente de Perícias a rodar na porta ${PORT}.`);
  });
}

startServer();
