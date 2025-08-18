import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { initializeRAGEngine } from './rag-engine.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// ---------- Middlewares base ----------
app.use(cors());
app.use(express.json({ limit: '2mb' })); // JSON para /api/generate
app.use(express.urlencoded({ extended: true }));

// ---------- Pastas públicas ----------
const PUBLIC_DIR = path.join(__dirname, 'public');
const UPLOAD_DIR = path.join(__dirname, 'uploads');

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Servir estáticos e uploads
app.use(express.static(PUBLIC_DIR));
app.use('/uploads', express.static(UPLOAD_DIR));

// ---------- Upload de imagens (Multer) ----------
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOAD_DIR);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname) || '';
    cb(null, `${uuidv4()}${ext}`);
  },
});

const imageOnly = (req, file, cb) => {
  // Aceita apenas imagens comuns
  const ok = /^image\/(png|jpe?g|webp|gif)$/.test(file.mimetype);
  if (ok) return cb(null, true);
  cb(new Error('Tipo de arquivo não suportado. Envie PNG, JPG, JPEG, WEBP ou GIF.'));
};

const upload = multer({
  storage,
  fileFilter: imageOnly,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB por arquivo
});

// ---------- RAG ----------
let ragRetriever = null;

// Endpoint de verificação
app.get('/api/health', (req, res) => {
  res.json({ ok: true, ragReady: !!ragRetriever });
});

// Upload de fotos (pode enviar 1+ arquivos no campo "photos")
app.post('/api/upload', upload.array('photos', 6), (req, res) => {
  try {
    const files = (req.files || []).map(f => ({
      filename: f.filename,
      url: `/uploads/${f.filename}`,
      size: f.size,
      mimetype: f.mimetype,
    }));
    res.json({ ok: true, files });
  } catch (err) {
    console.error('Erro no upload:', err);
    res.status(400).json({ ok: false, error: err.message });
  }
});

// Geração com suporte a contexto RAG e links de imagens
app.post('/api/generate', async (req, res) => {
  try {
    const { prompt, chatHistory = [], imageUrls = [] } = req.body || {};
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ ok: false, error: 'Campo "prompt" é obrigatório.' });
    }

    // 1) Recuperar contexto da base
    let contextText = '';
    if (ragRetriever) {
      const docs = await ragRetriever.getRelevantDocuments(prompt);
      contextText = docs.map(d => d.pageContent).join('\n---\n').slice(0, 8000); // corta para evitar saídas enormes
    }

    // 2) Montar instrução para o modelo
    const systemPreamble = `Você é o Assistente de Perícias do CBMAL. Responda de forma objetiva e cite trechos do contexto quando relevantes.
Se a resposta não estiver no contexto, seja transparente e diga que não encontrou.`;

    let imagesNote = '';
    if (Array.isArray(imageUrls) && imageUrls.length > 0) {
      imagesNote = `\nLinks de imagens anexadas pelo usuário:\n${imageUrls.map(u => `- ${u}`).join('\n')}\n`;
    }

    const fullPrompt = `${systemPreamble}

[Contexto RAG]
${contextText || '(sem contexto recuperado)'}

[Instrução do usuário]
${prompt}

[Anexos]
${imagesNote || '(sem anexos)'}\n`;

    // 3) Chamar o modelo Gemini via LangChain
    const model = new ChatGoogleGenerativeAI({
      apiKey: process.env.GEMINI_API_KEY,
      modelName: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
      temperature: 0.3,
      maxOutputTokens: 1024,
    });

    const response = await model.invoke(fullPrompt);
    const reply = typeof response?.content === 'string'
      ? response.content
      : (Array.isArray(response?.content) ? response.content.map(p => p?.text || '').join('') : 'Desculpe, não consegui gerar uma resposta.');

    res.json({ ok: true, reply });

  } catch (err) {
    console.error('Erro em /api/generate:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ---------- Rota "catch-all" DEPOIS das APIs ----------
app.get('*', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

async function startServer() {
  try {
    ragRetriever = await initializeRAGEngine();
    app.listen(PORT, () => {
      console.log(`Servidor do Assistente de Perícias rodando na porta ${PORT}`);
    });
  } catch (e) {
    console.error('Falha ao iniciar o RAG:', e);
    // Mesmo se RAG falhar, sobe o servidor (apenas sem contexto)
    app.listen(PORT, () => {
      console.log(`Servidor rodando sem RAG na porta ${PORT}`);
    });
  }
}

startServer();