-- ============================================================================
-- Schema MySQL — app de gestão multi-tenant para academias de jiu-jitsu.
-- Uma linha em "academias" = uma academia = um login (autenticação própria,
-- sem provedor externo). Isolamento entre academias é feito na camada da API
-- (toda consulta filtra por academia_id), não pelo banco.
-- ============================================================================

CREATE TABLE IF NOT EXISTS academias (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  senha_hash VARCHAR(255) NOT NULL,
  nome VARCHAR(255) NOT NULL DEFAULT 'Minha Academia',
  tatame_comprimento DECIMAL(6,2) NOT NULL DEFAULT 4.5,
  tatame_largura DECIMAL(6,2) NOT NULL DEFAULT 4.5,
  concentracao_pico DECIMAL(4,3) NOT NULL DEFAULT 0.1,
  generated_months JSON NOT NULL,
  category_groups JSON NOT NULL,
  cobranca_templates JSON NOT NULL,
  status_pagamento VARCHAR(20) NOT NULL DEFAULT 'ativo',
  valor_mensal DECIMAL(10,2) NOT NULL DEFAULT 0,
  proximo_vencimento DATE NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS turmas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  academia_id INT NOT NULL,
  nome VARCHAR(100) NOT NULL,
  horarios JSON NOT NULL,
  freq_anterior DECIMAL(6,2) NOT NULL DEFAULT 0,
  freq_atual DECIMAL(6,2) NOT NULL DEFAULT 0,
  CONSTRAINT fk_turmas_academia FOREIGN KEY (academia_id) REFERENCES academias(id) ON DELETE CASCADE,
  INDEX idx_turmas_academia (academia_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS students (
  id INT AUTO_INCREMENT PRIMARY KEY,
  academia_id INT NOT NULL,
  nome VARCHAR(255) NOT NULL,
  turma VARCHAR(100),
  categoria VARCHAR(20) NOT NULL DEFAULT 'Adulto',
  status VARCHAR(20) NOT NULL DEFAULT 'Ativo',
  valor_mensalidade DECIMAL(10,2) NOT NULL DEFAULT 0,
  dia_vencimento INT,
  valor_matricula DECIMAL(10,2) NOT NULL DEFAULT 0,
  mes_matricula VARCHAR(20),
  dia_matricula INT,
  email VARCHAR(255),
  telefone VARCHAR(30),
  observacoes TEXT,
  CONSTRAINT fk_students_academia FOREIGN KEY (academia_id) REFERENCES academias(id) ON DELETE CASCADE,
  INDEX idx_students_academia (academia_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS transactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  academia_id INT NOT NULL,
  data DATE NOT NULL,
  grupo VARCHAR(40) NOT NULL,
  categoria VARCHAR(100) NOT NULL,
  descricao VARCHAR(255),
  valor DECIMAL(10,2) NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL,
  tipo VARCHAR(10) NOT NULL,
  aluno_id INT,
  origem VARCHAR(30),
  CONSTRAINT fk_transactions_academia FOREIGN KEY (academia_id) REFERENCES academias(id) ON DELETE CASCADE,
  CONSTRAINT fk_transactions_aluno FOREIGN KEY (aluno_id) REFERENCES students(id) ON DELETE SET NULL,
  INDEX idx_transactions_academia_data (academia_id, data)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
