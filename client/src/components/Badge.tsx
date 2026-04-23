type Tone = "green" | "red" | "yellow" | "blue" | "gray" | "purple";

interface BadgeProps {
  label: string;
  tone?: Tone;
}

const tones: Record<Tone, string> = {
  green:  "bg-emerald-100 text-emerald-800",
  red:    "bg-rose-100 text-rose-800",
  yellow: "bg-amber-100 text-amber-800",
  blue:   "bg-blue-100 text-blue-800",
  gray:   "bg-slate-100 text-slate-700",
  purple: "bg-purple-100 text-purple-800",
};

export function Badge({ label, tone = "gray" }: BadgeProps) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${tones[tone]}`}>
      {label}
    </span>
  );
}

export function statusTone(status: string): Tone {
  switch (status) {
    case "active":    return "green";
    case "inactive":  return "yellow";
    case "churned":   return "red";
    case "expired":   return "red";
    case "cancelled": return "gray";
    default:          return "gray";
  }
}
