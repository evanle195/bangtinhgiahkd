import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pricing Dashboard",
  description: "Dashboard tính giá vốn, VAT, thuế HKD và lợi nhuận từng mặt hàng",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
