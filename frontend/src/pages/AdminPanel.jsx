import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, formatApiErrorDetail } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { useTableControls } from "../hooks/useTableControls";
import {
  TableToolbar,
  SortableHead,
  TablePagination,
} from "../components/TableControls";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../components/ui/alert-dialog";
import { toast } from "sonner";
import {
  ChevronDown,
  LogOut,
  Users,
  Building2,
  LayoutDashboard,
  Shield,
  Trash2,
  Tv,
  ShieldCheck,
  KeyRound,
} from "lucide-react";
import { Palette } from "lucide-react";
import { useTheme, THEMES } from "../context/ThemeContext";

function Stat({ label, value, accent, hint, testid }) {
  return (
    <div
      className="rounded-2xl border border-stone-200 bg-white p-5"
      data-testid={testid}
    >
      <p className="text-[11px] uppercase tracking-[0.22em] text-stone-500">
        {label}
      </p>
      <p
        className={`font-serif-display text-4xl mt-2 ${accent || "text-[#2C302E]"}`}
      >
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-stone-500">{hint}</p>}
    </div>
  );
}

export default function AdminPanel() {
  const { auth, logout } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [outlets, setOutlets] = useState([]);
  const [lockouts, setLockouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const { theme, updateTheme } = useTheme();
  const t = THEMES.find((th) => th.id === theme.theme_id) || THEMES[0];
  const c = t.vars;
  const [savingTheme, setSavingTheme] = useState(false);
  const handleThemeChange = async (themeId) => {
    setSavingTheme(true);
    try {
      await updateTheme(themeId);
      toast.success("Theme updated");
    } catch {
      toast.error("Failed to save theme");
    } finally {
      setSavingTheme(false);
    }
  };
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, u, o, l] = await Promise.all([
        api.get("/admin/stats"),
        api.get("/admin/users"),
        api.get("/admin/businesses"),
        api.get("/admin/security/lockouts"),
      ]);
      setStats(s.data);
      setUsers(u.data);
      setOutlets(o.data);
      setLockouts(l.data);
    } catch (err) {
      toast.error(
        formatApiErrorDetail(err.response?.data?.detail) || err.message,
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const setPlan = async (userId, plan) => {
    try {
      await api.patch(`/admin/users/${userId}`, { plan });
      toast.success(`Plan set to ${plan}`);
      load();
    } catch (err) {
      toast.error(
        formatApiErrorDetail(err.response?.data?.detail) || err.message,
      );
    }
  };

  const setLocked = async (userId, is_locked) => {
    try {
      await api.patch(`/admin/users/${userId}`, { is_locked });
      toast.success(is_locked ? "Account frozen" : "Account restored");
      load();
    } catch (err) {
      toast.error(
        formatApiErrorDetail(err.response?.data?.detail) || err.message,
      );
    }
  };

  const deleteOutlet = async (id) => {
    try {
      await api.delete(`/admin/businesses/${id}`);
      toast.success("Outlet deleted");
      load();
    } catch (err) {
      toast.error(
        formatApiErrorDetail(err.response?.data?.detail) || err.message,
      );
    }
  };

  const clearLockout = async (email) => {
    try {
      await api.delete(`/admin/security/lockouts/${encodeURIComponent(email)}`);
      toast.success(`Unlocked ${email}`);
      load();
    } catch (err) {
      toast.error(
        formatApiErrorDetail(err.response?.data?.detail) || err.message,
      );
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  // Table controls — search, sort, pagination
  const usersTable = useTableControls(users, {
    searchKeys: ["email", "name", "plan"],
    initialSort: { key: "created_at", dir: "desc" },
  });
  const outletsTable = useTableControls(outlets, {
    searchKeys: [
      "business_name",
      "owner_email",
      "owner_name",
      "city",
      "state",
      "pincode",
    ],
    initialSort: { key: "business_name", dir: "asc" },
  });
  const lockoutsTable = useTableControls(lockouts, {
    searchKeys: ["email"],
    initialSort: { key: "failed_attempts", dir: "desc" },
  });

  const planStyle = (p) =>
    p === "premium_plus"
      ? "bg-[#2C302E] text-white border-[#2C302E]"
      : p === "premium"
        ? "bg-[#C47C5C]/15 text-[#A86246] border-[#C47C5C]/40"
        : "bg-stone-100 text-stone-600 border-stone-200";

  const planLabelText = (p) =>
    p === "premium_plus" ? "Premium+" : p === "premium" ? "Premium" : "Free";

  return (
    <div
      className="min-h-screen"
      style={{ background: c["--app-bg"], color: c["--app-text"] }}
    >
      <header
        className="sticky top-0 z-40 backdrop-blur-xl border-b"
        style={{
          background: c["--app-bg"] + "e6",
          borderColor: c["--app-border"],
        }}
      >
        {" "}
        <div className="mx-auto max-w-6xl px-5 py-3 flex flex-wrap items-center gap-3">
          <Link to="/" className="flex items-center gap-2">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-full text-white font-serif-display"
              style={{ background: c["--app-text"] }}
            >
              g
            </div>
            <span className="text-sm font-semibold">Go-Next</span>
            <span className="hidden sm:inline-flex items-center gap-1 rounded-full border border-[#7D9276]/40 bg-[#7D9276]/10 px-3 py-0.5 text-[10px] uppercase tracking-[0.22em] text-[#4c6547]">
              <Shield className="h-3 w-3" /> Admin
            </span>
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="rounded-full text-stone-600"
              onClick={load}
              data-testid="admin-refresh"
            >
              Refresh
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full border-stone-300"
                  data-testid="admin-menu"
                >
                  <span className="hidden sm:inline mr-1.5 text-stone-700">
                    {auth?.user?.name || "Admin"}
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
                  onClick={handleLogout}
                  data-testid="admin-logout"
                >
                  <LogOut className="h-4 w-4 mr-2" /> Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-10">
        <p
          className="text-[11px] uppercase tracking-[0.26em]"
          style={{ color: c["--app-accent-text"] }}
        >
          Platformpcontrol
        </p>
        <h1 className="font-serif-display text-4xl sm:text-5xl mt-2 leading-none">
          Super admin
        </h1>
        <p className="mt-2 text-stone-600 text-sm">
          Everything running on Go-Next, across every owner.
        </p>

        <div
          className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
          data-testid="admin-stats"
        >
          <Stat
            label="Total owners"
            value={stats?.total_users ?? "—"}
            hint={`${stats?.premium_users ?? 0} on Premium`}
            testid="admin-stat-users"
          />
          <Stat
            label="Outlets"
            value={stats?.total_businesses ?? "—"}
            accent="text-[#A86246]"
            testid="admin-stat-outlets"
          />
          <Stat
            label="Tickets (all-time)"
            value={stats?.total_tickets ?? "—"}
            testid="admin-stat-tickets"
          />
          <Stat
            label="Completed today"
            value={stats?.completed_today ?? "—"}
            accent="text-[#4c6547]"
            testid="admin-stat-today"
          />
        </div>

        <Tabs defaultValue="users" className="mt-10">
          <TabsList className="bg-white border border-stone-200 rounded-full p-1">
            <TabsTrigger
              value="users"
              className="rounded-full data-[state=active]:bg-[#F4EFE8] data-[state=active]:text-[#A86246]"
              data-testid="admin-tab-users"
            >
              <Users className="h-3.5 w-3.5 mr-1.5" /> Owners
            </TabsTrigger>
            <TabsTrigger
              value="outlets"
              className="rounded-full data-[state=active]:bg-[#F4EFE8] data-[state=active]:text-[#A86246]"
              data-testid="admin-tab-outlets"
            >
              <Building2 className="h-3.5 w-3.5 mr-1.5" /> Outlets
            </TabsTrigger>
            <TabsTrigger
              value="overview"
              className="rounded-full data-[state=active]:bg-[#F4EFE8] data-[state=active]:text-[#A86246]"
              data-testid="admin-tab-overview"
            >
              <LayoutDashboard className="h-3.5 w-3.5 mr-1.5" /> Overview
            </TabsTrigger>
            <TabsTrigger
              value="security"
              className="rounded-full data-[state=active]:bg-[#F4EFE8] data-[state=active]:text-[#A86246]"
              data-testid="admin-tab-security"
            >
              <ShieldCheck className="h-3.5 w-3.5 mr-1.5" /> Security
              {lockouts.some((l) => l.is_locked) && (
                <span className="ml-1.5 h-1.5 w-1.5 rounded-full bg-red-500" />
              )}
            </TabsTrigger>
            <TabsTrigger
              value="theme"
              className="rounded-full data-[state=active]:bg-[#F4EFE8] data-[state=active]:text-[#A86246]"
              data-testid="admin-tab-theme"
            >
              <Palette className="h-3.5 w-3.5 mr-1.5" /> Theme
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="mt-6">
            <div
              className="rounded-2xl border border-stone-200 bg-white overflow-hidden"
              data-testid="admin-users-table"
            >
              <TableToolbar
                query={usersTable.query}
                onQueryChange={usersTable.setSearch}
                pageSize={usersTable.pageSize}
                onPageSizeChange={usersTable.setPageSize}
                total={usersTable.total}
                placeholder="Search by email, name or plan…"
                testidPrefix="users"
              />
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <SortableHead
                      label="Owner"
                      sortKey="name"
                      sort={usersTable.sort}
                      onToggle={usersTable.toggleSort}
                    />
                    <SortableHead
                      label="Email"
                      sortKey="email"
                      sort={usersTable.sort}
                      onToggle={usersTable.toggleSort}
                    />
                    <SortableHead
                      label="Outlets"
                      sortKey="outlet_count"
                      sort={usersTable.sort}
                      onToggle={usersTable.toggleSort}
                      className="text-center"
                    />
                    <SortableHead
                      label="Plan"
                      sortKey="plan"
                      sort={usersTable.sort}
                      onToggle={usersTable.toggleSort}
                    />
                    <SortableHead
                      label="Joined"
                      sortKey="created_at"
                      sort={usersTable.sort}
                      onToggle={usersTable.toggleSort}
                    />
                    <TableHead className="text-right pr-5">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading && (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="text-center py-10 text-stone-500"
                      >
                        Loading…
                      </TableCell>
                    </TableRow>
                  )}
                  {!loading && usersTable.total === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="text-center py-10 text-stone-500"
                      >
                        {users.length === 0
                          ? "No owners yet."
                          : "No owners match that search."}
                      </TableCell>
                    </TableRow>
                  )}
                  {usersTable.visible.map((u) => (
                    <TableRow key={u.id} data-testid={`admin-user-row-${u.id}`}>
                      <TableCell className="font-medium">
                        {u.name || "—"}
                        {u.is_locked && (
                          <Badge className="ml-2 rounded-full border font-normal bg-red-50 text-red-600 border-red-100">
                            Frozen
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-stone-600">
                        {u.email}
                      </TableCell>
                      <TableCell className="text-center">
                        {u.outlet_count}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={`rounded-full border font-normal ${planStyle(u.plan)}`}
                        >
                          {planLabelText(u.plan)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-stone-500 text-xs">
                        {u.created_at
                          ? new Date(u.created_at).toLocaleDateString()
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right pr-5">
                        <div className="flex justify-end gap-2">
                          {u.is_locked ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="rounded-full border-red-200 text-red-700"
                              onClick={() => setLocked(u.id, false)}
                              data-testid={`unlock-account-${u.id}`}
                            >
                              Restore
                            </Button>
                          ) : null}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                size="sm"
                                variant="outline"
                                className="rounded-full border-stone-300"
                                data-testid={`plan-menu-${u.id}`}
                              >
                                Plan{" "}
                                <ChevronDown className="h-3.5 w-3.5 ml-1" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                              <DropdownMenuLabel className="font-normal text-xs">
                                Set plan
                              </DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              {[
                                { id: "free", label: "Free" },
                                { id: "premium", label: "Premium" },
                                { id: "premium_plus", label: "Premium Plus" },
                              ].map((p) => (
                                <DropdownMenuItem
                                  key={p.id}
                                  disabled={u.plan === p.id}
                                  onClick={() => setPlan(u.id, p.id)}
                                  data-testid={`set-plan-${p.id}-${u.id}`}
                                >
                                  {p.label}
                                  {u.plan === p.id && (
                                    <span className="ml-auto text-[10px] text-stone-400">
                                      current
                                    </span>
                                  )}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <TablePagination
                page={usersTable.page}
                totalPages={usersTable.totalPages}
                onPageChange={usersTable.setPage}
                testidPrefix="users"
              />
            </div>
          </TabsContent>

          <TabsContent value="outlets" className="mt-6">
            <div
              className="rounded-2xl border border-stone-200 bg-white overflow-hidden"
              data-testid="admin-outlets-table"
            >
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Outlet</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead className="text-center">Stations</TableHead>
                    <TableHead>Online</TableHead>
                    <TableHead className="text-right pr-5">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading && (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="text-center py-10 text-stone-500"
                      >
                        Loading…
                      </TableCell>
                    </TableRow>
                  )}
                  {!loading && outlets.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="text-center py-10 text-stone-500"
                      >
                        No outlets yet.
                      </TableCell>
                    </TableRow>
                  )}
                  {outlets.map((b) => (
                    <TableRow
                      key={b.id}
                      data-testid={`admin-outlet-row-${b.id}`}
                    >
                      <TableCell>
                        <p className="font-medium">{b.business_name}</p>
                        <p className="text-xs text-stone-500 capitalize">
                          {b.business_type}
                        </p>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm">{b.owner_name || "—"}</p>
                        <p className="text-xs text-stone-500">
                          {b.owner_email}
                        </p>
                      </TableCell>
                      <TableCell className="text-stone-600 text-sm">
                        {[b.city, b.state, b.pincode]
                          .filter(Boolean)
                          .join(", ") || "—"}
                      </TableCell>
                      <TableCell className="text-center">
                        {b.total_chairs}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex h-2 w-2 rounded-full ${b.is_online ? "bg-[#7D9276]" : "bg-stone-400"}`}
                        />
                        <span className="ml-2 text-xs text-stone-600">
                          {b.is_online ? "Accepting" : "Paused"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right pr-5">
                        <div className="flex justify-end gap-2">
                          <Link
                            to={`/display/${b.id}`}
                            target="_blank"
                            rel="noreferrer"
                            data-testid={`admin-open-display-${b.id}`}
                          >
                            <Button
                              size="sm"
                              variant="ghost"
                              className="rounded-full text-stone-600"
                              title="Open TV display"
                            >
                              <Tv className="h-4 w-4" />
                            </Button>
                          </Link>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="rounded-full text-red-600"
                                data-testid={`admin-delete-outlet-${b.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  Delete {b.business_name}?
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  This permanently removes the outlet and all
                                  its tickets. This affects the owner (
                                  {b.owner_email}).
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteOutlet(b.id)}
                                  className="bg-red-600 hover:bg-red-500"
                                  data-testid={`admin-confirm-delete-${b.id}`}
                                >
                                  Delete outlet
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <TablePagination
                page={outletsTable.page}
                totalPages={outletsTable.totalPages}
                onPageChange={outletsTable.setPage}
                testidPrefix="outlets"
              />
            </div>
          </TabsContent>

          <TabsContent value="overview" className="mt-6">
            <div
              className="rounded-2xl border border-stone-200 bg-white p-6 grid gap-4 sm:grid-cols-3"
              data-testid="admin-overview"
            >
              <Stat label="Free owners" value={stats?.free_users ?? "—"} />
              <Stat
                label="Premium owners"
                value={stats?.premium_users ?? "—"}
                accent="text-[#A86246]"
              />
              <Stat
                label="Conversion"
                value={
                  stats && stats.total_users
                    ? `${Math.round((stats.premium_users / stats.total_users) * 100)}%`
                    : "—"
                }
                hint="of owners on Premium"
              />
            </div>
          </TabsContent>

          <TabsContent value="security" className="mt-6">
            <div
              className="rounded-2xl border border-stone-200 bg-white overflow-hidden"
              data-testid="admin-security-table"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 px-5 py-4">
                <div>
                  <h3 className="font-serif-display text-xl leading-none flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-[#4c6547]" /> Account
                    lockouts
                  </h3>
                  <p className="mt-1 text-xs text-stone-500">
                    5 failed logins within 15 minutes locks the account. Clear a
                    lockout to help a genuine user log back in immediately.
                  </p>
                </div>
                <span className="text-[10px] uppercase tracking-[0.22em] text-stone-500">
                  {lockouts.filter((l) => l.is_locked).length} locked ·{" "}
                  {lockouts.length} tracked
                </span>
              </div>
              <TableToolbar
                query={lockoutsTable.query}
                onQueryChange={lockoutsTable.setSearch}
                pageSize={lockoutsTable.pageSize}
                onPageSizeChange={lockoutsTable.setPageSize}
                total={lockoutsTable.total}
                placeholder="Search by email…"
                testidPrefix="lockouts"
              />
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <SortableHead
                      label="Email"
                      sortKey="email"
                      sort={lockoutsTable.sort}
                      onToggle={lockoutsTable.toggleSort}
                    />
                    <SortableHead
                      label="Failed attempts"
                      sortKey="failed_attempts"
                      sort={lockoutsTable.sort}
                      onToggle={lockoutsTable.toggleSort}
                      className="text-center"
                    />
                    <SortableHead
                      label="Status"
                      sortKey="is_locked"
                      sort={lockoutsTable.sort}
                      onToggle={lockoutsTable.toggleSort}
                    />
                    <SortableHead
                      label="Unlocks in"
                      sortKey="unlock_in_minutes"
                      sort={lockoutsTable.sort}
                      onToggle={lockoutsTable.toggleSort}
                    />
                    <TableHead className="text-right pr-5">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading && (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="text-center py-10 text-stone-500"
                      >
                        Loading…
                      </TableCell>
                    </TableRow>
                  )}
                  {!loading && lockoutsTable.total === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="text-center py-10 text-stone-500"
                      >
                        {lockouts.length === 0
                          ? "No recent failed logins. All quiet."
                          : "No accounts match that search."}
                      </TableCell>
                    </TableRow>
                  )}
                  {lockoutsTable.visible.map((l) => (
                    <TableRow
                      key={l.email}
                      data-testid={`lockout-row-${l.email}`}
                    >
                      <TableCell className="font-medium">{l.email}</TableCell>
                      <TableCell className="text-center">
                        {l.failed_attempts}
                      </TableCell>
                      <TableCell>
                        {l.is_locked ? (
                          <Badge className="rounded-full border font-normal bg-red-50 text-red-600 border-red-100">
                            Locked
                          </Badge>
                        ) : (
                          <Badge className="rounded-full border font-normal bg-stone-100 text-stone-600 border-stone-200">
                            Warned
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-stone-600 text-sm">
                        {l.is_locked ? `${l.unlock_in_minutes} min` : "—"}
                      </TableCell>
                      <TableCell className="text-right pr-5">
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-full border-stone-300"
                          onClick={() => clearLockout(l.email)}
                          data-testid={`clear-lockout-${l.email}`}
                        >
                          <KeyRound className="h-3.5 w-3.5 mr-1.5" /> Unlock
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <TablePagination
                page={lockoutsTable.page}
                totalPages={lockoutsTable.totalPages}
                onPageChange={lockoutsTable.setPage}
                testidPrefix="lockouts"
              />
            </div>
          </TabsContent>
          <TabsContent value="theme" className="mt-6">
            <div
              className="rounded-2xl border border-stone-200 bg-white p-6"
              data-testid="admin-theme-panel"
            >
              <h3 className="font-serif-display text-2xl leading-none">
                Platform theme
              </h3>
              <p className="mt-1 text-sm text-stone-500">
                Choose a colour palette and mode for the entire app. Changes
                apply instantly for all users.
              </p>

              <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {THEMES.map((t) => {
                  const isActive = theme.theme_id === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => handleThemeChange(t.id)}
                      disabled={savingTheme}
                      data-testid={`theme-option-${t.id}`}
                      className={`group relative text-left rounded-2xl border-2 p-4 transition-all focus:outline-none
              ${
                isActive
                  ? "border-[#C47C5C] shadow-md"
                  : "border-stone-200 hover:border-stone-300"
              }`}
                    >
                      {/* Preview swatch */}
                      <div
                        className="h-16 rounded-xl mb-3 flex items-end p-3 gap-1.5"
                        style={{ background: t.preview.bg }}
                      >
                        <span
                          className="h-5 w-5 rounded-full border-2 border-white/60"
                          style={{ background: t.preview.accent }}
                        />
                        <span
                          className="h-3 flex-1 rounded-full opacity-30"
                          style={{ background: t.preview.text }}
                        />
                        <span
                          className="h-2 w-8 rounded-full opacity-20"
                          style={{ background: t.preview.text }}
                        />
                      </div>

                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-sm text-[#2C302E]">
                            {t.name}
                          </p>
                          <p className="text-xs text-stone-500 mt-0.5">
                            {t.description}
                          </p>
                        </div>
                        <span
                          className={`mt-0.5 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider font-medium
                ${
                  t.mode === "dark"
                    ? "bg-[#2C302E] text-white"
                    : "bg-stone-100 text-stone-600"
                }`}
                        >
                          {t.mode}
                        </span>
                      </div>

                      {isActive && (
                        <div className="absolute top-3 right-3 h-5 w-5 rounded-full bg-[#C47C5C] flex items-center justify-center">
                          <svg
                            className="h-3 w-3 text-white"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={3}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              <p className="mt-4 text-xs text-stone-400">
                {savingTheme
                  ? "Saving…"
                  : `Active theme: ${THEMES.find((t) => t.theme_id === theme.theme_id || t.id === theme.theme_id)?.name || "Warm Sand"}`}
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
