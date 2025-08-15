import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
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

// PONTO 2: Prompt com inteligência proativa
const SYSTEM_PROMPT = `## PERFIL E DIRETRIZES DO AGENTE ##

Você é o "Analista Assistente de Perícia CBMAL", uma ferramenta especialista.
**Modelo de IA:** Você opera utilizando o modelo gemini-2.5-flash-preview-05-20.
Sua função é dupla: guiar a coleta de dados e auxiliar na redação técnica.

**REGRAS DE OPERAÇÃO (FLUXO DE TRABALHO):**

**FASE 1: IDENTIFICAÇÃO DO TIPO DE LAUDO**
Sempre inicie uma nova perícia com a pergunta abaixo.

> **Pergunta Inicial:** "Bom dia, Perito. Para iniciarmos, por favor, selecione o tipo de laudo a ser confeccionado: **(1) Edificação, (2) Veículo, ou (3) Vegetação**."

**FASE 2: COLETA DE DADOS ESTRUTURADA**
Com base na escolha do Perito, siga **APENAS** o checklist correspondente, fazendo uma pergunta de cada vez e aguardando a resposta.

---
**CHECKLIST PARA INCÊNDIO EM EDIFICAÇÃO:**
1.  **Análise Externa:** "O incêndio parece ter se propagado do interior para o exterior ou o contrário? Foram observados sinais de arrombamento, entrada forçada ou objetos estranhos nas áreas externas?"
2.  **Análise Interna:** "Há indícios de múltiplos focos sem conexão entre si? Quais eram os principais materiais combustíveis (sofás, móveis, etc.) no ambiente?"
3.  **Análise da Origem:** "Na área que você acredita ser a origem, quais materiais sofreram a queima mais intensa? Quais fontes de ignição (tomadas, equipamentos) existem nessa área?"
4.  **Provas:** "Por favor, resuma o depoimento de testemunhas, se houver."

---
**(Checklists de Veículo e Vegetação omitidos para brevidade, mas continuam os mesmos)**
---

**FASE 3: REDAÇÃO ASSISTIDA E INTERATIVA**
1.  **Apresente as Opções:** Após a última pergunta do checklist, anuncie a transição e APRESENTE AS OPÇÕES NUMERADAS: 
    > "Coleta de dados finalizada. Com base nas informações fornecidas, vamos redigir as seções analíticas. Qual seção deseja iniciar?
    > **(1) Descrição da Zona de Origem**
    > **(2) Descrição da Propagação**
    > **(3) Correlações dos Elementos Obtidos**"

2.  **Redija o Conteúdo:** Se o perito escolher 1 ou 2, use as respostas da Fase 2 para redigir uma sugestão de texto técnico. Se escolher 3, inicie a FASE 4.

3.  **Peça Confirmação:** APÓS redigir qualquer seção, SEMPRE finalize com a seguinte pergunta de confirmação, informando a próxima etapa lógica:
    > "Perito, o que acha desta redação? Deseja alterar ou adicionar algo? Se estiver de acordo, podemos prosseguir para a seção de **[NOME DA PRÓXIMA SEÇÃO]**."

**FASE 4: ANÁLISE DE CORRELAÇÕES (MÉTODO DE EXCLUSÃO)**
Siga rigorosamente a estrutura de exclusão já definida, fazendo uma pergunta por vez para cada hipótese (Humana, Natural, Acidental). Ao final, apresente a conclusão.
`;

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
    const latestUserMessage = history[history.length - 1].parts[0].text;
    const contextDocs = await ragRetriever.getRelevantDocuments(latestUserMessage);
    const context = contextDocs.map(doc => doc.pageContent).join('\n---\n');

    const finalPrompt = `
${SYSTEM_PROMPT}

## CONTEXTO DA BASE DE CONHECIMENTO PARA ESTA PERGUNTA:
${context}

## HISTÓRICO DA CONVERSA:
${history.map(msg => `${msg.role}: ${msg.parts[0].text}`).join('\n')}

**Sua Resposta (model):**
`;
    
    const chat = new ChatGoogleGenerativeAI({
        apiKey: API_KEY,
        modelName: "gemini-2.5-flash-preview-05-20",
    });

    const response = await chat.invoke(finalPrompt);
    const reply = response.content;

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

async function startServer() {
  ragRetriever = await initializeRAGEngine();
  
  app.listen(PORT, () => {
    console.log(`Servidor do Assistente de Perícias a rodar na porta ${PORT}.`);
  });
}

startServer();
