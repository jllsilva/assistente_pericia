Correções aplicadas por Ziggy

1) Upload de fotos restaurado
   - Novo endpoint POST /api/upload com Multer (campo "photos", até 6 arquivos, 5MB cada).
   - Imagens ficam em ./uploads e são servidas em /uploads/<arquivo>.
   - Tipos aceitos: png, jpg, jpeg, webp, gif.

2) Geração com RAG + anexos
   - POST /api/generate aceita { prompt, chatHistory, imageUrls }.
   - Se houver imagens anexadas, o front-end primeiro envia para /api/upload e depois manda as URLs no generate.
   - O back-end incorpora os links na mensagem ao modelo Gemini.

3) Ordem das rotas
   - As rotas /api/... vêm antes do app.get('*'). Isso evita que o catch-all intercepte as APIs.

4) Melhorias gerais
   - Limites de tamanho e tipo de arquivo.
   - Diretórios públicos e de upload garantidos em runtime.
   - Mensagens de erro mais claras.
   - RAG inicializa na subida, mas o servidor inicia mesmo que a indexação falhe.

Como rodar
----------
1. Configure a variável de ambiente GEMINI_API_KEY (e opcional GEMINI_MODEL).
2. Instale as dependências:
   npm install
3. Inicie:
   npm start

Front-end
---------
- O botão de anexar chama o input[type=file].
- Preview simples de imagens selecionadas.
- Envio em duas etapas (upload e depois generate).

Se precisar integrar as imagens no fluxo do seu RAG (ex: OCR), podemos adicionar um pipeline futuro.