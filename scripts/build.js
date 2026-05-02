/**
 * build.js — Chạy khi Vercel deploy
 * Parse BangGia.xlsx → public/data/products.json
 * Dùng Node.js thuần, KHÔNG cần npm install thêm gì
 */

const fs   = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT       = path.join(__dirname, '..');
const EXCEL_PATH = path.join(ROOT, 'data', 'BangGia.xlsx');
const OUT_DIR    = path.join(ROOT, 'public', 'data');
const OUT_PATH   = path.join(OUT_DIR, 'products.json');

// ── ZIP parser (Node built-in zlib) ─────────────────────────────────────────

function readUInt16LE(buf, off) { return buf[off] | (buf[off+1] << 8); }
function readUInt32LE(buf, off) { return (buf[off] | (buf[off+1]<<8) | (buf[off+2]<<16) | (buf[off+3]<<24)) >>> 0; }

function readZipEntries(buf) {
  // Find End of Central Directory (0x06054b50)
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf[i]===0x50 && buf[i+1]===0x4B && buf[i+2]===0x05 && buf[i+3]===0x06) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Không phải file ZIP hợp lệ');

  const cdCount  = readUInt16LE(buf, eocd + 8);
  const cdOffset = readUInt32LE(buf, eocd + 16);
  const entries  = {};
  let pos = cdOffset;

  for (let i = 0; i < cdCount; i++) {
    if (buf[pos]!==0x50||buf[pos+1]!==0x4B||buf[pos+2]!==0x01||buf[pos+3]!==0x02) break;
    const method   = readUInt16LE(buf, pos + 10);
    const compSize = readUInt32LE(buf, pos + 20);
    const fnLen    = readUInt16LE(buf, pos + 28);
    const extLen   = readUInt16LE(buf, pos + 30);
    const cmtLen   = readUInt16LE(buf, pos + 32);
    const localOff = readUInt32LE(buf, pos + 42);
    const fileName = buf.slice(pos + 46, pos + 46 + fnLen).toString('utf8');
    pos += 46 + fnLen + extLen + cmtLen;

    if (!fileName.endsWith('.xml')) continue;
    const lname = fileName.toLowerCase();
    if (!lname.includes('sharedstrings') && !lname.match(/worksheets\/sheet[\w]*\.xml/)) continue;

    const lfnLen  = readUInt16LE(buf, localOff + 26);
    const lextLen = readUInt16LE(buf, localOff + 28);
    const dataOff = localOff + 30 + lfnLen + lextLen;
    const compressed = buf.slice(dataOff, dataOff + compSize);

    let xml;
    if (method === 0) {
      xml = compressed.toString('utf8');
    } else if (method === 8) {
      xml = zlib.inflateRawSync(compressed).toString('utf8');
    } else {
      continue;
    }
    entries[fileName] = xml;
  }
  return entries;
}

// ── Minimal XML parser ───────────────────────────────────────────────────────

function getTagContent(xml, tag) {
  // Extract all <tag ...>content</tag> blocks
  const results = [];
  const re = new RegExp(`<(?:[^:>]+:)?${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:[^:>]+:)?${tag}>`, 'g');
  let m;
  while ((m = re.exec(xml)) !== null) results.push(m[1]);
  return results;
}

function getAttr(str, attr) {
  const m = str.match(new RegExp(`\\b${attr}="([^"]*)"`));
  return m ? m[1] : null;
}

function parseSharedStrings(xml) {
  // Extract all <si> blocks
  const sis = getTagContent(xml, 'si');
  return sis.map(si => {
    // Get all <t> values and join (handles rich text)
    const ts = [];
    const re = /<(?:[^:>]+:)?t(?:\s[^>]*)?>([^<]*)<\/(?:[^:>]+:)?t>/g;
    let m;
    while ((m = re.exec(si)) !== null) ts.push(m[1]);
    return ts.join('').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(n));
  });
}

function parseSheet(xml, strings) {
  const headers = [];
  const data    = [];

  // Extract all <row> blocks
  const rowRe = /<(?:[^:>]+:)?row\b[^>]*>([\s\S]*?)<\/(?:[^:>]+:)?row>/g;
  let rowMatch;
  while ((rowMatch = rowRe.exec(xml)) !== null) {
    const rowXml = rowMatch[1];
    const arr    = [];

    // Extract all <c> elements
    const cRe = /<(?:[^:>]+:)?c\b([^>]*)>([\s\S]*?)<\/(?:[^:>]+:)?c>/g;
    let cMatch;
    while ((cMatch = cRe.exec(rowXml)) !== null) {
      const attrs = cMatch[1];
      const inner = cMatch[2];
      const ref   = getAttr(attrs, 'r') || '';
      const t     = getAttr(attrs, 't') || '';
      const colLetter = ref.replace(/\d/g, '');
      const colIdx    = colLetterToIndex(colLetter);

      // Get <v> value
      const vm = inner.match(/<(?:[^:>]+:)?v[^>]*>([^<]*)<\/(?:[^:>]+:)?v>/);
      let val = vm ? vm[1] : '';

      if (t === 's') {
        val = strings[parseInt(val)] ?? '';
      } else if (t === 'b') {
        val = val === '1';
      } else if (val !== '') {
        val = parseFloat(val);
        if (isNaN(val)) val = '';
      }
      arr[colIdx] = val;
    }

    // Fill gaps
    for (let j = 0; j < arr.length; j++) if (arr[j] === undefined) arr[j] = '';

    if (headers.length === 0) {
      arr.forEach((v,i) => headers[i] = String(v ?? '').trim());
    } else {
      if (arr.every(v => v === '' || v == null)) continue;
      const obj = {};
      headers.forEach((h,i) => { if (h) obj[h] = arr[i] ?? ''; });
      data.push(obj);
    }
  }
  return { data, headers };
}

