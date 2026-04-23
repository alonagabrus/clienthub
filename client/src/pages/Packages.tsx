import { FormEvent, useEffect, useState } from "react";
import { api, Package } from "../api";
import { Modal } from "../components/Modal";
import { Badge } from "../components/Badge";

const EMPTY = {
  name: "", description: "", price: "", durationDays: "30", features: "", active: true,
};

export function Packages() {
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing]     = useState<Package | null>(null);
  const [form, setForm]           = useState(EMPTY);
  const [saving, setSaving]       = useState(false);
  const [formErr, setFormErr]     = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try { setPackages(await api.listPackages()); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : "Error"); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  function openAdd() {
    setEditing(null); setForm(EMPTY); setFormErr(null); setShowModal(true);
  }
  function openEdit(p: Package) {
    setEditing(p);
    setForm({
      name: p.name, description: p.description ?? "",
      price: String(p.price), durationDays: String(p.durationDays),
      features: p.features.join(", "), active: p.active,
    });
    setFormErr(null); setShowModal(true);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true); setFormErr(null);
    const body = {
      name:         form.name,
      description:  form.description || null,
      price:        parseFloat(form.price),
      durationDays: parseInt(form.durationDays, 10),
      features:     form.features ? form.features.split(",").map((f) => f.trim()).filter(Boolean) : [],
      active:       form.active,
    };
    try {
      if (editing) {
        const u = await api.updatePackage(editing.id, body);
        setPackages((p) => p.map((x) => (x.id === u.id ? u : x)));
      } else {
        const c = await api.createPackage(body);
        setPackages((p) => [...p, c]);
      }
      setShowModal(false);
    } catch (e: unknown) { setFormErr(e instanceof Error ? e.message : "Error"); }
    finally { setSaving(false); }
  }

  async function onDelete(pkg: Package) {
    if (!confirm(`Delete package "${pkg.name}"?`)) return;
    try {
      await api.deletePackage(pkg.id);
      setPackages((p) => p.filter((x) => x.id !== pkg.id));
    } catch (e: unknown) { alert(e instanceof Error ? e.message : "Error"); }
  }

  const setField = (k: keyof typeof EMPTY) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  if (loading) return <p className="text-slate-500 p-4">Loading...</p>;
  if (error)   return <p className="text-rose-600 p-4">{error}</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Packages</h1>
          <p className="text-sm text-slate-500">{packages.length} packages</p>
        </div>
        <button onClick={openAdd} className="btn-primary">+ Add Package</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {packages.map((pkg) => (
          <div key={pkg.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold text-slate-900">{pkg.name}</h3>
                {pkg.description && <p className="text-sm text-slate-500 mt-0.5">{pkg.description}</p>}
              </div>
              <Badge label={pkg.active ? "Active" : "Inactive"} tone={pkg.active ? "green" : "gray"} />
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-slate-900">${pkg.price}</span>
              <span className="text-sm text-slate-500">/ {pkg.durationDays}d</span>
            </div>
            {pkg.features.length > 0 && (
              <ul className="space-y-1">
                {pkg.features.map((f, i) => (
                  <li key={i} className="text-sm text-slate-600 flex items-center gap-1.5">
                    <span className="text-emerald-500">✓</span> {f}
                  </li>
                ))}
              </ul>
            )}
            <div className="flex gap-2 pt-1">
              <button onClick={() => openEdit(pkg)} className="btn-sm-ghost flex-1">Edit</button>
              <button onClick={() => onDelete(pkg)} className="btn-sm-danger">Delete</button>
            </div>
          </div>
        ))}
        {packages.length === 0 && (
          <p className="col-span-3 text-center text-slate-500 py-8">No packages yet.</p>
        )}
      </div>

      {showModal && (
        <Modal title={editing ? "Edit Package" : "Add Package"} onClose={() => setShowModal(false)}>
          <form onSubmit={(e) => { void onSubmit(e); }} className="space-y-4">
            <div>
              <label className="label">Name *</label>
              <input className="input" value={form.name} onChange={setField("name")} required />
            </div>
            <div>
              <label className="label">Description</label>
              <textarea className="input" rows={2} value={form.description} onChange={setField("description")} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Price ($) *</label>
                <input type="number" step="0.01" min="0" className="input" value={form.price} onChange={setField("price")} required />
              </div>
              <div>
                <label className="label">Duration (days) *</label>
                <input type="number" min="1" className="input" value={form.durationDays} onChange={setField("durationDays")} required />
              </div>
            </div>
            <div>
              <label className="label">Features <span className="text-slate-400">(comma-separated)</span></label>
              <textarea className="input" rows={2} value={form.features} onChange={setField("features")}
                placeholder="5 users, Email support, 1GB storage" />
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.active}
                onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} />
              <span className="text-sm text-slate-700">Active</span>
            </label>
            {formErr && <p className="text-sm text-rose-600">{formErr}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowModal(false)} className="btn-ghost">Cancel</button>
              <button type="submit" disabled={saving} className="btn-primary">{saving ? "Saving..." : "Save"}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
