export type ProductRow = {
  id: string;
  maHang: string;
  tenHang: string;
  donViTinh: string;
  nhomHangGoc: string;
  nhomHang: string;
  tonKho: number;
  giaVon: number;
  giaNhapCuoiChuaVat: number;
  giaBanThucTe: number;
  vatRate: number;
  vatDauVao: number;
  tongGiaVonThuc: number;
  thueHkdPhaiNop: number;
  loiNhuanThuan: number | null;
  giaBanHoaVonToiThieu: number;
  tySuatLoiNhuanTrenTongGv: number | null;
  doanhThu: number;
  tongVatDauVao: number;
  tongThueHkd: number;
  tongLoiNhuanThuan: number;
  danhGia: "✅ Lời" | "❌ Lỗ" | "Chưa có giá";
};

export type DashboardPayload = {
  updatedAt: string;
  sourceFileName?: string;
  rows: ProductRow[];
  summary: DashboardSummary;
};

export type DashboardSummary = {
  totalSku: number;
  totalRevenue: number;
  totalInputVat: number;
  totalHkdTax: number;
  totalRealCost: number;
  totalNetProfit: number;
  profitableSku: number;
  lossSku: number;
  missingPriceSku: number;
  avgMarginOnCost: number | null;
};

const HKD_TAX_RATE = 0.015;
const VAT_RATES = [0.08, 0.1];

const headerAliases: Record<string, string[]> = {
  maHang: ["ma hang", "mã hàng", "sku", "code", "item code"],
  tenHang: ["ten hang", "tên hàng", "ten san pham", "tên sản phẩm", "product", "product name"],
  donViTinh: ["don vi tinh", "đơn vị tính", "unit", "uom"],
  nhomHang: ["nhom hang", "nhóm hàng", "category", "group"],
  tonKho: ["ton kho", "tồn kho", "stock", "inventory"],
  giaVon: ["gia von", "giá vốn", "cost", "cogs"],
  giaNhapCuoi: ["gia nhap cuoi", "giá nhập cuối", "last purchase price", "purchase price"],
  giaBan: ["bang gia chung", "bảng giá chung", "gia ban", "giá bán", "selling price", "retail price"],
};

function stripDiacritics(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[đ]/g, "d")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function findIndex(headers: string[], key: keyof typeof headerAliases, fallbackIndex: number) {
  const normalizedHeaders = headers.map((item) => stripDiacritics(String(item ?? "")));
  const aliases = headerAliases[key].map(stripDiacritics);
  const found = normalizedHeaders.findIndex((header) => aliases.some((alias) => header.includes(alias)));
  return found >= 0 ? found : fallbackIndex;
}

export function parseNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (value === null || value === undefined) return 0;
  let text = String(value).trim();
  if (!text || text === "-") return 0;
  text = text.replace(/\s/g, "").replace(/₫|đ|VND|VNĐ|%/gi, "");
  const hasComma = text.includes(",");
  const hasDot = text.includes(".");
  if (hasComma && hasDot) {
    const lastComma = text.lastIndexOf(",");
    const lastDot = text.lastIndexOf(".");
    text = lastComma > lastDot ? text.replace(/\./g, "").replace(",", ".") : text.replace(/,/g, "");
  } else if (hasComma) {
    const decimalComma = /,\d{1,2}$/.test(text);
    text = decimalComma ? text.replace(",", ".") : text.replace(/,/g, "");
  }
  const result = Number(text.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(result) ? result : 0;
}

function closestVatRate(giaVon: number, giaNhapCuoi: number) {
  if (giaVon <= 0 || giaNhapCuoi <= 0) return 0.1;
  const actualRate = giaVon / giaNhapCuoi - 1;
  return VAT_RATES.reduce((best, current) =>
    Math.abs(current - actualRate) < Math.abs(best - actualRate) ? current : best
  );
}

function normalizeGroup(raw: string) {
  const clean = stripDiacritics(raw);
  const lower = String(raw ?? "").toLowerCase();
  if (clean.includes("banh") || clean.includes("keo") || lower.includes("k?o") || clean.includes("snack")) return "Bánh kẹo";
  if (lower.includes("n??c") || clean.includes("nuoc ngot")) return "Nước ngọt";
  if (lower === "s?a" || clean === "sua") return "Sữa";
  if (clean.includes("dau an") || clean.includes("gia vi") || lower.includes("n??c ch?m")) return "Dầu ăn - Gia vị - Nước chấm";
  if (lower.includes("???ng") || clean.includes("duong")) return "Đường";
  if (clean.includes("cham soc ca nhan")) return "Chăm sóc cá nhân";
  return raw || "Khác";
}

