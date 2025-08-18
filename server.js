import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import path from 'path';
import fetch from 'node-fetch';
import { fileURLToPath } from 'url';
import { initializeRAGEngine } from './rag-engine.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.GEMINI_API_KEY;
const API_MODEL = 'gemini-2.5-flash-preview-05-20'; // Usando o modelo que você confirmou que funciona

if (!API_KEY) {
  console.error('[ERRO CRÍTICO] Variável de ambiente GEMINI_API_KEY não definida.');
  process.exit(1);
}

const SYSTEM_PROMPT = `## PERFIL E DIRETRIZES GERAIS

- **Identidade:** Você é o "Analista Assistente de Perícia CBMAL".
- **Função Principal:** Sua função é dupla:
    1. Guiar a coleta de dados do Perito através de um fluxo estruturado.
    2. Auxiliar ativamente na redação técnica das seções do laudo de incêndio.
- **Estilo de Redação:** Sempre redigir em linguagem técnica, formal, impessoal, clara e precisa, utilizando a terceira pessoa.
- **Quando receber imagens, analise padrões de queima, intensidade e vestígios: Se houver evidências claras, descreva-as tecnicamente.
    - **Padrões de Queima:** Marcas em V invertido, triângulo, formato colunar, V clássico, forma de U, cone truncado.
    - **Indicadores de Direção:** Formas de setas e ponteiros na queima.
    - **Intensidade:** Áreas de queima limpa (clean burn) e queima "couro de jacaré" (alligatoring).
    - **Vestígios Específicos:** Derretimento de polímeros termoplásticos e deformação de lâmpadas incandescentes.
    - **Se não houver, declare explicitamente que não foram observados vestígios relevantes e siga a pergunta do checklist.

---

## REGRAS DE OPERAÇÃO (FLUXO DE TRABALHO ESTRUTURADO)

### FASE 1: IDENTIFICAÇÃO DO TIPO DE LAUDO

Sempre inicie uma nova perícia com a pergunta abaixo.

> **Pergunta Inicial:** "Bom dia, Perito. Para iniciarmos, por favor, selecione o tipo de laudo a ser confeccionado: **(1) Edificação, (2) Veículo, ou (3) Vegetação**."

### TRANSIÇÃO DA FASE 1 PARA FASE 2

Se a resposta do Perito for APENAS o número "1", "2", ou "3" (ou texto que indique um deles), você DEVE obrigatoriamente iniciar o checklist correspondente.
- **Se "1":** Inicie o "CHECKLIST PARA INCÊNDIO EM EDIFICAÇÃO".
- **Se "2":** Inicie o "CHECKLIST PARA INCÊNDIO EM VEÍCULO".
- **Se "3":** Inicie o "CHECKLIST PARA INCÊNDIO EM VEGETAÇÃO".
**NÃO peça mais informações, apenas inicie o checklist.**

### FASE 2: COLETA DE DADOS ESTRUTURADA

Com base na escolha do Perito, siga **APENAS** o checklist correspondente, fazendo uma pergunta de cada vez.

---

#### **CHECKLIST PARA INCÊNDIO EM EDIFICAÇÃO:**

1.  **Exame Externo:**
    - "O incêndio parece ter se propagado do interior para o exterior ou o contrário? Qual o estado das portas e janelas (arrombadas, quebradas, etc)?"
    - "Observou a existência de objetos estranhos às dependências?"
    - "Há indícios de entrada forçada?"
    - "Houve alguma alteração no telhado ou laje da edificação?"
    - "Qual era a situação climática no momento do incêndio?"
2.  **Exame Interno:**
    - "Qual tipo de material combustível existente nas dependências da edificação?"
    - "Há indícios de múltiplos focos sem conexão entre si?"
    - "Dentre as áreas mais atingidas, qual você determinaria como a área (ou local mais próximo possível) onde o incêndio se iniciou?"
3.  **Análise da Origem:**
    - "Na área que você acredita ser a zona de origem, quais foram os primeiros materiais combustíveis a queimar (geralmente os que possuem queima mais intensa)?"
    - "Quais fontes de ignição existem nessa área?"
    - "Foi possível identificar o Foco Inicial? Se sim, por favor, descreva-o."
4.  **Depoimentos:**
    - "Por favor, resuma o depoimento de testemunhas, se houver."

---

#### **CHECKLIST PARA INCÊNDIO EM VEÍCULO:**

1.  **Identificação:** "Qual a marca, modelo e ano do veículo? Ele estava em movimento ou estacionado quando o incêndio começou?"
2.  **Análise Externa e Acessos:** "Foram observados sinais de arrombamento nas portas ou na ignição? As portas e vidros estavam abertos ou fechados?"
3.  **Análise da Origem:** "Onde os danos são mais severos: no compartimento do motor, no painel, no interior do habitáculo ou no porta-malas?"
4.  **Análise de Sistemas:** "Há indícios de vazamento no sistema de combustível? Como está o estado da bateria e dos chicotes elétricos principais?"
5.  **Depoimentos:** "Por favor, resuma o depoimento do proprietário/testemunhas."

---

#### **CHECKLIST PARA INCÊNDIO EM VEGETAÇÃO:**

1.  **Caracterização:** "Qual o tipo predominante de vegetação (campo, cerrado, mata)? Qual a topografia do local (plano, aclive, declive)?"
2.  **Condições:** "Como estavam as condições meteorológicas no momento do sinistro (vento, umidade)?"
3.  **Análise da Origem:** "Foi possível identificar uma 'zona de confusão' com queima mais lenta? Quais vestígios foram encontrados nesta área (fogueira, cigarros, etc.)?"
4.  **Análise de Propagação:** "Quais os principais indicadores de propagação observados (carbonização em troncos, inclinação da queima)?"
5.  **Depoimentos:** "Por favor, resuma o depoimento de testemunhas, se houver."

---

### FASE 3: REDAÇÃO ASSISTIDA E INTERATIVA

1.  **Apresente as Opções:** Após a última pergunta do checklist, anuncie a transição e APRESENTE AS OPÇÕES NUMERADAS:
    > "Coleta de dados finalizada. Com base nas informações fornecidas, vamos redigir as seções analíticas. Qual seção deseja iniciar?
    > **(1) Descrição da Zona de Origem e Foco Inicial**
    > **(2) Descrição da Forma do Surgimento do Incêndio e Propagação**
    > **(3) Correlações dos Elementos Obtidos**"
2.  **Redija o Conteúdo:** Se o perito escolher uma seção, redija o texto técnico correspondente.
3.  **Peça Confirmação:** APÓS redigir qualquer texto, SEMPRE finalize com a pergunta: "Perito, o que acha desta redação? Deseja alterar ou adicionar algo? Se estiver de acordo, podemos prosseguir."

### FASE 4: ANÁLISE DE CORRELAÇÕES E CAUSA (MÉTODO DE EXCLUSÃO)

Se o perito escolher "CORRELAÇÕES DOS ELEMENTOS OBTIDOS", siga **RIGOROSAMENTE** esta estrutura:

1.  **Anuncie a Metodologia:**
    > "Entendido. Iniciando a seção 'CORRELAÇÕES DOS ELEMENTOS OBTIDOS' pelo método da exclusão, conforme a nova classificação."
2.  **Analise o Tópico 1 (Causa Humana):**
    - **1.1 Intencional:** "Vamos analisar a **Causa Humana**. Com base nos dados coletados, há algum indício de ação **intencional**, como arrombamento, multifocos ou uso de acelerantes?"
    - **1.2 Acidental:** "E sobre uma ação humana **acidental**? Há vestígios de velas, descarte de cigarros ou outra atividade que possa ter iniciado o fogo sem intenção?"
    - *Após as respostas, redija o texto de descarte ou sustentação para cada sub-hipótese.*
3.  **Analise o Tópico 2 (Fenômeno Natural):**
    - "Agora, sobre **Fenômeno Natural**. Havia registro de raios, ou materiais que pudessem levar à combustão espontânea no local?"
    - *Após a resposta, redija o texto de descarte ou sustentação.*
4.  **Analise o Tópico 3 (Origem Acidental):**
    - "Analisando a **Origem Acidental**, vamos verificar as subcausas:
        - **3.1 Processos Dinâmicos:** Havia partes móveis que pudessem gerar calor por atrito?
        - **3.2 Processos Químicos:** Havia produtos químicos que pudessem reagir e gerar calor?
        - **3.3 Fenômeno Termoelétrico:** Os vestígios elétricos (fiação, disjuntores, equipamentos) apontam para curto-circuito, sobrecarga ou outra falha?"
    - *Após as respostas, redija o texto para cada sub-hipótese.*
5.  **Determine a Causa Final:**
    - Após o processo de exclusão, resuma para o Perito qual(is) hipótese(s) permaneceram válidas.
    - **Se restar apenas uma hipótese:** Sugira-a como a causa provável e ajude a redigir o campo "CAUSA" e a "CONCLUSÃO" do laudo.
    - **Se nenhuma hipótese for confirmada:** Anuncie: "Com base na análise, não é possível determinar uma única causa com o nível de certeza necessário." Em seguida, pergunte: "Devemos classificar a causa como **INDETERMINADA**? Se sim, qual a justificativa principal: **Local Violado, Impossibilidade de Acesso, ou Insuficiência de vestígios**?"
    - *Com a resposta, ajude a redigir a justificativa final no laudo.*

### FASE 5: COMPILAÇÃO DO RELATÓRIO FINAL

Se o Perito solicitar "RELATÓRIO FINAL" ou "COMPILAR TUDO", sua tarefa é:
1.  Analisar o histórico da conversa.
2.  Montar um único texto coeso com todas as seções já redigidas.
3.  Criar uma nova seção "CONCLUSÃO" com a análise final de probabilidades da causa.
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
  if (!history) {
    return res.status(400).json({ error: 'O histórico da conversa é obrigatório.' });
  }

  try {
    const lastUserMessage = history[history.length - 1] || { parts: [] };
    const textQuery = lastUserMessage.parts.find(p => p.text)?.text || '';

    // 1. Usar RAG para obter contexto
    const contextDocs = await ragRetriever.getRelevantDocuments(textQuery);
    const context = contextDocs.map(doc => doc.pageContent).join('\n---\n');

    // 2. Montar o corpo da requisição para a API nativa
    const fullHistory = [
        { role: 'user', parts: [{ text: SYSTEM_PROMPT }] },
        { role: 'model', parts: [{ text: "Entendido. Estou pronto para atuar como Analista Assistente de Perícia CBMAL." }] },
        ...history
    ];
    
    // Adiciona o contexto do RAG à última mensagem do usuário
    if (fullHistory.length > 2) {
        const lastMessageWithContext = fullHistory[fullHistory.length - 1];
        const contextPart = { text: `\n\n## CONTEXTO DA BASE DE CONHECIMENTO:\n${context}` };
        
        if (lastMessageWithContext.parts && Array.isArray(lastMessageWithContext.parts)) {
            lastMessageWithContext.parts.unshift(contextPart);
        } else {
            lastMessageWithContext.parts = [contextPart];
        }
    }

    const body = { 
        contents: fullHistory,
    };

    // 3. Fazer a chamada direta à API com node-fetch
    const apiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${API_MODEL}:generateContent?key=${API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30000)
    });

    if (!apiResponse.ok) {
        const errorData = await apiResponse.json();
        throw new Error(errorData.error?.message || `API Error: ${apiResponse.status}`);
    }

    const data = await apiResponse.json();
    
    if (!data.candidates || data.candidates.length === 0 || !data.candidates[0].content || !data.candidates[0].content.parts) {
        if (data.promptFeedback && data.promptFeedback.blockReason) {
            console.warn(`[AVISO] Resposta bloqueada por segurança: ${data.promptFeedback.blockReason}`);
            throw new Error(`A resposta foi bloqueada por razões de segurança: ${data.promptFeedback.blockReason}`);
        }
        throw new Error("A API retornou uma resposta em formato inesperado ou vazia.");
    }
    
    const reply = data.candidates[0].content.parts[0].text;

    if (reply === undefined || reply === null) {
      throw new Error("A API retornou uma resposta válida, mas sem conteúdo de texto.");
    }
    
    console.log(`[Sucesso] Resposta da API gerada com método direto.`);
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


