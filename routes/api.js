// routes/api.js - Turso/libSQL version
const express = require('express');
const router = express.Router();
const db = require('../database');
const {
  isWorkDay,
  computeClockInStatus,
  computeClockOutStatus,
  expectedHours
} = require('../scheduleUtils');

const todayStr = () => new Date().toISOString().split('T')[0];
const nowISO = () => new Date().toISOString();

// ─────────────────────────────────────────
// POST /api/clock-in
// ─────────────────────────────────────────
router.post('/clock-in', async (req, res) => {
  try {
    const { employee_id, name } = req.body;
    if (!employee_id || !name) {
      return res.status(400).json({ error: 'Employee ID and Name are required.' });
    }
    const today = todayStr();

    // Find employee
    let empRes = await db.execute({
      sql: `SELECT * FROM employees WHERE employee_id = ?`,
      args: [employee_id]
    });
    let employee = empRes.rows[0];

    // Create if missing
    if (!employee) {
      await db.execute({
        sql: `INSERT INTO employees 
              (employee_id, name, department, work_days, shift_start, shift_end, grace_minutes)
              VALUES (?, ?, 'General', '1,2,3,4,5', '09:00', '18:00', 15)`,
        args: [employee_id, name]
      });
      empRes = await db.execute({
        sql: `SELECT * FROM employees WHERE employee_id = ?`,
        args: [employee_id]
      });
      employee = empRes.rows[0];
    }

    // Check for existing open clock-in
    const openRes = await db.execute({
      sql: `SELECT * FROM attendance WHERE employee_id = ? AND date = ? AND time_out IS NULL`,
      args: [employee_id, today]
    });
    if (openRes.rows.length) {
      return res.status(400).json({ error: 'You are already clocked in. Please time out first.' });
    }

    const now = new Date();
    const workDay = isWorkDay(employee, now);
    const { status, lateMinutes } = computeClockInStatus(employee, now);
    const expected = expectedHours(employee);

    const notes = [];
    if (!workDay) notes.push('Off-schedule day');
    if (lateMinutes > 0) notes.push(`Late by ${lateMinutes} min`);

    await db.execute({
      sql: `INSERT INTO attendance 
            (employee_id, date, time_in, status, expected_hours, notes)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [employee_id, today, nowISO(), status, expected, notes.join(' | ')]
    });

    res.json({
      success: true,
      message: `Clocked in at ${now.toLocaleTimeString()}. Status: ${status}` +
               (lateMinutes > 0 ? ` (${lateMinutes} min late)` : ''),
      status,
      late_minutes: lateMinutes
    });
  } catch (err) {
    console.error('clock-in error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────
// POST /api/clock-out
// ─────────────────────────────────────────
router.post('/clock-out', async (req, res) => {
  try {
    const { employee_id } = req.body;
    if (!employee_id) return res.status(400).json({ error: 'Employee ID is required.' });

    const today = todayStr();

    const empRes = await db.execute({
      sql: `SELECT * FROM employees WHERE employee_id = ?`,
      args: [employee_id]
    });
    const emp = empRes.rows[0];
    if (!emp) return res.status(400).json({ error: 'Employee not found.' });

    const openRes = await db.execute({
      sql: `SELECT * FROM attendance 
            WHERE employee_id = ? AND date = ? AND time_out IS NULL
            ORDER BY id DESC LIMIT 1`,
      args: [employee_id, today]
    });
    const row = openRes.rows[0];
    if (!row) return res.status(400).json({ error: 'No active clock-in found for today.' });

    const timeOut = new Date();
    const timeIn = new Date(row.time_in);
    const totalHours = +((timeOut - timeIn) / 3600000).toFixed(2);
    const { status, undertimeMinutes, overtimeMinutes } = computeClockOutStatus(emp, timeOut);

    const notes = [];
    if (undertimeMinutes) notes.push(`Undertime ${undertimeMinutes} min`);
    if (overtimeMinutes) notes.push(`Overtime ${overtimeMinutes} min`);
    if (row.notes) notes.unshift(row.notes);

    await db.execute({
      sql: `UPDATE attendance SET time_out = ?, total_hours = ?, status = ?, notes = ? WHERE id = ?`,
      args: [timeOut.toISOString(), totalHours, status, notes.join(' | '), row.id]
    });

    res.json({
      success: true,
      message: `Clocked out at ${timeOut.toLocaleTimeString()}. ${totalHours} hrs. Status: ${status}`,
      total_hours: totalHours,
      status
    });
  } catch (err) {
    console.error('clock-out error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────
// GET /api/employees
// ─────────────────────────────────────────
router.get('/employees', async (req, res) => {
  try {
    const result = await db.execute(`SELECT * FROM employees ORDER BY name ASC`);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────
// GET /api/employees/:employee_id
// ─────────────────────────────────────────
router.get('/employees/:employee_id', async (req, res) => {
  try {
    const result = await db.execute({
      sql: `SELECT * FROM employees WHERE employee_id = ?`,
      args: [req.params.employee_id]
    });
    if (!result.rows.length) return res.status(404).json({ error: 'Employee not found.' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────
// POST /api/employees
// ─────────────────────────────────────────
router.post('/employees', async (req, res) => {
  try {
    const {
      employee_id, name, department,
      work_days = '1,2,3,4,5',
      shift_start = '09:00',
      shift_end = '18:00',
      grace_minutes = 15
    } = req.body;

    if (!employee_id || !name) {
      return res.status(400).json({ error: 'Employee ID and Name are required.' });
    }

    await db.execute({
      sql: `INSERT INTO employees 
            (employee_id, name, department, work_days, shift_start, shift_end, grace_minutes)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [employee_id, name, department || 'General', work_days, shift_start, shift_end, grace_minutes]
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────
// PUT /api/employees/:employee_id
// ─────────────────────────────────────────
router.put('/employees/:employee_id', async (req, res) => {
  try {
    const { employee_id } = req.params;
    const { name, department, work_days, shift_start, shift_end, grace_minutes } = req.body;

    const fields = [];
    const args = [];
    if (name !== undefined)          { fields.push('name = ?');          args.push(name); }
    if (department !== undefined)    { fields.push('department = ?');    args.push(department); }
    if (work_days !== undefined)     { fields.push('work_days = ?');     args.push(work_days); }
    if (shift_start !== undefined)   { fields.push('shift_start = ?');   args.push(shift_start); }
    if (shift_end !== undefined)     { fields.push('shift_end = ?');     args.push(shift_end); }
    if (grace_minutes !== undefined) { fields.push('grace_minutes = ?'); args.push(grace_minutes); }

    if (!fields.length) return res.status(400).json({ error: 'No fields to update.' });

    args.push(employee_id);
    await db.execute({
      sql: `UPDATE employees SET ${fields.join(', ')} WHERE employee_id = ?`,
      args
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────
// DELETE /api/employees/:employee_id
// ─────────────────────────────────────────
router.delete('/employees/:employee_id', async (req, res) => {
  try {
    await db.execute({
      sql: `DELETE FROM employees WHERE employee_id = ?`,
      args: [req.params.employee_id]
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────
// GET /api/records/:employee_id
// ─────────────────────────────────────────
router.get('/records/:employee_id', async (req, res) => {
  try {
    const { from, to } = req.query;
    let sql = `SELECT * FROM attendance WHERE employee_id = ?`;
    const args = [req.params.employee_id];
    if (from) { sql += ` AND date >= ?`; args.push(from); }
    if (to)   { sql += ` AND date <= ?`; args.push(to); }
    sql += ` ORDER BY date DESC, id DESC`;

    const result = await db.execute({ sql, args });
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────
// GET /api/records (admin - all)
// ─────────────────────────────────────────
router.get('/records', async (req, res) => {
  try {
    const { from, to, employee_id } = req.query;
    let sql = `
      SELECT a.*, e.name, e.department, e.shift_start, e.shift_end
      FROM attendance a
      LEFT JOIN employees e ON a.employee_id = e.employee_id
      WHERE 1=1
    `;
    const args = [];
    if (from)        { sql += ` AND a.date >= ?`; args.push(from); }
    if (to)          { sql += ` AND a.date <= ?`; args.push(to); }
    if (employee_id) { sql += ` AND a.employee_id = ?`; args.push(employee_id); }
    sql += ` ORDER BY a.date DESC, a.id DESC`;

    const result = await db.execute({ sql, args });
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────
// GET /api/export/csv
// ─────────────────────────────────────────
router.get('/export/csv', async (req, res) => {
  try {
    const { from, to } = req.query;
    let sql = `
      SELECT a.employee_id, e.name, e.department, e.shift_start, e.shift_end,
             a.date, a.time_in, a.time_out, a.total_hours, a.expected_hours, a.status, a.notes
      FROM attendance a
      LEFT JOIN employees e ON a.employee_id = e.employee_id
      WHERE 1=1
    `;
    const args = [];
    if (from) { sql += ` AND a.date >= ?`; args.push(from); }
    if (to)   { sql += ` AND a.date <= ?`; args.push(to); }
    sql += ` ORDER BY a.date DESC`;

    const result = await db.execute({ sql, args });
    const rows = result.rows;

    const headers = ['Employee ID','Name','Department','Shift Start','Shift End',
                     'Date','Time In','Time Out','Total Hours','Expected Hours','Status','Notes'];
    const csv = [headers.join(',')];
    rows.forEach(r => {
      csv.push([
        r.employee_id, `"${r.name || ''}"`, `"${r.department || ''}"`,
        r.shift_start || '', r.shift_end || '',
        r.date, r.time_in || '', r.time_out || '',
        r.total_hours || 0, r.expected_hours || 0,
        r.status, `"${r.notes || ''}"`
      ].join(','));
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=attendance.csv');
    res.send(csv.join('\n'));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────
// GET /api/stats
// ─────────────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const today = todayStr();
    const stats = {};

    const r1 = await db.execute(`SELECT COUNT(*) AS total FROM employees`);
    stats.total_employees = r1.rows[0]?.total || 0;

    const r2 = await db.execute({
      sql: `SELECT COUNT(*) AS c FROM attendance WHERE date = ?`,
      args: [today]
    });
    stats.today_records = r2.rows[0]?.c || 0;

    const r3 = await db.execute({
      sql: `SELECT COUNT(*) AS c FROM attendance WHERE date = ? AND time_out IS NULL`,
      args: [today]
    });
    stats.currently_in = r3.rows[0]?.c || 0;

    const r4 = await db.execute({
      sql: `SELECT SUM(total_hours) AS s FROM attendance WHERE date = ?`,
      args: [today]
    });
    stats.today_hours = +(r4.rows[0]?.s || 0).toFixed(2);

    const r5 = await db.execute({
      sql: `SELECT COUNT(*) AS c FROM attendance WHERE date = ? AND status = 'Late'`,
      args: [today]
    });
    stats.late_today = r5.rows[0]?.c || 0;

    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;