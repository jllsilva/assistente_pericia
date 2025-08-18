import express from "express";
import multer from "multer";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import OpenAI from "openai";

dotenv.config();

const app = express();
const upload = multer({ dest: "uploads/" });
const PORT = process.env.PORT || 3000;

// Configuração do OpenAI
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// Função fictícia de processamento (RAG/IA)
async function processarPergunta(prompt, files) {
  let context = "";

  if (files.length > 0) {
    for (const file of files) {
      try {
        const content = fs.readFileSync(file.path, "utf-8");
        context += `\nArquivo: ${file.originalname}\n${content}`;
      } catch (err) {
        console.error("Erro ao ler arquivo:", err);
      }
    }
  }

  // Monta a entrada para o modelo
  const userPrompt = `
Usuário perguntou: ${prompt || "(sem texto)"} 
${context ? "\nContexto dos anexos:\n" + context : ""}
  `;

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: userPrompt }],
  });

  return response.choices[0].message.content;
}

// Rota principal de chat
app.post("/api/chat", upload.array("files"), async (req, res) => {
  try {
    const prompt = req.body.prompt || "";
    const files = req.files || [];

    if (!prompt && files.length === 0) {
      return res
        .status(400)
        .json({ error: "Envie um texto ou pelo menos um anexo." });
    }

    const resposta = await processarPergunta(prompt, files);
    res.json({ reply: resposta });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro interno no servidor" });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
