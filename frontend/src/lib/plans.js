/**
 * Plan limits — keep in sync with /app/backend/app/config.py PLAN_LIMITS.
 * Used for client-side gating only; the backend is the source of truth.
 */
export const PLAN_LIMITS = {
  free: {
    label: "Free",
    max_outlets: 1,
    max_stations: 3,
    max_tokens_per_day: 50,
    can_manage_services: false,
    max_services: 0,
  },
  premium: {
    label: "Premium",
    max_outlets: 3,
    max_stations: 10,
    max_tokens_per_day: 200,
    can_manage_services: true,
    max_services: 12,
  },
  premium_plus: {
    label: "Premium Plus",
    max_outlets: 25,
    max_stations: 10,
    max_tokens_per_day: 500,
    can_manage_services: true,
    max_services: 30,
  },
};

const FALLBACK = PLAN_LIMITS.free;

export function getPlan(user) {
  const id = user?.plan || "free";
  return PLAN_LIMITS[id] ? id : "free";
}

export function planLimits(user) {
  return PLAN_LIMITS[getPlan(user)] || FALLBACK;
}

export function isPaidPlan(user) {
  const id = getPlan(user);
  return id === "premium" || id === "premium_plus";
}

export function planLabel(user) {
  return planLimits(user).label;
}
