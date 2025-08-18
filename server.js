// =================================================================
//  1. IMPORTAÇÕES DE MÓDULOS
// =================================================================
import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { initializeRAGEngine } from './rag-engine.js';

// =================================================================
//  2. CONFIGURAÇÃO INICIAL E VARIÁVEIS DE AMBIENTE
// =================================================================
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.GEMINI_API_KEY;

// Validação crítica da chave de API na inicialização
if (!API_KEY) {
  console.error('[ERRO CRÍTICO] Variável de ambiente GEMINI_API_KEY não definida.');
  process.exit(1);
}

// =================================================================
//  3. PROMPT DO SISTEMA (A "PERSONALIDADE" DO ASSISTENTE)
// =================================================================
const SYSTEM_PROMPT = `## PERFIL E DIRETRIZES GERAIS ##

Você é o "Analista Assistente de Perícia CBMAL", uma ferramenta especialista.
**Modelo de IA:** Você opera utilizando o modelo gemini-1.5-flash-latest.
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

2.  **Redija o Conteúdo:** Se o perito escolher uma seção, redija o texto técnico correspondente.

3.  **Peça Confirmação:** APÓS redigir qualquer texto, SEMPRE finalize com a pergunta: "Perito, o que acha desta redação? Deseja alterar ou adicionar algo? Se estiver de acordo, podemos prosseguir."

**FASE 4: ANÁLISE DE CORRELAÇÕES E CAUSA**
Se o perito escolher "CORRELAÇÕES DOS ELEMENTOS OBTIDOS", siga RIGOROSAMENTE a estrutura de exclusão.

**FASE 5: COMPILAÇÃO DO RELATÓRIO FINAL**
Se o Perito solicitar "RELATÓRIO FINAL" ou "COMPILAR TUDO", sua tarefa é:
1.  Analisar o histórico.
2.  Montar um único texto coeso com as seções redigidas.
3.  Criar uma nova seção "CONCLUSÃO" com a análise de probabilidades da causa.
`;

// =================================================================
//  4. CONFIGURAÇÃO DO SERVIDOR EXPRESS
// =================================================================
let ragRetriever; // Variável global para armazenar o motor RAG

// Middlewares essenciais
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Permite o upload de anexos grandes
app.use(express.static(path.join(__dirname, 'public'))); // Serve os ficheiros do frontend

// =================================================================
//  5. DEFINIÇÃO DAS ROTAS DA APLICAÇÃO
// =================================================================

// Rota para verificação de saúde do servidor
app.get('/health', (req, res) => {
    res.status(200).send('Servidor do Assistente de Perícias está ativo e saudável.');
});

// Rota principal da API para gerar respostas do chatbot
app.post('/api/generate', async (req, res) => {
  const { history } = req.body;
  if (!history || !Array.isArray(history) || history.length === 0) {
    return res.status(400).json({ error: 'O histórico da conversa é obrigatório.' });
  }

  try {
    // Extrai a última mensagem do usuário para a busca RAG
    const latestUserMessage = history[history.length - 1].parts[0].text;
    
    // Busca na base de conhecimento
    const contextDocs = await ragRetriever.getRelevantDocuments(latestUserMessage);
    const context = contextDocs.map(doc => doc.pageContent).join('\n---\n');

    // Monta o prompt final com todas as informações
    const finalPrompt = `
${SYSTEM_PROMPT}

## CONTEXTO DA BASE DE CONHECIMENTO PARA ESTA PERGUNTA:
${context}

## HISTÓRICO DA CONVERSA:
${history.map(msg => `${msg.role}: ${msg.parts[0].text}`).join('\n')}

**Sua Resposta (model):**
`;
    
    // Configura e chama o modelo de IA
    const chat = new ChatGoogleGenerativeAI({
        apiKey: API_KEY,
        modelName: "gemini-1.5-flash-latest", // Corrigido para o modelo mais recente
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

// Rota fallback: serve o index.html para qualquer outra requisição GET
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// =================================================================
//  6. INICIALIZAÇÃO DO SERVIDOR
// =================================================================

/**
 * Função principal que inicializa o motor RAG e, em seguida,
 * inicia o servidor Express para receber requisições.
 */
async function startServer() {
  // Primeiro, carrega a base de conhecimento na memória
  ragRetriever = await initializeRAGEngine();
  
  // Após a base de conhecimento estar pronta, inicia o servidor
  app.listen(PORT, () => {
    console.log(`Servidor do Assistente de Perícias a rodar na porta ${PORT}.`);
  });
}

// Inicia todo o processo
startServer();
