/**
 * Validation - Form validation utilities
 * Single Responsibility: Validate user input
 */

/**
 * Validate email
 */
export function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate phone number (Indian)
 */
export function validatePhone(phone) {
  const phoneRegex = /^[6-9]\d{9}$/;
  return phoneRegex.test(phone);
}

/**
 * Validate required field
 */
export function validateRequired(value) {
  return value && value.trim().length > 0;
}

/**
 * Validate amount
 */
export function validateAmount(amount) {
  const num = Number(amount);
  return !isNaN(num) && num >= 0;
}

/**
 * Validate service selection
 */
export function validateServiceSelection(services) {
  return Array.isArray(services) && services.length > 0;
}
