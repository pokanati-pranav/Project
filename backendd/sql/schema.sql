CREATE TABLE IF NOT EXISTS organizations (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  organization_name VARCHAR(180) NOT NULL,
  organization_type VARCHAR(80),
  address VARCHAR(500),
  country VARCHAR(100),
  state VARCHAR(100),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(160) NOT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(32) NOT NULL,
  organization_id BIGINT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_user_org FOREIGN KEY (organization_id) REFERENCES organizations(id)
);

CREATE TABLE IF NOT EXISTS buildings (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  organization_id BIGINT NOT NULL,
  building_name VARCHAR(180) NOT NULL,
  building_type VARCHAR(80),
  location VARCHAR(300),
  area_in_sqft DECIMAL(14,2),
  number_of_floors INT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_building_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
  INDEX idx_building_org (organization_id)
);

CREATE TABLE IF NOT EXISTS building_assignments (
  user_id BIGINT NOT NULL,
  building_id BIGINT NOT NULL,
  assigned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, building_id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (building_id) REFERENCES buildings(id)
);

CREATE TABLE IF NOT EXISTS energy_readings (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  building_id BIGINT NOT NULL,
  reading_date DATE NOT NULL,
  energy_consumed_kwh DECIMAL(14,3) NOT NULL,
  recorded_by BIGINT NOT NULL,
  source VARCHAR(40) NOT NULL DEFAULT 'MANUAL',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT ck_energy_positive CHECK (energy_consumed_kwh >= 0),
  CONSTRAINT uq_reading_building_day UNIQUE (building_id, reading_date),
  FOREIGN KEY (building_id) REFERENCES buildings(id),
  FOREIGN KEY (recorded_by) REFERENCES users(id),
  INDEX idx_reading_date (reading_date),
  INDEX idx_reading_building_date (building_id, reading_date)
);

CREATE TABLE IF NOT EXISTS emission_factors (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  region VARCHAR(120) NOT NULL,
  emission_factor DECIMAL(12,6) NOT NULL,
  unit VARCHAR(40) NOT NULL DEFAULT 'kg CO2e/kWh',
  effective_from DATE NOT NULL,
  effective_to DATE NULL,
  source VARCHAR(500) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_factor_region_date (region, effective_from, effective_to)
);

CREATE TABLE IF NOT EXISTS anomaly_alerts (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  building_id BIGINT NOT NULL,
  reading_id BIGINT NOT NULL,
  anomaly_score DECIMAL(9,6) NOT NULL,
  severity VARCHAR(16) NOT NULL,
  description VARCHAR(1000) NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'OPEN',
  detected_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP NULL,
  UNIQUE KEY uq_alert_reading (reading_id),
  FOREIGN KEY (building_id) REFERENCES buildings(id),
  FOREIGN KEY (reading_id) REFERENCES energy_readings(id)
);

CREATE TABLE IF NOT EXISTS energy_predictions (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  building_id BIGINT NOT NULL,
  prediction_date DATE NOT NULL,
  predicted_kwh DECIMAL(14,3) NOT NULL,
  model_name VARCHAR(100) NOT NULL,
  model_version VARCHAR(80) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (building_id) REFERENCES buildings(id),
  INDEX idx_prediction_building_date (building_id, prediction_date)
);

CREATE TABLE IF NOT EXISTS recommendations (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  building_id BIGINT NOT NULL,
  title VARCHAR(220) NOT NULL,
  description TEXT NOT NULL,
  recommendation_type VARCHAR(50) NOT NULL,
  priority VARCHAR(20) NOT NULL,
  estimated_saving_kwh DECIMAL(14,3),
  status VARCHAR(24) NOT NULL DEFAULT 'OPEN',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (building_id) REFERENCES buildings(id)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100),
  entity_id BIGINT,
  details JSON,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_audit_created (created_at)
);
