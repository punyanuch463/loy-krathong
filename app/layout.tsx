import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ลอยกระทงใต้แสงจันทร์",
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
