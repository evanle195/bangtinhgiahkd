import { useState, useMemo, useRef } from "react";
import * as XLSX from "xlsx";

const fmtVND  = (n) => n == null || isNaN(n) ? "—" : Math.round(n).toLocaleString("vi-VN");
const pct     = (n) => n == null || isNaN(n) || n === "" ? "—" : (n * 100).toFixed(1) + "%";
const ceil500 = (n) => Math.ceil(n / 500) * 500;

// ── Color tokens ──────────────────────────────────────────────────────────────
const C = {
  rowA: "var(--color-background-primary)", rowB: "#F7FBFF",
  maC:  "#185FA5", tenC: "#0C447C", dvtC: "#378ADD", nhomC: "#185FA5", tonC: "#3B6D11",
  gvBg: "#EAF3DE",   gvC:   "#27500A",
  vatBg:"#D4F0E8",   vatC:  "#0F6E56",
  chuaBg:"#E1F5EE",  chuaC: "#085041",
  gbBg: "#E6F1FB",   gbC:   "#0C447C",
  thueBg:"#FAEEDA",  thueC: "#633806",
  dtBg: "#FFF2CC",   dtC:   "#854F0B",
  lnBg: "#EAF3DE",   lnPos: "#175404", lnNeg: "#791F1F", ln0: "#5F5E5A",
  pctBg:"#D4F0E8",   pctPos:"#085041", pctNeg:"#A32D2D",
  hvBg: "#F1EFE8",   hvC:   "#444441",
  clBg: "#E8EDF4",   clPos: "#0C447C", clNeg: "#A32D2D",
  dim:  "#A8A8A0",
};

const GH = {
  info:{ bg:"#1F4E79", c:"#FFFFFF" },
  cost:{ bg:"#375623", c:"#FFFFFF" },
  sell:{ bg:"#1F5099", c:"#FFFFFF" },
  tax: { bg:"#7F4C02", c:"#FFFFFF" },
  prof:{ bg:"#1D6B34", c:"#FFFFFF" },
  hv:  { bg:"#444441", c:"#FFFFFF" },
  ev:  { bg:"#4A3278", c:"#FFFFFF" },
};

const ST = {
  profit:{ label:"✓ Lời",    fg:"#27500A", bg:"#C0DD97" },
  loss:  { label:"✗ Lỗ",     fg:"#791F1F", bg:"#F7C1C1" },
  break: { label:"Hòa vốn",  fg:"#633806", bg:"#FAC775" },
  np:    { label:"Chưa giá", fg:"#444441", bg:"#D3D1C7" },
  nd:    { label:"—",         fg:"#888780", bg:"transparent" },
};

// ── Row computation ───────────────────────────────────────────────────────────
function compute(row, vat, hkd) {
  const gv      = row.giaVon || 0;
  const vatAn   = gv * vat / (1 + vat);
  const chuaVat = gv / (1 + vat);
  const gb      = row.giaBan || 0;
  const thue    = gb * hkd;
  const dtSau   = gb * (1 - hkd);
  const ln      = gv > 0 && gb > 0 ? dtSau - gv : 0;
  const pGV     = gv > 0 && gb > 0 ? ln / gv : null;
  const pDT     = gv > 0 && gb > 0 ? ln / gb : null;
  const hv      = gv > 0 ? ceil500(gv / (1 - hkd)) : 0;
  const cl      = gv > 0 && gb > 0 ? gb - hv : 0;
  const dg      = gv === 0 ? "nd" : gb === 0 ? "np" : ln > 0 ? "profit" : ln === 0 ? "break" : "loss";
  return { ...row, vatAn, chuaVat, thue, dtSau, ln, pGV, pDT, hv, cl, dg };
}

// ── Editable price cell with VND thousand-dot formatting ─────────────────────
function EditablePrice({ value, onChange }) {
  const [focused, setFocused] = useState(false);
  const [raw, setRaw] = useState(String(value || ""));

  return (
    <input
      type="text"
      value={focused ? raw : fmtVND(value)}
      onFocus={() => { setFocused(true); setRaw(String(value || "")); }}
      onChange={(e) => {
        const v = e.target.value.replace(/[^\d]/g, "");
        setRaw(v);
        onChange(parseInt(v) || 0);
      }}
      onBlur={() => setFocused(false)}
      style={{
        width: "100%", border: "none", background: "transparent",
        textAlign: "right", fontSize: 12, fontWeight: 600,
        color: C.gbC, padding: "3px 4px", outline: "none",
        fontFamily: "inherit",
      }}
    />
  );
}

