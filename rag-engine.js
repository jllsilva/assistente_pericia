import { DirectoryLoader } from 'langchain/document_loaders/fs/directory';
import { DocxLoader } from "@langchain/community/document_loaders/fs/docx"; // <-- ESTA LINHA FOI CORRIGIDA
import { PDFLoader } from 'langchain/document_loaders/fs/pdf';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import { MemoryVectorStore } from 'langchain/vectorstores/memory';

// Esta função irá inicializar todo o nosso motor de busca
export async function initializeRAGEngine() {
  try {
    console.log('[RAG Engine] Iniciando indexação da base de conhecimento...');
    
    // 1. Carregar os documentos da pasta
    const loader = new DirectoryLoader(
      './knowledge_base', // O nome da pasta que criamos
      {
        '.pdf': (path) => new PDFLoader(path),
        '.docx': (path) => new DocxLoader(path),
      }
    );
    const docs = await loader.load();

    // 2. Quebrar os documentos em pedaços menores (chunks)
    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1500, // Tamanho de cada pedaço de texto
      chunkOverlap: 200,  // Sobreposição entre pedaços para manter o contexto
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
    return vectorStore.asRetriever({ k: 4 }); // k: 4 -> buscar os 4 chunks mais relevantes

  } catch (error) {
    console.error('[RAG Engine] Falha ao inicializar a base de conhecimento:', error);
    process.exit(1); // Encerra o servidor se a base de conhecimento falhar
  }
}
