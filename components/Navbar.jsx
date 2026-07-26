// components/Navbar.jsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Navbar() {
  const pathname = usePathname();

  const navLinks = [
    { href: "/dashboard", label: "📊 แดชบอร์ด" },
    { href: "/incidents", label: "🚨 เปิดเหตุ" },
    { href: "/sop", label: "📋 ติดตาม SOP" },
  ];

  return (
    <nav className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 flex justify-between items-center h-14 sm:h-16 gap-2">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 shrink-0">
          <span className="text-lg sm:text-xl font-extrabold text-blue-600">TMHCC</span>
          <span className="hidden sm:inline-block text-xs font-semibold px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full whitespace-nowrap">
            ศูนย์บัญชาการสุขภาพจิตตำบล
          </span>
        </div>

        <div className="flex items-center gap-1 overflow-x-auto">
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`px-2.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-medium whitespace-nowrap transition ${
                  isActive
                    ? "bg-blue-50 text-blue-600 font-bold"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}