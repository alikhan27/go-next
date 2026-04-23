import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, formatApiErrorDetail } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import DashboardHeader from "../components/DashboardHeader";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "../components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "../components/ui/alert-dialog";
import { toast } from "sonner";
import { Plus, MapPin, Building2, ArrowRight, Trash2 } from "lucide-react";

export default function Outlets() {
  const { auth, addBusiness, removeBusiness } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    business_name: "",
    business_type: "salon",
    address: "",
    city: "",
    state: "",
    pincode: "",
  });

  const isPremium = auth?.user?.plan === "premium";
  const businesses = auth?.businesses || [];
  const maxOutlets = isPremium ? 10 : 1;
  const atLimit = businesses.length >= maxOutlets;

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await api.post("/business", form);
      addBusiness(data);
      toast.success(`${data.business_name} added`);
      setOpen(false);
      setForm({ business_name: "", business_type: "salon", address: "", city: "", state: "", pincode: "" });
      navigate(`/dashboard/${data.id}`);
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || err.message);
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
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || err.message);
    }
  };

  return (
    <div className="min-h-screen bg-[#F9F8F6]">
      <DashboardHeader activeTab="queue" />
      <main className="mx-auto max-w-6xl px-5 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.26em] text-[#A86246]">Outlets</p>
            <h1 className="font-serif-display text-4xl sm:text-5xl mt-2 leading-none">Your locations</h1>
            <p className="mt-2 text-stone-600 text-sm">
              {isPremium
                ? `Premium plan · up to ${maxOutlets} outlets.`
                : `Free plan · ${businesses.length} / ${maxOutlets} outlet used.`}
            </p>
          </div>
          <Dialog open={open} onOpenChange={(v) => !atLimit && setOpen(v)}>
            <DialogTrigger asChild>
              <Button
                className="rounded-full bg-[#2C302E] hover:bg-[#1d201f] text-white press disabled:opacity-40"
                disabled={atLimit}
                data-testid="new-outlet-btn"
                title={atLimit && !isPremium ? "Upgrade to Premium to add more outlets" : undefined}
              >
                <Plus className="h-4 w-4 mr-1.5" /> New outlet
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="font-serif-display text-2xl">Add a new outlet</DialogTitle>
                <DialogDescription>Each outlet gets its own queue, QR code and display.</DialogDescription>
              </DialogHeader>
              <form onSubmit={submit} className="space-y-4" data-testid="new-outlet-form">
                <div>
                  <Label>Business name</Label>
                  <Input required className="mt-1.5 h-11" value={form.business_name}
                    onChange={(e) => set("business_name")(e.target.value)} data-testid="new-outlet-name" />
                </div>
                <div>
                  <Label>Business type</Label>
                  <Select value={form.business_type} onValueChange={set("business_type")}>
                    <SelectTrigger className="mt-1.5 h-11" data-testid="new-outlet-type">
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
                </div>
                <div>
                  <Label>Address</Label>
                  <Input className="mt-1.5 h-11" value={form.address}
                    onChange={(e) => set("address")(e.target.value)} data-testid="new-outlet-address" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>City</Label>
                    <Input className="mt-1.5 h-11" value={form.city}
                      onChange={(e) => set("city")(e.target.value)} data-testid="new-outlet-city" />
                  </div>
                  <div>
                    <Label>State <span className="text-[#A86246]">*</span></Label>
                    <Input required className="mt-1.5 h-11" value={form.state}
                      onChange={(e) => set("state")(e.target.value)} data-testid="new-outlet-state" />
                  </div>
                </div>
                <div>
                  <Label>Pincode <span className="text-[#A86246]">*</span></Label>
                  <Input required className="mt-1.5 h-11" inputMode="numeric" value={form.pincode}
                    onChange={(e) => set("pincode")(e.target.value)} data-testid="new-outlet-pincode" />
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={saving}
                    className="rounded-full bg-[#2C302E] hover:bg-[#1d201f] text-white h-11 px-6"
                    data-testid="new-outlet-submit">
                    {saving ? "Creating…" : "Create outlet"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {!isPremium && atLimit && (
          <div className="mt-8 rounded-2xl border border-[#C47C5C]/40 bg-[#F4EFE8]/60 p-5 flex flex-wrap items-center justify-between gap-3" data-testid="upgrade-banner">
            <div>
              <p className="font-serif-display text-xl leading-tight">You&apos;re at your Free plan limit.</p>
              <p className="mt-1 text-sm text-stone-600">Upgrade to Premium to add up to 10 outlets, 100 stations, and full analytics.</p>
            </div>
            <Link to="/#pricing" data-testid="upgrade-banner-cta">
              <Button className="rounded-full bg-[#C47C5C] hover:bg-[#A86246] text-white h-10 px-5 press">
                See pricing
              </Button>
            </Link>
          </div>
        )}

        {businesses.length === 0 ? (
          <div className="mt-12 rounded-3xl border border-dashed border-stone-300 bg-white p-12 text-center">
            <Building2 className="mx-auto h-8 w-8 text-stone-400" />
            <h3 className="font-serif-display text-2xl mt-4">No outlets yet</h3>
            <p className="mt-2 text-sm text-stone-600">Add your first location to start taking walk-ins and remote joins.</p>
          </div>
        ) : (
          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3 stagger-in">
            {businesses.map((b) => (
              <div key={b.id}
                className="rounded-2xl border border-stone-200 bg-white p-6 flex flex-col transition press hover:-translate-y-1 hover:shadow-lg"
                data-testid={`outlet-card-${b.id}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.22em] text-[#A86246]">{b.business_type}</p>
                    <h3 className="font-serif-display text-2xl leading-tight mt-1">{b.business_name}</h3>
                  </div>
                  <span className={`h-2 w-2 mt-2 rounded-full ${b.is_online ? "bg-[#7D9276]" : "bg-stone-400"}`} />
                </div>
                <p className="mt-3 text-sm text-stone-600 flex items-start gap-1.5">
                  <MapPin className="h-3.5 w-3.5 mt-0.5 flex-none" />
                  <span>{[b.address, b.city, b.state, b.pincode].filter(Boolean).join(", ")}</span>
                </p>
                <div className="mt-4 flex items-center gap-3 text-xs text-stone-500">
                  <span>{b.total_chairs} station{b.total_chairs === 1 ? "" : "s"}</span>
                  <span>·</span>
                  <span>limit {b.token_limit}</span>
                </div>
                <div className="mt-6 flex items-center gap-2">
                  <Link to={`/dashboard/${b.id}`} className="flex-1" data-testid={`open-outlet-${b.id}`}>
                    <Button className="w-full rounded-full bg-[#2C302E] hover:bg-[#1d201f] text-white">
                      Open <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                    </Button>
                  </Link>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="text-stone-500 rounded-full" data-testid={`delete-outlet-${b.id}`}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remove {b.business_name}?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This deletes the outlet and all its queue history. This can&apos;t be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDelete(b.id)}
                          className="bg-red-600 hover:bg-red-500"
                          data-testid={`confirm-delete-outlet-${b.id}`}
                        >
                          Remove
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
