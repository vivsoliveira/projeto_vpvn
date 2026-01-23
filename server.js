// server.js - SQLite version
require('dotenv').config();
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

const app = express();
app.use(helmet());
app.use(express.json());

// CORS
const corsOrigin = process.env.CORS_ORIGIN || '*';
app.use(cors({ origin: corsOrigin }));

// Rate limiter
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX || '60', 10),
});
app.use(limiter);

// SQLite database
const dbPath = path.join(__dirname, 'operacoes.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Erro ao abrir banco:', err);
    process.exit(1);
  }
  console.log('✓ SQLite conectado');
  initDB();
});

function initDB() {
  db.run(`
    CREATE TABLE IF NOT EXISTS operacoes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome_social TEXT NOT NULL,
      data_json LONGTEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) console.error('Erro ao criar tabela:', err);
    else console.log('✓ Tabela operacoes pronta');
  });
}

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// Serve arquivos estáticos (HTML, CSS, JS)
app.use(express.static(__dirname));

// GET /api/operacoes
app.get('/api/operacoes', (req, res) => {
  db.all('SELECT * FROM operacoes ORDER BY created_at DESC', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
  });
});

// POST /api/operacoes
app.post('/api/operacoes', (req, res) => {
  const out = req.body;
  if (!out || !out.nomeSocial) {
    return res.status(400).json({ error: 'Campo nomeSocial obrigatório' });
  }

  db.run(
    'INSERT INTO operacoes (nome_social, data_json) VALUES (?, ?)',
    [out.nomeSocial, JSON.stringify(out)],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ id: this.lastID });
    }
  );
});

// DELETE /api/operacoes/:id
app.delete('/api/operacoes/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

  db.run('DELETE FROM operacoes WHERE id = ?', [id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ deleted: this.changes });
  });
});

// Servir index.html para rotas não-API
app.get(['/', '/dados.html', '/historico.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = parseInt(process.env.PORT || '3000', 10);
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
});

process.on('SIGINT', () => {
  db.close((err) => {
    if (err) console.error('Erro ao fechar banco:', err);
    process.exit(0);
  });
});
