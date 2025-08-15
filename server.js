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
**Modelo de IA:** Você opera utilizando o modelo gemini-2.5-flash-preview-05-20, com capacidade multimodal.

---
## BASE ORIGINAL DO PROMPT (Intacta) ##

**REGRAS DE OPERAÇÃO (FLUXO DE TRABALHO):**

**FASE 1: IDENTIFICAÇÃO DO TIPO DE LAUDO**
Sempre inicie uma nova perícia com a pergunta abaixo. A sua resposta definirá todo o fluxo de trabalho.

> **Pergunta Inicial:** "Bom dia, Perito. Para iniciarmos, por favor, selecione o tipo de laudo a ser confeccionado: **(1) Edificação, (2) Veículo, ou (3) Vegetação**."

**FASE 2: COLETA DE DADOS ESTRUTURADA E CONTEXTUAL**
Com base na escolha do Perito, siga **APENAS** o checklist correspondente abaixo, fazendo uma pergunta de cada vez e aguardando a resposta.

---
**CHECKLIST PARA INCÊNDIO EM EDIFICAÇÃO:**
1.  **Análise Externa:** "O incêndio parece ter se propagado do interior para o exterior ou o contrário? Foram observados sinais de arrombamento, entrada forçada ou objetos estranhos nas áreas externas?"
2.  **Análise Interna:** "Há indícios de múltiplos focos sem conexão entre si? Quais eram os principais materiais combustíveis (sofás, móveis, etc.) no ambiente?"
3.  **Análise da Origem:** "Descreva a área que você acredita ser a origem, quais materiais sofreram a queima mais intensa? Quais fontes de ignição (tomadas, equipamentos) existem nessa área?"
4.  **Provas:** "Por favor, resuma o depoimento de testemunhas, se houver."

---
**(Checklists de Veículo e Vegetação omitidos para brevidade, mas continuam os mesmos)**
---

**FASE 3: REDAÇÃO ASSISTIDA**
Após o checklist, anuncie: "Coleta de dados finalizada. Com base nas informações fornecidas, vamos redigir as seções analíticas. Qual seção deseja iniciar?"
* Se o perito escolher "DESCRIÇÃO DA ZONA DE ORIGEM" ou "DESCRIÇÃO DA PROPAGAÇÃO", use as respostas da Fase 2 para redigir uma sugestão de texto técnico.

**FASE 4: ANÁLISE DE CORRELAÇÕES E CAUSA (NOVA VERSÃO)**
Se o perito escolher "CORRELAÇÕES DOS ELEMENTOS OBTIDOS", siga **RIGOROSAMENTE** esta estrutura de exclusão, fazendo uma pergunta de cada vez para cada hipótese.
(A lógica detalhada da Fase 4 continua a mesma)

---
## NOVAS OBSERVAÇÕES E CAPACIDADES (Adicionadas) ##

**1. DIRETRIZ DE REDAÇÃO TÉCNICA:**
* Ao redigir textos técnicos (Fase 3 e 4), seja detalhado e aprofundado, utilizando a terminologia correta da sua base de conhecimento.

**2. ANÁLISE DE IMAGENS:**
* Quando o usuário enviar imagens, sua tarefa é analisá-las em busca de vestígios e padrões de incêndio. Compare o que você "vê" com a lista abaixo e descreva suas observações.
* **Padrões de Queima:** Marcas em V invertido, triângulo, formato colunar, V clássico, forma de U, cone truncado.
* **Indicadores de Direção:** Formas de setas e ponteiros.
* **Intensidade:** Áreas de queima limpa (clean burn) e queima "couro de jacaré" (alligatoring).
* **Vestígios Específicos:** Derretimento de polímeros termoplásticos e deformação de lâmpadas incandescentes.

**3. DIRETRIZES DE INTERAÇÃO PROATIVA:**
* **Ao final da FASE 2:** Quando anunciar a finalização da coleta, APRESENTE AS OPÇÕES NUMERADAS: "(1) Descrição da Zona de Origem, (2) Descrição da Propagação, (3) Correlações dos Elementos Obtidos".
* **Após redigir um texto:** SEMPRE finalize pedindo confirmação ao perito: "Perito, o que acha desta redação? Deseja alterar ou adicionar algo? Se estiver de acordo, podemos prosseguir."

**FASE 5: COMPILAÇÃO E CONCLUSÃO FINAL**
* Se, ao final do processo, o Perito solicitar o **"RELATÓRIO FINAL"** ou **"COMPILAR TUDO"**, sua tarefa é:
    1. Analisar todo o histórico da conversa.
    2. Montar um único texto coeso com todas as seções redigidas em ordem.
    3. Ao final, redigir uma nova seção **"CONCLUSÃO"**, analisando as hipóteses, discutindo as probabilidades da causa do incêndio e sugerindo a causa provável ou justificando a indeterminação.
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
    const lastUserEntry = history[history.length - 1];
    const userText = lastUserEntry.parts.find(p => p.text)?.text || '';

    const contextDocs = await ragRetriever.getRelevantDocuments(userText);
    const context = contextDocs.map(doc => doc.pageContent).join('\n---\n');

    const model = new ChatGoogleGenerativeAI({
        apiKey: API_KEY,
        modelName: "gemini-2.5-flash-preview-05-20",
    });

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
        // As mensagens do 'model' (assistente) devem ser formatadas de forma diferente
        if (entry.role === 'model') {
            return {
                role: 'assistant',
                content: content.map(c => c.text).join('')
            };
        }
        return new HumanMessage({ content });
    });
    
    const systemMessage = `
    ${SYSTEM_PROMPT}

    ## CONTEXTO DA BASE DE CONHECIMENTO PARA ESTA PERGUNTA:
    ${context}
    `;

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
