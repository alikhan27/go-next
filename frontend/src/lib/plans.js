export const DEFAULT_PLAN_LIMITS = {
  free: {
    id: "free",
    name: "Free",
    label: "Free",
    price_monthly: 0,
    max_outlets: 1,
    max_stations: 3,
    max_tokens_per_day: 50,
    analytics_days: 7,
    can_manage_services: false,
    max_services: 0,
    features: [
      "1 outlet with up to 3 stations",
      "Up to 50 tokens per day",
      "Live queue board & customer QR",
      "Live customer ticket tracking",
      "Collections and analytics for last 7 days",
    ],
  },
  premium: {
    id: "premium",
    name: "Premium",
    label: "Premium",
    price_monthly: 19,
    max_outlets: 3,
    max_stations: 10,
    max_tokens_per_day: 200,
    analytics_days: 90,
    can_manage_services: true,
    max_services: 12,
    features: [
      "Up to 3 outlets",
      "Up to 10 stations per outlet",
      "Up to 200 tokens per day",
      "Custom services & accurate ETAs",
      "Public TV \"Now Serving\" display",
      "Collections filters up to 90 days",
      "Full 90-day analytics & heatmap",
      "Priority support",
    ],
  },
  premium_plus: {
    id: "premium_plus",
    name: "Premium Plus",
    label: "Premium Plus",
    price_monthly: 49,
    max_outlets: 25,
    max_stations: 10,
    max_tokens_per_day: 500,
    analytics_days: 180,
    can_manage_services: true,
    max_services: 30,
    features: [
      "Up to 25 outlets",
      "Up to 10 stations per outlet",
      "Up to 500 tokens per day",
      "Custom services & accurate ETAs",
      "Public TV \"Now Serving\" display",
      "Collections filters up to 180 days",
      "180-day analytics history",
      "Dedicated success manager",
    ],
  },
};

export function normalizePlanCatalog(plans = []) {
  const catalog = {
    free: { ...DEFAULT_PLAN_LIMITS.free },
    premium: { ...DEFAULT_PLAN_LIMITS.premium },
    premium_plus: { ...DEFAULT_PLAN_LIMITS.premium_plus },
  };
  for (const plan of plans) {
    if (!plan?.id || !catalog[plan.id]) continue;
    catalog[plan.id] = {
      ...catalog[plan.id],
      ...plan,
      features: Array.isArray(plan.features)
        ? plan.features.filter(Boolean)
        : catalog[plan.id].features,
    };
  }
  return catalog;
}

export function getPlanId(user) {
  const id = user?.plan || "free";
  return DEFAULT_PLAN_LIMITS[id] ? id : "free";
}
