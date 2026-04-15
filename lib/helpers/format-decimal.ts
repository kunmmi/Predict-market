/** Display wallet / ledger amounts from numeric strings. */
export function formatDecimal(
  value: string | number | null | undefined,
  maxFractionDigits = 8,
): string {
  if (value === null || value === undefined || value === "") {
    return "—";
  }
  const n = typeof value === "string" ? Number.parseFloat(value) : value;
  if (Number.isNaN(n)) {
    return "—";
  }
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: maxFractionDigits,
    minimumFractionDigits: 0,
  }).format(n);
}