function colLetterToIndex(col) {
  let n = 0;
  for (const ch of col.toUpperCase()) n = n*26 + ch.charCodeAt(0) - 64;
  return n - 1;
}

// ── Business logic ────────────────────────────────────────────────────────────

function parseNum(v) {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return isNaN(v) ? 0 : v;
  const s = String(v).replace(/[^\d,.-]/g,'');
  if (s.includes(',') && s.includes('.')) {
    return s.lastIndexOf(',') > s.lastIndexOf('.')
      ? parseFloat(s.replace(/\./g,'').replace(',','.')) || 0
      : parseFloat(s.replace(/,/g,'')) || 0;
  }
  if (s.includes(',')) return parseFloat(s.replace(',','.')) || 0;
  return parseFloat(s) || 0;
}

function normalizeGroup(g) {
  if (!g) return 'Khác';
  g = g.trim();
  if (/bánh|kẹo|snack/i.test(g)) return 'Bánh Kẹo & Snack';
  return g;
}

function round2(v) { return Math.round(v * 100) / 100; }

// ── Main ─────────────────────────────────────────────────────────────────────

console.log('[build] Đọc file:', EXCEL_PATH);
if (!fs.existsSync(EXCEL_PATH)) {
  console.error('[build] ❌ Không tìm thấy data/BangGia.xlsx');
  process.exit(1);
}

const buf     = fs.readFileSync(EXCEL_PATH);
const entries = readZipEntries(buf);

console.log('[build] Các XML entries:', Object.keys(entries).join(', '));

const ssKey = Object.keys(entries).find(k => k.toLowerCase().includes('sharedstrings'));
const strings = ssKey ? parseSharedStrings(entries[ssKey]) : [];
console.log(`[build] Shared strings: ${strings.length}`);

const sheetKey = Object.keys(entries).find(k => /worksheets\/sheet[\w]*\.xml/i.test(k));
if (!sheetKey) { console.error('[build] ❌ Không tìm được sheet'); process.exit(1); }

const { data: rows, headers } = parseSheet(entries[sheetKey], strings);
console.log(`[build] Headers: ${headers.join(' | ')}`);
console.log(`[build] Rows: ${rows.length}`);

const REQUIRED = ['Mã hàng','Tên hàng','Đơn vị tính','Nhóm hàng','Tồn kho','Giá vốn','Giá nhập cuối','Bảng giá chung'];
const missing = REQUIRED.filter(c => !headers.includes(c));
if (missing.length) {
  console.error('[build] ❌ Thiếu cột:', missing.join(', '));
  process.exit(1);
}

const products = rows
  .filter(r => r['Mã hàng'] && String(r['Mã hàng']).trim())
  .map(r => {
    const maHang    = String(r['Mã hàng']      || '').trim();
    const tenHang   = String(r['Tên hàng']      || '').trim();
    const donViTinh = String(r['Đơn vị tính']   || '').trim();
    const nhomHang  = normalizeGroup(String(r['Nhóm hàng'] || '').trim());
    const tonKho    = parseNum(r['Tồn kho']);
    const giaVon    = parseNum(r['Giá vốn']);
    const giaNhap   = parseNum(r['Giá nhập cuối']);
    const bangGia   = parseNum(r['Bảng giá chung']);

    const vatPct  = (nhomHang === 'Sữa' || nhomHang === 'Chăm Sóc Cá Nhân') ? 0.10 : 0.08;
    const vatDV   = round2(giaNhap * vatPct);
    const tongGV  = round2(giaNhap + vatDV);
    const thueHKD = round2(bangGia * 0.015);
    const lnThuan = round2(bangGia - thueHKD - tongGV);
    const hoaVon  = round2(tongGV + thueHKD);
    const pctLN   = tongGV > 0 ? Math.round(lnThuan/tongGV*1000000)/10000 : 0;
    const danhGia = bangGia === 0 ? 'Chưa có giá' : lnThuan > 0 ? 'Lời' : 'Lỗ';

    return { maHang, tenHang, donViTinh, nhomHang,
      tonKho: round2(tonKho), giaVon: round2(giaVon),
      giaNhap, bangGia, vatPct, vatDV, tongGV, thueHKD, lnThuan, hoaVon, pctLN, danhGia };
  });

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(OUT_PATH, JSON.stringify(products));

const loi  = products.filter(p => p.danhGia === 'Lời').length;
const lo   = products.filter(p => p.danhGia === 'Lỗ').length;
const chua = products.filter(p => p.danhGia === 'Chưa có giá').length;
console.log(`[build] ✅ ${products.length} sản phẩm → public/data/products.json`);
console.log(`[build]    Lời: ${loi} | Lỗ: ${lo} | Chưa có giá: ${chua}`);
