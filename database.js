// database.js - Turso (libSQL) client with IPv4 fix
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

require('dotenv').config();
const { createClient } = require('@libsql/client');

if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
  console.error('❌ Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN in environment.');
  process.exit(1);
}

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN
});

// Initialize tables with retry
(async function initTables(retries = 3) {
  try {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS employees (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_id TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        department TEXT,
        work_days TEXT DEFAULT '1,2,3,4,5',
        shift_start TEXT DEFAULT '09:00',
        shift_end TEXT DEFAULT '18:00',
        grace_minutes INTEGER DEFAULT 15,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS attendance (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_id TEXT NOT NULL,
        date TEXT NOT NULL,
        time_in DATETIME,
        time_out DATETIME,
        total_hours REAL DEFAULT 0,
        expected_hours REAL DEFAULT 8,
        status TEXT DEFAULT 'Present',
        notes TEXT
      )
    `);

    console.log('✅ Turso connected & tables ready.');
  } catch (err) {
    console.error(`❌ Turso init error (${retries} retries left):`, err.message);
    if (retries > 0) {
      setTimeout(() => initTables(retries - 1), 2000);
    }
  }
})();

module.exports = db;