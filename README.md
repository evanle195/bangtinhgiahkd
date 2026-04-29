# Pricing Dashboard Vercel

Website dashboard tính toán giá vốn, VAT đầu vào, thuế HKD, lợi nhuận thuần và giá bán hòa vốn theo từng mặt hàng sau khi admin upload file Excel/CSV.

## Tính năng

- Trang người dùng `/`: xem dashboard, KPI, bảng chi tiết, tìm kiếm sản phẩm, lọc nhóm hàng và trạng thái lời/lỗ.
- Trang admin `/admin`: upload file `.xlsx`, `.xls`, `.csv`.
- Backend API:
  - `GET /api/products`: trả dữ liệu dashboard mới nhất.
  - `POST /api/admin/upload`: nhận file, đọc dữ liệu, tính toán và lưu kết quả.
- Responsive mobile: KPI xếp dọc, bảng có cuộn ngang trên điện thoại.
- Nhóm `Bánh`, `Kẹo`, `Snack` được gộp thành `Bánh kẹo`.
- Có dữ liệu mẫu từ file `data/sample-bang-gia.csv` để mở dashboard ngay khi chưa upload.

## Công thức đang dùng

Với mỗi mặt hàng:

- `Giá nhập cuối chưa VAT` = cột Giá nhập cuối trong file.
- `VAT đầu vào` = Tổng giá vốn thực - Giá nhập cuối chưa VAT.
- Hệ thống tự nhận diện VAT 8% hoặc 10% bằng cách so sánh tỷ lệ giữa `Giá vốn` và `Giá nhập cuối`.
- `Tổng giá vốn thực` = Giá nhập cuối chưa VAT + VAT đầu vào. Nếu cột Giá vốn hệ thống lệch trong ngưỡng 2% so với công thức, hệ thống ưu tiên cột Giá vốn để bám dữ liệu thực tế.
- `Thuế HKD phải nộp` = Giá bán thực tế × 1,5%.
- `Lợi nhuận thuần` = Giá bán thực tế - Thuế HKD - Tổng giá vốn thực.
- `Giá bán hòa vốn tối thiểu` = Tổng giá vốn thực / (1 - 1,5%).
- `% Lợi nhuận / Tổng GV thực` = Lợi nhuận thuần / Tổng giá vốn thực.
- `Đánh giá` = `✅ Lời`, `❌ Lỗ`, hoặc `Chưa có giá`.

KPI tổng đang tính theo `Tồn kho` trong file vì file mẫu chưa có cột số lượng bán. Nếu sau này có cột `Số lượng bán`, có thể bổ sung vào `lib/pricing.ts` để doanh thu tính đúng theo sales thực tế.

## Chạy local

```bash
npm install
npm run dev
```

Mở:

- Dashboard: `http://localhost:3000`
- Admin upload: `http://localhost:3000/admin`

## Cấu hình admin token

Tạo file `.env.local` từ `.env.example`:

```bash
ADMIN_TOKEN=mat-khau-admin-cua-ban
```

Khi upload ở `/admin`, nhập đúng token này.

## Deploy Vercel

1. Push folder này lên GitHub.
2. Import repo vào Vercel.
3. Tạo Vercel Blob trong Storage của project.
4. Vercel sẽ tạo biến môi trường `BLOB_READ_WRITE_TOKEN` cho project. Nếu chưa có, thêm thủ công trong Settings > Environment Variables.
5. Deploy.

Không có `BLOB_READ_WRITE_TOKEN` thì app vẫn chạy bằng dữ liệu mẫu, nhưng dữ liệu admin upload sẽ không lưu bền trên Vercel serverless. Khi deploy production nên dùng Vercel Blob.

## Cấu trúc chính

```text
app/
  page.tsx                         Dashboard người dùng
  admin/page.tsx                   Trang upload cho admin
  api/products/route.ts            API đọc dữ liệu dashboard
  api/admin/upload/route.ts        API upload Excel/CSV
components/
  DashboardClient.tsx              UI dashboard, KPI, filter, table
  AdminUpload.tsx                  UI upload file
lib/
  pricing.ts                       Toàn bộ logic tính giá, VAT, thuế, lời/lỗ
  storage.ts                       Lưu/đọc dữ liệu bằng Vercel Blob hoặc local file
  format.ts                        Format tiền, số, phần trăm
data/
  sample-bang-gia.csv              File mẫu
  sample-products.json             Dữ liệu mẫu đã xử lý
```
