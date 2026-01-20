-- create_table.sql
CREATE TABLE IF NOT EXISTS operacoes (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  nome_social VARCHAR(255) NOT NULL,
  data_json JSON NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Se seu MySQL não suporta JSON, troque data_json JSON por data_json TEXT
