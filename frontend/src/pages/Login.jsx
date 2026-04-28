import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { toast } from "sonner";
import { formatApiErrorDetail } from "../lib/api";
import BrandLogo from "../components/LogoMark";
import { useTheme } from "../context/ThemeContext";

export default function Login() {
  const { theme } = useTheme();
  const appAccentColor = theme?.vars?.["--app-accent"];
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState("demo@go-next.in");
  const [password, setPassword] = useState("admin123");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await login(email, password);
      toast.success("Welcome back");
      if (data?.user?.role === "super_admin") {
        navigate("/admin");
      } else {
        navigate("/dashboard");
      }
    } catch (err) {
      toast.error(
        formatApiErrorDetail(err.response?.data?.detail) || err.message,
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid md:grid-cols-2 bg-background">
      <div className="relative hidden md:block">
        <img
          src="https://images.pexels.com/photos/7195812/pexels-photo-7195812.jpeg"
          alt="Salon"
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-primary/30 via-transparent to-foreground/40" />
        <div className="absolute bottom-10 left-10 right-10 text-white">
          <p className="text-[11px] uppercase tracking-[0.26em]">Go-Next</p>
          <p className="font-serif-display text-4xl leading-tight mt-3">
            “The chairs keep filling themselves now.”
          </p>
          <p className="mt-3 text-sm text-white/80">— Amara, studio owner</p>
        </div>
      </div>

      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <Link
            to="/"
            className="inline-flex items-center gap-2"
            data-testid="login-brand"
          >
            <BrandLogo color={appAccentColor} />
          </Link>

          <h1 className="font-serif-display mt-8 text-4xl leading-tight">
            Welcome back.
          </h1>
          <p className="mt-2 text-sm text-stone-600">
            Sign in to manage your queue.
          </p>

          <form
            onSubmit={handleSubmit}
            className="mt-8 space-y-4"
            data-testid="login-form"
          >
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="mt-1.5 h-11"
                data-testid="login-email"
              />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="mt-1.5 h-11"
                data-testid="login-password"
              />
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-full bg-foreground hover:bg-foreground/90 text-white press"
              data-testid="login-submit"
            >
              {loading ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          <p className="mt-6 text-sm text-stone-600">
            New here?{" "}
            <Link
              to="/register"
              className="text-primary underline underline-offset-4"
              data-testid="login-to-register"
            >
              Create your business account
            </Link>
          </p>
          <p className="mt-1 text-sm text-stone-600">
            <Link
              to="/forgot-password"
              className="text-primary underline underline-offset-4"
              data-testid="login-forgot-password"
            >
              Forgot your password?
            </Link>
          </p>
          <p className="mt-2 text-xs text-stone-500">
            Demo owner: demo@go-next.in · Demo@1234
          </p>
        </div>
      </div>
    </div>
  );
}
