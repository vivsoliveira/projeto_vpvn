// server.js
require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
app.use(helmet());
app.use(express.json());

// CORS: prefira configurar CORS_ORIGIN no env; para dev pode usar '*'
const corsOrigin = process.env.CORS_ORIGIN || '*';
app.use(cors({ origin: corsOrigin }));

// Rate limiter básico
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: parseInt(process.env.RATE_LIMIT_MAX || '60', 10), // requests por IP
});
app.use(limiter);

// Pool de conexões (credenciais via env vars)
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: parseInt(process.env.DB_CONN_LIMIT || '10', 10),
  queueLimit: 0
});

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// POST /api/operacoes  -> salva operação (body: JSON com estrutura do seu "out")
app.post('/api/operacoes', async (req, res) => {
  try {
    const out = req.body;
    if (!out || !out.nomeSocial) {
      return res.status(400).json({ error: 'Dados inválidos: campo nomeSocial obrigatório' });
    }

    const sql = 'INSERT INTO operacoes (nome_social, data_json) VALUES (?, ?)';
    const [result] = await pool.query(sql, [out.nomeSocial, JSON.stringify(out)]);
    return res.status(201).json({ id: result.insertId });
  } catch (err) {
    console.error('POST /api/operacoes error:', err);
    return res.status(500).json({ error: 'Erro interno no servidor' });
  }
});

// GET /api/operacoes -> lista últimas operações (limit configurable via query ?limit=50)
app.get('/api/operacoes', async (req, res) => {
  try {
    const limit = Math.min(1000, Math.max(1, parseInt(req.query.limit || '100', 10)));
    const [rows] = await pool.query(
      'SELECT id, nome_social, data_json, created_at FROM operacoes ORDER BY created_at DESC LIMIT ?',
      [limit]
    );
    const parsed = rows.map(r => {
      let parsedData = null;
      try { parsedData = JSON.parse(r.data_json); } catch (e) { parsedData = r.data_json; }
      return { id: r.id, nome_social: r.nome_social, data: parsedData, created_at: r.created_at };
    });
    res.json(parsed);
  } catch (err) {
    console.error('GET /api/operacoes error:', err);
    res.status(500).json({ error: 'Erro ao buscar operações' });
  }
});

// Opcional: endpoint para buscar uma operação por id
app.get('/api/operacoes/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, nome_social, data_json, created_at FROM operacoes WHERE id = ? LIMIT 1', [req.params.id]);
    if (!rows || rows.length === 0) return res.status(404).json({ error: 'Não encontrado' });
    const r = rows[0];
    let parsedData = null;
    try { parsedData = JSON.parse(r.data_json); } catch (e) { parsedData = r.data_json; }
    res.json({ id: r.id, nome_social: r.nome_social, data: parsedData, created_at: r.created_at });
  } catch (err) {
    console.error('GET /api/operacoes/:id error:', err);
    res.status(500).json({ error: 'Erro ao buscar' });
  }
});

// Start
const PORT = parseInt(process.env.PORT || '3000', 10);
app.listen(PORT, () => {
  console.log(`API operacoes rodando na porta ${PORT} (CORS_ORIGIN=${corsOrigin})`);
});
