import { Fragment, useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, formatApiErrorDetail } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { usePlans } from "../context/PlanContext";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Switch } from "../components/ui/switch";
import { Textarea } from "../components/ui/textarea";
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
import { toast } from "sonner";
import {
  ChevronDown,
  LogOut,
  Users,
  LayoutDashboard,
  Shield,
  Trash2,
  Tv,
  ShieldCheck,
  KeyRound,
  SlidersHorizontal,
  XCircle,
} from "lucide-react";
import { Palette } from "lucide-react";
import { useTheme, THEMES } from "../context/ThemeContext";
import BrandLogo from "../components/LogoMark";
import ConfirmDialog from "../components/common/ConfirmDialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../components/ui/dialog";
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
        className={`font-serif-display text-4xl mt-2 ${accent || "text-foreground"}`}
      >
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-stone-500">{hint}</p>}
    </div>
  );
}

// Standardized table state for server-side
function useServerTable(
  endpoint,
  { initialSort = { key: "created_at", dir: "desc" } } = {},
) {
  const [data, setData] = useState({
    items: [],
    total: 0,
    page: 1,
    page_size: 25,
  });
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState(initialSort);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const url = `${endpoint}?page=${data.page}&page_size=${data.page_size}&sort_by=${sort.key}&sort_dir=${sort.dir}&search=${encodeURIComponent(query)}`;
      const { data: res } = await api.get(url);
      setData((prev) => ({ ...prev, ...res }));
    } catch (err) {
      toast.error(
        formatApiErrorDetail(err.response?.data?.detail) || err.message,
      );
    } finally {
      setLoading(false);
    }
  }, [endpoint, data.page, data.page_size, sort, query]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    items: data.items,
    total: data.total,
    totalPages: Math.ceil(data.total / data.page_size),
    page: data.page,
    pageSize: data.page_size,
    sort,
    query,
    setPage: (p) => setData((prev) => ({ ...prev, page: p })),
    setPageSize: (ps) =>
      setData((prev) => ({ ...prev, page_size: ps, page: 1 })),
    setSearch: (q) => {
      setQuery(q);
      setData((prev) => ({ ...prev, page: 1 }));
    },
    toggleSort: (key) =>
      setSort((prev) => ({
        key,
        dir: prev.key === key && prev.dir === "asc" ? "desc" : "asc",
      })),
    loading,
    refresh: fetchData,
  };
}

