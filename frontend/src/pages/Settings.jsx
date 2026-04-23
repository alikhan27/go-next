import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, formatApiErrorDetail } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import Navbar from "../components/Navbar";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Switch } from "../components/ui/switch";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";

export default function Settings() {
  const { auth, refresh } = useAuth();
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (auth && auth.business) {
      setForm({
        business_name: auth.business.business_name || "",
        business_type: auth.business.business_type || "salon",
        address: auth.business.address || "",
        city: auth.business.city || "",
        total_chairs: auth.business.total_chairs || 1,
        token_limit: auth.business.token_limit || 100,
        is_online: !!auth.business.is_online,
        station_label: auth.business.station_label || "Station",
      });
    }
  }, [auth]);

  if (!form) {
    return (
      <div className="min-h-screen bg-[#F9F8F6]">
        <Navbar />
        <div className="mx-auto max-w-2xl px-5 py-20 text-center text-stone-500">Loading…</div>
      </div>
    );
  }

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.patch("/business/me", {
        ...form,
        total_chairs: Number(form.total_chairs),
        token_limit: Number(form.token_limit),
      });
      await refresh();
      toast.success("Saved");
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F9F8F6]">
      <Navbar />
      <main className="mx-auto max-w-3xl px-5 py-10">
        <Link to="/dashboard" className="text-sm text-stone-500 hover:text-stone-800 inline-flex items-center gap-1" data-testid="back-to-dashboard">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to dashboard
        </Link>
        <h1 className="font-serif-display text-4xl mt-4">Salon settings</h1>
        <p className="text-stone-600 text-sm mt-1">Keep your business details up to date.</p>

        <form onSubmit={save} className="mt-8 space-y-5 rounded-2xl border border-stone-200 bg-white p-6 sm:p-8" data-testid="settings-form">
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>Business name</Label>
              <Input className="mt-1.5 h-11" value={form.business_name}
                onChange={(e) => set("business_name")(e.target.value)} data-testid="settings-name" />
            </div>
            <div>
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
              <Label>Stations / chairs</Label>
              <Input type="number" min="1" max="100" className="mt-1.5 h-11" value={form.total_chairs}
                onChange={(e) => set("total_chairs")(e.target.value)} data-testid="settings-chairs" />
            </div>
            <div>
              <Label>Daily token limit</Label>
              <Input type="number" min="1" max="1000" className="mt-1.5 h-11" value={form.token_limit}
                onChange={(e) => set("token_limit")(e.target.value)} data-testid="settings-token-limit" />
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
          </div>

          <Button type="submit" disabled={saving}
            className="rounded-full bg-[#2C302E] hover:bg-[#1d201f] text-white h-11 px-8 press"
            data-testid="settings-save">
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </form>
      </main>
    </div>
  );
}
