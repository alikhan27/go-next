import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { toast } from "sonner";
import { formatApiErrorDetail } from "../lib/api";

function slugify(s) {
  return (s || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 32);
}

export default function Register() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [form, setForm] = useState({
    owner_name: "",
    business_name: "",
    business_type: "salon",
    email: "",
    password: "",
    address: "",
    city: "",
    state: "",
    pincode: "",
  });
  const [loading, setLoading] = useState(false);

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await register(form);
      toast.success("Your business is live");
      navigate("/dashboard");
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || err.message);
    } finally {
      setLoading(false);
    }
  };

  const slug = slugify(form.business_name) || "your-business";

  return (
    <div className="min-h-screen bg-[#F9F8F6] px-5 py-10">
      <div className="mx-auto max-w-2xl">
        <Link to="/" className="inline-flex items-center gap-2" data-testid="register-brand">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#C47C5C] text-white font-serif-display">g</div>
          <span className="text-sm font-semibold">Go-Next</span>
        </Link>

        <h1 className="font-serif-display mt-10 text-4xl sm:text-5xl leading-tight">
          Create your business account.
        </h1>
        <p className="mt-3 max-w-lg text-stone-600">
          Takes under two minutes. We&apos;ll spin up your live queue board and a customer join link.
        </p>

        <div className="mt-6 rounded-xl border border-dashed border-[#C47C5C]/40 bg-[#F4EFE8]/60 px-4 py-3 text-xs text-stone-700" data-testid="register-url-preview">
          Your customer queue will live at{" "}
          <span className="font-medium text-[#A86246]">go-next.in/join/{slug}</span>
        </div>

        <form onSubmit={submit} className="mt-6 grid gap-5 sm:grid-cols-2 rounded-2xl border border-stone-200 bg-white p-6 sm:p-8" data-testid="register-form">
          <div className="sm:col-span-2">
            <Label>Your name</Label>
            <Input required className="mt-1.5 h-11" value={form.owner_name}
              onChange={(e) => set("owner_name")(e.target.value)} data-testid="register-owner-name" />
          </div>
          <div className="sm:col-span-2">
            <Label>Business name</Label>
            <Input required className="mt-1.5 h-11" value={form.business_name}
              onChange={(e) => set("business_name")(e.target.value)} data-testid="register-business-name" />
          </div>
          <div className="sm:col-span-2">
            <Label>Business type</Label>
            <Select value={form.business_type} onValueChange={set("business_type")}>
              <SelectTrigger className="mt-1.5 h-11" data-testid="register-business-type">
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
            <Label>Email</Label>
            <Input type="email" required className="mt-1.5 h-11" value={form.email}
              onChange={(e) => set("email")(e.target.value)} data-testid="register-email" />
          </div>
          <div>
            <Label>Password</Label>
            <Input type="password" required minLength={6} className="mt-1.5 h-11" value={form.password}
              onChange={(e) => set("password")(e.target.value)} data-testid="register-password" />
          </div>
          <div className="sm:col-span-2">
            <Label>Address</Label>
            <Input className="mt-1.5 h-11" value={form.address}
              onChange={(e) => set("address")(e.target.value)} data-testid="register-address" />
          </div>
          <div>
            <Label>City</Label>
            <Input className="mt-1.5 h-11" value={form.city}
              onChange={(e) => set("city")(e.target.value)} data-testid="register-city" />
          </div>
          <div>
            <Label>State <span className="text-[#A86246]">*</span></Label>
            <Input required className="mt-1.5 h-11" value={form.state}
              onChange={(e) => set("state")(e.target.value)} data-testid="register-state" />
          </div>
          <div className="sm:col-span-2">
            <Label>Pincode <span className="text-[#A86246]">*</span></Label>
            <Input required minLength={3} maxLength={12} className="mt-1.5 h-11"
              inputMode="numeric" value={form.pincode}
              onChange={(e) => set("pincode")(e.target.value)} data-testid="register-pincode" />
          </div>

          <Button type="submit" disabled={loading}
            className="sm:col-span-2 h-11 rounded-full bg-[#2C302E] hover:bg-[#1d201f] text-white press mt-2"
            data-testid="register-submit">
            {loading ? "Creating…" : "Create account"}
          </Button>
        </form>

        <p className="mt-6 text-sm text-stone-600">
          Already have one?{" "}
          <Link to="/login" className="text-[#A86246] underline underline-offset-4" data-testid="register-to-login">
            Sign in
          </Link>
        </p>
        <p className="mt-1 text-xs text-stone-500">
          Tip: You can set the number of stations / chairs later in Settings.
        </p>
      </div>
    </div>
  );
}
