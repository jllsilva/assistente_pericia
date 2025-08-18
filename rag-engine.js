import { DirectoryLoader } from "@langchain/community/document_loaders/fs/directory";
import { DocxLoader } from "@langchain/community/document_loaders/fs/docx";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/text_splitters";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { MemoryVectorStore } from "@langchain/community/vectorstores/memory";

// Esta função irá inicializar todo o nosso motor de busca
export async function initializeRAGEngine() {
  try {
    console.log('[RAG Engine] Iniciando indexação da base de conhecimento...');
    
    // 1. Carregar os documentos da pasta
    const loader = new DirectoryLoader(
      './knowledge_base',
      {
        '.pdf': (path) => new PDFLoader(path, { splitPages: false }),
        '.docx': (path) => new DocxLoader(path),
      }
    );
    const docs = await loader.load();

    if (docs.length === 0) {
      console.log('[RAG Engine] Nenhum documento encontrado na base de conhecimento. O servidor continuará sem conhecimento de RAG.');
      // Retorna um retriever "falso" que não faz nada
      return { getRelevantDocuments: () => Promise.resolve([]) };
    }

    // 2. Quebrar os documentos em pedaços menores (chunks)
    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1500,
      chunkOverlap: 200,
    });
    const splits = await textSplitter.splitDocuments(docs);

    // 3. Inicializar o modelo de embeddings do Google
    const embeddings = new GoogleGenerativeAIEmbeddings({
        apiKey: process.env.GEMINI_API_KEY,
        modelName: "text-embedding-004"
    });

    // 4. Criar a base de dados vetorial em memória a partir dos pedaços e embeddings
    const vectorStore = await MemoryVectorStore.fromDocuments(splits, embeddings);

    console.log(`[RAG Engine] Indexação concluída. ${splits.length} pedaços de texto carregados na memória.`);

    // 5. Retornar um "retriever", que é o objeto que usaremos para fazer as buscas
    return vectorStore.asRetriever({ k: 4 });

  } catch (error) {
    console.error('[RAG Engine] Falha ao inicializar a base de conhecimento:', error);
    // Não encerra o processo, apenas retorna um retriever que não faz nada
    return { getRelevantDocuments: () => Promise.resolve([]) };
  }
}
