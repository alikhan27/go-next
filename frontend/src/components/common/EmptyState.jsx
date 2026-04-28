/**
 * EmptyState Component
 * Single Responsibility: Display empty state with optional action
 * Open/Closed: Easy to customize via props
 */
import React from 'react';
import { Button } from '../ui/button';

export function EmptyState({ icon: Icon, title, description, action, actionLabel }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      {Icon && <Icon className="h-12 w-12 text-stone-400 mb-4" />}
      <h3 className="text-lg font-medium text-stone-900 mb-2">{title}</h3>
      {description && <p className="text-sm text-stone-500 mb-4">{description}</p>}
      {action && actionLabel && (
        <Button onClick={action} className="rounded-full">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
