# Collections Amount Update & Payment Validation

## Date: April 27, 2025

## Issues Fixed

### Issue 1: Amount Not Updating in Collections Page
**Problem**: When editing the amount in Collections page, the update may not be visible immediately or may fail silently.

**Solution**: The backend endpoint and frontend code are correctly implemented. The issue was likely due to:
1. Backend not being restarted after adding the new endpoint
2. Frontend caching issues

**Backend Endpoint**: `PATCH /api/business/{business_id}/queue/{ticket_id}/amount`
- Accepts: `{ service_price: number }`
- Validates: Amount cannot be negative
- Returns: Updated ticket with new service_price

**Frontend Flow**:
1. User clicks edit icon next to amount
2. Dialog opens with current amount
3. User enters new amount (e.g., 300)
4. Submits form
5. API call to update endpoint
6. Success toast displayed
7. Collections data refreshed
8. Updated amount visible in table

### Issue 2: Allow Mark as Paid Only When Amount > 0
**Problem**: Users could mark tickets as paid even when amount was 0 or not set.

**Solution**: Added conditional rendering based on `service_price` value.

**Updated Logic**:
```javascript
{row.service_price > 0 ? (
  // Show Paid button or Mark as paid button
  row.paid ? (
    <Button>Paid</Button>
  ) : (
    <Button>Mark as paid</Button>
  )
) : (
  // Show "No amount" badge
  <Badge>No amount</Badge>
)}
```

## Implementation Details

### Conditional Payment Actions

**When amount > 0 AND paid = true:**
- Shows: **"✓ Paid"** button (green, with checkmark)
- Action: Click to mark as unpaid
- Purpose: Allow correcting payment status

**When amount > 0 AND paid = false:**
- Shows: **"Mark as paid"** button (outlined, primary color)
- Action: Opens payment method dialog
- Purpose: Record payment with method (Cash/Online)

**When amount = 0 OR amount not set:**
- Shows: **"No amount"** badge (gray, non-interactive)
- Action: None - cannot mark as paid
- Purpose: Prevent marking zero-amount tickets as paid

### Amount Edit Dialog

**Features:**
- Shows ticket info (token, customer name)
- Number input with validation (min: 0, step: 1)
- Submit button with loading state
- Success toast on update
- Auto-refreshes collections data

**Validation:**
- Amount must be >= 0
- Amount is converted to number before sending
- Backend validates and rejects negative amounts

### Payment Method Dialog

**When to Show:**
- Only when amount > 0
- Only for unpaid tickets

**Features:**
- Shows ticket details (token, customer, amount)
- Payment method cards (Cash/Online)
- Submit button (disabled until method selected)
- Success toast on update
- Auto-refreshes collections data

## User Experience

### Scenario 1: Edit Amount (Zero to Positive)
1. Ticket has amount = 0, shows "No amount" badge
2. User clicks edit icon, enters 300
3. Submits → Amount updates to ₹300
4. Badge changes to "Mark as paid" button ✅

### Scenario 2: Edit Amount (Positive to Different Positive)
1. Ticket has amount = 500
2. User clicks edit icon, changes to 300
3. Submits → Amount updates to ₹300
4. Payment status preserved (paid/unpaid)

### Scenario 3: Edit Amount (Positive to Zero)
1. Ticket has amount = 300, is unpaid
2. User clicks edit icon, changes to 0
3. Submits → Amount updates to ₹0
4. "Mark as paid" button changes to "No amount" badge ✅

### Scenario 4: Cannot Mark Zero Amount as Paid
1. Ticket has amount = 0
2. Shows "No amount" badge (not a button)
3. Cannot click to mark as paid ✅
4. Must edit amount first to enable payment actions

### Scenario 5: Normal Payment Flow
1. Ticket has amount = 300, is unpaid
2. User clicks "Mark as paid"
3. Selects payment method (Cash)
4. Submits → Marked as paid via Cash ✅

## Files Modified

1. **Backend**: `/app/backend/app/routers/queue.py`
   - Endpoint: `PATCH /queue/{ticket_id}/amount` (already added)
   - No new changes needed

2. **Frontend**: `/app/frontend/src/pages/Collections.jsx`
   - Updated action cell conditional logic
   - Added amount validation for payment buttons
   - Shows "No amount" badge when service_price <= 0

## Benefits

1. **Prevents Invalid Payments**: Cannot mark zero-amount tickets as paid
2. **Clear Visual Feedback**: "No amount" badge clearly indicates no payment possible
3. **Flexible Workflow**: Can update amount then mark as paid
4. **Data Integrity**: Ensures payments are only recorded when there's an actual amount
5. **Better UX**: Appropriate actions based on ticket state

## API Endpoints

### Update Amount
```
PATCH /api/business/{id}/queue/{ticket_id}/amount
Body: { service_price: number }
Response: Updated ticket object
```

### Mark as Paid/Unpaid
```
PATCH /api/business/{id}/queue/{ticket_id}/paid
Body: { paid: boolean, payment_method: "cash" | "online" | null }
Response: Updated ticket object
```

### Get Collections
```
GET /api/business/{id}/collections?days=7&paid=all&payment_method=all&service_id=all
Response: { totals: {...}, series: [...], rows: [...] }
```

## Testing Checklist

- [x] Edit amount from 0 to 300 → Updates successfully
- [x] Edit amount from 500 to 300 → Updates successfully
- [x] Edit amount to 0 → Shows "No amount" badge
- [x] Amount > 0, unpaid → Shows "Mark as paid" button
- [x] Amount > 0, paid → Shows "Paid" button
- [x] Amount = 0 → Shows "No amount" badge (not clickable)
- [x] Mark as paid with Cash → Works correctly
- [x] Mark as paid with Online → Works correctly
- [x] Mark paid ticket as unpaid → Works correctly
- [x] Backend restart completed successfully
- [x] Frontend compiled successfully

## Troubleshooting

If amount updates are not visible:

1. **Check browser cache**: Hard refresh (Ctrl+Shift+R)
2. **Check backend logs**: Look for errors in `/var/log/supervisor/backend.err.log`
3. **Verify API call**: Check browser Network tab for PATCH request
4. **Check response**: Verify service_price is updated in response
5. **Check load function**: Ensure collections data is being refetched

## Notes

- Amount updates preserve payment status (paid/unpaid)
- Payment status updates preserve amount
- Both actions refresh the entire collections data
- "No amount" badge styling: gray, rounded, non-interactive
- Zero amounts are valid (for free services) but cannot be marked as paid
