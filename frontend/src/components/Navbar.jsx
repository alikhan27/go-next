import { Link, useNavigate } from "react-router-dom";
import { Button } from "./ui/button";
import { useAuth } from "../context/AuthContext";

export default function Navbar({ transparent = false }) {
  const { auth, logout } = useAuth();
  const navigate = useNavigate();
  const isAuthed = auth && auth !== true && auth.user;

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  return (
    <header
      className={`sticky top-0 z-50 w-full backdrop-blur-xl border-b border-stone-200/70 ${
        transparent ? "bg-white/60" : "bg-[#F9F8F6]/90"
      }`}
      data-testid="site-navbar"
    >
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-4">
        <Link to="/" className="flex items-center gap-2" data-testid="nav-brand">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#C47C5C] text-white font-serif-display text-lg">
            g
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold tracking-tight">Go-Next</p>
            <p className="text-[10px] uppercase tracking-[0.22em] text-stone-500">
              Calm queue platform
            </p>
          </div>
        </Link>

        <nav className="flex items-center gap-2">
          {!isAuthed ? (
            <>
              <Link to="/join/demo-salon" data-testid="nav-try-demo">
                <Button variant="ghost" className="rounded-full text-stone-700 hover:text-stone-900">
                  Try demo
                </Button>
              </Link>
              <Link to="/login" data-testid="nav-login">
                <Button variant="outline" className="rounded-full border-stone-300 hover:bg-stone-100">
                  Sign in
                </Button>
              </Link>
              <Link to="/register" data-testid="nav-register">
                <Button className="rounded-full bg-[#2C302E] hover:bg-[#1d201f] text-white press">
                  Create account
                </Button>
              </Link>
            </>
          ) : (
            <>
              <Link to="/dashboard" data-testid="nav-dashboard">
                <Button variant="outline" className="rounded-full border-stone-300">
                  Dashboard
                </Button>
              </Link>
              <Button
                onClick={handleLogout}
                variant="ghost"
                className="rounded-full text-stone-700"
                data-testid="nav-logout"
              >
                Logout
              </Button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
