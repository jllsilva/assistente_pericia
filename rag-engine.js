// =================================================================
//  1. IMPORTAÇÕES DE MÓDULOS DA BIBLIOTECA LANGCHAIN
// =================================================================
import { DirectoryLoader } from "langchain/document_loaders/fs/directory";
import { DocxLoader } from "langchain/document_loaders/fs/docx";
import { PDFLoader } from "langchain/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { MemoryVectorStore } from "langchain/vectorstores/memory";

// =================================================================
//  2. FUNÇÃO PRINCIPAL DE INICIALIZAÇÃO DO MOTOR RAG
// =================================================================

/**
 * Carrega, processa e indexa todos os documentos da base de conhecimento.
 * Esta função é executada uma vez quando o servidor é iniciado.
 * @returns {Promise<object>} Um objeto "retriever" pronto para buscar documentos.
 */
export async function initializeRAGEngine() {
  try {
    console.log('[RAG Engine] Iniciando indexação da base de conhecimento...');
    
    // --- Passo 1: Carregar os documentos da pasta ---
    // A DirectoryLoader varre a pasta 'knowledge_base' e usa o loader apropriado
    // para cada tipo de ficheiro (.pdf, .docx).
    const loader = new DirectoryLoader(
      './knowledge_base',
      {
        '.pdf': (path) => new PDFLoader(path, { splitPages: false }), // splitPages: false melhora a leitura de alguns PDFs
        '.docx': (path) => new DocxLoader(path),
      }
    );
    const docs = await loader.load();

    // --- Verificação de Segurança: Garante que há documentos para processar ---
    if (docs.length === 0) {
      console.log('[RAG Engine] Nenhum documento encontrado na base de conhecimento. O servidor continuará sem conhecimento de RAG.');
      // Retorna um retriever "falso" que não faz nada, para evitar que a aplicação quebre.
      return { getRelevantDocuments: () => Promise.resolve([]) };
    }

    // --- Passo 2: Quebrar os documentos em pedaços menores (chunks) ---
    // Isso é crucial para que o modelo de IA receba apenas o contexto mais relevante.
    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1500, // Cada pedaço terá no máximo 1500 caracteres
      chunkOverlap: 200,  // Cada pedaço compartilha 200 caracteres com o anterior para não perder o contexto
    });
    const splits = await textSplitter.splitDocuments(docs);

    // --- Passo 3: Inicializar o modelo de embeddings do Google ---
    // Este modelo transforma cada pedaço de texto num vetor numérico.
    const embeddings = new GoogleGenerativeAIEmbeddings({
        apiKey: process.env.GEMINI_API_KEY,
        modelName: "text-embedding-004"
    });

    // --- Passo 4: Criar a base de dados vetorial em memória ---
    // A MemoryVectorStore armazena todos os vetores na RAM do servidor para buscas ultra-rápidas.
    const vectorStore = await MemoryVectorStore.fromDocuments(splits, embeddings);

    console.log(`[RAG Engine] Indexação concluída. ${splits.length} pedaços de texto carregados na memória.`);

    // --- Passo 5: Retornar um "retriever" ---
    // O retriever é o objeto que usaremos no server.js para fazer as buscas de similaridade.
    // k: 4 significa que ele sempre retornará os 4 pedaços de texto mais relevantes.
    return vectorStore.asRetriever({ k: 4 });

  } catch (error) {
    // --- Tratamento de Erros ---
    // Se qualquer passo falhar, o erro é capturado, logado, e o servidor é encerrado.
    console.error('[RAG Engine] Falha grave ao inicializar a base de conhecimento:', error);
    process.exit(1);
  }
}
