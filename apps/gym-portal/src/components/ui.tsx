import type { ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-border bg-surface p-4 ${className}`}>{children}</div>;
}

export function StatCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "primary" | "success" | "warning" | "danger";
}) {
  const toneClass =
    tone === "primary"
      ? "text-primary"
      : tone === "success"
        ? "text-success"
        : tone === "warning"
          ? "text-warning"
          : tone === "danger"
            ? "text-danger"
            : "text-foreground";
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-dark">{label}</p>
      <p className={`mt-1 text-2xl font-extrabold ${toneClass}`}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

const STATUS_TONE: Record<string, string> = {
  active: "border-success/40 bg-success/10 text-success",
  captured: "border-success/40 bg-success/10 text-success",
  verified: "border-success/40 bg-success/10 text-success",
  approved: "border-success/40 bg-success/10 text-success",
  paid: "border-success/40 bg-success/10 text-success",
  pending: "border-warning/40 bg-warning/10 text-warning",
  pending_payment: "border-warning/40 bg-warning/10 text-warning",
  paid_pending_approval: "border-info/40 bg-info/10 text-info",
  processing: "border-info/40 bg-info/10 text-info",
  onboarding: "border-info/40 bg-info/10 text-info",
  pending_verification: "border-info/40 bg-info/10 text-info",
  created: "border-border bg-surface-raised text-muted",
  draft: "border-border bg-surface-raised text-muted",
  expired: "border-border bg-surface-raised text-muted",
  cancelled: "border-border bg-surface-raised text-muted",
  failed: "border-danger/40 bg-danger/10 text-danger",
  payment_failed: "border-danger/40 bg-danger/10 text-danger",
  halted: "border-danger/40 bg-danger/10 text-danger",
  rejected: "border-danger/40 bg-danger/10 text-danger",
  suspended: "border-danger/40 bg-danger/10 text-danger",
  verification_rejected: "border-danger/40 bg-danger/10 text-danger",
  refunded: "border-info/40 bg-info/10 text-info",
  unpaid: "border-warning/40 bg-warning/10 text-warning",
  none: "border-border bg-surface-raised text-muted",
};

export function StatusChip({ status, label }: { status: string; label?: string }) {
  const tone = STATUS_TONE[status] ?? "border-border bg-surface-raised text-muted";
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-bold capitalize ${tone}`}>
      {(label ?? status.replace(/_/g, " "))}
    </span>
  );
}

export function Button({
  children,
  onClick,
  type = "button",
  variant = "primary",
  disabled,
  loading,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  variant?: "primary" | "secondary" | "danger" | "ghost";
  disabled?: boolean;
  loading?: boolean;
  className?: string;
}) {
  const base =
    "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border px-4 py-2 text-sm font-bold transition disabled:opacity-45";
  const variants = {
    primary: "border-primary bg-primary text-white hover:bg-primary-dark",
    secondary: "border-border bg-surface-raised text-foreground hover:border-muted-dark",
    danger: "border-danger/40 bg-danger/10 text-danger hover:bg-danger/20",
    ghost: "border-transparent bg-transparent text-muted hover:text-foreground",
  } as const;
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`${base} ${variants[variant]} ${className}`}
    >
      {loading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : null}
      {children}
    </button>
  );
}

export function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string | null;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-dark">{label}</span>
      {children}
      {error ? <span className="block text-xs text-danger">{error}</span> : null}
    </label>
  );
}

export const inputClass =
  "w-full rounded-xl border border-border bg-surface-raised px-3.5 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-dark focus:border-primary";

export function EmptyState({
  title,
  message,
  action,
}: {
  title: string;
  message?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-surface/60 px-6 py-14 text-center">
      <p className="text-lg font-bold">{title}</p>
      {message ? <p className="max-w-md text-sm text-muted">{message}</p> : null}
      {action}
    </div>
  );
}

export function LoadingState({ message = "Loading…" }: { message?: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-muted">
      <div className="h-7 w-7 animate-spin rounded-full border-2 border-border border-t-primary" />
      <p className="text-sm">{message}</p>
    </div>
  );
}

export function ErrorState({ message, detail, onRetry }: { message: string; detail?: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-danger/30 bg-danger/5 px-6 py-12 text-center">
      <p className="text-lg font-bold text-danger">{message}</p>
      {detail ? <p className="max-w-md text-sm text-muted">{detail}</p> : null}
      {onRetry ? (
        <Button variant="secondary" onClick={onRetry}>
          Retry
        </Button>
      ) : null}
    </div>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-dark">{children}</h2>;
}
