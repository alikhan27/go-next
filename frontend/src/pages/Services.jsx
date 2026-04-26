import { useCallback, useEffect, useState } from "react";
import { useParams, Link, Navigate } from "react-router-dom";
import { api, formatApiErrorDetail } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { usePlans } from "../context/PlanContext";
import DashboardHeader from "../components/DashboardHeader";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Switch } from "../components/ui/switch";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "../components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "../components/ui/alert-dialog";
import { toast } from "sonner";
import { Plus, Trash2, Sparkles, ArrowLeft, Pencil, Check, X } from "lucide-react";
import { useTableControls } from "../hooks/useTableControls";
import {
  TableToolbar,
  SortableHead,
  TablePagination,
} from "../components/TableControls";

/**
 * Owner page to manage the services offered by a single outlet.
 * Premium and Premium Plus only — Free plan owners see an upgrade card.
 *
 * Each service has a name + duration in minutes, which the backend uses
 * to compute accurate ETA on customer tickets.
 */
export default function Services() {
  const { businessId } = useParams();
  const { auth } = useAuth();
  const { isPaidPlan, planLimits, planLabel } = usePlans();
  const businesses = auth?.businesses || [];
  const business = businesses.find((b) => b.id === businessId);

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState({ name: "", duration_minutes: 30, price: "" });
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState({ name: "", duration_minutes: 30, price: 0 });

  const limits = planLimits(auth?.user);
  const canManage = isPaidPlan(auth?.user);

  const table = useTableControls(items, {
    searchKeys: ["name"],
    initialSort: { key: "sort_order", dir: "asc" },
  });

  const load = useCallback(async () => {
    if (!business) return;
    setLoading(true);
    try {
      const { data } = await api.get(`/business/${business.id}/services`);
      setItems(data);
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || err.message);
    } finally {
      setLoading(false);
    }
  }, [business]);

  useEffect(() => {
    load();
  }, [load]);

  if (auth === null) return null;
  if (!business) {
    if (businesses.length === 0) return <Navigate to="/dashboard/outlets" replace />;
    return <Navigate to={`/dashboard/${businesses[0].id}/services`} replace />;
  }

  const atLimit = items.length >= limits.max_services;

  const create = async (e) => {
    e.preventDefault();
    if (!draft.name.trim()) return;
    setCreating(true);
    try {
      await api.post(`/business/${business.id}/services`, {
        name: draft.name.trim(),
        duration_minutes: Number(draft.duration_minutes) || 30,
        price: Number(draft.price) || 0,
        sort_order: items.length,
      });
      setDraft({ name: "", duration_minutes: 30, price: "" });
      toast.success("Service added");
      load();
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || err.message);
    } finally {
      setCreating(false);
    }
  };

  const beginEdit = (s) => {
    setEditingId(s.id);
    setEditDraft({ name: s.name, duration_minutes: s.duration_minutes, price: s.price ?? 0 });
  };

  const saveEdit = async (s) => {
    try {
      await api.patch(`/business/${business.id}/services/${s.id}`, {
        name: editDraft.name.trim() || s.name,
        duration_minutes: Number(editDraft.duration_minutes) || s.duration_minutes,
        price: Number(editDraft.price) || 0,
      });
      setEditingId(null);
      toast.success("Updated");
      load();
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || err.message);
    }
  };

  const toggleActive = async (s, value) => {
    try {
      await api.patch(`/business/${business.id}/services/${s.id}`, { is_active: value });
      load();
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || err.message);
    }
  };

  const remove = async (s) => {
    try {
      await api.delete(`/business/${business.id}/services/${s.id}`);
      toast.success(`${s.name} removed`);
      load();
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || err.message);
    }
  };

  return (
    <div className="min-h-screen bg-background" data-testid="services-page">
      <DashboardHeader activeTab="services" />
      <main className="mx-auto max-w-4xl px-5 py-10">
        <Link
          to={`/dashboard/${business.id}`}
          className="text-sm text-stone-500 hover:text-stone-800 inline-flex items-center gap-1"
          data-testid="services-back"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to queue
        </Link>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.26em] text-primary">Services</p>
            <h1 className="font-serif-display text-4xl sm:text-5xl mt-2 leading-none">
              {business.business_name}
            </h1>
            <p className="mt-2 text-sm text-stone-600 max-w-xl">
              List the services you offer with the average minutes each takes — Go-Next uses this to show customers an accurate wait time.
            </p>
          </div>
          {canManage && (
            <span className="rounded-full bg-stone-100 text-stone-600 border border-stone-200 px-3 py-1 text-[11px]">
              {items.length} / {limits.max_services} on {planLabel(auth?.user)}
            </span>
          )}
        </div>

        {!canManage ? (
          <div
            className="mt-10 rounded-3xl border-2 border-primary/40 bg-white p-8 text-center"
            data-testid="services-upgrade-card"
          >
            <Sparkles className="mx-auto h-7 w-7 text-primary" />
            <h2 className="font-serif-display text-3xl mt-4">Custom services unlock on Premium.</h2>
            <p className="mt-2 text-stone-600 max-w-md mx-auto text-sm">
              Tell customers what you offer — haircut, beard trim, colouring — and Go-Next will use the duration of each to power accurate ETAs.
            </p>
            <Link to="/#pricing" className="mt-6 inline-block">
              <Button className="rounded-full bg-primary hover:bg-primary/90 text-white h-11 px-6 press" data-testid="services-see-pricing">
                See plans
              </Button>
            </Link>
          </div>
        ) : (
          <>
            <form
              onSubmit={create}
              className="mt-8 rounded-2xl border border-stone-200 bg-white p-5 sm:p-6 grid gap-3 sm:grid-cols-[1fr_140px_140px_auto] items-end"
              data-testid="services-create-form"
            >
              <div>
                <Label>Service name</Label>
                <Input
                  className="mt-1.5 h-11"
                  placeholder="e.g. Haircut, Beard trim, Hair colour"
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  disabled={atLimit}
                  data-testid="service-name-input"
                />
              </div>
              <div>
                <Label>Minutes</Label>
                <Input
                  type="number"
                  min={1}
                  max={480}
                  className="mt-1.5 h-11"
                  value={draft.duration_minutes}
                  onChange={(e) => setDraft({ ...draft, duration_minutes: e.target.value })}
                  disabled={atLimit}
                  data-testid="service-duration-input"
                />
              </div>
              <div>
                <Label>Price (₹)</Label>
                <Input
                  type="number"
                  min={0}
                  step="1"
                  className="mt-1.5 h-11"
                  placeholder="0"
                  value={draft.price}
                  onChange={(e) => setDraft({ ...draft, price: e.target.value })}
                  disabled={atLimit}
                  data-testid="service-price-input"
                />
              </div>
              <Button
                type="submit"
                disabled={creating || atLimit || !draft.name.trim()}
                className="h-11 rounded-full bg-foreground hover:bg-foreground/90 text-white press"
                data-testid="service-add-btn"
              >
                <Plus className="h-4 w-4 mr-1.5" /> {creating ? "Adding…" : "Add service"}
              </Button>
              {atLimit && (
                <p className="sm:col-span-4 text-xs text-stone-500">
                  You&apos;re at your plan&apos;s service limit ({limits.max_services}). Remove one or upgrade for more.
                </p>
              )}
            </form>

            <div className="mt-6 rounded-2xl border border-stone-200 bg-white overflow-hidden">
              <TableToolbar query={table.query} onQueryChange={table.setSearch} total={table.total} pageSize={table.pageSize} onPageSizeChange={table.setPageSize} />
              <Table>
                <TableHeader>
                  <TableRow className="bg-secondary/40">
                    <SortableHead label="Service" sortKey="name" sort={table.sort} onToggle={table.toggleSort} className="pl-5" />
                    <SortableHead label="Minutes" sortKey="duration_minutes" sort={table.sort} onToggle={table.toggleSort} className="w-[110px]" />
                    <SortableHead label="Price" sortKey="price" sort={table.sort} onToggle={table.toggleSort} className="w-[120px]" />
                    <SortableHead label="Active" sortKey="is_active" sort={table.sort} onToggle={table.toggleSort} className="w-[100px]" />
                    <TableHead className="w-[180px] pr-5 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={5} className="text-center text-stone-400 py-8">Loading…</TableCell></TableRow>
                  ) : table.total === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center text-stone-500 py-10" data-testid="services-empty">
                      No services found.
                    </TableCell></TableRow>
                  ) : (
                    table.visible.map((s) => {
                      const isEditing = editingId === s.id;
                      return (
                        <TableRow key={s.id} data-testid={`service-row-${s.id}`}>
                          <TableCell className="pl-5">
                            {isEditing ? (
                              <Input
                                className="h-9"
                                value={editDraft.name}
                                onChange={(e) => setEditDraft({ ...editDraft, name: e.target.value })}
                                data-testid={`service-edit-name-${s.id}`}
                              />
                            ) : (
                              <span className="font-medium text-stone-800">{s.name}</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {isEditing ? (
                              <Input
                                type="number" min={1} max={480}
                                className="h-9 w-24"
                                value={editDraft.duration_minutes}
                                onChange={(e) => setEditDraft({ ...editDraft, duration_minutes: e.target.value })}
                                data-testid={`service-edit-duration-${s.id}`}
                              />
                            ) : (
                              <span className="text-stone-700">{s.duration_minutes} min</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {isEditing ? (
                              <Input
                                type="number" min={0} step="1"
                                className="h-9 w-24"
                                value={editDraft.price}
                                onChange={(e) => setEditDraft({ ...editDraft, price: e.target.value })}
                                data-testid={`service-edit-price-${s.id}`}
                              />
                            ) : (
                              <span className="text-stone-700">
                                {s.price > 0 ? `₹${Number(s.price).toLocaleString("en-IN")}` : <span className="text-stone-400">—</span>}
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Switch
                              checked={!!s.is_active}
                              onCheckedChange={(v) => toggleActive(s, v)}
                              data-testid={`service-toggle-${s.id}`}
                            />
                          </TableCell>
                          <TableCell className="text-right pr-5">
                            <div className="flex justify-end gap-2">
                              {isEditing ? (
                                <>
                                  <Button size="sm" variant="ghost" className="rounded-full text-stone-500 h-8" onClick={() => setEditingId(null)} data-testid={`service-cancel-${s.id}`}>
                                    <X className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button size="sm" className="rounded-full bg-success hover:bg-success/90 text-white h-8" onClick={() => saveEdit(s)} data-testid={`service-save-${s.id}`}>
                                    <Check className="h-3.5 w-3.5" />
                                  </Button>
                                </>
                              ) : (
                                <>
                                  <Button size="sm" variant="ghost" className="rounded-full text-stone-500 h-8" onClick={() => beginEdit(s)} data-testid={`service-edit-${s.id}`}>
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button size="sm" variant="ghost" className="rounded-full text-red-600 h-8" data-testid={`service-delete-${s.id}`}>
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Remove {s.name}?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          New customers won&apos;t be able to pick this service. Tickets already in the queue keep their current service.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction
                                          className="bg-red-600 hover:bg-red-500"
                                          onClick={() => remove(s)}
                                          data-testid={`service-confirm-delete-${s.id}`}
                                        >
                                          Remove
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                        );
                        })
                        )}
                        </TableBody>
                        </Table>
                        <TablePagination page={table.page} totalPages={table.totalPages} onPageChange={table.setPage} />
                        </div>
          </>
        )}
      </main>
    </div>
  );
}