export function parseTable(headers: string[], rows: unknown[][], sourceFileName?: string): DashboardPayload {
  const indexMap = {
    maHang: findIndex(headers, "maHang", 0),
    tenHang: findIndex(headers, "tenHang", 1),
    donViTinh: findIndex(headers, "donViTinh", 2),
    nhomHang: findIndex(headers, "nhomHang", 3),
    tonKho: findIndex(headers, "tonKho", 4),
    giaVon: findIndex(headers, "giaVon", 5),
    giaNhapCuoi: findIndex(headers, "giaNhapCuoi", 6),
    giaBan: findIndex(headers, "giaBan", 7),
  };

  const parsedRows = rows
    .filter((row) => row.some((cell) => String(cell ?? "").trim() !== ""))
    .map((row, rowIndex): ProductRow => {
      const maHang = String(row[indexMap.maHang] ?? "").trim();
      const tenHang = String(row[indexMap.tenHang] ?? "").trim();
      const donViTinh = String(row[indexMap.donViTinh] ?? "").trim();
      const nhomHangGoc = String(row[indexMap.nhomHang] ?? "").trim();
      const tonKho = parseNumber(row[indexMap.tonKho]);
      const giaVon = parseNumber(row[indexMap.giaVon]);
      const giaNhapCuoiChuaVat = parseNumber(row[indexMap.giaNhapCuoi]);
      const giaBanThucTe = parseNumber(row[indexMap.giaBan]);
      const vatRate = closestVatRate(giaVon, giaNhapCuoiChuaVat);
      const vatDuKien = giaNhapCuoiChuaVat * vatRate;
      const tongGiaVonTheoRate = giaNhapCuoiChuaVat + vatDuKien;
      const dungGiaVonHeThong = giaVon > 0 && Math.abs(giaVon - tongGiaVonTheoRate) / Math.max(1, tongGiaVonTheoRate) <= 0.02;
      const tongGiaVonThuc = dungGiaVonHeThong ? giaVon : tongGiaVonTheoRate || giaVon;
      const vatDauVao = Math.max(0, tongGiaVonThuc - giaNhapCuoiChuaVat);
      const thueHkdPhaiNop = giaBanThucTe > 0 ? giaBanThucTe * HKD_TAX_RATE : 0;
      const loiNhuanThuan = giaBanThucTe > 0 ? giaBanThucTe - thueHkdPhaiNop - tongGiaVonThuc : null;
      const giaBanHoaVonToiThieu = tongGiaVonThuc > 0 ? tongGiaVonThuc / (1 - HKD_TAX_RATE) : 0;
      const tySuatLoiNhuanTrenTongGv = loiNhuanThuan !== null && tongGiaVonThuc > 0 ? loiNhuanThuan / tongGiaVonThuc : null;
      const soLuongTinh = tonKho > 0 ? tonKho : 1;
      const doanhThu = giaBanThucTe * soLuongTinh;
      const tongVatDauVao = vatDauVao * soLuongTinh;
      const tongThueHkd = thueHkdPhaiNop * soLuongTinh;
      const tongLoiNhuanThuan = (loiNhuanThuan ?? 0) * soLuongTinh;
      const danhGia = giaBanThucTe <= 0 ? "Chưa có giá" : loiNhuanThuan !== null && loiNhuanThuan >= 0 ? "✅ Lời" : "❌ Lỗ";

      return {
        id: maHang || `row-${rowIndex + 1}`,
        maHang,
        tenHang,
        donViTinh,
        nhomHangGoc,
        nhomHang: normalizeGroup(nhomHangGoc),
        tonKho,
        giaVon,
        giaNhapCuoiChuaVat,
        giaBanThucTe,
        vatRate,
        vatDauVao,
        tongGiaVonThuc,
        thueHkdPhaiNop,
        loiNhuanThuan,
        giaBanHoaVonToiThieu,
        tySuatLoiNhuanTrenTongGv,
        doanhThu,
        tongVatDauVao,
        tongThueHkd,
        tongLoiNhuanThuan,
        danhGia,
      };
    });

  return {
    updatedAt: new Date().toISOString(),
    sourceFileName,
    rows: parsedRows,
    summary: createSummary(parsedRows),
  };
}

export function createSummary(rows: ProductRow[]): DashboardSummary {
  const pricedRows = rows.filter((row) => row.giaBanThucTe > 0);
  const totalRealCost = rows.reduce((sum, row) => sum + row.tongGiaVonThuc * (row.tonKho > 0 ? row.tonKho : 1), 0);
  const totalNetProfit = rows.reduce((sum, row) => sum + row.tongLoiNhuanThuan, 0);
  return {
    totalSku: rows.length,
    totalRevenue: rows.reduce((sum, row) => sum + row.doanhThu, 0),
    totalInputVat: rows.reduce((sum, row) => sum + row.tongVatDauVao, 0),
    totalHkdTax: rows.reduce((sum, row) => sum + row.tongThueHkd, 0),
    totalRealCost,
    totalNetProfit,
    profitableSku: rows.filter((row) => row.danhGia === "✅ Lời").length,
    lossSku: rows.filter((row) => row.danhGia === "❌ Lỗ").length,
    missingPriceSku: rows.filter((row) => row.danhGia === "Chưa có giá").length,
    avgMarginOnCost: totalRealCost > 0 ? totalNetProfit / totalRealCost : null,
  };
}
