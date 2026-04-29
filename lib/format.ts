export function formatCurrency(value: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

export function formatNumber(value: number, digits = 0) {
  return new Intl.NumberFormat("vi-VN", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value || 0);
}

export function formatPercent(value: number | null, digits = 1) {
  if (value === null || Number.isNaN(value)) return "-";
  return `${new Intl.NumberFormat("vi-VN", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value * 100)}%`;
}
