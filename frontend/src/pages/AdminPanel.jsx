import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, formatApiErrorDetail } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "../components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "../components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "../components/ui/alert-dialog";
import { toast } from "sonner";
import {
  ChevronDown, LogOut, Users, Building2, LayoutDashboard, ArrowUpRight, Shield, Trash2, Tv,
} from "lucide-react";

function Stat({ label, value, accent, hint, testid }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5" data-testid={testid}>
      <p className="text-[11px] uppercase tracking-[0.22em] text-stone-500">{label}</p>
      <p className={`font-serif-display text-4xl mt-2 ${accent || "text-[#2C302E]"}`}>{value}</p>
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
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, u, o] = await Promise.all([
        api.get("/admin/stats"),
        api.get("/admin/users"),
        api.get("/admin/businesses"),
      ]);
      setStats(s.data);
      setUsers(u.data);
      setOutlets(o.data);
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || err.message);
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
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || err.message);
    }
  };

  const deleteOutlet = async (id) => {
    try {
      await api.delete(`/admin/businesses/${id}`);
      toast.success("Outlet deleted");
      load();
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || err.message);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  const planStyle = (p) =>
    p === "premium"
      ? "bg-[#C47C5C]/15 text-[#A86246] border-[#C47C5C]/40"
      : "bg-stone-100 text-stone-600 border-stone-200";

  return (
    <div className="min-h-screen bg-[#F9F8F6]">
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-[#F9F8F6]/90 border-b border-stone-200/70">
        <div className="mx-auto max-w-6xl px-5 py-3 flex flex-wrap items-center gap-3">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#2C302E] text-white font-serif-display">g</div>
            <span className="text-sm font-semibold">Go-Next</span>
            <span className="hidden sm:inline-flex items-center gap-1 rounded-full border border-[#7D9276]/40 bg-[#7D9276]/10 px-3 py-0.5 text-[10px] uppercase tracking-[0.22em] text-[#4c6547]">
              <Shield className="h-3 w-3" /> Admin
            </span>
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="sm" className="rounded-full text-stone-600" onClick={load} data-testid="admin-refresh">
              Refresh
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="rounded-full border-stone-300" data-testid="admin-menu">
                  <span className="hidden sm:inline mr-1.5 text-stone-700">{auth?.user?.name || "Admin"}</span>
                  <ChevronDown className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <p className="font-medium">{auth?.user?.name}</p>
                  <p className="text-xs text-stone-500">{auth?.user?.email}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} data-testid="admin-logout">
                  <LogOut className="h-4 w-4 mr-2" /> Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-10">
        <p className="text-[11px] uppercase tracking-[0.26em] text-[#A86246]">Platform control</p>
        <h1 className="font-serif-display text-4xl sm:text-5xl mt-2 leading-none">Super admin</h1>
        <p className="mt-2 text-stone-600 text-sm">Everything running on Go-Next, across every owner.</p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" data-testid="admin-stats">
          <Stat label="Total owners" value={stats?.total_users ?? "—"} hint={`${stats?.premium_users ?? 0} on Premium`} testid="admin-stat-users" />
          <Stat label="Outlets" value={stats?.total_businesses ?? "—"} accent="text-[#A86246]" testid="admin-stat-outlets" />
          <Stat label="Tickets (all-time)" value={stats?.total_tickets ?? "—"} testid="admin-stat-tickets" />
          <Stat label="Completed today" value={stats?.completed_today ?? "—"} accent="text-[#4c6547]" testid="admin-stat-today" />
        </div>

        <Tabs defaultValue="users" className="mt-10">
          <TabsList className="bg-white border border-stone-200 rounded-full p-1">
            <TabsTrigger value="users" className="rounded-full data-[state=active]:bg-[#F4EFE8] data-[state=active]:text-[#A86246]" data-testid="admin-tab-users">
              <Users className="h-3.5 w-3.5 mr-1.5" /> Owners
            </TabsTrigger>
            <TabsTrigger value="outlets" className="rounded-full data-[state=active]:bg-[#F4EFE8] data-[state=active]:text-[#A86246]" data-testid="admin-tab-outlets">
              <Building2 className="h-3.5 w-3.5 mr-1.5" /> Outlets
            </TabsTrigger>
            <TabsTrigger value="overview" className="rounded-full data-[state=active]:bg-[#F4EFE8] data-[state=active]:text-[#A86246]" data-testid="admin-tab-overview">
              <LayoutDashboard className="h-3.5 w-3.5 mr-1.5" /> Overview
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="mt-6">
            <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden" data-testid="admin-users-table">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Owner</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead className="text-center">Outlets</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead className="text-right pr-5">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading && (
                    <TableRow><TableCell colSpan={5} className="text-center py-10 text-stone-500">Loading…</TableCell></TableRow>
                  )}
                  {!loading && users.length === 0 && (
                    <TableRow><TableCell colSpan={5} className="text-center py-10 text-stone-500">No owners yet.</TableCell></TableRow>
                  )}
                  {users.map((u) => (
                    <TableRow key={u.id} data-testid={`admin-user-row-${u.id}`}>
                      <TableCell className="font-medium">{u.name || "—"}</TableCell>
                      <TableCell className="text-stone-600">{u.email}</TableCell>
                      <TableCell className="text-center">{u.outlet_count}</TableCell>
                      <TableCell>
                        <Badge className={`rounded-full border font-normal ${planStyle(u.plan)}`}>{u.plan}</Badge>
                      </TableCell>
                      <TableCell className="text-right pr-5">
                        {u.plan === "premium" ? (
                          <Button size="sm" variant="outline" className="rounded-full border-stone-300"
                            onClick={() => setPlan(u.id, "free")}
                            data-testid={`downgrade-${u.id}`}>
                            Downgrade
                          </Button>
                        ) : (
                          <Button size="sm"
                            className="rounded-full bg-[#C47C5C] hover:bg-[#A86246] text-white"
                            onClick={() => setPlan(u.id, "premium")}
                            data-testid={`upgrade-${u.id}`}>
                            <ArrowUpRight className="h-3.5 w-3.5 mr-1" /> Upgrade
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="outlets" className="mt-6">
            <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden" data-testid="admin-outlets-table">
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
                    <TableRow><TableCell colSpan={6} className="text-center py-10 text-stone-500">Loading…</TableCell></TableRow>
                  )}
                  {!loading && outlets.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center py-10 text-stone-500">No outlets yet.</TableCell></TableRow>
                  )}
                  {outlets.map((b) => (
                    <TableRow key={b.id} data-testid={`admin-outlet-row-${b.id}`}>
                      <TableCell>
                        <p className="font-medium">{b.business_name}</p>
                        <p className="text-xs text-stone-500 capitalize">{b.business_type}</p>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm">{b.owner_name || "—"}</p>
                        <p className="text-xs text-stone-500">{b.owner_email}</p>
                      </TableCell>
                      <TableCell className="text-stone-600 text-sm">
                        {[b.city, b.state, b.pincode].filter(Boolean).join(", ") || "—"}
                      </TableCell>
                      <TableCell className="text-center">{b.total_chairs}</TableCell>
                      <TableCell>
                        <span className={`inline-flex h-2 w-2 rounded-full ${b.is_online ? "bg-[#7D9276]" : "bg-stone-400"}`} />
                        <span className="ml-2 text-xs text-stone-600">{b.is_online ? "Accepting" : "Paused"}</span>
                      </TableCell>
                      <TableCell className="text-right pr-5">
                        <div className="flex justify-end gap-2">
                          <Link to={`/display/${b.id}`} target="_blank" rel="noreferrer" data-testid={`admin-open-display-${b.id}`}>
                            <Button size="sm" variant="ghost" className="rounded-full text-stone-600" title="Open TV display">
                              <Tv className="h-4 w-4" />
                            </Button>
                          </Link>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="ghost" className="rounded-full text-red-600" data-testid={`admin-delete-outlet-${b.id}`}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete {b.business_name}?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This permanently removes the outlet and all its tickets. This affects the owner ({b.owner_email}).
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
            </div>
          </TabsContent>

          <TabsContent value="overview" className="mt-6">
            <div className="rounded-2xl border border-stone-200 bg-white p-6 grid gap-4 sm:grid-cols-3" data-testid="admin-overview">
              <Stat label="Free owners" value={stats?.free_users ?? "—"} />
              <Stat label="Premium owners" value={stats?.premium_users ?? "—"} accent="text-[#A86246]" />
              <Stat label="Conversion" value={stats && stats.total_users ? `${Math.round((stats.premium_users / stats.total_users) * 100)}%` : "—"} hint="of owners on Premium" />
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
