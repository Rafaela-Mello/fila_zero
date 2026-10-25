-- Rode no MySQL Workbench ou:
-- "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -u root -p < scripts/setup-mysql.sql

CREATE DATABASE IF NOT EXISTS filazero
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'filazero'@'%' IDENTIFIED BY 'filazero123';
CREATE USER IF NOT EXISTS 'filazero'@'localhost' IDENTIFIED BY 'filazero123';
GRANT ALL PRIVILEGES ON filazero.* TO 'filazero'@'%';
GRANT ALL PRIVILEGES ON filazero.* TO 'filazero'@'localhost';
FLUSH PRIVILEGES;

USE filazero;

CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  google_id VARCHAR(64) NOT NULL,
  email VARCHAR(255) NOT NULL,
  name VARCHAR(255) NULL,
  avatar_url VARCHAR(512) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_google_id (google_id),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB;

SHOW TABLES;
SELECT user, host FROM mysql.user WHERE user = 'filazero';
