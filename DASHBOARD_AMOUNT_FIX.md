# Dashboard Checkout Amount Fix

## Date: April 27, 2025

## Issue
Amount field in the checkout/complete dialog was not properly updating when manually edited. The value entered (e.g., 300) was being overridden by the suggested total calculation.

## Root Cause

The issue had two problems:

1. **Service Toggle Not Preserving Manual Amount**: When toggling services in the checkout dialog, the `toggleCompletionService` function was not checking if the user had manually edited the amount (`amountDirty` flag). It was always recalculating based on selected services.

2. **Dialog Not Resetting State**: When closing the dialog, the completion state (including `amountDirty`) was not being reset, causing stale state issues when reopening.

## Solution

### Fix 1: Smart Service Toggle Logic

Updated `toggleCompletionService` to check the `amountDirty` flag:

```javascript
const toggleCompletionService = (serviceId) => {
  setCompletion((prev) => {
    const newServiceIds = prev.service_ids.includes(serviceId)
      ? prev.service_ids.filter((id) => id !== serviceId)
      : [...prev.service_ids, serviceId];
    
    // If user hasn't manually edited the amount, update it based on selected services
    if (!prev.amountDirty) {
      const newTotal = services
        .filter((svc) => newServiceIds.includes(svc.id))
        .reduce((sum, svc) => sum + Number(svc.price || 0), 0);
      return {
        ...prev,
        service_ids: newServiceIds,
        final_amount: String(newTotal || 0),
      };
    }
    
    // User has manually edited amount, preserve it
    return {
      ...prev,
      service_ids: newServiceIds,
    };
  });
};
```

**Behavior:**
- If user hasn't edited amount: Auto-calculate from selected services
- If user has edited amount: Keep their manual value, don't override

### Fix 2: Reset Dialog State on Close

Updated the `onOpenChange` handler to reset completion state:

```javascript
<Dialog
  open={completeOpen}
  onOpenChange={(open) => {
    setCompleteOpen(open);
    if (!open) {
      setTicketToComplete(null);
      setCompleting(false);
      setCompletion({ 
        service_ids: [], 
        final_amount: "0", 
        payment_method: "", 
        amountDirty: false 
      });
    }
  }}
>
```

**Ensures:**
- Clean state for next ticket
- No stale `amountDirty` flags
- Fresh calculation on dialog open

## How It Works Now

### Scenario 1: Auto-Calculation (Default)
1. Open checkout dialog → Amount auto-fills from service prices
2. Toggle services → Amount updates automatically
3. ✅ Works as expected

### Scenario 2: Manual Amount Entry
1. Open checkout dialog → Amount auto-fills
2. **User types new amount (e.g., 300)** → `amountDirty: true`
3. Toggle services → **Amount stays at 300** (preserved)
4. Submit → ✅ Submits with 300

### Scenario 3: Zero Amount
1. Open checkout dialog → Amount is 0
2. Payment method selector is **hidden**
3. Button shows "Complete (Unpaid)"
4. Submit → ✅ Completes as unpaid

### Scenario 4: Amount > 0, Manual Edit
1. Open checkout dialog → Amount shows 500 (from services)
2. User changes to 300 → `amountDirty: true`
3. User selects "Cash" → Payment method set
4. Button shows "Complete & mark paid"
5. Submit → ✅ Marks as paid with ₹300 via Cash

## State Management

The `completion` state object:
```javascript
{
  service_ids: [],           // Selected services
  final_amount: "0",         // Amount to charge
  payment_method: "",        // "cash" or "online" or ""
  amountDirty: false        // Has user manually edited amount?
}
```

**`amountDirty` Flag:**
- `false` → Amount auto-calculates from services
- `true` → Amount is manually set, don't override

## Files Modified

- `/app/frontend/src/pages/Dashboard.jsx`
  - Updated `toggleCompletionService` function
  - Updated dialog `onOpenChange` handler

## Testing Checklist

- [x] Open checkout → Amount auto-fills correctly
- [x] Manually enter amount (e.g., 300) → Value persists
- [x] Toggle services after manual entry → Amount stays at 300
- [x] Submit with manual amount → Completes with 300
- [x] Amount = 0 → Payment selector hidden, completes as unpaid
- [x] Amount > 0 without payment method → Completes as unpaid
- [x] Amount > 0 with payment method → Marks as paid
- [x] Close and reopen dialog → Clean state, no issues

## Benefits

1. **Respects User Input**: Manual amounts are never overridden
2. **Smart Auto-Calculation**: Still calculates when user hasn't edited
3. **Clean State**: Dialog always opens fresh
4. **Better UX**: Predictable behavior, no surprises

## Notes

- The existing `useEffect` that watches `suggestedTotal` already respects `amountDirty`
- The fix ensures the flag is properly maintained during service toggling
- Closing the dialog now resets all state for next use
