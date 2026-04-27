# Collections Page Updates

## Date: April 27, 2025

## Summary
Enhanced the Collections page to allow editing service amounts and marking unpaid tickets as paid with payment method selection.

## Changes Made

### 1. Backend Changes

#### File: `/app/backend/app/routers/queue.py`

**New Endpoint**: `PATCH /api/business/{business_id}/queue/{ticket_id}/amount`
- Allows updating the service_price (amount) for any ticket
- Validates that amount is not negative
- Returns the updated ticket

```python
@router.patch("/queue/{ticket_id}/amount")
async def update_amount(
    business_id: str,
    ticket_id: str,
    body: dict,
    user: dict = Depends(get_current_user),
):
    # Updates service_price field
    # Validates amount >= 0
    # Returns updated ticket
```

### 2. Frontend Changes

#### File: `/app/frontend/src/pages/Collections.jsx`

**New Features Added:**

1. **Edit Amount Button**
   - Added edit icon button next to each amount in the table
   - Opens a dialog to update the service amount
   - Shows ticket details (token number, customer name)
   - Validates amount input (minimum 0)
   - Updates immediately and refreshes the collections data

2. **Mark as Paid Functionality**
   - Replaced static "Paid/Pending" badge with action buttons
   - **For Unpaid Tickets**: Shows "Mark as paid" button
   - **For Paid Tickets**: Shows "Paid" button (can click to mark as unpaid)
   - Opens dialog to select payment method (Cash/Online)
   - Shows ticket details including amount

3. **Payment Method Selection**
   - Reusable `PaymentMethodCards` component
   - Two options: Cash (Collected at counter), Online (UPI, card, transfer)
   - Visual selection with highlighted active state
   - Required to complete "mark as paid" action

**New State Variables:**
- `editingTicket` - Currently being edited ticket
- `editAmount` - Amount value in edit dialog
- `amountDialogOpen` - Edit amount dialog visibility
- `updatingAmount` - Loading state for amount update
- `paymentDialogOpen` - Payment method dialog visibility
- `paymentTicket` - Ticket being marked as paid
- `paymentMethod` - Selected payment method
- `updatingPayment` - Loading state for payment update

**New Functions:**
- `openAmountDialog(ticket)` - Opens amount edit dialog
- `updateAmount(e)` - Submits amount update
- `openPaymentDialog(ticket)` - Opens payment method dialog
- `markAsPaid(e)` - Marks ticket as paid with selected method
- `markAsUnpaid(ticketId)` - Marks ticket as unpaid

**UI Changes:**
- Changed "Payment" column header to "Actions"
- Amount cell now includes edit icon button
- Actions cell shows contextual buttons based on payment status

## User Experience Flow

### Edit Amount Flow
1. User clicks edit icon (✏️) next to any amount
2. Dialog opens showing ticket details
3. User enters new amount
4. Clicks "Update amount"
5. Amount updates immediately
6. Collections data refreshes

### Mark as Paid Flow
1. User sees "Mark as paid" button for unpaid tickets
2. Clicks button to open payment method dialog
3. Dialog shows ticket details (token, name, amount)
4. User selects payment method (Cash or Online)
5. Clicks "Confirm payment"
6. Ticket marked as paid with selected method
7. Button changes to "Paid" with checkmark icon

### Mark as Unpaid Flow
1. User clicks "Paid" button on a paid ticket
2. Ticket immediately marked as unpaid
3. Payment method cleared
4. Button changes to "Mark as paid"

## Benefits

1. **Flexible Amount Management**: Correct mistakes or adjust amounts after completion
2. **Easy Payment Tracking**: Simple one-click to mark as paid with method selection
3. **Reversible Actions**: Can mark tickets as unpaid if payment was mistakenly recorded
4. **Better Cash Flow Visibility**: See payment methods in the table
5. **Inline Editing**: No need to go to another page to update amounts
6. **Clear Visual Feedback**: Action buttons with icons for better UX

## Files Modified

1. **Backend**:
   - `/app/backend/app/routers/queue.py` - Added update_amount endpoint

2. **Frontend**:
   - `/app/frontend/src/pages/Collections.jsx` - Added edit and payment features

## API Endpoints Used

### New
- `PATCH /api/business/{id}/queue/{ticket_id}/amount` - Update service amount
  - Body: `{ service_price: number }`

### Existing
- `PATCH /api/business/{id}/queue/{ticket_id}/paid` - Mark as paid/unpaid
  - Body: `{ paid: boolean, payment_method: "cash" | "online" | null }`

## UI Components

### Edit Amount Dialog
- Shows ticket info (token, customer name)
- Number input for new amount
- Submit button with loading state
- Data testids: `edit-amount-input`, `update-amount-submit`

### Payment Method Dialog
- Shows ticket info (token, customer, amount)
- Payment method cards (Cash/Online)
- Submit button (disabled until method selected)
- Data testids: `collections-payment-method-cash`, `collections-payment-method-online`, `mark-paid-submit`

## Testing

**Test Scenarios:**
- [ ] Edit amount for a ticket (0, positive value, large value)
- [ ] Mark unpaid ticket as paid with Cash
- [ ] Mark unpaid ticket as paid with Online
- [ ] Mark paid ticket as unpaid
- [ ] Verify collections totals update correctly
- [ ] Verify daily chart reflects changes
- [ ] Test with different filters (paid/unpaid, payment method, service)

## Notes

- Amount updates don't change payment status
- Marking as unpaid clears payment method
- All changes refresh the entire collections data
- Payment method dialog requires selection (cannot mark as paid without method)
- Edit button always visible regardless of payment status
- Collections page retains existing filtering functionality
