import { FormEvent, useEffect, useState } from "react";
import { api, Company, Customer, CustomerPackage, Package, PackageAssignment, Promotion } from "../api";
import { Modal } from "../components/Modal";
import { Badge, statusTone } from "../components/Badge";

function fmt(date: string | null) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function daysUntil(date: string | null) {
  if (!date) return null;
  return Math.ceil((new Date(date).getTime() - Date.now()) / 86400000);
}

function addDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// ── Customer form ─────────────────────────────────────────────────────────────
interface CustomerFormData {
  firstName: string; lastName: string; email: string; phone: string;
  companyId: string; status: string; notes: string;
}
const CUSTOMER_EMPTY: CustomerFormData = {
  firstName: "", lastName: "", email: "", phone: "",
  companyId: "", status: "active", notes: "",
};

// ── Package assignment form ───────────────────────────────────────────────────
interface PkgFormData {
  packageId: string; promotionId: string;
  joinedAt: string; expiresAt: string; pricePaid: string;
}

// ── Main component ────────────────────────────────────────────────────────────
export function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [packages,  setPackages]  = useState<Package[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [search, setSearch]       = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  // Customer modal
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [editingCustomer, setEditingCustomer]     = useState<Customer | null>(null);
  const [custForm, setCustForm]                   = useState<CustomerFormData>(CUSTOMER_EMPTY);
  const [custFormErr, setCustFormErr]             = useState<string | null>(null);
  const [custSaving, setCustSaving]               = useState(false);

  // Package assignment modal
  const [pkgModalCustomer, setPkgModalCustomer] = useState<Customer | null>(null);
  const [pkgForm, setPkgForm]                   = useState<PkgFormData>({
    packageId: "", promotionId: "", joinedAt: new Date().toISOString().slice(0, 10),
    expiresAt: addDays(30), pricePaid: "",
  });
  const [pkgFormErr, setPkgFormErr]   = useState<string | null>(null);
  const [pkgSaving, setPkgSaving]     = useState(false);

  // History modal
  const [histCustomer, setHistCustomer]     = useState<Customer | null>(null);
  const [history, setHistory]               = useState<CustomerPackage[]>([]);
  const [histLoading, setHistLoading]       = useState(false);

  async function load(params?: { search?: string; status?: string }) {
    setLoading(true);
    try {
      const [c, co, pk, pr] = await Promise.all([
        api.listCustomers(params),
        api.listCompanies(),
        api.listPackages(),
        api.listPromotions(),
      ]);
      setCustomers(c); setCompanies(co); setPackages(pk); setPromotions(pr);
    } catch (e: unknown) { setError(e instanceof Error ? e.message : "Error"); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);

  function applyFilters() {
    void load({ search: search || undefined, status: filterStatus || undefined });
  }

  // ── Customer CRUD ──────────────────────────────────────────────────────────
  function openAdd() {
    setEditingCustomer(null);
    setCustForm(CUSTOMER_EMPTY);
    setCustFormErr(null);
    setShowCustomerModal(true);
  }

  function openEdit(c: Customer) {
    setEditingCustomer(c);
    setCustForm({
      firstName: c.firstName, lastName: c.lastName, email: c.email,
      phone: c.phone ?? "", companyId: c.companyId ? String(c.companyId) : "",
      status: c.status, notes: c.notes ?? "",
    });
    setCustFormErr(null);
    setShowCustomerModal(true);
  }

  async function onCustomerSubmit(e: FormEvent) {
    e.preventDefault();
    setCustSaving(true); setCustFormErr(null);
    const body = {
      firstName: custForm.firstName, lastName: custForm.lastName,
      email: custForm.email, phone: custForm.phone || null,
      companyId: custForm.companyId ? Number(custForm.companyId) : null,
      status: custForm.status as Customer["status"], notes: custForm.notes || null,
    };
    try {
      if (editingCustomer) {
        const u = await api.updateCustomer(editingCustomer.id, body);
        setCustomers((p) => p.map((x) => (x.id === u.id ? u : x)));
      } else {
        const c = await api.createCustomer(body);
        setCustomers((p) => [c, ...p]);
      }
      setShowCustomerModal(false);
    } catch (e: unknown) { setCustFormErr(e instanceof Error ? e.message : "Error"); }
    finally { setCustSaving(false); }
  }

  async function onDeleteCustomer(c: Customer) {
    if (!confirm(`Delete customer "${c.firstName} ${c.lastName}"? This cannot be undone.`)) return;
    try {
      await api.deleteCustomer(c.id);
      setCustomers((p) => p.filter((x) => x.id !== c.id));
    } catch (e: unknown) { alert(e instanceof Error ? e.message : "Error"); }
  }

  // ── Package assignment ─────────────────────────────────────────────────────
  function openPkgModal(c: Customer) {
    setPkgModalCustomer(c);
    setPkgForm({
      packageId: c.packageId ? String(c.packageId) : "",
      promotionId: c.promotionId ? String(c.promotionId) : "",
      joinedAt: new Date().toISOString().slice(0, 10),
      expiresAt: addDays(30), pricePaid: c.pricePaid ? String(c.pricePaid) : "",
    });
    setPkgFormErr(null);
  }

  function onPackageSelect(pkgId: string) {
    const pkg = packages.find((p) => String(p.id) === pkgId);
    setPkgForm((f) => ({
      ...f,
      packageId: pkgId,
      expiresAt: pkg ? addDays(pkg.durationDays) : addDays(30),
      pricePaid: pkg ? String(pkg.price) : "",
    }));
  }

  async function onPkgSubmit(e: FormEvent) {
    e.preventDefault();
    if (!pkgModalCustomer) return;
    setPkgSaving(true); setPkgFormErr(null);
    const assignment: PackageAssignment = {
      packageId:   Number(pkgForm.packageId),
      promotionId: pkgForm.promotionId ? Number(pkgForm.promotionId) : null,
      joinedAt:    new Date(pkgForm.joinedAt).toISOString(),
      expiresAt:   new Date(pkgForm.expiresAt).toISOString(),
      pricePaid:   pkgForm.pricePaid ? parseFloat(pkgForm.pricePaid) : null,
    };
    try {
      await api.assignPackage({ ...assignment, customerId: pkgModalCustomer.id });
      // Refresh the customer row
      const updated = await api.listCustomers();
      setCustomers(updated);
      setPkgModalCustomer(null);
    } catch (e: unknown) { setPkgFormErr(e instanceof Error ? e.message : "Error"); }
    finally { setPkgSaving(false); }
  }

  // ── History ────────────────────────────────────────────────────────────────
  async function openHistory(c: Customer) {
    setHistCustomer(c);
    setHistLoading(true);
    try {
      setHistory(await api.listCustomerPackages({ customerId: c.id }));
    } catch { setHistory([]); }
    finally { setHistLoading(false); }
  }

  const setCust = (k: keyof CustomerFormData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setCustForm((f) => ({ ...f, [k]: e.target.value }));

  if (loading) return <p className="text-slate-500 p-4">Loading...</p>;
  if (error)   return <p className="text-rose-600 p-4">{error}</p>;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Customers</h1>
          <p className="text-sm text-slate-500">{customers.length} customers</p>
        </div>
        <button onClick={openAdd} className="btn-primary">+ Add Customer</button>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <input
          className="input flex-1"
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") applyFilters(); }}
        />
        <select className="input w-40" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="churned">Churned</option>
        </select>
        <button onClick={applyFilters} className="btn-primary px-5">Search</button>
        <button onClick={() => { setSearch(""); setFilterStatus(""); void load(); }} className="btn-ghost">Clear</button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-x-auto">
        {customers.length === 0 ? (
          <p className="p-8 text-center text-slate-500">No customers found.</p>
        ) : (
          <table className="w-full text-sm min-w-[900px]">
            <thead>
              <tr className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wide">
                <th className="px-4 py-3 text-left">Customer</th>
                <th className="px-4 py-3 text-left">Company</th>
                <th className="px-4 py-3 text-left">Package</th>
                <th className="px-4 py-3 text-left">Joined</th>
                <th className="px-4 py-3 text-left">Expires</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {customers.map((c) => {
                const days = daysUntil(c.expiresAt);
                const expiringSoon = days !== null && days >= 0 && days <= 7;
                const expired = days !== null && days < 0;
                return (
                  <tr key={c.id} className={`hover:bg-slate-50 ${expiringSoon ? "bg-amber-50/30" : ""} ${expired ? "bg-rose-50/30" : ""}`}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{c.firstName} {c.lastName}</div>
                      <div className="text-xs text-slate-500">{c.email}</div>
                      {c.phone && <div className="text-xs text-slate-400">{c.phone}</div>}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{c.companyName ?? "—"}</td>
                    <td className="px-4 py-3">
                      {c.packageName
                        ? <span className="font-medium text-blue-700">{c.packageName}</span>
                        : <span className="text-slate-400 text-xs">No package</span>}
                      {c.promotionName && (
                        <div className="text-xs text-purple-600">🏷 {c.promotionName}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{fmt(c.joinedAt)}</td>
                    <td className="px-4 py-3">
                      {c.expiresAt ? (
                        <>
                          <div className={expired ? "text-rose-600 font-medium" : expiringSoon ? "text-amber-700 font-medium" : "text-slate-600"}>
                            {fmt(c.expiresAt)}
                          </div>
                          {days !== null && (
                            <div className="text-xs text-slate-400">
                              {days < 0 ? `${Math.abs(days)}d ago` : `in ${days}d`}
                            </div>
                          )}
                        </>
                      ) : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <Badge label={c.status} tone={statusTone(c.status)} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1 flex-wrap">
                        <button onClick={() => openPkgModal(c)} className="btn-sm-blue">
                          {c.packageId ? "Change Pkg" : "Assign Pkg"}
                        </button>
                        <button onClick={() => openHistory(c)} className="btn-sm-ghost">History</button>
                        <button onClick={() => openEdit(c)} className="btn-sm-ghost">Edit</button>
                        <button onClick={() => onDeleteCustomer(c)} className="btn-sm-danger">Delete</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Customer modal ── */}
      {showCustomerModal && (
        <Modal title={editingCustomer ? "Edit Customer" : "Add Customer"} onClose={() => setShowCustomerModal(false)} size="lg">
          <form onSubmit={(e) => { void onCustomerSubmit(e); }} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">First name *</label>
                <input className="input" value={custForm.firstName} onChange={setCust("firstName")} required />
              </div>
              <div>
                <label className="label">Last name *</label>
                <input className="input" value={custForm.lastName} onChange={setCust("lastName")} required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Email *</label>
                <input type="email" className="input" value={custForm.email} onChange={setCust("email")} required />
              </div>
              <div>
                <label className="label">Phone</label>
                <input className="input" value={custForm.phone} onChange={setCust("phone")} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Company</label>
                <select className="input" value={custForm.companyId} onChange={setCust("companyId")}>
                  <option value="">— None —</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Status</label>
                <select className="input" value={custForm.status} onChange={setCust("status")}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="churned">Churned</option>
                </select>
              </div>
            </div>
            <div>
              <label className="label">Notes</label>
              <textarea className="input" rows={2} value={custForm.notes} onChange={setCust("notes")} />
            </div>
            {custFormErr && <p className="text-sm text-rose-600">{custFormErr}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowCustomerModal(false)} className="btn-ghost">Cancel</button>
              <button type="submit" disabled={custSaving} className="btn-primary">
                {custSaving ? "Saving..." : "Save"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Package assignment modal ── */}
      {pkgModalCustomer && (
        <Modal
          title={`Assign Package — ${pkgModalCustomer.firstName} ${pkgModalCustomer.lastName}`}
          onClose={() => setPkgModalCustomer(null)}
        >
          <form onSubmit={(e) => { void onPkgSubmit(e); }} className="space-y-4">
            <div>
              <label className="label">Package *</label>
              <select className="input" value={pkgForm.packageId}
                onChange={(e) => onPackageSelect(e.target.value)} required>
                <option value="">— Select package —</option>
                {packages.filter((p) => p.active).map((p) => (
                  <option key={p.id} value={p.id}>{p.name} (${p.price} / {p.durationDays}d)</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Promotion <span className="text-slate-400">(optional)</span></label>
              <select className="input" value={pkgForm.promotionId}
                onChange={(e) => setPkgForm((f) => ({ ...f, promotionId: e.target.value }))}>
                <option value="">— None —</option>
                {promotions.filter((p) => p.active).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.discountPercent != null && ` (${p.discountPercent}%)`}
                    {p.discountAmount  != null && ` ($${p.discountAmount} off)`}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Join date *</label>
                <input type="date" className="input" value={pkgForm.joinedAt}
                  onChange={(e) => setPkgForm((f) => ({ ...f, joinedAt: e.target.value }))} required />
              </div>
              <div>
                <label className="label">Expiry date *</label>
                <input type="date" className="input" value={pkgForm.expiresAt}
                  onChange={(e) => setPkgForm((f) => ({ ...f, expiresAt: e.target.value }))} required />
              </div>
            </div>
            <div>
              <label className="label">Price paid ($)</label>
              <input type="number" step="0.01" min="0" className="input" value={pkgForm.pricePaid}
                onChange={(e) => setPkgForm((f) => ({ ...f, pricePaid: e.target.value }))} />
            </div>
            {pkgFormErr && <p className="text-sm text-rose-600">{pkgFormErr}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setPkgModalCustomer(null)} className="btn-ghost">Cancel</button>
              <button type="submit" disabled={pkgSaving} className="btn-primary">
                {pkgSaving ? "Saving..." : "Assign"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── History modal ── */}
      {histCustomer && (
        <Modal
          title={`Package history — ${histCustomer.firstName} ${histCustomer.lastName}`}
          onClose={() => setHistCustomer(null)}
          size="lg"
        >
          {histLoading ? (
            <p className="text-slate-500">Loading...</p>
          ) : history.length === 0 ? (
            <p className="text-slate-500">No package history.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-slate-600 border-b border-slate-200">
                  <th className="py-2 text-left">Package</th>
                  <th className="py-2 text-left">Joined</th>
                  <th className="py-2 text-left">Expires</th>
                  <th className="py-2 text-left">Price</th>
                  <th className="py-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {history.map((h) => (
                  <tr key={h.id}>
                    <td className="py-2 font-medium text-slate-800">{h.packageName}</td>
                    <td className="py-2 text-slate-600">{fmt(h.joinedAt)}</td>
                    <td className="py-2 text-slate-600">{fmt(h.expiresAt)}</td>
                    <td className="py-2 text-slate-600">{h.pricePaid != null ? `$${h.pricePaid}` : "—"}</td>
                    <td className="py-2"><Badge label={h.status} tone={statusTone(h.status)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Modal>
      )}
    </div>
  );
}
