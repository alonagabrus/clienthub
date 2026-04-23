type Tone = "default" | "blue" | "green" | "yellow" | "red" | "purple";

interface StatCardProps {
  label: string;
  value: number | string;
  tone?: Tone;
  sub?: string;
}

const tones: Record<Tone, string> = {
  default: "bg-white border-slate-200 text-slate-900",
  blue:    "bg-blue-50 border-blue-200 text-blue-900",
  green:   "bg-emerald-50 border-emerald-200 text-emerald-900",
  yellow:  "bg-amber-50 border-amber-200 text-amber-900",
  red:     "bg-rose-50 border-rose-200 text-rose-900",
  purple:  "bg-purple-50 border-purple-200 text-purple-900",
};

export function StatCard({ label, value, tone = "default", sub }: StatCardProps) {
  return (
    <div className={`rounded-2xl border shadow-sm p-4 ${tones[tone]}`}>
      <div className="text-xs uppercase tracking-wide opacity-60 font-medium">{label}</div>
      <div className="text-3xl font-bold mt-1">{value}</div>
      {sub && <div className="text-xs opacity-60 mt-0.5">{sub}</div>}
    </div>
  );
}
