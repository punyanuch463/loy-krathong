import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "วันเพ็ญเดือน 12 น้ำตะนองเต็มตะติ่ง",
  description: "สร้างกระทงและลอยคำอธิษฐานไปกับสายน้ำ",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="th"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
