"use client";

import { FormEvent, useState } from "react";
import { formatCurrency } from "@/lib/format";

type UploadResult = {
  ok: boolean;
  rowCount: number;
  sourceFileName: string;
  summary: {
    totalRevenue: number;
    totalInputVat: number;
    totalHkdTax: number;
    totalNetProfit: number;
  };
};

export default function AdminUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) return;
    setLoading(true);
    setError("");
    setResult(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("token", token);

    const response = await fetch("/api/admin/upload", {
      method: "POST",
      body: formData,
    });

    const data = await response.json();
    if (!response.ok) {
      setError(data?.message ?? "Upload thất bại");
    } else {
      setResult(data as UploadResult);
    }
    setLoading(false);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <section className="rounded-[2rem] bg-slate-950 p-6 text-white shadow-soft md:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-200">Admin</p>
        <h1 className="mt-3 text-3xl font-black tracking-tight md:text-5xl">Upload file Excel/CSV bảng giá</h1>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300">Sau khi upload, hệ thống sẽ tính lại VAT đầu vào, tổng giá vốn thực, thuế HKD 1,5%, lợi nhuận thuần, giá bán hòa vốn và trạng thái lời/lỗ.</p>
      </section>

      <form onSubmit={handleSubmit} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-soft md:p-8">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <label className="block md:col-span-2">
            <span className="mb-2 block text-sm font-bold text-slate-800">Chọn file</span>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              className="w-full rounded-2xl border-2 border-dashed border-indigo-300 bg-indigo-50 px-4 py-6 text-sm font-bold text-slate-700 file:mr-4 file:rounded-xl file:border-0 file:bg-indigo-600 file:px-4 file:py-2 file:font-bold file:text-white"
              required
            />
          </label>
          <label className="block md:col-span-2">
            <span className="mb-2 block text-sm font-bold text-slate-800">Admin token</span>
            <input
              value={token}
              onChange={(event) => setToken(event.target.value)}
              placeholder="Nhập ADMIN_TOKEN nếu đã bật trong .env"
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 font-semibold outline-none focus:ring-4 focus:ring-indigo-100"
            />
          </label>
        </div>
        <button disabled={loading || !file} className="mt-6 w-full rounded-2xl bg-slate-950 px-5 py-4 text-sm font-black text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300">
          {loading ? "Đang xử lý..." : "Upload & cập nhật dashboard"}
        </button>
      </form>

      {error ? <div className="rounded-3xl border border-rose-200 bg-rose-50 p-5 font-bold text-rose-700">{error}</div> : null}

      {result ? (
        <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 shadow-soft">
          <h2 className="text-xl font-black text-emerald-900">Upload thành công</h2>
          <p className="mt-2 text-sm text-emerald-800">Đã xử lý {result.rowCount} dòng từ file {result.sourceFileName}.</p>
          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-4">
            <div className="rounded-2xl bg-white p-4"><p className="text-xs text-slate-500">Doanh thu</p><p className="font-black">{formatCurrency(result.summary.totalRevenue)}</p></div>
            <div className="rounded-2xl bg-white p-4"><p className="text-xs text-slate-500">VAT đầu vào</p><p className="font-black">{formatCurrency(result.summary.totalInputVat)}</p></div>
            <div className="rounded-2xl bg-white p-4"><p className="text-xs text-slate-500">Thuế HKD</p><p className="font-black">{formatCurrency(result.summary.totalHkdTax)}</p></div>
            <div className="rounded-2xl bg-white p-4"><p className="text-xs text-slate-500">LN thuần</p><p className="font-black">{formatCurrency(result.summary.totalNetProfit)}</p></div>
          </div>
          <a href="/" className="mt-5 inline-flex rounded-2xl bg-emerald-700 px-5 py-3 text-sm font-black text-white hover:bg-emerald-800">Xem dashboard</a>
        </div>
      ) : null}
    </div>
  );
}