export default function AdminPanel() {
  const { auth, logout } = useAuth();
  const { catalog, setCatalog } = usePlans();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true); // Re-added this line

  // Use server-side state
  const usersTable = useServerTable("/admin/users");
  const pendingUsersTable = useServerTable("/admin/users/pending");
  const rejectedUsersTable = useServerTable("/admin/users/rejected", {
    initialSort: { key: "rejected_at", dir: "desc" },
  });
  const [lockouts, setLockouts] = useState([]);
  const lockoutsTable = useTableControls(lockouts, {
    searchKeys: ["email"],
    initialSort: { key: "failed_attempts", dir: "desc" },
  });
  const [plans, setPlans] = useState([]);
  const [savingPlans, setSavingPlans] = useState({});
  const [savingTheme, setSavingTheme] = useState(false);
  const [ownerOutletMap, setOwnerOutletMap] = useState({});
  const [selectedOwner, setSelectedOwner] = useState(null);
  const [ownerDialogOpen, setOwnerDialogOpen] = useState(false);
  const { theme, updateTheme } = useTheme();
  const appAccentColor = theme?.vars?.["--app-accent"];
  const t = THEMES.find((th) => th.id === theme.theme_id) || THEMES[0];
  const c = t.vars;

  const planStyle = (p) =>
    p === "premium_plus"
      ? "bg-foreground text-white border-foreground"
      : p === "premium"
        ? "bg-primary/15 text-primary border-primary/40"
        : "bg-stone-100 text-stone-600 border-stone-200";

  const planLabelText = (p) =>
    p === "premium_plus" ? "Premium+" : p === "premium" ? "Premium" : "Free";

  const handleThemeChange = useCallback(
    async (themeId) => {
      setSavingTheme(true);
      try {
        const { data } = await api.patch("/admin/theme", { theme_id: themeId });
        const themeObj = THEMES.find((t) => t.id === data.theme_id);
        updateTheme(data.theme_id);
        toast.success(`Theme updated to ${themeObj?.name || data.theme_id}`);
      } catch (err) {
        toast.error(
          formatApiErrorDetail(err.response?.data?.detail) || err.message,
        );
      } finally {
        setSavingTheme(false);
      }
    },
    [updateTheme],
  );

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  const loadData = useCallback(async () => {
    setLoading(true); // Keep local loading state for stats and plans, etc.
    try {
      const [s, l, p] = await Promise.all([
        api.get("/admin/stats"),
        api.get("/admin/security/lockouts"),
        api.get("/admin/plans"),
      ]);
      setStats(s.data);
      setLockouts(l.data);
      setPlans(
        (p.data?.plans || []).map((plan) => ({
          ...plan,
          features_text: (plan.features || []).join("\n"),
        })),
      );
      // Removed calls to pendingUsersTable.refresh() and rejectedUsersTable.refresh()
    } catch (err) {
      toast.error(
        formatApiErrorDetail(err.response?.data?.detail) || err.message,
      );
    } finally {
      setLoading(false);
    }
  }, []); // Removed pendingUsersTable, rejectedUsersTable from dependencies

  const approveUser = useCallback(
    async (userId) => {
      try {
        await api.post(`/admin/users/${userId}/approve`);
        toast.success("User approved!");
        pendingUsersTable.refresh();
        usersTable.refresh();
        loadData(); // Refresh stats, lockouts etc.
      } catch (err) {
        toast.error(
          formatApiErrorDetail(err.response?.data?.detail) || err.message,
        );
      }
    },
    [pendingUsersTable, usersTable, loadData],
  );

  const rejectUser = useCallback(
    async (userId) => {
      try {
        await api.post(`/admin/users/${userId}/reject`);
        toast.success("User rejected!");
        pendingUsersTable.refresh();
        rejectedUsersTable.refresh();
        loadData(); // Refresh stats, lockouts etc.
      } catch (err) {
        toast.error(
          formatApiErrorDetail(err.response?.data?.detail) || err.message,
        );
      }
    },
    [pendingUsersTable, rejectedUsersTable, loadData],
  );

  const copyEmailToClipboard = useCallback(async (email) => {
    try {
      await navigator.clipboard.writeText(email);
      toast.success("Email copied to clipboard");
    } catch (err) {
      toast.error("Unable to copy email");
    }
  }, []);

  const loadOwnerOutlets = useCallback(
    async (ownerId) => {
      if (ownerOutletMap[ownerId]) return;
      setOwnerOutletMap((prev) => ({
        ...prev,
        [ownerId]: { loading: true, items: [] },
      }));

      try {
        const { data } = await api.get(`/admin/users/${ownerId}/businesses`);
        setOwnerOutletMap((prev) => ({
          ...prev,
          [ownerId]: { loading: false, items: data.items || [] },
        }));
      } catch (err) {
        toast.error(
          formatApiErrorDetail(err.response?.data?.detail) || err.message,
        );
        setOwnerOutletMap((prev) => ({
          ...prev,
          [ownerId]: { loading: false, items: [] },
        }));
      }
    },
    [ownerOutletMap],
  );

  const openOwnerDialog = useCallback(
    (owner) => {
      setSelectedOwner(owner);
      setOwnerDialogOpen(true);
      if (owner.outlet_count > 0 && !ownerOutletMap[owner.id]) {
        loadOwnerOutlets(owner.id);
      }
    },
    [loadOwnerOutlets, ownerOutletMap],
  );

  const setPlan = useCallback(
    async (userId, plan) => {
      try {
        await api.patch(`/admin/users/${userId}`, { plan });
        toast.success(`Plan updated to ${planLabelText(plan)}`);
        loadData();
      } catch (err) {
        toast.error(
          formatApiErrorDetail(err.response?.data?.detail) || err.message,
        );
      }
    },
    [loadData],
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

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
        <div className="w-full px-5 py-3 flex flex-wrap items-center gap-3">
          <Link to="/" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center">
              <BrandLogo compact color={appAccentColor} />
            </span>
            <span className="text-sm font-semibold">Go-Next</span>
            <span className="hidden sm:inline-flex items-center gap-1 rounded-full border border-success/40 bg-success/10 px-3 py-0.5 text-[10px] uppercase tracking-[0.22em] text-success">
              <Shield className="h-3 w-3" /> Admin
            </span>
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="rounded-full text-stone-600"
              onClick={loadData}
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

      <main className="w-full px-5 py-10">
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
          className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5"
          data-testid="admin-stats"
        >
          <Stat
            label="Total owners"
            value={stats?.total_users ?? "—"}
            hint={`${stats?.free_users ?? 0} free · ${stats?.premium_users ?? 0} Premium`}
            testid="admin-stat-users"
          />
          <Stat
            label="Conversion"
            value={
              stats && stats.total_users
                ? `${Math.round((stats.premium_users / stats.total_users) * 100)}%`
                : "—"
            }
            accent="text-primary"
            hint="of owners on Premium"
            testid="admin-stat-conversion"
          />
          <Stat
            label="Outlets"
            value={stats?.total_businesses ?? "—"}
            accent="text-primary"
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
            accent="text-success"
            testid="admin-stat-today"
          />
        </div>

        <Tabs defaultValue="users" className="mt-10">
          <TabsList className="bg-white border border-stone-200 rounded-full p-1">
            <TabsTrigger
              value="pending"
              className="rounded-full data-[state=active]:bg-secondary data-[state=active]:text-primary"
              data-testid="admin-tab-pending"
            >
              <Shield className="h-3.5 w-3.5 mr-1.5" /> Pending
              {pendingUsersTable.total > 0 && (
                <span className="ml-1.5 h-4 w-4 rounded-full bg-primary text-[10px] text-white flex items-center justify-center">
                  {pendingUsersTable.total}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="rejected"
              className="rounded-full data-[state=active]:bg-secondary data-[state=active]:text-primary"
              data-testid="admin-tab-rejected"
            >
              <XCircle className="h-3.5 w-3.5 mr-1.5" /> Rejected
            </TabsTrigger>
            <TabsTrigger
              value="users"
              className="rounded-full data-[state=active]:bg-secondary data-[state=active]:text-primary"
              data-testid="admin-tab-users"
            >
              <Users className="h-3.5 w-3.5 mr-1.5" /> Owners
            </TabsTrigger>
            <TabsTrigger
              value="security"
              className="rounded-full data-[state=active]:bg-secondary data-[state=active]:text-primary"
              data-testid="admin-tab-security"
            >
              <ShieldCheck className="h-3.5 w-3.5 mr-1.5" /> Security
              {lockouts.some((l) => l.is_locked) && (
                <span className="ml-1.5 h-1.5 w-1.5 rounded-full bg-red-500" />
              )}
            </TabsTrigger>
            <TabsTrigger
              value="theme"
              className="rounded-full data-[state=active]:bg-secondary data-[state=active]:text-primary"
              data-testid="admin-tab-theme"
            >
              <Palette className="h-3.5 w-3.5 mr-1.5" /> Theme
            </TabsTrigger>
            <TabsTrigger
              value="plans"
              className="rounded-full data-[state=active]:bg-secondary data-[state=active]:text-primary"
              data-testid="admin-tab-plans"
            >
              <SlidersHorizontal className="h-3.5 w-3.5 mr-1.5" /> Plans
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="mt-6">
            <div
              className="rounded-2xl border border-stone-200 bg-white overflow-hidden"
              data-testid="admin-pending-table"
            >
              <TableToolbar
                query={pendingUsersTable.query}
                onQueryChange={pendingUsersTable.setSearch}
                pageSize={pendingUsersTable.pageSize}
                onPageSizeChange={pendingUsersTable.setPageSize}
                total={pendingUsersTable.total}
                placeholder="Search by email or name…"
                testidPrefix="pending"
              />
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <SortableHead
                      label="Owner"
                      sortKey="name"
                      sort={pendingUsersTable.sort}
                      onToggle={pendingUsersTable.toggleSort}
                    />
                    <SortableHead
                      label="Email"
                      sortKey="email"
                      sort={pendingUsersTable.sort}
                      onToggle={pendingUsersTable.toggleSort}
                    />
                    <SortableHead
                      label="Plan"
                      sortKey="plan"
                      sort={pendingUsersTable.sort}
                      onToggle={pendingUsersTable.toggleSort}
                    />
                    <SortableHead
                      label="Joined"
                      sortKey="created_at"
                      sort={pendingUsersTable.sort}
                      onToggle={pendingUsersTable.toggleSort}
                    />
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingUsersTable.loading && (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="text-center py-10 text-stone-500"
                      >
                        Loading…
                      </TableCell>
                    </TableRow>
                  )}
                  {!pendingUsersTable.loading &&
                    pendingUsersTable.total === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="text-center py-10 text-stone-500"
                        >
                          {pendingUsersTable.items.length === 0
                            ? "No pending registrations."
                            : "No pending registrations match that search."}
                        </TableCell>
                      </TableRow>
                    )}
                  {pendingUsersTable.items.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.name}</TableCell>
                      <TableCell>{u.email}</TableCell>
                      <TableCell>
                        <span className={planStyle(u.plan)}>
                          {planLabelText(u.plan)}
                        </span>
                      </TableCell>
                      <TableCell className="text-stone-500">
                        {u.created_at
                          ? new Date(u.created_at).toLocaleDateString()
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <ConfirmDialog
                          trigger={
                            <Button
                              size="sm"
                              className="mr-2 rounded-full bg-success hover:bg-success/90 text-white"
                              data-testid={`approve-user-${u.id}`}
                            >
                              Approve
                            </Button>
                          }
                          title={`Approve ${u.email}?`}
                          description="The user will be able to sign in immediately and start managing their outlets. You can lock them later if needed."
                          confirmLabel="Approve user"
                          variant="default"
                          onConfirm={() => approveUser(u.id)}
                          testidPrefix={`approve-user-${u.id}`}
                        />
                        <ConfirmDialog
                          trigger={
                            <Button
                              size="sm"
                              variant="outline"
                              className="rounded-full border-stone-300"
                              data-testid={`reject-user-${u.id}`}
                            >
                              Reject
                            </Button>
                          }
                          title={`Reject ${u.email}?`}
                          description="The user will not be able to sign in. You can re-approve them later from the Rejected tab."
                          confirmLabel="Reject user"
                          onConfirm={() => rejectUser(u.id)}
                          testidPrefix={`reject-user-${u.id}`}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <TablePagination
                page={pendingUsersTable.page}
                totalPages={pendingUsersTable.totalPages}
                onPageChange={pendingUsersTable.setPage}
                testidPrefix="pending"
              />
            </div>
          </TabsContent>

          <TabsContent value="rejected" className="mt-6">
            <div
              className="rounded-2xl border border-stone-200 bg-white overflow-hidden"
              data-testid="admin-rejected-table"
            >
              <TableToolbar
                query={rejectedUsersTable.query}
                onQueryChange={rejectedUsersTable.setSearch}
                pageSize={rejectedUsersTable.pageSize}
                onPageSizeChange={rejectedUsersTable.setPageSize}
                total={rejectedUsersTable.total}
                placeholder="Search by email or name…"
                testidPrefix="rejected"
              />
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <SortableHead
                      label="Owner"
                      sortKey="name"
                      sort={rejectedUsersTable.sort}
                      onToggle={rejectedUsersTable.toggleSort}
                    />
                    <SortableHead
                      label="Email"
                      sortKey="email"
                      sort={rejectedUsersTable.sort}
                      onToggle={rejectedUsersTable.toggleSort}
                    />
                    <SortableHead
                      label="Plan"
                      sortKey="plan"
                      sort={rejectedUsersTable.sort}
                      onToggle={rejectedUsersTable.toggleSort}
                    />
                    <SortableHead
                      label="Joined"
                      sortKey="created_at"
                      sort={rejectedUsersTable.sort}
                      onToggle={rejectedUsersTable.toggleSort}
                    />
                    <SortableHead
                      label="Rejected"
                      sortKey="rejected_at"
                      sort={rejectedUsersTable.sort}
                      onToggle={rejectedUsersTable.toggleSort}
                    />
                    <TableHead className="text-center">Outlets</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rejectedUsersTable.loading && (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="text-center py-10 text-stone-500"
                      >
                        Loading…
                      </TableCell>
                    </TableRow>
                  )}
                  {!rejectedUsersTable.loading &&
                    rejectedUsersTable.total === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="text-center py-10 text-stone-500"
                        >
                          {rejectedUsersTable.items.length === 0
                            ? "No rejected registrations."
                            : "No rejected registrations match that search."}
                        </TableCell>
                      </TableRow>
                    )}
                  {rejectedUsersTable.items.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.name}</TableCell>
                      <TableCell>{u.email}</TableCell>
                      <TableCell>
                        <span className={planStyle(u.plan)}>
                          {planLabelText(u.plan)}
                        </span>
                      </TableCell>
                      <TableCell className="text-stone-500">
                        {u.created_at
                          ? new Date(u.created_at).toLocaleDateString()
                          : "—"}
                      </TableCell>
                      <TableCell className="text-stone-500">
                        {u.rejected_at
                          ? new Date(u.rejected_at).toLocaleDateString()
                          : "—"}
                      </TableCell>
                      <TableCell className="text-center">
                        {u.outlet_count}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <TablePagination
                page={rejectedUsersTable.page}
                totalPages={rejectedUsersTable.totalPages}
                onPageChange={rejectedUsersTable.setPage}
                testidPrefix="rejected"
              />
            </div>
          </TabsContent>

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
                  {usersTable.loading && (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="text-center py-10 text-stone-500"
                      >
                        Loading…
                      </TableCell>
                    </TableRow>
                  )}
                  {!usersTable.loading && usersTable.total === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="text-center py-10 text-stone-500"
                      >
                        {usersTable.items.length === 0
                          ? "No owners yet."
                          : "No owners match that search."}
                      </TableCell>
                    </TableRow>
                  )}
                  {usersTable.items.map((u) => (
                    <Fragment key={u.id}>
                      <TableRow
                        key={u.id}
                        data-testid={`admin-user-row-${u.id}`}
                        className="cursor-pointer hover:bg-stone-50"
                        onClick={() => openOwnerDialog(u)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="flex flex-col">
                              <span className="font-semibold text-stone-900">
                                {u.name || "—"}
                              </span>
                              {u.is_locked ? (
                                <Badge className="w-fit mt-1 rounded-full border font-normal bg-red-50 text-red-600 border-red-100 text-[10px]">
                                  Frozen Account
                                </Badge>
                              ) : (
                                <span className="text-xs text-stone-500">
                                  Owner
                                </span>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-stone-600 text-sm">
                          <span
                            className="cursor-pointer text-primary underline decoration-dotted"
                            onClick={(event) => {
                              event.stopPropagation();
                              copyEmailToClipboard(u.email);
                            }}
                            title="Copy email"
                            data-testid={`admin-owner-email-${u.id}`}
                          >
                            {u.email}
                          </span>
                        </TableCell>
                        <TableCell className="text-center font-medium">
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
                        <TableCell
                          className="text-right pr-5"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <div className="flex justify-end gap-2">
                            {u.is_locked ? (
                              <Button
                                size="sm"
                                variant="outline"
                                className="rounded-full border-red-200 text-red-700 hover:bg-red-50"
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
                    </Fragment>
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

            <Dialog open={ownerDialogOpen} onOpenChange={setOwnerDialogOpen}>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>
                    {selectedOwner?.name || "Owner outlets"}
                  </DialogTitle>
                  <DialogDescription>
                    {selectedOwner?.outlet_count
                      ? `Showing ${selectedOwner.outlet_count} outlet${selectedOwner.outlet_count === 1 ? "" : "s"} for ${selectedOwner.name}.`
                      : "This owner has no outlets yet."}
                  </DialogDescription>
                </DialogHeader>

                <div className="mt-4 space-y-3">
                  {selectedOwner &&
                  ownerOutletMap[selectedOwner.id]?.loading ? (
                    <p className="text-sm text-stone-500">Loading outlets…</p>
                  ) : selectedOwner &&
                    ownerOutletMap[selectedOwner.id]?.items?.length ? (
                    ownerOutletMap[selectedOwner.id].items.map((business) => (
                      <div
                        key={business.id}
                        className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm"
                      >
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="font-semibold text-stone-900">
                              {business.business_name}
                            </p>
                            <p className="text-sm text-stone-500">
                              {[business.city, business.state, business.pincode]
                                .filter(Boolean)
                                .join(", ") || "Location not set"}
                            </p>
                          </div>
                          <Link
                            to={`/display/${business.id}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <Button
                              size="sm"
                              variant="ghost"
                              className="rounded-full text-stone-600 hover:text-stone-900"
                              title="Open TV display"
                            >
                              <Tv className="h-4 w-4" />
                            </Button>
                          </Link>
                        </div>
                      </div>
                    ))
                  ) : selectedOwner ? (
                    <p className="text-sm text-stone-500">
                      No outlets available for this owner.
                    </p>
                  ) : null}
                </div>
              </DialogContent>
            </Dialog>
          </TabsContent>

          <TabsContent value="security" className="mt-6">
            <div
              className="rounded-2xl border border-stone-200 bg-white overflow-hidden"
              data-testid="admin-security-table"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 px-5 py-4">
                <div>
                  <h3 className="font-serif-display text-xl leading-none flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-success" /> Account
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
                  {lockoutsTable.loading && (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="text-center py-10 text-stone-500"
                      >
                        Loading…
                      </TableCell>
                    </TableRow>
                  )}
                  {!lockoutsTable.loading && lockoutsTable.total === 0 && (
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
                  ? "border-primary shadow-md"
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
                          <p className="font-semibold text-sm text-foreground">
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
                    ? "bg-foreground text-white"
                    : "bg-stone-100 text-stone-600"
                }`}
                        >
                          {t.mode}
                        </span>
                      </div>

                      {isActive && (
                        <div className="absolute top-3 right-3 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
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

          <TabsContent value="plans" className="mt-6">
            <div
              className="grid gap-5 lg:grid-cols-3"
              data-testid="admin-plans"
            >
              {plans.map((plan) => (
                <div
                  key={plan.id}
                  className="rounded-2xl border border-stone-200 bg-white p-6"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.22em] text-stone-500">
                        {plan.id.replace("_", " ")}
                      </p>
                      <h3 className="font-serif-display text-2xl mt-2">
                        {plan.label || plan.name}
                      </h3>
                      <p className="mt-1 text-xs text-stone-500">
                        {plan.price_monthly > 0
                          ? `$${plan.price_monthly}/mo`
                          : "Free"}
                      </p>
                    </div>
                    <Badge
                      className={`rounded-full border font-normal ${planStyle(plan.id)}`}
                    >
                      {planLabelText(plan.id)}
                    </Badge>
                  </div>

                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label>Max outlets</Label>
                      <Input
                        type="number"
                        min="1"
                        className="mt-1.5 h-10"
                        value={plan.max_outlets}
                        onChange={(e) =>
                          updatePlanDraft(
                            plan.id,
                            "max_outlets",
                            e.target.value,
                          )
                        }
                      />
                    </div>
                    <div>
                      <Label>Max stations</Label>
                      <Input
                        type="number"
                        min="1"
                        className="mt-1.5 h-10"
                        value={plan.max_stations}
                        onChange={(e) =>
                          updatePlanDraft(
                            plan.id,
                            "max_stations",
                            e.target.value,
                          )
                        }
                      />
                    </div>
                    <div>
                      <Label>Daily token limit</Label>
                      <Input
                        type="number"
                        min="1"
                        className="mt-1.5 h-10"
                        value={plan.max_tokens_per_day}
                        onChange={(e) =>
                          updatePlanDraft(
                            plan.id,
                            "max_tokens_per_day",
                            e.target.value,
                          )
                        }
                      />
                    </div>
                    <div>
                      <Label>Analytics / collections days</Label>
                      <Input
                        type="number"
                        min="1"
                        className="mt-1.5 h-10"
                        value={plan.analytics_days}
                        onChange={(e) =>
                          updatePlanDraft(
                            plan.id,
                            "analytics_days",
                            e.target.value,
                          )
                        }
                      />
                    </div>
                    <div>
                      <Label>Max services</Label>
                      <Input
                        type="number"
                        min="0"
                        className="mt-1.5 h-10"
                        value={plan.max_services}
                        onChange={(e) =>
                          updatePlanDraft(
                            plan.id,
                            "max_services",
                            e.target.value,
                          )
                        }
                      />
                    </div>
                    <div className="rounded-xl border border-stone-200 px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-stone-900">
                            Custom services
                          </p>
                          <p className="text-xs text-stone-500">
                            Enable service catalog management
                          </p>
                        </div>
                        <Switch
                          checked={!!plan.can_manage_services}
                          onCheckedChange={(checked) =>
                            updatePlanDraft(
                              plan.id,
                              "can_manage_services",
                              checked,
                            )
                          }
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mt-4">
                    <Label>Feature list</Label>
                    <Textarea
                      className="mt-1.5 min-h-[180px]"
                      value={
                        plan.features_text ?? (plan.features || []).join("\n")
                      }
                      onChange={(e) =>
                        updatePlanDraft(
                          plan.id,
                          "features_text",
                          e.target.value,
                        )
                      }
                      placeholder={"One feature per line"}
                    />
                    <p className="mt-1 text-xs text-stone-500">
                      This list is used on the public pricing page and
                      plan-aware UI.
                    </p>
                  </div>

                  <div className="mt-5 flex justify-end">
                    <Button
                      onClick={() => savePlan(plan.id)}
                      disabled={!!savingPlans[plan.id]}
                      className="rounded-full bg-foreground hover:bg-foreground/90 text-white"
                      data-testid={`save-plan-${plan.id}`}
                    >
                      {savingPlans[plan.id] ? "Saving…" : "Save changes"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
