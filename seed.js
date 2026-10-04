// seed.js - Creates tables (if missing) then seeds employees into Turso
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

require('dotenv').config();
const db = require('./database');

const employees = [
  { employee_id: 'EMP001', name: 'Juan Dela Cruz', department: 'IT',
    work_days: '1,2,3,4,5', shift_start: '09:00', shift_end: '18:00', grace_minutes: 15 },
  { employee_id: 'EMP002', name: 'Maria Santos', department: 'HR',
    work_days: '1,2,3,4,5', shift_start: '08:00', shift_end: '17:00', grace_minutes: 10 },
  { employee_id: 'EMP003', name: 'Pedro Reyes', department: 'Finance',
    work_days: '1,2,3,4,5,6', shift_start: '10:00', shift_end: '19:00', grace_minutes: 15 },
  { employee_id: 'EMP004', name: 'Ana Lopez', department: 'Marketing',
    work_days: '2,3,4,5,6', shift_start: '07:00', shift_end: '16:00', grace_minutes: 20 }
];

(async () => {
  try {
    console.log('🔧 Ensuring tables exist...');

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

    console.log('✅ Tables ready.');

    for (const e of employees) {
      await db.execute({
        sql: `INSERT OR IGNORE INTO employees
              (employee_id, name, department, work_days, shift_start, shift_end, grace_minutes)
              VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: [e.employee_id, e.name, e.department, e.work_days, e.shift_start, e.shift_end, e.grace_minutes]
      });
      console.log(`✅ Seeded: ${e.name} (${e.shift_start}-${e.shift_end})`);
    }

    console.log('🌱 Done.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Seed error:', err.message);
    process.exit(1);
  }
})();