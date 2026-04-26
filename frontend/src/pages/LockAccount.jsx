import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api, formatApiErrorDetail } from "../lib/api";
import { Button } from "../components/ui/button";
import { toast } from "sonner";
import { ArrowLeft, ShieldAlert, ShieldCheck } from "lucide-react";

export default function LockAccount() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(null);

  const submit = async () => {
    if (!token) {
      toast.error("Missing lock token in the link");
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post("/auth/lock-account", { token });
      setDone(data);
      toast.success("Account locked");
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-5 py-10">
      <div className="w-full max-w-md">
        <Link to="/login" className="text-sm text-stone-500 hover:text-stone-800 inline-flex items-center gap-1" data-testid="lock-back">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
        </Link>

        {!done ? (
          <div className="mt-5 rounded-2xl border border-red-200 bg-white p-6" data-testid="lock-confirm-card">
            <div className="flex items-start gap-3">
              <ShieldAlert className="h-6 w-6 text-red-600 mt-1 flex-none" />
              <div>
                <h1 className="font-serif-display text-3xl sm:text-4xl leading-tight">Freeze this account?</h1>
                <p className="mt-3 text-stone-600 text-sm">
                  Use this only if you didn&apos;t reset your own password. We&apos;ll immediately block sign-in and invalidate any outstanding reset links. You can regain access by contacting our team.
                </p>
              </div>
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              <Button onClick={submit} disabled={loading || !token}
                className="flex-1 h-11 rounded-full bg-red-600 hover:bg-red-500 text-white press"
                data-testid="lock-submit">
                {loading ? "Locking…" : "Lock my account"}
              </Button>
              <Button onClick={() => navigate("/")}
                variant="outline"
                className="flex-1 h-11 rounded-full border-stone-300"
                data-testid="lock-cancel">
                That was me
              </Button>
            </div>
            {!token && (
              <p className="mt-3 text-xs text-red-600 text-center">Missing token. Please use the link we sent.</p>
            )}
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-stone-200 bg-white p-6 text-center" data-testid="lock-success-card">
            <ShieldCheck className="h-10 w-10 text-red-600 mx-auto" />
            <h1 className="font-serif-display text-3xl mt-3">Account frozen</h1>
            <p className="mt-2 text-sm text-stone-600">
              Sign-in is blocked for <strong>{done.email}</strong>. Contact our team to restore access.
            </p>
            <Button onClick={() => navigate("/")}
              className="mt-6 w-full h-11 rounded-full bg-foreground hover:bg-foreground/90 text-white"
              data-testid="lock-home">
              Back to home
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
