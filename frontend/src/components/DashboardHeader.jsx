import { Link, useNavigate, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { Button } from "./ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "./ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Plus, ChevronDown, LogOut, Building2, Sparkles } from "lucide-react";
import { LATEST_VERSION } from "../lib/releases";

const SEEN_KEY = "gonext:whatsnew:seen";

function useHasUnreadRelease() {
  const [unread, setUnread] = useState(false);
  useEffect(() => {
    const check = () => {
      try {
        setUnread(localStorage.getItem(SEEN_KEY) !== LATEST_VERSION);
      } catch {
        setUnread(false);
      }
    };
    check();
    const onStorage = (e) => {
      if (!e || e.key === SEEN_KEY) check();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("gonext:whatsnew-seen", check);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("gonext:whatsnew-seen", check);
    };
  }, []);
  return unread;
}

export default function DashboardHeader({ activeTab = "queue" }) {
  const { auth, logout } = useAuth();
  const navigate = useNavigate();
  const { businessId } = useParams();
  const businesses = auth?.businesses || [];
  const current = businesses.find((b) => b.id === businessId) || businesses[0];
  const hasUnread = useHasUnreadRelease();

  const switchOutlet = (id) => {
    if (!id) return;
    if (activeTab === "settings") navigate(`/dashboard/${id}/settings`);
    else if (activeTab === "analytics") navigate(`/dashboard/${id}/analytics`);
    else navigate(`/dashboard/${id}`);
  };

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  const tabs = [
    { key: "queue", label: "Live queue", to: `/dashboard/${current?.id || ""}` },
    { key: "analytics", label: "Analytics", to: `/dashboard/${current?.id || ""}/analytics` },
    { key: "settings", label: "Settings", to: `/dashboard/${current?.id || ""}/settings` },
  ];

  return (
    <header className="sticky top-0 z-40 backdrop-blur-xl bg-[#F9F8F6]/90 border-b border-stone-200/70" data-testid="dashboard-header">
      <div className="mx-auto max-w-6xl px-5 py-3 flex flex-wrap items-center gap-3">
        <Link to="/" className="flex items-center gap-2" data-testid="dashboard-brand">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#C47C5C] text-white font-serif-display">g</div>
          <span className="text-sm font-semibold">Go-Next</span>
        </Link>

        <Select value={current?.id || ""} onValueChange={switchOutlet}>
          <SelectTrigger className="h-9 w-[240px] rounded-full border-stone-300 bg-white" data-testid="outlet-switcher">
            <div className="flex items-center gap-2 truncate">
              <Building2 className="h-3.5 w-3.5 text-[#A86246] flex-none" />
              <SelectValue placeholder="Select outlet" />
            </div>
          </SelectTrigger>
          <SelectContent>
            {businesses.map((b) => (
              <SelectItem key={b.id} value={b.id} data-testid={`outlet-option-${b.id}`}>
                {b.business_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Link to="/dashboard/outlets" data-testid="nav-manage-outlets">
          <Button variant="ghost" size="sm" className="rounded-full text-stone-600 hover:text-stone-900">
            <Plus className="h-3.5 w-3.5 mr-1" /> Outlets
          </Button>
        </Link>

        <nav className="ml-auto hidden md:flex items-center gap-1">
          {tabs.map((t) => (
            <Link key={t.key} to={t.to} data-testid={`tab-${t.key}`}>
              <Button
                variant={activeTab === t.key ? "secondary" : "ghost"}
                size="sm"
                className={`rounded-full ${activeTab === t.key ? "bg-[#F4EFE8] text-[#A86246]" : "text-stone-600"}`}
              >
                {t.label}
              </Button>
            </Link>
          ))}
        </nav>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="rounded-full border-stone-300" data-testid="user-menu">
              <span className="hidden sm:inline mr-1.5 text-stone-700">{auth?.user?.name || "Account"}</span>
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <p className="font-medium">{auth?.user?.name}</p>
              <p className="text-xs text-stone-500">{auth?.user?.email}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate("/dashboard/outlets")} data-testid="menu-outlets">
              <Building2 className="h-4 w-4 mr-2" /> All outlets
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/dashboard/whats-new")} data-testid="menu-whats-new">
              <Sparkles className="h-4 w-4 mr-2" /> What&apos;s new
              {hasUnread && <span className="ml-auto h-2 w-2 rounded-full bg-[#C47C5C]" />}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleLogout} data-testid="menu-logout">
              <LogOut className="h-4 w-4 mr-2" /> Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Mobile tabs row */}
      <div className="md:hidden border-t border-stone-200/70 bg-white/60 px-5 py-2 flex gap-1 overflow-x-auto">
        {tabs.map((t) => (
          <Link key={t.key} to={t.to} data-testid={`mtab-${t.key}`}>
            <Button
              variant={activeTab === t.key ? "secondary" : "ghost"}
              size="sm"
              className={`rounded-full ${activeTab === t.key ? "bg-[#F4EFE8] text-[#A86246]" : "text-stone-600"}`}
            >
              {t.label}
            </Button>
          </Link>
        ))}
      </div>
    </header>
  );
}
