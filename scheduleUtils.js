// scheduleUtils.js - Helpers for schedule logic

// Parse "09:00" → minutes since midnight
function timeToMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

// Get minutes since midnight from a Date object
function dateToMinutes(date) {
  return date.getHours() * 60 + date.getMinutes();
}

// Get ISO weekday: Mon=1 ... Sun=7
function isoWeekday(date) {
  const d = date.getDay(); // 0=Sun..6=Sat
  return d === 0 ? 7 : d;
}

// Format minutes back to "HH:MM"
function minutesToTime(mins) {
  const h = Math.floor(mins / 60).toString().padStart(2, '0');
  const m = (mins % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

// Check if employee is scheduled to work on a given date
function isWorkDay(employee, date) {
  const days = (employee.work_days || '1,2,3,4,5').split(',').map(d => d.trim());
  return days.includes(String(isoWeekday(date)));
}

// Determine clock-in status based on schedule
function computeClockInStatus(employee, clockInDate) {
  const shiftStart = timeToMinutes(employee.shift_start || '09:00');
  const grace = employee.grace_minutes ?? 15;
  const inMinutes = dateToMinutes(clockInDate);

  if (inMinutes > shiftStart + grace) {
    const lateMinutes = inMinutes - shiftStart;
    return { status: 'Late', lateMinutes };
  }
  return { status: 'Present', lateMinutes: 0 };
}

// Determine clock-out status based on schedule
function computeClockOutStatus(employee, clockOutDate) {
  const shiftEnd = timeToMinutes(employee.shift_end || '18:00');
  const outMinutes = dateToMinutes(clockOutDate);

  if (outMinutes < shiftEnd) {
    const undertime = shiftEnd - outMinutes;
    return { status: 'Early Out', undertimeMinutes: undertime };
  }

  // Overtime: more than 30 min past shift end
  if (outMinutes > shiftEnd + 30) {
    const overtime = outMinutes - shiftEnd;
    return { status: 'Overtime', overtimeMinutes: overtime };
  }

  return { status: 'Complete' };
}

// Expected hours = shift duration
function expectedHours(employee) {
  const start = timeToMinutes(employee.shift_start || '09:00');
  const end = timeToMinutes(employee.shift_end || '18:00');
  return +((end - start) / 60).toFixed(2);
}

module.exports = {
  timeToMinutes,
  dateToMinutes,
  isoWeekday,
  minutesToTime,
  isWorkDay,
  computeClockInStatus,
  computeClockOutStatus,
  expectedHours
};