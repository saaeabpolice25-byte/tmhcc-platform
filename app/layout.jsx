// app/layout.jsx
import "./globals.css";
import Navbar from "@/components/Navbar";

export const metadata = {
  title: "TMHCC Platform - ศูนย์บัญชาการสุขภาพจิตตำบล",
  description: "Real-time Incident & SOP Tracking System",
};

export default function RootLayout({ children }) {
  return (
    <html lang="th">
      <body className="bg-slate-50 min-h-screen">
        <Navbar />
        <main className="p-3 sm:p-4">{children}</main>
      </body>
    </html>
  );
}