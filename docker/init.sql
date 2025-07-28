-- ChillFi3 Database Initialization
-- Creates database and user only - schema is handled by Node.js

CREATE DATABASE IF NOT EXISTS musiclib CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'musiclib'@'%' IDENTIFIED BY 'musiclib_password';
GRANT ALL PRIVILEGES ON musiclib.* TO 'musiclib'@'%';
FLUSH PRIVILEGES;