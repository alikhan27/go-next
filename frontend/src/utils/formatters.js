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
 * Format date
 */
export function formatDate(dateString) {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString('en-IN');
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
