const Database = require('better-sqlite3');
const path = require('path');
const { app } = require('electron');

class DatabaseManager {
  constructor() {
    const dbPath = path.join(app.getPath('userData'), 'metrics.db');
    this.db = new Database(dbPath);
    this.initializeTables();
  }

  initializeTables() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        email TEXT,
        is_admin BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_login_at DATETIME
      );

      CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT,
        start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        end_time DATETIME,
        total_claims INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS claims (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER,
        claim_id TEXT,
        claim_type TEXT,
        start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        end_time DATETIME,
        duration_seconds INTEGER,
        FOREIGN KEY (session_id) REFERENCES sessions(id)
      );

      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER,
        claim_id INTEGER,
        event_type TEXT,
        event_data TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (session_id) REFERENCES sessions(id),
        FOREIGN KEY (claim_id) REFERENCES claims(id)
      );

      CREATE TABLE IF NOT EXISTS tab_interactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        claim_id INTEGER,
        tab_name TEXT,
        time_spent_seconds INTEGER,
        fields_completed INTEGER,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (claim_id) REFERENCES claims(id)
      );

      CREATE TABLE IF NOT EXISTS validations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        claim_id INTEGER,
        field_name TEXT,
        validation_type TEXT,
        is_valid BOOLEAN,
        error_message TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (claim_id) REFERENCES claims(id)
      );
    `);
  }

  execute(sql, params = []) {
    return this.db.prepare(sql).run(params);
  }

  query(sql, params = []) {
    return this.db.prepare(sql).all(params);
  }

  queryOne(sql, params = []) {
    return this.db.prepare(sql).get(params);
  }

  // User management methods
  getUser(username) {
    return this.queryOne('SELECT * FROM users WHERE LOWER(username) = LOWER(?)', [username]);
  }

  getAllUsers() {
    return this.query('SELECT * FROM users ORDER BY username');
  }

  createUser(username, email = null, isAdmin = false) {
    const normalizedUsername = username.toLowerCase();
    const defaultEmail = email || `${normalizedUsername}@cbcsclaims.com`;
    return this.execute(
      'INSERT INTO users (username, email, is_admin, created_at, last_login_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
      [normalizedUsername, defaultEmail, isAdmin ? 1 : 0]
    );
  }

  updateUser(id, email, isAdmin) {
    return this.execute(
      'UPDATE users SET email = ?, is_admin = ? WHERE id = ?',
      [email, isAdmin ? 1 : 0, id]
    );
  }

  deleteUser(id) {
    return this.execute('DELETE FROM users WHERE id = ?', [id]);
  }

  updateLastLogin(username) {
    return this.execute(
      'UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE LOWER(username) = LOWER(?)',
      [username]
    );
  }

  close() {
    this.db.close();
  }
}

module.exports = DatabaseManager;
