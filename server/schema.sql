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
  logo_key VARCHAR(255) NULL,
  watermark_ativo TINYINT(1) NOT NULL DEFAULT 0,
  graduacao_regras JSON NULL, -- lista de faixas + critério pra próxima, por categoria (Adulto/Kids)
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
  data_inicio DATE NULL, -- quando começou a treinar (não é a matrícula financeira)
  faixa VARCHAR(30) NULL,
  grau INT NOT NULL DEFAULT 0,
  CONSTRAINT fk_students_academia FOREIGN KEY (academia_id) REFERENCES academias(id) ON DELETE CASCADE,
  INDEX idx_students_academia (academia_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS presencas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  academia_id INT NOT NULL,
  aluno_id INT NOT NULL,
  data DATE NOT NULL,
  turma VARCHAR(100), -- informativo — não trava quem pode ser marcado presente
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_presencas_academia FOREIGN KEY (academia_id) REFERENCES academias(id) ON DELETE CASCADE,
  CONSTRAINT fk_presencas_aluno FOREIGN KEY (aluno_id) REFERENCES students(id) ON DELETE CASCADE,
  INDEX idx_presencas_academia_data (academia_id, data),
  INDEX idx_presencas_aluno (aluno_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS graduacoes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  academia_id INT NOT NULL,
  aluno_id INT NOT NULL,
  data DATE NOT NULL,
  faixa_anterior VARCHAR(30),
  faixa_nova VARCHAR(30) NOT NULL,
  grau INT NOT NULL DEFAULT 0,
  observacoes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_graduacoes_academia FOREIGN KEY (academia_id) REFERENCES academias(id) ON DELETE CASCADE,
  CONSTRAINT fk_graduacoes_aluno FOREIGN KEY (aluno_id) REFERENCES students(id) ON DELETE CASCADE,
  INDEX idx_graduacoes_aluno (aluno_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS usuarios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  academia_id INT NOT NULL,
  nome VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  senha_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL, -- 'operacao' | 'aluno'
  aluno_id INT NULL, -- só preenchido quando role = 'aluno': vincula ao cadastro em students
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_usuarios_academia FOREIGN KEY (academia_id) REFERENCES academias(id) ON DELETE CASCADE,
  CONSTRAINT fk_usuarios_aluno FOREIGN KEY (aluno_id) REFERENCES students(id) ON DELETE CASCADE,
  INDEX idx_usuarios_academia (academia_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS password_resets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  token VARCHAR(128) NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  used TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_password_resets_token (token)
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
  recorrente TINYINT(1) NOT NULL DEFAULT 0,
  recorrencia_meses INT NULL, -- NULL = repete para sempre, número = repete só por N meses
  CONSTRAINT fk_transactions_academia FOREIGN KEY (academia_id) REFERENCES academias(id) ON DELETE CASCADE,
  CONSTRAINT fk_transactions_aluno FOREIGN KEY (aluno_id) REFERENCES students(id) ON DELETE SET NULL,
  INDEX idx_transactions_academia_data (academia_id, data)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Fora do multi-tenant: quem gerencia as academias em si (painel
-- /admin.html). Semeado por script de linha de comando, nunca por HTTP.
CREATE TABLE IF NOT EXISTS super_admins (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  senha_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Dado sensível (categoria especial pela LGPD) — 1:1 com o aluno. Tanto o
-- próprio aluno (pelo portal) quanto admin/operação podem preencher/editar;
-- fica numa tabela separada de students pra deixar claro que é uma
-- categoria de dado diferente, não pra misturar com o cadastro comum.
CREATE TABLE IF NOT EXISTS fichas_medicas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  academia_id INT NOT NULL,
  aluno_id INT NOT NULL,
  contato_emergencia_nome VARCHAR(150),
  contato_emergencia_parentesco VARCHAR(60),
  contato_emergencia_telefone VARCHAR(30),
  tipo_sanguineo VARCHAR(5),
  alergias TEXT,
  condicoes_medicas TEXT,
  medicamentos TEXT,
  lesoes_previas TEXT,
  restricao_pratica TEXT,
  hospital_preferencia VARCHAR(150),
  plano_saude VARCHAR(100),
  numero_carteirinha VARCHAR(60),
  responsavel_legal_nome VARCHAR(150),
  responsavel_legal_telefone VARCHAR(30),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_fichas_medicas_academia FOREIGN KEY (academia_id) REFERENCES academias(id) ON DELETE CASCADE,
  CONSTRAINT fk_fichas_medicas_aluno FOREIGN KEY (aluno_id) REFERENCES students(id) ON DELETE CASCADE,
  UNIQUE KEY uq_fichas_medicas_aluno (aluno_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Mural de recados do instrutor pro aluno — sem validade, fica visível até
-- ser apagado. "alcance" decide quem vê: todo mundo, uma turma, ou um
-- aluno só (mensagem direta).
CREATE TABLE IF NOT EXISTS recados (
  id INT AUTO_INCREMENT PRIMARY KEY,
  academia_id INT NOT NULL,
  alcance ENUM('global','turma','aluno') NOT NULL DEFAULT 'global',
  turma VARCHAR(100) NULL,
  aluno_id INT NULL,
  titulo VARCHAR(150) NOT NULL,
  mensagem TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_recados_academia FOREIGN KEY (academia_id) REFERENCES academias(id) ON DELETE CASCADE,
  CONSTRAINT fk_recados_aluno FOREIGN KEY (aluno_id) REFERENCES students(id) ON DELETE CASCADE,
  INDEX idx_recados_academia (academia_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
