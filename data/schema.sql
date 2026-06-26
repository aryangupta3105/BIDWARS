CREATE TABLE IF NOT EXISTS franchises (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  short_code VARCHAR(10) UNIQUE NOT NULL,
  primary_color VARCHAR(10) NOT NULL,
  secondary_color VARCHAR(10) NOT NULL,
  salary_cap_cr NUMERIC(5, 2) DEFAULT 120.00,
  home_city VARCHAR(100) NOT NULL,
  personality_type VARCHAR(200) NOT NULL
);

CREATE TABLE IF NOT EXISTS players (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  nationality VARCHAR(10) NOT NULL,
  role VARCHAR(20) NOT NULL,
  base_price_cr NUMERIC(4, 2) NOT NULL,
  ipl_matches INT DEFAULT 0,
  ipl_runs INT DEFAULT 0,
  ipl_avg NUMERIC(5, 2) DEFAULT 0,
  ipl_sr NUMERIC(5, 2) DEFAULT 0,
  ipl_100s INT DEFAULT 0,
  ipl_50s INT DEFAULT 0,
  ipl_wickets INT DEFAULT 0,
  ipl_economy NUMERIC(5, 2) DEFAULT 0,
  ipl_bowling_avg NUMERIC(5, 2) DEFAULT 0,
  ipl_best_figures VARCHAR(20) DEFAULT '',
  last_ipl_team VARCHAR(50) DEFAULT '',
  form_rating INT DEFAULT 5,
  injury_flag BOOLEAN DEFAULT FALSE,
  tier VARCHAR(20) NOT NULL
);

CREATE TABLE IF NOT EXISTS auction_state (
  auction_id VARCHAR(100) PRIMARY KEY,
  state_json JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
