import React from 'react';
import { formatAppDate } from '../../utils/formatters';

/**
 * Consistent Date Display Component
 * Shows:
 * 01/Jan/2026
 * Monday
 */
export default function FormattedDate({ date, className = "" }) {
  const { date: formattedDate, weekday } = formatAppDate(date);
  
  if (!formattedDate) return null;

  return (
    <div className={`flex flex-col leading-tight ${className}`}>
      <span className="font-medium">{formattedDate}</span>
      <span className="text-[0.8em] text-muted-foreground opacity-80">{weekday}</span>
    </div>
  );
}
