import { FormEvent, useEffect, useState } from "react";
import { api, Promotion } from "../api";
import { Modal } from "../components/Modal";
import { Badge } from "../components/Badge";

function toLocalDate(iso: string) {
  return iso ? iso.slice(0, 10) : "";
}

const EMPTY = {
  name: "", description: "", discountPercent: "", discountAmount: "",
  validFrom: "", validUntil: "", active: true,
};

export function Promotions() {
  const [promos, setPromos]       = useState<Promotion[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing]     = useState<Promotion | null>(null);
  const [form, setForm]           = useState(EMPTY);
  const [saving, setSaving]       = useState(false);
  const [formErr, setFormErr]     = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try { setPromos(await api.listPromotions()); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : "Error"); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  function openAdd() {
    setEditing(null); setForm(EMPTY); setFormErr(null); setShowModal(true);
  }
  function openEdit(p: Promotion) {
    setEditing(p);
    setForm({
      name:            p.name,
      description:     p.description ?? "",
      discountPercent: p.discountPercent != null ? String(p.discountPercent) : "",
      discountAmount:  p.discountAmount  != null ? String(p.discountAmount)  : "",
      validFrom:       toLocalDate(p.validFrom),
      validUntil:      toLocalDate(p.validUntil),
      active:          p.active,
    });
    setFormErr(null); setShowModal(true);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true); setFormErr(null);
    const body = {
      name:            form.name,
      description:     form.description || null,
      discountPercent: form.discountPercent ? parseFloat(form.discountPercent) : null,
      discountAmount:  form.discountAmount  ? parseFloat(form.discountAmount)  : null,
      validFrom:       new Date(form.validFrom).toISOString(),
      validUntil:      new Date(form.validUntil).toISOString(),
      active:          form.active,
    };
    try {
      if (editing) {
        const u = await api.updatePromotion(editing.id, body);
        setPromos((p) => p.map((x) => (x.id === u.id ? u : x)));
      } else {
        const c = await api.createPromotion(body);
        setPromos((p) => [c, ...p]);
      }
      setShowModal(false);
    } catch (e: unknown) { setFormErr(e instanceof Error ? e.message : "Error"); }
    finally { setSaving(false); }
  }

  async function onDelete(pr: Promotion) {
    if (!confirm(`Delete promotion "${pr.name}"?`)) return;
    try { await api.deletePromotion(pr.id); setPromos((p) => p.filter((x) => x.id !== pr.id)); }
    catch (e: unknown) { alert(e instanceof Error ? e.message : "Error"); }
  }

  const set = (k: keyof typeof EMPTY) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  function isExpired(p: Promotion) { return new Date(p.validUntil) < new Date(); }

  if (loading) return <p className="text-slate-500 p-4">Loading...</p>;
  if (error)   return <p className="text-rose-600 p-4">{error}</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Promotions</h1>
          <p className="text-sm text-slate-500">{promos.length} promotions</p>
        </div>
        <button onClick={openAdd} className="btn-primary">+ Add Promotion</button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {promos.length === 0 ? (
          <p className="p-8 text-center text-slate-500">No promotions yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wide">
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Discount</th>
                <th className="px-4 py-3 text-left">Valid From</th>
                <th className="px-4 py-3 text-left">Valid Until</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {promos.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{p.name}</div>
                    {p.description && <div className="text-xs text-slate-500">{p.description}</div>}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {p.discountPercent != null && <span>{p.discountPercent}%</span>}
                    {p.discountPercent != null && p.discountAmount != null && " / "}
                    {p.discountAmount  != null && <span>${p.discountAmount}</span>}
                    {p.discountPercent == null && p.discountAmount == null && "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{toLocalDate(p.validFrom)}</td>
                  <td className="px-4 py-3 text-slate-600">{toLocalDate(p.validUntil)}</td>
                  <td className="px-4 py-3">
                    {!p.active
                      ? <Badge label="Inactive" tone="gray" />
                      : isExpired(p)
                      ? <Badge label="Expired"  tone="red" />
                      : <Badge label="Active"   tone="green" />}
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button onClick={() => openEdit(p)} className="btn-sm-ghost">Edit</button>
                    <button onClick={() => onDelete(p)} className="btn-sm-danger">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <Modal title={editing ? "Edit Promotion" : "Add Promotion"} onClose={() => setShowModal(false)}>
          <form onSubmit={(e) => { void onSubmit(e); }} className="space-y-4">
            <div>
              <label className="label">Name *</label>
              <input className="input" value={form.name} onChange={set("name")} required />
            </div>
            <div>
              <label className="label">Description</label>
              <textarea className="input" rows={2} value={form.description} onChange={set("description")} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Discount % <span className="text-slate-400">(optional)</span></label>
                <input type="number" step="0.01" min="0" max="100" className="input"
                  value={form.discountPercent} onChange={set("discountPercent")} />
              </div>
              <div>
                <label className="label">Discount $ <span className="text-slate-400">(optional)</span></label>
                <input type="number" step="0.01" min="0" className="input"
                  value={form.discountAmount} onChange={set("discountAmount")} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Valid From *</label>
                <input type="date" className="input" value={form.validFrom} onChange={set("validFrom")} required />
              </div>
              <div>
                <label className="label">Valid Until *</label>
                <input type="date" className="input" value={form.validUntil} onChange={set("validUntil")} required />
              </div>
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
