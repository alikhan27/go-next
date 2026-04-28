# Frontend Refactoring Plan - SOLID Principles

## Overview
Refactor the Go-Next frontend to follow SOLID principles, improve maintainability, and reduce technical debt.

---

## Current Issues

### 1. Large Components
- **Dashboard.jsx**: ~750 lines (too large)
- **Collections.jsx**: ~600 lines
- **AdminPanel.jsx**: ~1400 lines (way too large!)

### 2. Duplicated Logic
- API calls scattered across components
- Form validation duplicated
- Toast notifications repeated
- Loading state patterns duplicated

### 3. Tight Coupling
- Business logic mixed with UI
- Direct API calls in components
- Hardcoded values

### 4. Missing Abstractions
- No custom hooks for common patterns
- No service layer
- No utility functions for common tasks

---

## SOLID Principles Applied

### S - Single Responsibility Principle
**Problem**: Components do too much (UI + logic + API + state)
**Solution**: 
- Extract custom hooks for business logic
- Create service layer for API calls
- Separate presentational and container components

### O - Open/Closed Principle
**Problem**: Hard to extend without modifying existing code
**Solution**:
- Use composition patterns
- Create pluggable components
- Use configuration objects

### L - Liskov Substitution Principle
**Problem**: Components not easily replaceable
**Solution**:
- Consistent prop interfaces
- Shared base patterns
- Reusable components

### I - Interface Segregation Principle
**Problem**: Large prop objects with unused props
**Solution**:
- Focused component APIs
- Specific prop requirements
- Optional props only when needed

### D - Dependency Inversion Principle
**Problem**: Components depend on concrete implementations
**Solution**:
- Abstract API calls into services
- Use context for dependencies
- Inject dependencies via props/hooks

---

## Refactoring Strategy

### Phase 1: Create Infrastructure ✅
1. **Services Layer**
   - `services/queueService.js` - Queue operations
   - `services/businessService.js` - Business operations
   - `services/authService.js` - Authentication
   - `services/collectionsService.js` - Collections data

2. **Custom Hooks**
   - `hooks/useQueue.js` - Queue state management
   - `hooks/useBusinesses.js` - Business data
   - `hooks/useCollections.js` - Collections data
   - `hooks/useForm.js` - Form handling
   - `hooks/useAsync.js` - Async operations

3. **Utilities**
   - `utils/validation.js` - Form validation
   - `utils/formatters.js` - Data formatting
   - `utils/constants.js` - App constants

### Phase 2: Extract Components ✅
1. **Common Components**
   - `components/LoadingButton.jsx` - Button with loading state
   - `components/ErrorBoundary.jsx` - Error handling
   - `components/EmptyState.jsx` - Empty states
   - `components/ConfirmDialog.jsx` - Confirmation dialogs
   - `components/StatusBadge.jsx` - Status indicators
   - `components/PaymentMethodSelector.jsx` - Payment method UI

2. **Domain Components**
   - `components/queue/TicketCard.jsx` - Ticket display
   - `components/queue/QueueTable.jsx` - Queue table
   - `components/queue/CompleteDialog.jsx` - Complete ticket dialog
   - `components/queue/WalkInDialog.jsx` - Walk-in form

### Phase 3: Refactor Pages ✅
1. **Dashboard.jsx**
   - Extract hooks
   - Split into smaller components
   - Use service layer

2. **Collections.jsx**
   - Extract hooks
   - Simplify logic
   - Use service layer

3. **Other pages**
   - Apply consistent patterns
   - Remove duplication

---

## Implementation Plan

### Step 1: Services Layer
```javascript
// services/queueService.js
export const queueService = {
  async list(businessId, filters) { },
  async create(businessId, data) { },
  async update(businessId, ticketId, data) { },
  async complete(businessId, ticketId, data) { },
  async callNext(businessId) { },
};
```

### Step 2: Custom Hooks
```javascript
// hooks/useQueue.js
export function useQueue(businessId) {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const refresh = useCallback(async () => {
    // Implementation
  }, [businessId]);
  
  return { tickets, loading, error, refresh };
}
```

### Step 3: Extract Components
```javascript
// components/LoadingButton.jsx
export function LoadingButton({ loading, children, ...props }) {
  return (
    <Button disabled={loading} {...props}>
      {loading ? <Loader2 className="animate-spin" /> : children}
    </Button>
  );
}
```

---

## Benefits

### Maintainability
- ✅ Smaller, focused files
- ✅ Clear separation of concerns
- ✅ Easy to find and fix bugs

### Testability
- ✅ Services can be tested independently
- ✅ Hooks can be tested in isolation
- ✅ Components are pure and predictable

### Reusability
- ✅ Hooks can be shared across pages
- ✅ Components are composable
- ✅ Services are reusable

### Scalability
- ✅ Easy to add new features
- ✅ Consistent patterns
- ✅ Less duplication

---

## File Structure (After Refactoring)

```
src/
├── components/
│   ├── common/
│   │   ├── LoadingButton.jsx
│   │   ├── ErrorBoundary.jsx
│   │   ├── EmptyState.jsx
│   │   └── StatusBadge.jsx
│   ├── queue/
│   │   ├── TicketCard.jsx
│   │   ├── QueueTable.jsx
│   │   ├── CompleteDialog.jsx
│   │   └── WalkInDialog.jsx
│   └── ui/ (existing shadcn components)
├── hooks/
│   ├── useQueue.js
│   ├── useBusinesses.js
│   ├── useCollections.js
│   ├── useForm.js
│   └── useAsync.js
├── services/
│   ├── queueService.js
│   ├── businessService.js
│   ├── authService.js
│   └── collectionsService.js
├── utils/
│   ├── validation.js
│   ├── formatters.js
│   └── constants.js
├── pages/ (refactored, smaller)
└── context/ (existing)
```

---

## Metrics

### Before Refactoring
- Dashboard.jsx: ~750 lines
- Collections.jsx: ~600 lines
- AdminPanel.jsx: ~1400 lines
- Duplicated code: High
- Test coverage: Low
- Component reuse: Low

### After Refactoring (Target)
- Dashboard.jsx: ~300 lines (60% reduction)
- Collections.jsx: ~250 lines (58% reduction)
- AdminPanel.jsx: ~600 lines (57% reduction)
- Duplicated code: Low
- Test coverage: High
- Component reuse: High

---

## Next Steps

1. ✅ Create services layer
2. ✅ Create custom hooks
3. ✅ Extract reusable components
4. ✅ Refactor Dashboard.jsx
5. ✅ Refactor Collections.jsx
6. ✅ Apply patterns to other pages
7. ✅ Add PropTypes/TypeScript
8. ✅ Write tests
9. ✅ Update documentation

---

This refactoring will make the codebase:
- **More maintainable** - Clear structure
- **More testable** - Isolated logic
- **More reusable** - Shared components
- **More scalable** - Easy to extend
