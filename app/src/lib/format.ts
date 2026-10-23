const ms = (t: string | number | Date) => new Date(t).getTime();

export const ago = (t: string | number | Date) => {
  const s = Math.max(0, Math.round((Date.now() - ms(t)) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

export const duration = (from: string | number | Date, to: string | number | Date | null) => {
  const s = Math.max(0, Math.round(((to ? ms(to) : Date.now()) - ms(from)) / 1000));
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
};

export const num = (n: number) => n.toLocaleString();

export const bytes = (n: number) =>
  n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`;
