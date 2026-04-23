import { FormEvent, useEffect, useState } from "react";
import { api, Company } from "../api";
import { Modal } from "../components/Modal";

const EMPTY = { name: "", email: "", phone: "", address: "" };

export function Companies() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing]     = useState<Company | null>(null);
  const [form, setForm]           = useState(EMPTY);
  const [saving, setSaving]       = useState(false);
  const [formErr, setFormErr]     = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      setCompanies(await api.listCompanies());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  function openAdd() {
    setEditing(null);
    setForm(EMPTY);
    setFormErr(null);
    setShowModal(true);
  }

  function openEdit(c: Company) {
    setEditing(c);
    setForm({ name: c.name, email: c.email ?? "", phone: c.phone ?? "", address: c.address ?? "" });
    setFormErr(null);
    setShowModal(true);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormErr(null);
    const body = {
      name:    form.name,
      email:   form.email   || null,
      phone:   form.phone   || null,
      address: form.address || null,
    };
    try {
      if (editing) {
        const updated = await api.updateCompany(editing.id, body);
        setCompanies((p) => p.map((c) => (c.id === updated.id ? updated : c)));
      } else {
        const created = await api.createCompany(body);
        setCompanies((p) => [...p, created]);
      }
      setShowModal(false);
    } catch (e: unknown) {
      setFormErr(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(c: Company) {
    if (!confirm(`Delete "${c.name}"? All customers will lose company assignment.`)) return;
    try {
      await api.deleteCompany(c.id);
      setCompanies((p) => p.filter((x) => x.id !== c.id));
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Error");
    }
  }

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  if (loading) return <p className="text-slate-500 p-4">Loading...</p>;
  if (error)   return <p className="text-rose-600 p-4">{error}</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Companies</h1>
          <p className="text-sm text-slate-500">{companies.length} companies</p>
        </div>
        <button onClick={openAdd} className="btn-primary">+ Add Company</button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {companies.length === 0 ? (
          <p className="p-8 text-center text-slate-500">No companies yet. Add the first one!</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wide">
                <th className="px-4 py-3 text-left">Company</th>
                <th className="px-4 py-3 text-left">Email</th>
                <th className="px-4 py-3 text-left">Phone</th>
                <th className="px-4 py-3 text-center">Customers</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {companies.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{c.name}</td>
                  <td className="px-4 py-3 text-slate-600">{c.email ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{c.phone ?? "—"}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-100 text-blue-800 text-xs font-semibold">
                      {c.customerCount}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button onClick={() => openEdit(c)} className="btn-sm-ghost">Edit</button>
                    <button onClick={() => onDelete(c)} className="btn-sm-danger">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <Modal title={editing ? "Edit Company" : "Add Company"} onClose={() => setShowModal(false)}>
          <form onSubmit={(e) => { void onSubmit(e); }} className="space-y-4">
            <div>
              <label className="label">Company name *</label>
              <input className="input" value={form.name} onChange={set("name")} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Email</label>
                <input type="email" className="input" value={form.email} onChange={set("email")} />
              </div>
              <div>
                <label className="label">Phone</label>
                <input className="input" value={form.phone} onChange={set("phone")} />
              </div>
            </div>
            <div>
              <label className="label">Address</label>
              <textarea className="input" rows={2} value={form.address} onChange={set("address")} />
            </div>
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
