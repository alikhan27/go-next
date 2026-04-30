import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, formatApiErrorDetail } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { usePlans } from "../context/PlanContext";
import DashboardHeader from "../components/DashboardHeader";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../components/ui/dialog";
import ConfirmDialog from "../components/common/ConfirmDialog";
import { toast } from "sonner";
import { Plus, MapPin, Building2, ArrowRight, Trash2 } from "lucide-react";
import { INDIA_STATES } from "../lib/constants"; // Import INDIA_STATES

export default function Outlets() {
  const { auth, addBusiness, removeBusiness } = useAuth();
  const { isPaidPlan, planLimits, planLabel } = usePlans();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [form, setForm] = useState({
    business_name: "",
    business_type: "salon",
    address: "",
    city: "",
    state: "",
    pincode: "",
  });

  const isPremium = isPaidPlan(auth?.user);
  const businesses = auth?.businesses || [];
  const limits = planLimits(auth?.user);
  const maxOutlets = limits.max_outlets;
  const atLimit = businesses.length >= maxOutlets;

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  const validate = () => {
    const newErrors = {};
    if (!form.business_name.trim()) {
      newErrors.business_name = "Business name is required";
    }
    if (!form.business_type) {
      newErrors.business_type = "Business type is required";
    }
    if (!form.address.trim()) {
      newErrors.address = "Address is required";
    }
    if (!form.city.trim()) {
      newErrors.city = "City is required";
    } else if (/\d/.test(form.city)) {
      newErrors.city = "City cannot contain numbers";
    } else if (form.city && form.city.length > 50) {
      newErrors.city = "City name is too long";
    }
    if (!form.state) {
      newErrors.state = "State is required";
    }
    if (!form.pincode.trim()) {
      newErrors.pincode = "Pincode is required";
    } else if (!/^\d{6}$/.test(form.pincode.trim())) {
      newErrors.pincode = "Enter a valid 6-digit pincode";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const clearError = (field) => {
    setErrors((e) => ({ ...e, [field]: undefined }));
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      const { data } = await api.post("/business", form);
      addBusiness(data);
      toast.success(`${data.business_name} added`);
      setOpen(false);
      setForm({
        business_name: "",
        business_type: "salon",
        address: "",
        city: "",
        state: "",
        pincode: "",
      });
      setErrors({});
      navigate(`/dashboard/${data.id}`);
    } catch (err) {
      toast.error(
        formatApiErrorDetail(err.response?.data?.detail) || err.message,
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/business/${id}`);
      removeBusiness(id);
      toast.success("Outlet removed");
    } catch (err) {
      toast.error(
        formatApiErrorDetail(err.response?.data?.detail) || err.message,
      );
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader activeTab="queue" />
      <main className="mx-auto max-w-6xl px-5 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.26em] text-primary">
              Outlets
            </p>
            <h1 className="font-serif-display text-4xl sm:text-5xl mt-2 leading-none">
              Your locations
            </h1>
            <p className="mt-2 text-stone-600 text-sm">
              {isPremium
                ? `${planLabel(auth?.user)} plan · up to ${maxOutlets} outlet${maxOutlets === 1 ? "" : "s"}.`
                : `Free plan · ${businesses.length} / ${maxOutlets} outlet used.`}
            </p>
          </div>
          <Dialog
            open={open}
            onOpenChange={(v) => {
              if (!v) setErrors({});
              setOpen(v);
            }}
          >
            <DialogTrigger asChild>
              <Button
                className="rounded-full bg-foreground hover:bg-foreground/90 text-white press disabled:opacity-40"
                disabled={atLimit}
                data-testid="new-outlet-btn"
                title={
                  atLimit && !isPremium
                    ? "Upgrade to Premium to add more outlets"
                    : undefined
                }
              >
                <Plus className="h-4 w-4 mr-1.5" /> New outlet
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="font-serif-display text-2xl">
                  Add a new outlet
                </DialogTitle>
                <DialogDescription>
                  Each outlet gets its own queue, QR code and display.
                </DialogDescription>
              </DialogHeader>
              <form
                onSubmit={submit}
                className="space-y-4"
                data-testid="new-outlet-form"
              >
                <div>
                  <Label>
                    Business name <span className="text-primary">*</span>
                  </Label>
                  <Input
                    className={`mt-1.5 h-11 ${errors.business_name ? "border-destructive focus:ring-destructive" : ""}`}
                    value={form.business_name}
                    onChange={(e) => {
                      set("business_name")(e.target.value);
                      clearError("business_name");
                    }}
                    data-testid="new-outlet-name"
                  />
                  {errors.business_name && (
                    <p className="mt-1 text-sm text-destructive">
                      {errors.business_name}
                    </p>
                  )}
                </div>
                <div>
                  <Label>
                    Business type <span className="text-primary">*</span>
                  </Label>
                  <Select
                    value={form.business_type}
                    onValueChange={(v) => {
                      set("business_type")(v);
                      clearError("business_type");
                    }}
                  >
                    <SelectTrigger
                      className={`mt-1.5 h-11 ${errors.business_type ? "border-destructive focus:ring-destructive" : ""}`}
                      data-testid="new-outlet-type"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="salon">Salon / Barbershop</SelectItem>
                      <SelectItem value="clinic">Clinic</SelectItem>
                      <SelectItem value="spa">Spa / Wellness</SelectItem>
                      <SelectItem value="restaurant">Restaurant</SelectItem>
                      <SelectItem value="retail">Retail</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.business_type && (
                    <p className="mt-1 text-sm text-destructive">
                      {errors.business_type}
                    </p>
                  )}
                </div>
                <div>
                  <Label>
                    Address <span className="text-primary">*</span>
                  </Label>
                  <Input
                    className={`mt-1.5 h-11 ${errors.address ? "border-destructive focus:ring-destructive" : ""}`}
                    value={form.address}
                    onChange={(e) => {
                      set("address")(e.target.value);
                      clearError("address");
                    }}
                    data-testid="new-outlet-address"
                  />
                  {errors.address && (
                    <p className="mt-1 text-sm text-destructive">
                      {errors.address}
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>
                      City <span className="text-primary">*</span>
                    </Label>
                    <Input
                      className={`mt-1.5 h-11 ${errors.city ? "border-destructive focus:ring-destructive" : ""}`}
                      value={form.city}
                      onChange={(e) => {
                        const val = e.target.value;
                        set("city")(val);
                        if (/\d/.test(val)) {
                          setErrors((prev) => ({ ...prev, city: "City cannot contain numbers" }));
                        } else {
                          clearError("city");
                        }
                      }}
                      data-testid="new-outlet-city"
                    />
                    {errors.city && (
                      <p className="mt-1 text-sm text-destructive">
                        {errors.city}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label>
                      State <span className="text-primary">*</span>
                    </Label>
                    <Select
                      value={form.state}
                      onValueChange={(v) => {
                        set("state")(v);
                        clearError("state");
                      }}
                    >
                      <SelectTrigger
                        className={`mt-1.5 h-11 ${errors.state ? "border-destructive focus:ring-destructive" : ""}`}
                        data-testid="new-outlet-state"
                      >
                        <SelectValue placeholder="Select state" />
                      </SelectTrigger>
                      <SelectContent className="max-h-64">
                        {INDIA_STATES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.state && (
                      <p className="mt-1 text-sm text-destructive">
                        {errors.state}
                      </p>
                    )}
                  </div>
                </div>
                <div>
                  <Label>
                    Pincode <span className="text-primary">*</span>
                  </Label>
                  <Input
                    className={`mt-1.5 h-11 ${errors.pincode ? "border-destructive focus:ring-destructive" : ""}`}
                    inputMode="numeric"
                    value={form.pincode}
                    onChange={(e) => {
                      set("pincode")(e.target.value);
                      clearError("pincode");
                    }}
                    data-testid="new-outlet-pincode"
                    maxLength={6}
                  />
                  {errors.pincode && (
                    <p className="mt-1 text-sm text-destructive">
                      {errors.pincode}
                    </p>
                  )}
                </div>
                <DialogFooter>
                  <Button
                    type="submit"
                    disabled={saving}
                    className="rounded-full bg-foreground hover:bg-foreground/90 text-white h-11 px-6"
                    data-testid="new-outlet-submit"
                  >
                    {saving ? "Creating…" : "Create outlet"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {!isPremium && atLimit && (
          <div
            className="mt-8 rounded-2xl border border-primary/40 bg-secondary/60 p-5 flex flex-wrap items-center justify-between gap-3"
            data-testid="upgrade-banner"
          >
            <div>
              <p className="font-serif-display text-xl leading-tight">
                You&apos;re at your Free plan limit.
              </p>
              <p className="mt-1 text-sm text-stone-600">
                Upgrade to Premium for 3 outlets, custom services with accurate
                ETAs, and a 90-day analytics history.
              </p>
            </div>
            <Link to="/#pricing" data-testid="upgrade-banner-cta">
              <Button className="rounded-full bg-primary hover:bg-primary/90 text-white h-10 px-5 press">
                See pricing
              </Button>
            </Link>
          </div>
        )}

        {businesses.length === 0 ? (
          <div className="mt-12 rounded-3xl border border-dashed border-stone-300 bg-white p-12 text-center">
            <Building2 className="mx-auto h-8 w-8 text-stone-400" />
            <h3 className="font-serif-display text-2xl mt-4">No outlets yet</h3>
            <p className="mt-2 text-sm text-stone-600">
              Add your first location to start taking walk-ins and remote joins.
            </p>
          </div>
        ) : (
          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3 stagger-in">
            {businesses.map((b) => (
              <div
                key={b.id}
                className="rounded-2xl border border-stone-200 bg-white p-6 flex flex-col transition press hover:-translate-y-1 hover:shadow-lg"
                data-testid={`outlet-card-${b.id}`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.22em] text-primary">
                      {b.business_type}
                    </p>
                    <h3 className="font-serif-display text-2xl leading-tight mt-1">
                      {b.business_name}
                    </h3>
                  </div>
                  <span
                    className={`h-2 w-2 mt-2 rounded-full ${b.is_online ? "bg-success" : "bg-stone-400"}`}
                  />
                </div>
                <p className="mt-3 text-sm text-stone-600 flex items-start gap-1.5">
                  <MapPin className="h-3.5 w-3.5 mt-0.5 flex-none" />
                  <span>
                    {[b.address, b.city, b.state, b.pincode]
                      .filter(Boolean)
                      .join(", ")}
                  </span>
                </p>
                <div className="mt-4 flex items-center gap-3 text-xs text-stone-500">
                  <span>
                    {b.total_chairs} station{b.total_chairs === 1 ? "" : "s"}
                  </span>
                  <span>·</span>
                  <span>limit {b.token_limit}</span>
                </div>
                <div className="mt-6 flex items-center gap-2">
                  <Link
                    to={`/dashboard/${b.id}`}
                    className="flex-1"
                    data-testid={`open-outlet-${b.id}`}
                  >
                    <Button className="w-full rounded-full bg-foreground hover:bg-foreground/90 text-white">
                      Open <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                    </Button>
                  </Link>
                  <ConfirmDialog
                    trigger={
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-stone-500 rounded-full"
                        data-testid={`delete-outlet-${b.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    }
                    title={`Remove ${b.business_name}?`}
                    description="Warning: This permanently deletes the outlet, its services, and all queue history. Please ensure you have taken a backup before proceeding. This cannot be undone."
                    confirmLabel="Remove"
                    onConfirm={() => handleDelete(b.id)}
                    testidPrefix={`confirm-delete-outlet-${b.id}`}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
