import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { DEFAULT_PLAN_LIMITS, getPlanId, normalizePlanCatalog } from "../lib/plans";

const PlanContext = createContext(null);

export function PlanProvider({ children }) {
  const [catalog, setCatalog] = useState(DEFAULT_PLAN_LIMITS);

  useEffect(() => {
    let active = true;
    async function loadPlans() {
      try {
        const { data } = await api.get("/plans");
        if (!active) return;
        setCatalog(normalizePlanCatalog(data?.plans || []));
      } catch {
        if (active) setCatalog(DEFAULT_PLAN_LIMITS);
      }
    }
    loadPlans();
    return () => {
      active = false;
    };
  }, []);

  const value = useMemo(() => ({
    catalog,
    setCatalog,
    getPlan: (user) => getPlanId(user),
    planLimits: (user) => catalog[getPlanId(user)] || catalog.free || DEFAULT_PLAN_LIMITS.free,
    isPaidPlan: (user) => {
      const id = getPlanId(user);
      return id === "premium" || id === "premium_plus";
    },
    planLabel: (user) => (catalog[getPlanId(user)] || catalog.free || DEFAULT_PLAN_LIMITS.free).label,
  }), [catalog]);

  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>;
}

export function usePlans() {
  const ctx = useContext(PlanContext);
  if (!ctx) throw new Error("usePlans must be used within PlanProvider");
  return ctx;
}
