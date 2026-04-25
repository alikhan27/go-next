import { Link, useNavigate, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useTheme, THEMES } from "../context/ThemeContext";
import { Button } from "./ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import {
  Plus,
  ChevronDown,
  LogOut,
  Building2,
  Sparkles,
  Settings,
  Briefcase,
  Wallet,
} from "lucide-react";
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
  const { theme } = useTheme();
  const navigate = useNavigate();
  const { businessId } = useParams();
  const businesses = auth?.businesses || [];
  const current = businesses.find((b) => b.id === businessId) || businesses[0];
  const hasUnread = useHasUnreadRelease();

  // Get current theme colors directly
  const t = THEMES.find((t) => t.id === theme.theme_id) || THEMES[0];
  const c = t.vars;
  const switchOutlet = (id) => {
    if (!id) return;
    if (activeTab === "settings") navigate(`/dashboard/${id}/settings`);
    else if (activeTab === "analytics") navigate(`/dashboard/${id}/analytics`);
    else if (activeTab === "collections") navigate(`/dashboard/${id}/collections`);
    else if (activeTab === "services") navigate(`/dashboard/${id}/services`);
    else navigate(`/dashboard/${id}`);
  };

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  const tabs = [
    {
      key: "queue",
      label: "Live queue",
      to: `/dashboard/${current?.id || ""}`,
    },
    {
      key: "analytics",
      label: "Analytics",
      to: `/dashboard/${current?.id || ""}/analytics`,
    },
    {
      key: "collections",
      label: "Collections",
      to: `/dashboard/${current?.id || ""}/collections`,
    },
  ];

  return (
    <header
      className="sticky top-0 z-40 backdrop-blur-xl border-b"
      style={{
        background: c["--app-bg"] + "e6",
        borderColor: c["--app-border"],
      }}
      data-testid="dashboard-header"
    >
      <div className="mx-auto max-w-6xl px-5 py-3 flex flex-wrap items-center gap-3">
        <Link
          to="/"
          className="flex items-center gap-2"
          data-testid="dashboard-brand"
        >
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full text-white font-serif-display"
            style={{ background: c["--app-accent"] }}
          >
            g
          </div>
          <span
            className="text-sm font-semibold"
            style={{ color: c["--app-text"] }}
          >
            Go-Next
          </span>
        </Link>

        <Select value={current?.id || ""} onValueChange={switchOutlet}>
          <SelectTrigger
            className="h-9 w-[240px] rounded-full border"
            style={{
              borderColor: c["--app-border"],
              background: c["--app-surface"],
              color: c["--app-text"],
            }}
            data-testid="outlet-switcher"
          >
            <div className="flex items-center gap-2 truncate">
              <Building2
                className="h-3.5 w-3.5 flex-none"
                style={{ color: c["--app-accent-text"] }}
              />
              <SelectValue placeholder="Select outlet" />
            </div>
          </SelectTrigger>
          <SelectContent>
            {businesses.map((b) => (
              <SelectItem
                key={b.id}
                value={b.id}
                data-testid={`outlet-option-${b.id}`}
              >
                {b.business_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Link to="/dashboard/outlets" data-testid="nav-manage-outlets">
          <Button
            variant="ghost"
            size="sm"
            className="rounded-full"
            style={{ color: c["--app-text-muted"] }}
          >
            <Plus className="h-3.5 w-3.5 mr-1" /> Outlets
          </Button>
        </Link>

        {auth?.user?.plan &&
          (() => {
            const p = auth.user.plan;
            const isPremiumPlus = p === "premium_plus";
            const isPremium = p === "premium";
            const label = isPremiumPlus
              ? "Premium+"
              : isPremium
                ? "Premium"
                : "Free plan";
            const style = isPremiumPlus
              ? {
                  background: c["--app-text"],
                  color: c["--app-bg"],
                  borderColor: c["--app-text"],
                }
              : isPremium
                ? {
                    background: c["--app-accent"] + "1a",
                    color: c["--app-accent-text"],
                    borderColor: c["--app-accent"] + "4d",
                  }
                : {
                    background: c["--app-border"],
                    color: c["--app-text-muted"],
                    borderColor: c["--app-border"],
                  };
            return (
              <span
                className="hidden md:inline-flex items-center rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.22em] border"
                style={style}
                data-testid="plan-badge"
              >
                {label}
              </span>
            );
          })()}

        <nav className="ml-auto hidden md:flex items-center gap-1">
          {tabs.map((tab) => (
            <Link key={tab.key} to={tab.to} data-testid={`tab-${tab.key}`}>
              <Button
                variant="ghost"
                size="sm"
                className="rounded-full"
                style={
                  activeTab === tab.key
                    ? {
                        background: c["--app-accent"] + "26",
                        color: c["--app-accent-text"],
                      }
                    : { color: c["--app-text-muted"] }
                }
              >
                {tab.label}
              </Button>
            </Link>
          ))}
        </nav>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="rounded-full"
              style={{
                borderColor: c["--app-border"],
                color: c["--app-text"],
                background: c["--app-surface"],
              }}
              data-testid="user-menu"
            >
              <span className="hidden sm:inline mr-1.5">
                {auth?.user?.name || "Account"}
              </span>
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <p className="font-medium">{auth?.user?.name}</p>
              <p className="text-xs text-stone-500">{auth?.user?.email}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => navigate("/dashboard/outlets")}
              data-testid="menu-outlets"
            >
              <Building2 className="h-4 w-4 mr-2" /> All outlets
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() =>
                current && navigate(`/dashboard/${current.id}/services`)
              }
              disabled={!current}
              data-testid="menu-services"
            >
              <Briefcase className="h-4 w-4 mr-2" /> Services
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() =>
                current && navigate(`/dashboard/${current.id}/collections`)
              }
              disabled={!current}
              data-testid="menu-collections"
            >
              <Wallet className="h-4 w-4 mr-2" /> Collections
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() =>
                current && navigate(`/dashboard/${current.id}/settings`)
              }
              disabled={!current}
              data-testid="menu-settings"
            >
              <Settings className="h-4 w-4 mr-2" /> Settings
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => navigate("/dashboard/whats-new")}
              data-testid="menu-whats-new"
            >
              <Sparkles className="h-4 w-4 mr-2" /> What&apos;s new
              {hasUnread && (
                <span
                  className="ml-auto h-2 w-2 rounded-full"
                  style={{ background: c["--app-accent"] }}
                />
              )}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleLogout} data-testid="menu-logout">
              <LogOut className="h-4 w-4 mr-2" /> Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Mobile tabs */}
      <div
        className="md:hidden border-t px-5 py-2 flex gap-1 overflow-x-auto"
        style={{
          borderColor: c["--app-border"],
          background: c["--app-surface"] + "99",
        }}
      >
        {tabs.map((tab) => (
          <Link key={tab.key} to={tab.to} data-testid={`mtab-${tab.key}`}>
            <Button
              variant="ghost"
              size="sm"
              className="rounded-full"
              style={
                activeTab === tab.key
                  ? {
                      background: c["--app-accent"] + "26",
                      color: c["--app-accent-text"],
                    }
                  : { color: c["--app-text-muted"] }
              }
            >
              {tab.label}
            </Button>
          </Link>
        ))}
      </div>
    </header>
  );
}
