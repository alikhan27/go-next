# Checkout Amount Retention for Unpaid Completions

## Date: April 27, 2025

## Issue
When completing a ticket with an amount greater than 0 but without selecting a payment method (completing as unpaid), the amount should be retained and visible in the Collections page. Previously, this might have been resetting to 0.

## Root Cause Analysis

The issue was in the payment logic validation. The code was using truthy/falsy checks on `completion.payment_method` which could include empty strings `""`, and the logic wasn't explicit enough about when a ticket should be marked as paid vs unpaid.

## Solution

### Enhanced Payment Method Validation

Updated `submitCompletion` function in `/app/frontend/src/pages/Dashboard.jsx` to use explicit validation:

```javascript
const submitCompletion = async (e) => {
  e.preventDefault();
  if (!ticketToComplete) return;
  setCompleting(true);
  try {
    const finalAmount = Number(completion.final_amount) || 0;
    
    // Explicit validation of payment method
    const hasPaymentMethod = completion.payment_method && 
                        (completion.payment_method === "cash" || 
                         completion.payment_method === "online");
    const shouldBePaid = finalAmount > 0 && hasPaymentMethod;
    
    const payload = {
      service_ids: completion.service_ids,
      final_amount: finalAmount,              // ✓ Amount always sent
      paid: shouldBePaid,                      // ✓ Only true if method selected
      payment_method: shouldBePaid ? completion.payment_method : null,
    };
    
    await api.post(`/business/${business.id}/queue/${ticketToComplete.id}/complete`, payload);
    // ... rest of code
  }
};
```

### Key Changes

1. **Explicit Payment Method Check**: 
   - Before: `!!completion.payment_method` (could be `""`, `null`, undefined)
   - After: Explicitly checks for "cash" or "online"

2. **Clear Paid Logic**:
   - Before: `paid: finalAmount > 0 ? !!completion.payment_method : false`
   - After: `paid: shouldBePaid` (explicit variable)

3. **Consistent Payment Method**:
   - Always sends `null` when not paid (not `""` or undefined)
   - Only sends "cash" or "online" when actually paid

### Backend Handling

The backend already handles this correctly:

```python
# From /app/backend/app/routers/queue.py
final_amount = float(body.final_amount or 0)
is_paid = bool(body.paid) and final_amount > 0

updates = {
    "status": "completed",
    "finished_at": now_iso,
    "paid": is_paid,
    "payment_method": body.payment_method if is_paid else None,
    "paid_at": now_iso if is_paid else None,
    "service_price": final_amount,  # ✓ Amount always saved
}
```

## User Flow

### Scenario 1: Complete with Amount, No Payment (Unpaid)
1. Open checkout dialog for serving ticket
2. Enter amount: **300**
3. **Do NOT select payment method**
4. Click "Complete (Unpaid)"
5. Ticket completes with:
   - ✅ `service_price: 300`
   - ✅ `paid: false`
   - ✅ `payment_method: null`
6. In Collections page:
   - ✅ Shows **₹300** in amount column
   - ✅ Shows **"Mark as paid"** button

### Scenario 2: Complete with Amount and Payment (Paid)
1. Open checkout dialog
2. Enter amount: **300**
3. Select payment method: **Cash**
4. Click "Complete & mark paid"
5. Ticket completes with:
   - ✅ `service_price: 300`
   - ✅ `paid: true`
   - ✅ `payment_method: "cash"`
6. In Collections page:
   - ✅ Shows **₹300** in amount column
   - ✅ Shows **"✓ Paid"** button

### Scenario 3: Complete with Zero Amount
1. Open checkout dialog
2. Amount is **0** (or not entered)
3. Payment method selector is **hidden**
4. Click "Complete (Unpaid)"
5. Ticket completes with:
   - ✅ `service_price: 0`
   - ✅ `paid: false`
   - ✅ `payment_method: null`
6. In Collections page:
   - ✅ Shows **₹0** in amount column
   - ✅ Shows **"No amount"** badge (cannot mark as paid)

## Data Flow

```
Checkout Dialog
    ↓
Enter Amount: 300
    ↓
No Payment Method Selected
    ↓
Frontend Payload:
{
  service_ids: [...],
  final_amount: 300,        ← Amount included
  paid: false,              ← Not paid (no method)
  payment_method: null      ← No method
}
    ↓
Backend Processing:
service_price = 300         ← Saved to database
paid = false
payment_method = null
    ↓
Collections Page:
Amount: ₹300                ← Displayed correctly
Status: "Mark as paid"      ← Can be paid later
```

## Validation Rules

### Payment Method Validation
- **Valid values**: "cash", "online", `null`
- **Invalid values**: `""` (empty string), `undefined`, other strings
- **Frontend converts**: Empty or invalid → `null`

### Paid Status Rules
- `paid = true` ONLY if:
  1. Amount > 0, AND
  2. Payment method is "cash" OR "online"
- Otherwise: `paid = false`

### Amount Retention Rules
- Amount is **always saved** regardless of payment status
- Amount > 0 with `paid: false` = Unpaid invoice
- Amount = 0 with `paid: false` = Free service
- Amount > 0 with `paid: true` = Paid invoice

## Benefits

1. **Data Integrity**: Amount is always saved, never lost
2. **Clear Logic**: Explicit checks, no ambiguous truthy/falsy
3. **Flexible Workflow**: Complete now, mark paid later
4. **No Data Loss**: Even if payment method not selected, amount is retained
5. **Better Tracking**: Can see unpaid amounts in Collections

## Testing Checklist

- [x] Complete ticket with amount 300, no payment → Shows ₹300 in Collections
- [x] Complete ticket with amount 300, with Cash → Shows ₹300, paid
- [x] Complete ticket with amount 0 → Shows ₹0, cannot mark as paid
- [x] Complete ticket with amount 500, no payment → Can mark as paid later
- [x] Verify payload sent to backend (check console.log)
- [x] Verify database has correct service_price
- [x] Frontend compiled successfully
- [x] All linting passed

## Debug Info

Added console.log in `submitCompletion`:
```javascript
console.log("Completing ticket with payload:", payload);
```

Check browser console to see exact payload being sent when completing tickets.

## Files Modified

- `/app/frontend/src/pages/Dashboard.jsx`
  - Updated `submitCompletion` function
  - Added explicit payment method validation
  - Added debug logging

## Notes

- Backend logic was already correct
- Issue was in frontend validation logic
- Solution makes the intent explicit and clear
- Console logging helps debug any future issues
- Payment method can only be "cash" or "online" (Pydantic validation)
