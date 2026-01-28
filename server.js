// server.js - versão corrigida (garante pasta data e caminho absoluto do DB)
require('dotenv').config();
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');

const app = express();

// Middlewares básicos
app.use(helmet({
  contentSecurityPolicy: false // desabilita CSP por padrão aqui para evitar bloqueios; ajuste conforme quiser
}));
app.use(express.json());

// CORS (use variável de ambiente ou '*' para dev)
const corsOrigin = process.env.CORS_ORIGIN || '*';
app.use(cors({ origin: corsOrigin }));

// Rate limit simples (opcional)
const maxRequests = parseInt(process.env.RATE_LIMIT_MAX || '60', 10);
app.use(rateLimit({
  windowMs: 60 * 1000,
  max: maxRequests
}));

// --- Configuração do caminho do DB ---
const dbDir = path.join(__dirname, 'data'); // pasta onde ficará o DB
const dbPath = path.join(dbDir, 'operacoes.db');

// garante que a pasta existe e tem permissões
try {
  fs.mkdirSync(dbDir, { recursive: true });
  console.log('db dir ensured:', dbDir);
} catch (err) {
  console.error('Erro criando dir do DB:', err);
}

// opcional: cria arquivo vazio se não existir (útil pra diagnosticar permissões)
try {
  if (!fs.existsSync(dbPath)) {
    fs.closeSync(fs.openSync(dbPath, 'w'));
    console.log('DB file criado em:', dbPath);
  }
} catch (err) {
  console.error('Erro criando arquivo DB teste:', err);
}

console.log('Tentando abrir DB em:', dbPath);

// abre/ cria o banco
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
  if (err) {
    console.error('Erro ao abrir banco:', err);
  } else {
    console.log('SQLite conectado em', dbPath);
    // se quiser, inicialize tabelas aqui (exemplo)
    // db.run('CREATE TABLE IF NOT EXISTS operacoes (id INTEGER PRIMARY KEY, texto TEXT)');
  }
});

// --- Servir arquivos estáticos (frontend) ---
app.use(express.static(path.join(__dirname))); // serve index.html, css, js na raiz do repo

// exemplo de rota API simples
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// fallback para SPA (caso esteja usando routes no front)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// start server
const PORT = parseInt(process.env.PORT || '3000', 10);
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
});

// fechar DB ao encerrar
process.on('SIGINT', () => {
  db.close((err) => {
    if (err) console.error('Erro ao fechar banco:', err);
    process.exit(0);
  });
});
