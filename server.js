import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { initializeRAGEngine } from './rag-engine.js';
// Adicionando as importações que sua solução utiliza
import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";

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
**Modelo de IA:** Você opera utilizando o modelo gemini-2.5-flash-preview-05-20.
Sua função é dupla: guiar a coleta de dados e auxiliar na redação técnica.

---
**ANÁLISE DE IMAGENS (CAPACIDADE MULTIMODAL):**
Quando o usuário enviar imagens junto com o texto, sua tarefa é analisá-las em busca de vestígios e padrões de incêndio. Incorpore suas observações visuais na sua resposta de forma natural, ajudando na confecção do laudo. Foco em:
- **Padrões de Queima:** Marcas em V invertido, triângulo, formato colunar, V clássico, forma de U, cone truncado.
- **Indicadores de Direção:** Formas de setas e ponteiros na queima.
- **Intensidade:** Áreas de queima limpa (clean burn) e queima "couro de jacaré" (alligatoring).
- **Vestígios Específicos:** Derretimento de polímeros termoplásticos e deformação de lâmpadas incandescentes.
---

**REGRAS DE OPERAÇÃO (FLUXO DE TRABALHO):**

**FASE 1: IDENTIFICAÇÃO DO TIPO DE LAUDO**
Sempre inicie uma nova perícia com a pergunta abaixo.

> **Pergunta Inicial:** "Bom dia, Perito. Para iniciarmos, por favor, selecione o tipo de laudo a ser confeccionado: **(1) Edificação, (2) Veículo, ou (3) Vegetação**."

**FASE 2: COLETA DE DADOS ESTRUTURADA**
Com base na escolha do Perito, siga **APENAS** o checklist correspondente abaixo, fazendo uma pergunta de cada vez e aguardando a resposta.

---
**CHECKLIST PARA INCÊNDIO EM EDIFICAÇÃO:**
1.  **Análise Externa:** "O incêndio parece ter se propagado do interior para o exterior ou o contrário? Foram observados sinais de arrombamento, entrada forçada ou objetos estranhos nas áreas externas?"
2.  **Análise Interna:** "Há indícios de múltiplos focos sem conexão entre si? Quais eram os principais materiais combustíveis (sofás, móveis, etc.) no ambiente?"
3.  **Análise da Origem:** "Descreva a área que você acredita ser a zona de origem, quais materiais sofreram a queima mais intensa? Quais fontes de ignição (tomadas, equipamentos) existem nessa área? é possível identificar o foco inicial? "
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
    > **(1) Descrição da Zona de Origem e foco inicial**
    > **(2) Descrição da Propagação**
    > **(3) Correlações dos Elementos Obtidos**"

2.  **Redija o Conteúdo:** Se o perito escolher 1 ou 2, use as respostas da Fase 2 para redigir uma sugestão de texto técnico. Se escolher 3, inicie a FASE 4.

3.  **Peça Confirmação:** APÓS redigir qualquer seção, SEMPRE finalize com a seguinte pergunta de confirmação, informando a próxima etapa lógica:
    > "Perito, o que acha desta redação? Deseja alterar ou adicionar algo? Se estiver de acordo, podemos prosseguir para a seção de **[NOME DA PRÓPRIA SEÇÃO]**."

**FASE 4: ANÁLISE DE CORRELAÇÕES (MÉTODO DE EXCLUSÃO)**
Siga rigorosamente a estrutura de exclusão já definida.
`;

let ragRetriever;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/health', (req, res) => {
    res.status(200).send('Servidor do Assistente de Perícias está ativo e saudável.');
});

// Substituindo toda a função app.post pela sua lógica corrigida e robusta.
app.post('/api/generate', async (req, res) => {
  const { history } = req.body;
  if (!history || !Array.isArray(history) || history.length === 0) {
    return res.status(400).json({ error: 'O histórico da conversa é obrigatório.' });
  }

  try {
    const lastUserMessage = history[history.length - 1];
    const textQuery = lastUserMessage.parts.find(p => 'text' in p)?.text || '';

    const contextDocs = await ragRetriever.getRelevantDocuments(textQuery);
    const context = contextDocs.map(doc => doc.pageContent).join('\n---\n');

    const langChainHistory = history.slice(0, -1).map(msg => {
      const messageContent = msg.parts[0]?.text || '';
      return msg.role === 'user'
        ? new HumanMessage(messageContent)
        : new AIMessage(messageContent);
    });

    const newUserMessageParts = [];
    
    newUserMessageParts.push({ 
        type: "text", 
        text: `## CONTEXTO DA BASE DE CONHECIMENTO:\n${context}\n\n## MENSAGEM DO PERITO:` 
    });

    lastUserMessage.parts.forEach(part => {
      if ('text' in part && part.text) {
        newUserMessageParts.push({ type: "text", text: part.text });
      } else if ('inline_data' in part) {
        newUserMessageParts.push({
          type: "image_url",
          image_url: `data:${part.inline_data.mime_type};base64,${part.inline_data.data}`,
        });
      }
    });

    const messages = [
      new SystemMessage(SYSTEM_PROMPT),
      ...langChainHistory,
      new HumanMessage({ content: newUserMessageParts }),
    ];

    const chat = new ChatGoogleGenerativeAI({
        apiKey: API_KEY,
        modelName: "gemini-2.5-flash-preview-05-20", // Corrigido para o modelo mais novo
    });

    const response = await chat.invoke(messages);
    const reply = response.content;

    if (!reply) {
      throw new Error("A API retornou uma resposta válida, mas vazia.");
    }
    
    console.log(`[Sucesso] Resposta da API gerada com contexto RAG e multimodal.`);
    return res.json({ reply });

  } catch (error) {
    console.error(`[ERRO] Falha ao gerar resposta:`, error);
    res.status(503).json({ error: `Ocorreu um erro ao processar sua solicitação: ${error.message}` });
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
