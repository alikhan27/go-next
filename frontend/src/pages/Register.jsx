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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { formatApiErrorDetail } from "../lib/api";
import { INDIA_STATES } from "../lib/constants";
import { TERMS_OF_USE, PRIVACY_POLICY } from "../lib/legal";
import Navbar from "../components/Navbar";
import SiteFooter from "../components/SiteFooter";

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
  const [registered, setRegistered] = useState(false);
  const [errors, setErrors] = useState({});
  const [showTerms, setShowTerms] = useState(false);

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  const validate = () => {
    const newErrors = {};
    if (!form.owner_name.trim()) {
      newErrors.owner_name = "Your name is required";
    }
    if (!form.business_name.trim()) {
      newErrors.business_name = "Business name is required";
    }
    if (!form.business_type) {
      newErrors.business_type = "Business type is required";
    }
    if (!form.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^\S+@\S+\.\S+$/.test(form.email)) {
      newErrors.email = "Enter a valid email address";
    }
    if (!form.password) {
      newErrors.password = "Password is required";
    } else if (form.password.length < 8) {
      newErrors.password = "Password must be at least 8 characters";
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

  const getPasswordDetails = (password) => {
    if (!password) return null;
    let score = 0;
    const missing = [];

    if (password.length >= 8) score += 1;
    else missing.push("8+ chars");

    if (password.match(/[A-Z]/)) score += 1;
    else missing.push("uppercase");

    if (password.match(/[0-9]/)) score += 1;
    else missing.push("number");

    if (password.match(/[^a-zA-Z0-9]/)) score += 1;
    else missing.push("symbol");

    if (password.length < 8) {
      return {
        blocks: 1,
        color: "bg-destructive",
        tips: "Use at least 8 characters",
      };
    }
    if (score === 4) {
      return { blocks: 4, color: "bg-success", tips: null };
    }

    let color = "bg-destructive";
    if (score === 2) color = "bg-amber-500";
    else if (score === 3) color = "bg-primary";

    return {
      blocks: Math.max(1, score),
      color,
      tips: "Tip: Add " + missing.join(", "),
    };
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    // Open the terms dialog instead of submitting directly
    setShowTerms(true);
  };

  const handleAgreeAndRegister = async () => {
    setShowTerms(false);
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
  const pwdDetails = getPasswordDetails(form.password);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <div className="flex-1 px-5 py-10">
        <div className="mx-auto max-w-2xl">
          {!registered && (
            <>
              <h1 className="font-serif-display text-4xl sm:text-5xl leading-tight">
                Create your business account.
              </h1>
              <p className="mt-3 text-stone-600 max-w-lg">
                Takes under two minutes. We&apos;ll spin up your live queue
                board and a customer join link.
              </p>

              <div
                className="mt-6 rounded-xl border border-dashed border-primary/40 bg-secondary/60 px-4 py-3 text-xs text-stone-700"
                data-testid="register-url-preview"
              >
                Your customer queue will live at{" "}
                <span className="font-medium text-primary">
                  go-next.in/join/{slug}
                </span>
              </div>
            </>
          )}

          {!registered && (
            <form
              onSubmit={submit}
              className="mt-6 grid gap-5 sm:grid-cols-2 rounded-2xl border border-stone-200 bg-white p-6 sm:p-8"
              data-testid="register-form"
            >
              <div className="sm:col-span-2">
                <Label>
                  Your name <span className="text-primary">*</span>
                </Label>
                <Input
                  className={`mt-1.5 h-11 ${errors.owner_name ? "border-destructive focus:ring-destructive" : ""}`}
                  value={form.owner_name}
                  onChange={(e) => {
                    set("owner_name")(e.target.value);
                    clearError("owner_name");
                  }}
                  data-testid="register-owner-name"
                />
                {errors.owner_name && (
                  <p className="mt-1 text-sm text-destructive">
                    {errors.owner_name}
                  </p>
                )}
              </div>
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
                  data-testid="register-business-name"
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
                {errors.business_type && (
                  <p className="mt-1 text-sm text-destructive">
                    {errors.business_type}
                  </p>
                )}
              </div>
              <div>
                <Label>
                  Email <span className="text-primary">*</span>
                </Label>
                <Input
                  type="email"
                  className={`mt-1.5 h-11 ${errors.email ? "border-destructive focus:ring-destructive" : ""}`}
                  value={form.email}
                  onChange={(e) => {
                    set("email")(e.target.value);
                    clearError("email");
                  }}
                  data-testid="register-email"
                />
                {errors.email && (
                  <p className="mt-1 text-sm text-destructive">
                    {errors.email}
                  </p>
                )}
              </div>
              <div>
                <Label>
                  Password <span className="text-primary">*</span>
                </Label>
                <Input
                  type="password"
                  className={`mt-1.5 h-11 ${errors.password ? "border-destructive focus:ring-destructive" : ""}`}
                  value={form.password}
                  onChange={(e) => {
                    set("password")(e.target.value);
                    clearError("password");
                  }}
                  data-testid="register-password"
                />
                {errors.password ? (
                  <p className="mt-1 text-sm text-destructive">
                    {errors.password}
                  </p>
                ) : (
                  pwdDetails && (
                    <div className="mt-2 w-full">
                      <div className="flex gap-1.5 h-1.5 w-full">
                        {[1, 2, 3, 4].map((block) => (
                          <div
                            key={block}
                            className={`flex-1 rounded-full transition-colors duration-300 ${
                              block <= pwdDetails.blocks
                                ? pwdDetails.color
                                : "bg-stone-200"
                            }`}
                          />
                        ))}
                      </div>
                      {pwdDetails.tips && (
                        <p className="mt-1.5 text-[11px] text-stone-500 leading-snug">
                          {pwdDetails.tips}
                        </p>
                      )}
                    </div>
                  )
                )}
              </div>
              <div className="sm:col-span-2">
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
                  data-testid="register-address"
                />
                {errors.address && (
                  <p className="mt-1 text-sm text-destructive">
                    {errors.address}
                  </p>
                )}
              </div>
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
                      setErrors((prev) => ({
                        ...prev,
                        city: "City cannot contain numbers",
                      }));
                    } else {
                      clearError("city");
                    }
                  }}
                  data-testid="register-city"
                />
                {errors.city && (
                  <p className="mt-1 text-sm text-destructive">{errors.city}</p>
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
                {errors.state && (
                  <p className="mt-1 text-sm text-destructive">
                    {errors.state}
                  </p>
                )}
              </div>

              <div>
                <Label>
                  Pincode <span className="text-primary">*</span>
                </Label>
                <Input
                  maxLength={6}
                  className={`mt-1.5 h-11 ${errors.pincode ? "border-destructive focus:ring-destructive" : ""}`}
                  inputMode="numeric"
                  placeholder="6-digit pincode"
                  value={form.pincode}
                  onChange={(e) => {
                    set("pincode")(e.target.value.replace(/\D/g, ""));
                    clearError("pincode");
                  }}
                  data-testid="register-pincode"
                />
                {errors.pincode && (
                  <p className="mt-1 text-sm text-destructive">
                    {errors.pincode}
                  </p>
                )}
              </div>

              <div className="flex items-end mt-2 sm:mt-0">
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full sm:w-auto px-8 h-11 rounded-full bg-foreground hover:bg-foreground/90 text-white press"
                  data-testid="register-submit"
                >
                  {loading ? "Creating…" : "Create account"}
                </Button>
              </div>
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

      {/* Terms and Conditions Dialog */}
      <Dialog open={showTerms} onOpenChange={setShowTerms}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col overflow-hidden p-0 sm:p-6">
          <DialogHeader className="px-6 pt-6 sm:p-0">
            <DialogTitle className="font-serif-display text-2xl">
              Terms & Privacy Policy
            </DialogTitle>
            <DialogDescription>
              Please review our terms before creating your account.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 sm:px-0 py-4 space-y-8">
            <div>
              <h3 className="text-lg font-semibold text-stone-900 mb-3">
                Terms of Use
              </h3>
              <div className="space-y-4">
                {TERMS_OF_USE.map((section, idx) => (
                  <div key={`term-${idx}`}>
                    <h4 className="font-medium text-sm text-stone-800">
                      {section.heading}
                    </h4>
                    <p className="text-sm text-stone-600 mt-1">
                      {section.body}
                    </p>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-stone-900 mb-3">
                Privacy Policy
              </h3>
              <div className="space-y-4">
                {PRIVACY_POLICY.map((section, idx) => (
                  <div key={`privacy-${idx}`}>
                    <h4 className="font-medium text-sm text-stone-800">
                      {section.heading}
                    </h4>
                    <p className="text-sm text-stone-600 mt-1">
                      {section.body}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="px-6 pb-6 sm:p-0 pt-4 border-t border-stone-200 mt-auto">
            <Button
              variant="outline"
              onClick={() => setShowTerms(false)}
              className="rounded-full"
            >
              Cancel
            </Button>
            <Button
              onClick={handleAgreeAndRegister}
              className="rounded-full bg-foreground hover:bg-foreground/90 text-white press"
            >
              I Agree, Create Account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SiteFooter />
    </div>
  );
}
