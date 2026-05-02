# 📊 Bảng Giá & Phân Tích Lợi Nhuận

Dashboard tự động từ file Excel — không cần upload thủ công.

## Cấu trúc thư mục

```
banggia-project/
├── data/
│   └── BangGia.xlsx        ← ✏️ THAY FILE NÀY ĐỂ CẬP NHẬT DỮ LIỆU
├── public/
│   ├── index.html          ← Dashboard (không cần chỉnh)
│   └── data/
│       └── products.json   ← Tự động sinh khi deploy
├── scripts/
│   └── build.js            ← Script chuyển Excel → JSON
├── package.json
├── vercel.json
└── .gitignore
```

## Cách cập nhật dữ liệu

1. Thay file `data/BangGia.xlsx` bằng file Excel mới
2. Commit & push lên GitHub
3. Vercel tự động deploy trong ~30 giây ✅

## Yêu cầu file Excel

File Excel phải có **8 cột** (đúng tên):

| Cột | Bắt buộc |
|-----|----------|
| Mã hàng | ✅ |
| Tên hàng | ✅ |
| Đơn vị tính | ✅ |
| Nhóm hàng | ✅ |
| Tồn kho | ✅ |
| Giá vốn | ✅ |
| Giá nhập cuối | ✅ |
| Bảng giá chung | ✅ |

## Công thức tính

```
VAT %          = 10% (Sữa, Chăm Sóc Cá Nhân) | 8% (các nhóm khác)
VAT đầu vào    = Giá nhập cuối × VAT %
Tổng giá vốn   = Giá nhập cuối + VAT đầu vào
Thuế HKD       = Bảng giá chung × 1.5%
Lợi nhuận thuần= Bảng giá chung − Thuế HKD − Tổng giá vốn
Giá hòa vốn    = Tổng giá vốn + Thuế HKD
% Lợi nhuận    = Lợi nhuận thuần / Tổng giá vốn × 100
```
