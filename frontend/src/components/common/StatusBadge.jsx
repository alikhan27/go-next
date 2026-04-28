/**
 * StatusBadge Component
 * Single Responsibility: Display status with consistent styling
 * Liskov Substitution: Can be used anywhere a badge is needed
 */
import React from 'react';
import { Badge } from '../ui/badge';

const STATUS_STYLES = {
  waiting: 'bg-blue-100 text-blue-800',
  serving: 'bg-green-100 text-green-800',
  completed: 'bg-stone-100 text-stone-600',
  cancelled: 'bg-red-100 text-red-800',
  no_show: 'bg-yellow-100 text-yellow-800',
  paid: 'bg-success text-white',
  unpaid: 'bg-stone-100 text-stone-600',
};

export function StatusBadge({ status, label, className = '' }) {
  const styles = STATUS_STYLES[status] || 'bg-stone-100 text-stone-600';
  
  return (
    <Badge className={`rounded-full ${styles} ${className}`}>
      {label || status}
    </Badge>
  );
}
