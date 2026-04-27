# Critical Bug Fix: Amount Being Overwritten to 0

## Date: April 27, 2025

## Critical Issue Found

When completing a ticket with a manual amount (e.g., 300), the amount was being saved as 0 in the database, regardless of what the user entered.

## Root Cause

**Location**: `/app/backend/app/routers/queue.py` - `complete_ticket` endpoint (line 229)

**The Bug**:
```python
updates = {
    "status": "completed",
    "finished_at": now_iso,
    "paid": is_paid,
    "payment_method": body.payment_method if is_paid else None,
    "paid_at": now_iso if is_paid else None,
    "service_price": final_amount,  # ← User's amount (300)
}
updates.update(ticket_service_fields(services))  # ← OVERWRITES service_price!
```

**What Happened**:
1. User enters amount: **300** in checkout dialog
2. Frontend sends `final_amount: 300` to backend
3. Backend sets `service_price: 300` in updates dict
4. Backend then calls `ticket_service_fields(services)` which returns:
   ```python
   {
       "service_ids": [...],
       "service_names": [...],
       "service_price": 0,  # ← Calculated from selected services
       ...
   }
   ```
5. `updates.update(...)` **overwrites** `service_price: 300` with `service_price: 0`
6. Database saves **0** instead of **300**!

## The Fix

**Updated Order of Operations**:
```python
updates = {
    "status": "completed",
    "finished_at": now_iso,
    "paid": is_paid,
    "payment_method": body.payment_method if is_paid else None,
    "paid_at": now_iso if is_paid else None,
    # Don't set service_price here yet
}
# First, add service fields
updates.update(ticket_service_fields(services))
# Then, OVERRIDE with the user's manual amount
updates["service_price"] = final_amount  # ← Now this is the final value!
```

**Key Change**: Set `service_price` **AFTER** `ticket_service_fields()`, so the user's manual amount takes precedence.

## Why This Bug Existed

The `ticket_service_fields()` function calculates the total price from the services selected. This is fine for auto-calculation, but it should NOT override a manually entered amount.

**Design Intent**:
- User selects services → Auto-calculate price ✓
- User manually enters amount → Use that amount ✓
- User's manual entry should ALWAYS take precedence ✓

## User Impact

**Before Fix:**
1. User enters **₹300** in checkout
2. Completes as unpaid
3. Collections shows **₹0** ❌
4. Amount lost!

**After Fix:**
1. User enters **₹300** in checkout
2. Completes as unpaid
3. Collections shows **₹300** ✓
4. Can mark as paid later ✓

## Complete User Flow (Fixed)

### Step 1: Complete Ticket with Custom Amount
1. Open checkout dialog for serving ticket
2. Enter amount: **300** (different from service prices)
3. **Don't select payment method** (complete as unpaid)
4. Click "Complete (Unpaid)"
5. ✅ Ticket completes with:
   - `service_price: 300` ← User's amount
   - `paid: false`
   - `payment_method: null`

### Step 2: View in Collections
1. Go to Collections page
2. Find the completed ticket
3. ✅ Shows:
   - Amount: **₹300** ← Correct!
   - Button: **"Mark as paid"**

### Step 3: Mark as Paid Later
1. Click "Mark as paid" button
2. Select payment method: **Cash** or **Online**
3. Click "Confirm payment"
4. ✅ Updates to:
   - Amount: **₹300** (unchanged)
   - Status: **Paid**
   - Method: **Cash/Online**
   - Button shows: **"✓ Paid"**

## Testing Scenarios

### Scenario 1: Custom Amount, Unpaid
```
Input:  amount = 300, paid = false
Output: service_price = 300, paid = false
Result: ✓ Collections shows ₹300, "Mark as paid" button
```

### Scenario 2: Custom Amount, Paid with Cash
```
Input:  amount = 300, paid = true, payment_method = "cash"
Output: service_price = 300, paid = true, payment_method = "cash"
Result: ✓ Collections shows ₹300, "✓ Paid" button
```

### Scenario 3: Zero Amount
```
Input:  amount = 0, paid = false
Output: service_price = 0, paid = false
Result: ✓ Collections shows ₹0, "No amount" badge
```

### Scenario 4: Auto-Calculated Amount
```
Input:  services selected (total = 500), amount = 500
Output: service_price = 500, paid = false/true
Result: ✓ Works correctly
```

## Code Changes

### File: `/app/backend/app/routers/queue.py`

**Before:**
```python
updates = {
    # ...
    "service_price": final_amount,
}
updates.update(ticket_service_fields(services))  # Overwrites service_price!
```

**After:**
```python
updates = {
    # ...
    # service_price not set here
}
updates.update(ticket_service_fields(services))
updates["service_price"] = final_amount  # Set AFTER, takes precedence
```

## Related Fixes

Also fixed in this session:
1. ✅ Boolean validation error (frontend)
2. ✅ Payment method validation (frontend)
3. ✅ Collections page "Mark as paid" only when amount > 0
4. ✅ Amount edit functionality in Collections

## Files Modified

1. **Backend**:
   - `/app/backend/app/routers/queue.py` - Fixed order of operations

2. **Frontend** (previous fixes):
   - `/app/frontend/src/pages/Dashboard.jsx` - Boolean validation
   - `/app/frontend/src/pages/Collections.jsx` - Amount validation

## Database Impact

No migration needed. The field `service_price` already exists, we're just fixing how it's being saved.

## Verification Steps

1. ✅ Python linting passed
2. ✅ Backend restarted successfully
3. ✅ No errors in logs
4. ✅ Ready to test

## Testing Instructions

**Test Case: Custom Amount Unpaid**
1. Go to Dashboard
2. Click "Done" on a serving ticket
3. Enter amount: **300**
4. Do NOT select payment method
5. Click "Complete (Unpaid)"
6. Go to Collections page
7. ✅ **Verify: Amount shows ₹300**
8. ✅ **Verify: Button shows "Mark as paid"**
9. Click "Mark as paid"
10. Select "Cash"
11. Click "Confirm payment"
12. ✅ **Verify: Shows "✓ Paid" button**

## Priority

**CRITICAL** - This was preventing the core feature (custom amount at checkout) from working at all.

## Notes

- This bug affected ALL completed tickets with custom amounts
- Any tickets completed before this fix have incorrect amounts (0 instead of actual)
- Future tickets will save correctly
- Users can manually edit amounts in Collections page to fix old data
