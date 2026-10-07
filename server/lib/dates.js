// All attendance dates are stored in Indian Standard Time.
export function todayIST(d = new Date()) {
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // YYYY-MM-DD
}

export function lastNDaysIST(n) {
  const days = [];
  for (let i = n - 1; i >= 0; i--) {
    days.push(todayIST(new Date(Date.now() - i * 86400000)));
  }
  return days;
}
