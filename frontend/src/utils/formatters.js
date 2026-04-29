/**
 * Formatters - Data formatting utilities
 * Single Responsibility: Format data for display
 */

/**
 * Format currency (INR)
 */
export function formatCurrency(amount) {
  return `₹${Number(amount || 0).toLocaleString('en-IN')}`;
}

/**
 * Format token number
 */
export function formatTokenNumber(tokenNumber) {
  return `#${String(tokenNumber).padStart(3, '0')}`;
}

/**
 * Format date into parts: { date: "01/Jan/2026", weekday: "Monday" }
 */
export function formatAppDate(dateString) {
  if (!dateString) return { date: '', weekday: '' };
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return { date: dateString, weekday: '' };
    
    const day = String(d.getDate()).padStart(2, '0');
    // Get short month like "Jan", "Feb"
    const month = d.toLocaleString('en-IN', { month: 'short' });
    const year = d.getFullYear();
    const weekday = d.toLocaleString('en-IN', { weekday: 'long' });
    
    return {
      date: `${day}/${month}/${year}`,
      weekday: weekday
    };
  } catch (e) {
    return { date: dateString, weekday: '' };
  }
}

/**
 * Format date for charts: "28-Apr" (no year)
 */
export function formatChartDate(dateString) {
  if (!dateString) return '';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    const day = String(d.getDate()).padStart(2, '0');
    const month = d.toLocaleString('en-IN', { month: 'short' });
    return `${day}-${month}`;
  } catch (e) {
    return dateString;
  }
}

/**
 * Format date string (default simple version)
 */
export function formatDate(dateString) {
  const { date } = formatAppDate(dateString);
  return date;
}

/**
 * Format time
 */
export function formatTime(dateString) {
  if (!dateString) return '';
  return new Date(dateString).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format payment method label
 */
export function formatPaymentMethod(method) {
  const labels = {
    cash: 'Cash',
    online: 'Online',
  };
  return labels[method] || method;
}

/**
 * Format status label
 */
export function formatStatus(status) {
  const labels = {
    waiting: 'Waiting',
    serving: 'Serving',
    completed: 'Completed',
    cancelled: 'Cancelled',
    no_show: 'No Show',
  };
  return labels[status] || status;
}
