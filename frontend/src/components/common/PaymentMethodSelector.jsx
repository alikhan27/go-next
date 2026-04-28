/**
 * PaymentMethodSelector Component
 * Single Responsibility: Payment method selection UI
 * Interface Segregation: Focused on payment method selection only
 */
import React from 'react';

export function PaymentMethodSelector({ value, onChange, testidPrefix = 'payment-method' }) {
  const options = [
    { id: 'cash', label: 'Cash', hint: 'Collected at the counter' },
    { id: 'online', label: 'Online', hint: 'UPI, card, or transfer' },
  ];

  return (
    <div className="grid grid-cols-2 gap-2">
      {options.map((option) => {
        const active = value === option.id;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            className={`rounded-xl border px-4 py-3 text-left transition-colors ${
              active
                ? 'border-primary bg-secondary'
                : 'border-stone-200 bg-white hover:border-stone-300'
            }`}
            data-testid={`${testidPrefix}-${option.id}`}
          >
            <span className="block text-sm font-medium text-stone-900">{option.label}</span>
            <span className="mt-1 block text-xs text-stone-500">{option.hint}</span>
          </button>
        );
      })}
    </div>
  );
}