// ── Upload zone ───────────────────────────────────────────────────────────────
function UpZone({ onData }) {
  const [drag, setDrag] = useState(false);
  const inp = useRef();

  const parse = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const wb  = XLSX.read(e.target.result, { type: "array" });
      const ws  = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json(ws, { header: 1 });
      const h   = raw[0];
      const fi  = (s) => h.findIndex((x) => String(x || "").includes(s));
      const iGV = fi("Giá nhập cuối") >= 0 ? fi("Giá nhập cuối") : fi("Giá vốn");
      const rows = raw.slice(1).filter((r) => r[fi("Mã hàng")]).map((r, i) => ({
        id: i, stt: i + 1,
        ma:    r[fi("Mã hàng")]        || "",
        ten:   r[fi("Tên hàng")]       || "",
        dvt:   r[fi("Đơn vị")]         || "",
        nhom:  r[fi("Nhóm")]           || "",
        ton:   Number(r[fi("Tồn")])    || 0,
        giaVon:Number(r[iGV])          || 0,
        giaBan:Number(r[fi("Bảng giá chung")]) || 0,
      }));
      onData(rows);
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <div
      onClick={() => inp.current.click()}
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); parse(e.dataTransfer.files[0]); }}
      style={{
        border: `2px dashed ${drag ? "#378ADD" : "var(--color-border-secondary)"}`,
        borderRadius: "var(--border-radius-lg)", padding: "2.5rem 2rem",
        textAlign: "center", cursor: "pointer",
        background: drag ? "#E6F1FB" : "var(--color-background-secondary)",
        transition: "all .15s",
      }}
    >
      <input ref={inp} type="file" accept=".xlsx,.xls"
        style={{ display: "none" }} onChange={(e) => parse(e.target.files[0])} />
      <div style={{ fontSize: 32, marginBottom: 8 }}>📂</div>
      <p style={{ fontWeight: 500, color: "#185FA5" }}>Kéo thả file Excel hoặc nhấn để chọn</p>
      <p style={{ fontSize: 12, color: "#5F5E5A", marginTop: 4 }}>
        Hỗ trợ .xlsx .xls — cần có: Giá nhập cuối, Bảng giá chung
      </p>
    </div>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function Card({ label, val, color, sub }) {
  return (
    <div style={{ background: "var(--color-background-secondary)", borderRadius: "var(--border-radius-md)", padding: "10px 14px" }}>
      <p style={{ fontSize: 11, color: "#888780", marginBottom: 4 }}>{label}</p>
      <p style={{ fontSize: 20, fontWeight: 500, color: color || "var(--color-text-primary)" }}>{val}</p>
      {sub && <p style={{ fontSize: 11, color: "#888780", marginTop: 2 }}>{sub}</p>}
    </div>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [raw,   setRaw]   = useState([]);
  const [vat,   setVat]   = useState(10);
  const [hkd,   setHkd]   = useState(1.5);
  const [q,     setQ]     = useState("");
  const [nhom,  setNhom]  = useState("Tất cả");
  const [edits, setEdits] = useState({});
  const [srt,   setSrt]   = useState({ k: "stt", d: 1 });

  const vatR = vat / 100, hkdR = hkd / 100;

  const rows = useMemo(() =>
    raw.map((r) => compute(
      { ...r, giaBan: edits[r.id] != null ? edits[r.id] : r.giaBan },
      vatR, hkdR
    )), [raw, vatR, hkdR, edits]);

  const nhoms = useMemo(() => {
    const s = new Set(rows.map((r) => r.nhom).filter(Boolean));
    return ["Tất cả", ...Array.from(s).sort()];
  }, [rows]);

  const filtered = useMemo(() => {
    let r = rows;
    if (nhom !== "Tất cả") r = r.filter((x) => x.nhom === nhom);
    if (q.trim()) {
      const lq = q.toLowerCase();
      r = r.filter((x) => x.ten.toLowerCase().includes(lq) || x.ma.toLowerCase().includes(lq));
    }
    return [...r].sort((a, b) => {
      const va = a[srt.k], vb = b[srt.k];
      if (va == null) return 1; if (vb == null) return -1;
      return (va < vb ? -1 : va > vb ? 1 : 0) * srt.d;
    });
  }, [rows, nhom, q, srt]);

  const stats = useMemo(() => {
    const v = rows.filter((r) => r.giaVon > 0 && r.giaBan > 0);
    return {
      tot: rows.length, cop: v.length,
      loi: v.filter((r) => r.dg === "profit").length,
      lo:  v.filter((r) => r.dg === "loss").length,
      tDT: v.reduce((s, r) => s + r.giaBan, 0),
      tLN: v.reduce((s, r) => s + r.ln, 0),
      tTh: v.reduce((s, r) => s + r.thue, 0),
    };
  }, [rows]);

  const ds = (k) => setSrt((s) => ({ k, d: s.k === k ? -s.d : 1 }));
  const sa = (k) => srt.k === k ? (srt.d === 1 ? " ↑" : " ↓") : "";
  const lc = (v) => v > 0 ? C.lnPos : v < 0 ? C.lnNeg : C.ln0;

  // Reusable header/data cell builders
  const TH = (label, key, bg) => (
    <th key={label} onClick={key ? () => ds(key) : undefined} style={{
      padding: "5px 7px", fontSize: 11, fontWeight: 600,
      cursor: key ? "pointer" : "default", userSelect: "none",
      background: bg, color: "#FFFFFF", whiteSpace: "nowrap", textAlign: "center",
      borderBottom: "1px solid rgba(0,0,0,0.15)",
      borderRight: "0.5px solid rgba(255,255,255,0.2)",
    }}>
      {label}{key ? sa(key) : ""}
    </th>
  );

  const TD = (v, bg, fc, opts = {}) => (
    <td style={{
      padding: "4px 7px", textAlign: opts.l ? "left" : "right",
      fontSize: 12, fontWeight: opts.bold ? 600 : 400,
      color: fc, background: bg,
      borderBottom: "0.5px solid var(--color-border-tertiary)",
      borderRight: "0.5px solid var(--color-border-tertiary)",
      whiteSpace: "nowrap", overflow: "hidden",
      maxWidth: opts.mw || 200, textOverflow: "ellipsis",
    }}>
      {v}
    </td>
  );

  // ── Empty / upload screen ─────────────────────────────────────────────────
  if (!raw.length) return (
    <div style={{ padding: "1rem 0" }}>
      <p style={{ fontWeight: 600, fontSize: 16, marginBottom: 6, color: "#185FA5" }}>
        Bảng tính giá — HKD nhóm 2
      </p>
      <p style={{ fontSize: 13, color: "#5F5E5A", marginBottom: "1.5rem" }}>
        Nhập file xuất từ phần mềm quản lý. Hệ thống tự tính VAT, thuế HKD, lợi nhuận và giá hòa vốn.
      </p>
      <UpZone onData={setRaw} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: "1.5rem" }}>
        {[
          ["Thuế VAT đầu vào", vat, setVat, 1, 30],
          ["Thuế khoán HKD (% DT)", hkd, setHkd, 0.5, 10],
        ].map(([lbl, val, setter, step, max], i) => (
          <div key={i} style={{ padding: "12px 16px", borderRadius: "var(--border-radius-md)", border: "0.5px solid var(--color-border-tertiary)" }}>
            <p style={{ fontSize: 12, color: "#5F5E5A", marginBottom: 6 }}>{lbl}</p>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input type="number" value={val} min={0} max={max} step={step}
                onChange={(e) => setter(+e.target.value)} style={{ width: 60 }} />
              <span style={{ fontSize: 13, color: "#185FA5", fontWeight: 600 }}>%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // ── Main view ─────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: "0.5rem 0" }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem", flexWrap: "wrap", gap: 8 }}>
        <div>
          <p style={{ fontWeight: 600, fontSize: 15, margin: 0, color: "#0C447C" }}>Bảng tính giá — HKD nhóm 2</p>
          <p style={{ fontSize: 11, color: "#888780", marginTop: 2 }}>{rows.length} sản phẩm · VAT {vat}% · Thuế HKD {hkd}%</p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {[["VAT", vat, setVat, 1], ["HKD", hkd, setHkd, 0.5]].map(([lbl, val, setter, step]) => (
            <div key={lbl} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}>
              <span style={{ color: "#5F5E5A", fontWeight: 500 }}>{lbl}</span>
              <input type="number" value={val} min={0} max={30} step={step}
                onChange={(e) => setter(+e.target.value)} style={{ width: 48 }} />
              <span style={{ color: "#185FA5", fontWeight: 600 }}>%</span>
            </div>
          ))}
          <button onClick={() => { setRaw([]); setEdits({}); }}>Đổi file ↗</button>
        </div>
      </div>

      {/* ── Stats ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 8, marginBottom: "1rem" }}>
        <Card label="Tổng SP"        val={stats.tot} color="#185FA5" />
        <Card label="Có giá bán"     val={stats.cop} color="#378ADD" />
        <Card label="Đang lời"       val={stats.loi} color="#27500A" />
        <Card label="Lỗ / hòa vốn"  val={stats.lo}  color="#791F1F" />
        <Card label="Tổng doanh thu" val={"₫" + fmtVND(stats.tDT)} color="#0C447C" sub="1 đơn vị/SP" />
        <Card label="Tổng lợi nhuận" val={"₫" + fmtVND(stats.tLN)} color={stats.tLN >= 0 ? "#175404" : "#791F1F"} />
        <Card label="Tổng thuế HKD"  val={"₫" + fmtVND(stats.tTh)} color="#633806" />
      </div>

      {/* ── Filters ── */}
      <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap", alignItems: "center" }}>
        <input type="text" placeholder="Tìm tên hàng, mã..." value={q}
          onChange={(e) => setQ(e.target.value)} style={{ width: 200, fontSize: 12 }} />
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {nhoms.map((n) => (
            <button key={n} onClick={() => setNhom(n)} style={{
              fontSize: 11, padding: "3px 9px",
              background:  nhom === n ? "#1F5099" : "var(--color-background-primary)",
              color:       nhom === n ? "#FFFFFF"  : "#185FA5",
              borderColor: nhom === n ? "#1F5099"  : "#B5D4F4",
              fontWeight:  nhom === n ? 600 : 400,
            }}>
              {n}
            </button>
          ))}
        </div>
        <span style={{ fontSize: 11, color: "#888780", marginLeft: "auto" }}>{filtered.length} / {rows.length} dòng</span>
      </div>

      {/* ── Table ── */}
      <div style={{ overflowX: "auto", maxHeight: 540, borderRadius: "var(--border-radius-md)", border: "0.5px solid var(--color-border-tertiary)" }}>
        <table style={{ borderCollapse: "collapse", width: "max-content", fontSize: 12 }}>
          <colgroup>
            {[48, 88, 200, 58, 95, 60, 125, 100, 105, 108, 105, 105, 105, 78, 78, 120, 92, 90].map((w, i) => (
              <col key={i} style={{ width: w }} />
            ))}
          </colgroup>
          <thead>
            {/* Group row */}
            <tr>
              {[
                [6, "Thông tin sản phẩm", GH.info],
                [3, "Giá vốn đầu vào",    GH.cost],
                [1, "Giá bán ✏",           GH.sell],
                [2, "Thuế HKD 1,5%",       GH.tax],
                [3, "Lợi nhuận",           GH.prof],
                [2, "Phân tích hòa vốn",   GH.hv],
                [1, "Đánh giá",            GH.ev],
              ].map(([span, label, g]) => (
                <th key={label} colSpan={span} style={{
                  padding: "6px 8px", fontSize: 11, fontWeight: 600,
                  background: g.bg, color: g.c, textAlign: "center",
                  borderBottom: "1px solid rgba(0,0,0,0.2)",
                  borderRight: "0.5px solid rgba(255,255,255,0.2)",
                }}>
                  {label}
                </th>
              ))}
            </tr>
            {/* Column row */}
            <tr>
              {TH("STT",                        "stt",     GH.info.bg)}
              {TH("Mã hàng",                    "ma",      GH.info.bg)}
              {TH("Tên hàng",                   "ten",     GH.info.bg)}
              {TH("ĐVT",                         null,      GH.info.bg)}
              {TH("Nhóm",                       "nhom",    GH.info.bg)}
              {TH("Tồn kho",                    "ton",     GH.info.bg)}
              {TH("Giá nhập cuối (đã có VAT)",  "giaVon",  GH.cost.bg)}
              {TH("VAT ẩn",                     "vatAn",   GH.cost.bg)}
              {TH("Giá chưa VAT",               "chuaVat", GH.cost.bg)}
              {TH("Giá bán ✏",                  "giaBan",  "#0C3D82")}
              {TH("Thuế nộp",                   "thue",    GH.tax.bg)}
              {TH("DT sau thuế",                "dtSau",   GH.tax.bg)}
              {TH("Lợi nhuận",                  "ln",      GH.prof.bg)}
              {TH("%LN/GV",                     "pGV",     GH.prof.bg)}
              {TH("%LN/DT",                     "pDT",     GH.prof.bg)}
              {TH("Hòa vốn tối thiểu",         "hv",      GH.hv.bg)}
              {TH("Chênh lệch",                 "cl",      GH.hv.bg)}
              {TH("Đánh giá",                    null,      GH.ev.bg)}
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, ri) => {
              const st     = ST[r.dg] || ST.nd;
              const bg     = ri % 2 === 0 ? C.rowA : C.rowB;
              const noData = r.giaVon === 0;
              const noSell = r.giaBan === 0;

              return (
                <tr key={r.id}>
                  {TD(r.stt,  bg, "#5F5E5A",  { l: true })}
                  {TD(r.ma,   bg, C.maC,      { l: true, bold: true })}

                  {/* Tên hàng — long text with ellipsis */}
                  <td title={r.ten} style={{
                    padding: "4px 7px", fontSize: 12, fontWeight: 500,
                    textAlign: "left", color: C.tenC, background: bg,
                    borderBottom: "0.5px solid var(--color-border-tertiary)",
                    borderRight: "0.5px solid var(--color-border-tertiary)",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 200,
                  }}>
                    {r.ten}
                  </td>

                  {TD(r.dvt,  bg, C.dvtC,  { l: true })}
                  {TD(r.nhom, bg, C.nhomC, { l: true, bold: true })}
                  {TD(fmtVND(r.ton), bg, r.ton > 0 ? C.tonC : C.dim, { bold: r.ton > 0 })}

                  {/* Cost group */}
                  {TD(noData ? "—" : fmtVND(r.giaVon),  C.gvBg,   noData ? C.dim : C.gvC,   { bold: !noData })}
                  {TD(noData ? "—" : fmtVND(r.vatAn),   C.vatBg,  noData ? C.dim : C.vatC,  { bold: !noData })}
                  {TD(noData ? "—" : fmtVND(r.chuaVat), C.chuaBg, noData ? C.dim : C.chuaC)}

                  {/* Giá bán — editable, formats with thousand dots */}
                  <td style={{
                    padding: "2px 4px", background: C.gbBg,
                    borderBottom: "0.5px solid var(--color-border-tertiary)",
                    borderRight: "0.5px solid var(--color-border-tertiary)",
                  }}>
                    <EditablePrice
                      value={edits[r.id] != null ? edits[r.id] : r.giaBan}
                      onChange={(v) => setEdits((prev) => ({ ...prev, [r.id]: v }))}
                    />
                  </td>

                  {/* Tax group */}
                  {TD(noSell ? "—" : fmtVND(r.thue),  C.thueBg, noSell ? C.dim : C.thueC, { bold: !noSell })}
                  {TD(noSell ? "—" : fmtVND(r.dtSau), C.dtBg,   noSell ? C.dim : C.dtC,   { bold: !noSell })}

                  {/* Profit group */}
                  {TD(
                    !noData && !noSell ? fmtVND(r.ln) : "—",
                    C.lnBg,
                    !noData && !noSell ? lc(r.ln) : C.dim,
                    { bold: !noData && !noSell }
                  )}
                  {TD(
                    r.pGV != null ? pct(r.pGV) : "—",
                    C.pctBg,
                    r.pGV != null ? (r.pGV > 0 ? C.pctPos : C.pctNeg) : C.dim,
                    { bold: r.pGV != null }
                  )}
                  {TD(
                    r.pDT != null ? pct(r.pDT) : "—",
                    C.pctBg,
                    r.pDT != null ? (r.pDT > 0 ? C.pctPos : C.pctNeg) : C.dim,
                    { bold: r.pDT != null }
                  )}

                  {/* Break-even group */}
                  {TD(noData ? "—" : fmtVND(r.hv), C.hvBg, noData ? C.dim : C.hvC)}
                  {TD(
                    !noData && !noSell ? fmtVND(r.cl) : "—",
                    C.clBg,
                    !noData && !noSell ? (r.cl > 0 ? C.clPos : C.clNeg) : C.dim,
                    { bold: !noData && !noSell }
                  )}

                  {/* Badge */}
                  <td style={{
                    padding: "4px 6px", textAlign: "center", background: bg,
                    borderBottom: "0.5px solid var(--color-border-tertiary)",
                    borderRight: "0.5px solid var(--color-border-tertiary)",
                  }}>
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: "2px 8px",
                      borderRadius: 999, whiteSpace: "nowrap",
                      background: st.bg, color: st.fg,
                    }}>
                      {st.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p style={{ fontSize: 11, color: "#888780", marginTop: 6 }}>
        Cột giá bán (xanh đậm) — nhấn để chỉnh, tự format dấu chấm khi blur · Giá hòa vốn làm tròn lên 500đ
      </p>
    </div>
  );
}
