/**
 * Locale-aware label helpers for status values and trade sides.
 * Use these wherever a DB enum value needs to be displayed to the user.
 */

import type { Locale } from "./translations";

const STATUS_LABELS: Record<Locale, Record<string, string>> = {
  en: {
    active:    "Active",
    pending:   "Pending",
    approved:  "Approved",
    rejected:  "Rejected",
    settled:   "Settled",
    cancelled: "Cancelled",
    open:      "Open",
    closed:    "Closed",
    draft:     "Draft",
  },
  zh: {
    active:    "活跃",
    pending:   "待处理",
    approved:  "已批准",
    rejected:  "已拒绝",
    settled:   "已结算",
    cancelled: "已取消",
    open:      "持仓中",
    closed:    "已关闭",
    draft:     "草稿",
  },
};

const SIDE_LABELS: Record<Locale, Record<string, string>> = {
  en: { yes: "YES", no: "NO" },
  zh: { yes: "看涨", no: "看跌" },
};

export function statusLabel(status: string, locale: Locale): string {
  return STATUS_LABELS[locale][status] ?? (status.charAt(0).toUpperCase() + status.slice(1));
}

export function sideLabel(side: string, locale: Locale): string {
  return SIDE_LABELS[locale][side.toLowerCase()] ?? side.toUpperCase();
}
