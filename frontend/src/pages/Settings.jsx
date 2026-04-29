import { useEffect, useState } from "react";
import { useParams, Link, Navigate, useNavigate } from "react-router-dom";
import { api, formatApiErrorDetail } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { usePlans } from "../context/PlanContext";
import DashboardHeader from "../components/DashboardHeader";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Switch } from "../components/ui/switch";
import { Textarea } from "../components/ui/textarea";
import FormattedDate from "../components/common/FormattedDate";
import { toast } from "sonner";
import { ArrowLeft, Check, Clock } from "lucide-react";

export default function Settings() {
  const { businessId } = useParams();
  const navigate = useNavigate();
  const { auth, updateBusiness, updateUser } = useAuth();
  const { catalog, planLimits } = usePlans();
  const businesses = auth?.businesses || [];
  const business = businesses.find((b) => b.id === businessId);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [changingPlan, setChangingPlan] = useState(null);

  useEffect(() => {
    if (business) {
      setForm({
        business_name: business.business_name || "",
        address: business.address || "",
        city: business.city || "",
        state: business.state || "",
        pincode: business.pincode || "",
        total_chairs: business.total_chairs || 1,
        token_limit: business.token_limit || 100,
        is_online: !!business.is_online,
        station_label: business.station_label || "Station",
        offline_message: business.offline_message || "",
      });
    }
  }, [business]);

  if (auth === null) return null;
  if (!business) {
    if (businesses.length === 0) return <Navigate to="/dashboard/outlets" replace />;
    return <Navigate to={`/dashboard/${businesses[0].id}/settings`} replace />;
  }
  if (!form) return null;

  const limits = planLimits(auth?.user);
  const planOrder = ["free", "premium", "premium_plus"];
  const currentPlan = auth?.user?.plan || "free";
  const pendingPlan = auth?.user?.pending_plan;
  const currentPlanLabel = catalog[currentPlan]?.label || "Free";
  const expiryDate = auth?.user?.plan_expires_at
    ? auth.user.plan_expires_at
    : null;
  const daysRemaining = auth?.user?.plan_days_remaining;

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await api.patch(`/business/${business.id}`, {
        ...form,
        total_chairs: Number(form.total_chairs),
        token_limit: Number(form.token_limit),
      });
      updateBusiness(data);
      toast.success("Saved");
      navigate(`/dashboard/${business.id}`);
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || err.message);
    } finally {
      setSaving(false);
    }
  };

  const changePlan = async (plan) => {
    setChangingPlan(plan);
    try {
      const { data } = await api.post("/subscription/change", { plan });
      updateUser(data.user);
      toast.success(data.message || "Plan updated");
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || err.message);
    } finally {
      setChangingPlan(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader activeTab="settings" />
      <main className="mx-auto max-w-3xl px-5 py-10">
        <Link to={`/dashboard/${business.id}`} className="text-sm text-stone-500 hover:text-stone-800 inline-flex items-center gap-1" data-testid="back-to-dashboard">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to queue
        </Link>
        <h1 className="font-serif-display text-4xl mt-4">{business.business_name}</h1>
        <p className="text-stone-600 text-sm mt-1">Keep your outlet details up to date.</p>

        <section className="mt-8 rounded-2xl border border-stone-200 bg-white p-6 sm:p-8" data-testid="plan-settings">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-stone-400">Plan</p>
              <h2 className="mt-1 font-serif-display text-2xl">{currentPlanLabel}</h2>
              <div className="mt-2">
                {expiryDate ? (
                  <div className="flex flex-col gap-1">
                    <p className="text-sm text-stone-600">
                      {daysRemaining ?? 0} day{daysRemaining === 1 ? "" : "s"} left · Expires on:
                    </p>
                    <FormattedDate date={expiryDate} className="text-sm" />
                  </div>
                ) : (
                  <p className="text-sm text-stone-600">Free plan does not expire.</p>
                )}
              </div>
              {pendingPlan ? (
                <p className="mt-3 inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs text-primary">
                  <Clock className="h-3.5 w-3.5" />
                  Switches to {catalog[pendingPlan]?.label || pendingPlan} when this plan ends
                </p>
              ) : null}
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {planOrder.map((plan) => {
              const item = catalog[plan];
              const isCurrent = currentPlan === plan;
              const isPending = pendingPlan === plan;
              return (
                <div key={plan} className="rounded-xl border border-stone-200 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium">{item?.label}</p>
                    {isCurrent ? <Check className="h-4 w-4 text-success" /> : null}
                  </div>
                  <p className="mt-1 text-sm text-stone-500">
                    ${(item?.price_monthly ?? 0)} / month
                  </p>
                  <Button
                    type="button"
                    variant={isCurrent ? "outline" : "default"}
                    disabled={isCurrent || changingPlan === plan}
                    onClick={() => changePlan(plan)}
                    className={`mt-4 h-10 w-full rounded-full ${isCurrent ? "" : "bg-foreground text-white hover:bg-foreground/90"}`}
                    data-testid={`change-plan-${plan}`}
                  >
                    {isCurrent
                      ? "Current"
                      : isPending
                        ? "Scheduled"
                        : changingPlan === plan
                          ? "Saving..."
                          : planOrder.indexOf(plan) > planOrder.indexOf(currentPlan)
                            ? "Upgrade"
                            : "Downgrade"}
                  </Button>
                </div>
              );
            })}
          </div>
        </section>

        <form onSubmit={save} className="mt-6 space-y-5 rounded-2xl border border-stone-200 bg-white p-6 sm:p-8" data-testid="settings-form">
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>Business name</Label>
              <Input className="mt-1.5 h-11" value={form.business_name}
                onChange={(e) => set("business_name")(e.target.value)} data-testid="settings-name" />
            </div>
            <div className="sm:col-span-2">
              <Label>Address</Label>
              <Input className="mt-1.5 h-11" value={form.address}
                onChange={(e) => set("address")(e.target.value)} data-testid="settings-address" />
            </div>
            <div>
              <Label>City</Label>
              <Input className="mt-1.5 h-11" value={form.city}
                onChange={(e) => set("city")(e.target.value)} data-testid="settings-city" />
            </div>
            <div>
              <Label>State</Label>
              <Input className="mt-1.5 h-11" value={form.state}
                onChange={(e) => set("state")(e.target.value)} data-testid="settings-state" />
            </div>
            <div>
              <Label>Pincode</Label>
              <Input className="mt-1.5 h-11" value={form.pincode}
                onChange={(e) => set("pincode")(e.target.value)} data-testid="settings-pincode" />
            </div>
            <div>
              <Label>Stations / chairs</Label>
              <Input type="number" min="1" max={limits.max_stations} className="mt-1.5 h-11" value={form.total_chairs}
                onChange={(e) => set("total_chairs")(e.target.value)} data-testid="settings-chairs" />
              <p className="mt-1 text-xs text-stone-500">Up to {limits.max_stations} on your current plan.</p>
            </div>
            <div>
              <Label>Daily token limit</Label>
              <Input type="number" min="1" max={limits.max_tokens_per_day} className="mt-1.5 h-11" value={form.token_limit}
                onChange={(e) => set("token_limit")(e.target.value)} data-testid="settings-token-limit" />
              <p className="mt-1 text-xs text-stone-500">Up to {limits.max_tokens_per_day} / day on your current plan.</p>
            </div>
            <div className="sm:col-span-2">
              <Label>Station label</Label>
              <Input className="mt-1.5 h-11" placeholder="e.g. Chair, Bay, Room" value={form.station_label}
                onChange={(e) => set("station_label")(e.target.value)} data-testid="settings-station-label" />
              <p className="mt-1 text-xs text-stone-500">How you address each service spot in the dashboard.</p>
            </div>
            <div className="sm:col-span-2 flex items-center justify-between rounded-xl border border-stone-200 px-4 py-3">
              <div>
                <p className="text-sm font-medium">Accepting new guests</p>
                <p className="text-xs text-stone-500">Turn off to pause the queue after last call.</p>
              </div>
              <Switch checked={form.is_online} onCheckedChange={set("is_online")} data-testid="settings-online" />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="offline-message">Offline message</Label>
              <Textarea
                id="offline-message"
                className="mt-1.5 min-h-[88px] resize-none"
                maxLength={280}
                placeholder="e.g. Closed for lunch, back at 2 pm. Walk-ins welcome after."
                value={form.offline_message}
                onChange={(e) => set("offline_message")(e.target.value)}
                data-testid="settings-offline-message"
              />
              <p className="mt-1 text-xs text-stone-500">
                Shown to customers on the join page and lobby TV when the queue is paused. {form.offline_message?.length || 0}/280
              </p>
            </div>
          </div>

          <Button type="submit" disabled={saving}
            className="rounded-full bg-foreground hover:bg-foreground/90 text-white h-11 px-8 press"
            data-testid="settings-save">
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </form>
      </main>
    </div>
  );
}
