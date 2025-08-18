import { DirectoryLoader } from "langchain/document_loaders/fs/directory";
import { DocxLoader } from "langchain/document_loaders/fs/docx";
import { PDFLoader } from "langchain/document_loaders/fs/pdf";
import { TextLoader } from "langchain/document_loaders/fs/text";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { MemoryVectorStore } from "langchain/vectorstores/memory";

export async function initializeRAGEngine() {
  console.log('[RAG Engine] Iniciando indexação da base de conhecimento...');
  // 1) Carregar documentos da pasta knowledge_base
  const loader = new DirectoryLoader('./knowledge_base', {
    ".pdf": p => new PDFLoader(p),
    ".docx": p => new DocxLoader(p),
    ".txt": p => new TextLoader(p),
  });

  const docs = await loader.load();
  if (!docs || docs.length === 0) {
    console.warn('[RAG Engine] Nenhum documento encontrado em ./knowledge_base');
  }

  // 2) Quebrar em pedaços
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1200,
    chunkOverlap: 150,
  });
  const splits = await splitter.splitDocuments(docs);

  // 3) Criar embeddings e vetor em memória
  const embeddings = new GoogleGenerativeAIEmbeddings({
    apiKey: process.env.GEMINI_API_KEY,
    modelName: "text-embedding-004",
  });

  const vectorStore = await MemoryVectorStore.fromDocuments(splits, embeddings);
  console.log(`[RAG Engine] Indexação concluída. Pedaços: ${splits.length}`);

  // 4) Retornar um retriever simples
  return vectorStore.asRetriever(6);
}