// public/js/app.js - Shared frontend logic

// ---------- Live Clock ----------
function tick() {
  const el = document.getElementById('liveClock');
  const de = document.getElementById('liveDate');
  if (!el) return;

  const now = new Date();
  el.textContent = now.toLocaleTimeString();
  if (de) {
    de.textContent = now.toLocaleDateString(undefined, {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
  }
}
setInterval(tick, 1000);
tick();

// ---------- Toast ----------
function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className = `toast ${type} show`;
  setTimeout(() => t.classList.remove('show'), 3000);
}

// ---------- Time formatting ----------
function formatTime(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ---------- Dark mode ----------
(function initTheme() {
  const isDark = localStorage.getItem('darkMode') === 'true';
  if (isDark) document.body.classList.add('dark');

  const btn = document.getElementById('themeToggle');
  if (btn) {
    btn.textContent = isDark ? '☀️' : '🌙';
    btn.addEventListener('click', () => {
      document.body.classList.toggle('dark');
      const dark = document.body.classList.contains('dark');
      localStorage.setItem('darkMode', dark);
      btn.textContent = dark ? '☀️' : '🌙';
    });
  }
})();

// ---------- Clock In / Out (home page only) ----------
const timeInBtn = document.getElementById('timeInBtn');
const timeOutBtn = document.getElementById('timeOutBtn');

async function postJSON(url, data) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return res.json();
}

if (timeInBtn) {
  timeInBtn.addEventListener('click', async () => {
    const employee_id = document.getElementById('employeeId').value.trim();
    const name = document.getElementById('employeeName').value.trim();
    if (!employee_id || !name) return showToast('Please enter both ID and Name.', 'error');

    const data = await postJSON('/api/clock-in', { employee_id, name });
    if (data.success) {
      showToast(data.message, 'success');
      loadStats();
    } else {
      showToast(data.error, 'error');
    }
  });
}

if (timeOutBtn) {
  timeOutBtn.addEventListener('click', async () => {
    const employee_id = document.getElementById('employeeId').value.trim();
    if (!employee_id) return showToast('Please enter your Employee ID.', 'error');

    const data = await postJSON('/api/clock-out', { employee_id });
    if (data.success) {
      showToast(data.message, 'success');
      loadStats();
    } else {
      showToast(data.error, 'error');
    }
  });
}

// ---------- Stats (home page only) ----------
async function loadStats() {
  const s = document.getElementById('statEmployees');
  if (!s) return;

  try {
    const res = await fetch('/api/stats');
    const data = await res.json();
    document.getElementById('statEmployees').textContent = data.total_employees;
    document.getElementById('statRecords').textContent = data.today_records;
    document.getElementById('statIn').textContent = data.currently_in;
    document.getElementById('statHours').textContent = data.today_hours;
    document.getElementById('statLate').textContent = data.late_today ?? 0;
  } catch (e) {
    console.error(e);
  }
}

if (document.getElementById('statEmployees')) {
  loadStats();
  setInterval(loadStats, 30000); // refresh every 30s
}