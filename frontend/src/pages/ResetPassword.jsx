import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api, formatApiErrorDetail } from "../lib/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2 } from "lucide-react";

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
      const { data } = await api.post("/auth/reset-password", { token, new_password: password });
      setDone(data);
      toast.success("Password updated");
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F9F8F6] flex items-center justify-center px-5 py-10">
      <div className="w-full max-w-md">
        <Link to="/login" className="text-sm text-stone-500 hover:text-stone-800 inline-flex items-center gap-1" data-testid="reset-back">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
        </Link>

        <h1 className="font-serif-display mt-5 text-4xl sm:text-5xl leading-tight">
          Set a new password
        </h1>
        <p className="mt-3 text-stone-600">
          Pick a password you&apos;ll remember. It must be at least 6 characters.
        </p>

        {!done ? (
          <form onSubmit={submit} className="mt-8 rounded-2xl border border-stone-200 bg-white p-6 space-y-4" data-testid="reset-form">
            <div>
              <Label>New password</Label>
              <Input type="password" required minLength={6} className="mt-1.5 h-11" value={password}
                onChange={(e) => setPassword(e.target.value)} data-testid="reset-new-password" />
            </div>
            <div>
              <Label>Confirm new password</Label>
              <Input type="password" required minLength={6} className="mt-1.5 h-11" value={confirm}
                onChange={(e) => setConfirm(e.target.value)} data-testid="reset-confirm-password" />
            </div>
            <Button type="submit" disabled={loading || !token}
              className="w-full h-11 rounded-full bg-[#2C302E] hover:bg-[#1d201f] text-white press"
              data-testid="reset-submit">
              {loading ? "Updating…" : "Update password"}
            </Button>
            {!token && (
              <p className="text-xs text-red-600 text-center">This page needs a reset link. Head back to <Link to="/forgot-password" className="underline">forgot password</Link>.</p>
            )}
          </form>
        ) : (
          <div className="mt-8 rounded-2xl border border-stone-200 bg-white p-6 text-center" data-testid="reset-success">
            <CheckCircle2 className="h-10 w-10 text-[#7D9276] mx-auto" />
            <p className="font-serif-display text-2xl mt-3">Password updated</p>
            <p className="mt-1 text-sm text-stone-600">You can now sign in with your new password.</p>
            <Button onClick={() => navigate("/login")}
              className="mt-6 w-full h-11 rounded-full bg-[#2C302E] hover:bg-[#1d201f] text-white press"
              data-testid="reset-to-login">
              Go to sign in
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
