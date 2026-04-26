import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
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
import { toast } from "sonner";
import { Check } from "lucide-react";
import { formatApiErrorDetail } from "../lib/api";
import { INDIA_STATES } from "../lib/constants";
import BrandLogo from "../components/LogoMark"; // Import BrandLogo from its actual file
import { useTheme } from "../context/ThemeContext"; // Import useTheme

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
  const { theme } = useTheme(); // Get theme from context
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
  const [registered, setRegistered] = useState(false);

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await register(form);
      setRegistered(true);
    } catch (err) {
      console.log("Full Register Error:", err);
      console.log("Response Data:", err?.response?.data);
      // If backend blocks login due to pending approval, show a clear message
      const detail = err?.response?.data?.detail;
      if (
        typeof detail === "string" &&
        detail.toLowerCase().includes("pending approval")
      ) {
        setRegistered(true);
      } else {
        toast.error(formatApiErrorDetail(detail) || err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const slug = slugify(form.business_name) || "your-business";

  const appAccentColor = theme?.vars?.["--app-accent"];

  return (
    <div className="min-h-screen bg-background px-5 py-10">
      <div className="mx-auto max-w-2xl">
        <Link
          to="/"
          className="inline-flex items-center gap-2"
          data-testid="register-brand"
        >
          <BrandLogo color={appAccentColor} />
        </Link>

        <h1 className="font-serif-display text-4xl sm:text-5xl leading-tight mt-5">
          Create your business account.
        </h1>
        <p className="mt-3 max-w-lg text-stone-600">
          Takes under two minutes. We&apos;ll spin up your live queue board and
          a customer join link.
        </p>

        {!registered && (
          <div
            className="mt-6 rounded-xl border border-dashed border-primary/40 bg-secondary/60 px-4 py-3 text-xs text-stone-700"
            data-testid="register-url-preview"
          >
            Your customer queue will live at{" "}
            <span className="font-medium text-primary">
              go-next.in/join/{slug}
            </span>
          </div>
        )}

        {!registered && (
          <form
            onSubmit={submit}
            className="mt-6 grid gap-5 sm:grid-cols-2 rounded-2xl border border-stone-200 bg-white p-6 sm:p-8"
            data-testid="register-form"
          >
            <div className="sm:col-span-2">
              <Label>Your name</Label>
              <Input
                required
                className="mt-1.5 h-11"
                value={form.owner_name}
                onChange={(e) => set("owner_name")(e.target.value)}
                data-testid="register-owner-name"
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Business name</Label>
              <Input
                required
                className="mt-1.5 h-11"
                value={form.business_name}
                onChange={(e) => set("business_name")(e.target.value)}
                data-testid="register-business-name"
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Business type</Label>
              <Select
                value={form.business_type}
                onValueChange={set("business_type")}
              >
                <SelectTrigger
                  className="mt-1.5 h-11"
                  data-testid="register-business-type"
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
            </div>
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                required
                className="mt-1.5 h-11"
                value={form.email}
                onChange={(e) => set("email")(e.target.value)}
                data-testid="register-email"
              />
            </div>
            <div>
              <Label>Password</Label>
              <Input
                type="password"
                required
                minLength={6}
                className="mt-1.5 h-11"
                value={form.password}
                onChange={(e) => set("password")(e.target.value)}
                data-testid="register-password"
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Address</Label>
              <Input
                className="mt-1.5 h-11"
                value={form.address}
                onChange={(e) => set("address")(e.target.value)}
                data-testid="register-address"
              />
            </div>
            <div>
              <Label>City</Label>
              <Input
                className="mt-1.5 h-11"
                value={form.city}
                onChange={(e) => set("city")(e.target.value)}
                data-testid="register-city"
              />
            </div>

            <div>
              <Label>
                State <span className="text-primary">*</span>
              </Label>
              <Select required value={form.state} onValueChange={set("state")}>
                <SelectTrigger
                  className="mt-1.5 h-11"
                  data-testid="register-state"
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
            </div>

            <div className="sm:col-span-2">
              <Label>
                Pincode <span className="text-primary">*</span>
              </Label>
              <Input
                required
                minLength={6}
                maxLength={6}
                className="mt-1.5 h-11"
                inputMode="numeric"
                placeholder="6-digit pincode"
                value={form.pincode}
                onChange={(e) =>
                  set("pincode")(e.target.value.replace(/\D/g, ""))
                }
                data-testid="register-pincode"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="sm:col-span-2 h-11 rounded-full bg-foreground hover:bg-foreground/90 text-white press mt-2"
              data-testid="register-submit"
            >
              {loading ? "Creating…" : "Create account"}
            </Button>
          </form>
        )}

        {registered && (
          <div className="mt-6 rounded-2xl border border-stone-200 bg-white p-8 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success/20">
              <Check className="h-8 w-8 text-success" />
            </div>
            <h2 className="mt-6 font-serif-display text-2xl">
              Thanks for registering!
            </h2>
            <p className="mt-3 text-stone-600">
              Your account is pending approval by our team. You'll receive an
              email once your account is activated.
            </p>
            <p className="mt-4 text-sm text-stone-500">
              This usually takes less than 24 hours.
            </p>
            <Button
              onClick={() => navigate("/login")}
              className="mt-6 h-11 rounded-full bg-foreground hover:bg-foreground/90 text-white press"
            >
              Go to Sign in
            </Button>
          </div>
        )}

        {!registered && (
          <>
            <p className="mt-6 text-sm text-stone-600">
              Already have one?{" "}
              <Link
                to="/login"
                className="text-primary underline underline-offset-4"
                data-testid="register-to-login"
              >
                Sign in
              </Link>
            </p>
            <p className="mt-1 text-xs text-stone-500">
              Tip: You can set the number of stations / chairs later in
              Settings.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
