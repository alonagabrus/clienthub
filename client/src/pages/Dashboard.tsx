import { useEffect, useState } from "react";
import { api, CustomerPackage, DashboardStats } from "../api";
import { StatCard } from "../components/StatCard";
import { Badge, statusTone } from "../components/Badge";

function fmt(date: string) {
  return new Date(date).toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function daysUntil(date: string) {
  const diff = new Date(date).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function Dashboard() {
  const [stats, setStats]       = useState<DashboardStats | null>(null);
  const [expiring, setExpiring] = useState<CustomerPackage[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([api.stats(), api.expiringPackages(30)])
      .then(([s, e]) => { setStats(s); setExpiring(e); })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="p-8 text-slate-500">Loading dashboard...</p>;
  if (error)   return <p className="p-8 text-rose-600">{error}</p>;
  if (!stats)  return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500">Overview of your customers and subscriptions</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <StatCard label="Total Customers"    value={stats.totalCustomers}      tone="blue"   />
        <StatCard label="Active Customers"   value={stats.activeCustomers}     tone="green"  />
        <StatCard label="Companies"          value={stats.totalCompanies}      tone="purple" />
        <StatCard label="Expiring (7 days)"  value={stats.expiringIn7Days}     tone="yellow" />
        <StatCard label="Expired"            value={stats.expiredSubscriptions} tone="red"   />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Active Subscriptions" value={stats.activeSubscriptions}  />
        <StatCard label="Expiring (30 days)"   value={stats.expiringIn30Days} tone="yellow" />
        <StatCard label="New Customers (30d)"  value={stats.newCustomers30d}  tone="blue"   />
        <StatCard
          label="Total Revenue"
          value={`$${stats.totalRevenue.toLocaleString("en-US", { minimumFractionDigits: 2 })}`}
          tone="green"
          sub="active subscriptions"
        />
      </div>

      {/* Expiring packages table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-800">Expiring within 30 days</h2>
          <span className="text-xs text-slate-500">{expiring.length} subscription(s)</span>
        </div>

        {expiring.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">No subscriptions expiring soon.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wide">
                <th className="px-4 py-2.5 text-left">Customer</th>
                <th className="px-4 py-2.5 text-left">Package</th>
                <th className="px-4 py-2.5 text-left">Expires</th>
                <th className="px-4 py-2.5 text-left">Days left</th>
                <th className="px-4 py-2.5 text-left">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {expiring.map((cp) => {
                const days = daysUntil(cp.expiresAt);
                return (
                  <tr key={cp.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-slate-900">{cp.customerName}</div>
                      <div className="text-xs text-slate-500">{cp.customerEmail}</div>
                    </td>
                    <td className="px-4 py-2.5 text-slate-700">{cp.packageName}</td>
                    <td className="px-4 py-2.5 text-slate-700">{fmt(cp.expiresAt)}</td>
                    <td className="px-4 py-2.5">
                      <span className={`font-semibold ${days <= 7 ? "text-rose-600" : "text-amber-600"}`}>
                        {days}d
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge label={cp.status} tone={statusTone(cp.status)} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
