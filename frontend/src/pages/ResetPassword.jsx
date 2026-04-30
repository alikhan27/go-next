import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api, formatApiErrorDetail } from "../lib/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, ShieldAlert, Copy } from "lucide-react";
import Navbar from "../components/Navbar";
import SiteFooter from "../components/SiteFooter";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    if (password !== confirm) {
      toast.error("Passwords don't match");
      return;
    }
    if (!token) {
      toast.error("Missing reset token in the link");
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post("/auth/reset-password", {
        token,
        new_password: password,
      });
      setDone(data);
      toast.success("Password updated");
    } catch (err) {
      toast.error(
        formatApiErrorDetail(err.response?.data?.detail) || err.message,
      );
    } finally {
      setLoading(false);
    }
  };

  const copyLink = (value) => {
    navigator.clipboard.writeText(value);
    toast.success("Link copied");
  };

  const openLocal = (absoluteUrl) => {
    const u = new URL(absoluteUrl);
    navigate(u.pathname + u.search);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <div className="flex-1 flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-md">
          <Link
            to="/login"
            className="text-sm text-stone-500 hover:text-stone-800 inline-flex items-center gap-1"
            data-testid="reset-back"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
          </Link>

          <h1 className="font-serif-display mt-5 text-4xl sm:text-5xl leading-tight">
            Set a new password
          </h1>
          <p className="mt-3 text-stone-600">
            Pick a password you&apos;ll remember. It must be at least 8
            characters.
          </p>

          {!done ? (
            <form
              onSubmit={submit}
              className="mt-8 rounded-2xl border border-stone-200 bg-white p-6 space-y-4"
              data-testid="reset-form"
            >
              <div>
                <Label>New password</Label>
                <Input
                  type="password"
                  required
                  minLength={8}
                  className="mt-1.5 h-11"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  data-testid="reset-new-password"
                />
              </div>
              <div>
                <Label>Confirm new password</Label>
                <Input
                  type="password"
                  required
                  minLength={8}
                  className="mt-1.5 h-11"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  data-testid="reset-confirm-password"
                />
              </div>
              <Button
                type="submit"
                disabled={loading || !token}
                className="w-full h-11 rounded-full bg-foreground hover:bg-foreground/90 text-white press"
                data-testid="reset-submit"
              >
                {loading ? "Updating…" : "Update password"}
              </Button>
              {!token && (
                <p className="text-xs text-red-600 text-center">
                  This page needs a reset link. Head back to{" "}
                  <Link to="/forgot-password" className="underline">
                    forgot password
                  </Link>
                  .
                </p>
              )}
            </form>
          ) : (
            <div
              className="mt-8 rounded-2xl border border-stone-200 bg-white p-6"
              data-testid="reset-success"
            >
              <div className="text-center">
                <CheckCircle2 className="h-10 w-10 text-success mx-auto" />
                <p className="font-serif-display text-2xl mt-3">
                  Password updated
                </p>
                <p className="mt-1 text-sm text-stone-600">
                  You can now sign in with your new password.
                </p>
              </div>

              <Button
                onClick={() => navigate("/login")}
                className="mt-6 w-full h-11 rounded-full bg-foreground hover:bg-foreground/90 text-white press"
                data-testid="reset-to-login"
              >
                Go to sign in
              </Button>

              {done.preview_lock_link && (
                <div
                  className="mt-6 rounded-xl border border-red-200 bg-red-50/60 p-4"
                  data-testid="lock-alert-card"
                >
                  <div className="flex items-start gap-2">
                    <ShieldAlert className="h-4 w-4 text-red-600 mt-0.5 flex-none" />
                    <div>
                      <p className="text-sm font-medium text-red-700">
                        Wasn&apos;t you?
                      </p>
                      <p className="text-xs text-stone-700 mt-1">
                        We&apos;d normally email a second link to lock your
                        account if this reset wasn&apos;t you. In preview
                        we&apos;re showing it here. Link is valid for{" "}
                        {done.lock_ttl_hours} hours and can only be used once.
                      </p>
                      <p
                        className="mt-2 text-[11px] text-stone-500 break-all"
                        data-testid="lock-preview-link"
                      >
                        {done.preview_lock_link}
                      </p>
                      <div className="mt-3 flex gap-2">
                        <Button
                          onClick={() => copyLink(done.preview_lock_link)}
                          variant="outline"
                          className="flex-1 rounded-full border-stone-300 bg-white"
                          data-testid="lock-preview-copy"
                        >
                          <Copy className="h-3.5 w-3.5 mr-1.5" /> Copy
                        </Button>
                        <Button
                          onClick={() => openLocal(done.preview_lock_link)}
                          variant="outline"
                          className="flex-1 rounded-full border-red-300 text-red-700 bg-white hover:bg-red-50"
                          data-testid="lock-preview-open"
                        >
                          Lock my account
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}
