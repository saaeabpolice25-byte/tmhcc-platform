// components/Navbar.jsx
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/firebase/config";
import { logoutUser } from "@/firebase/auth";
import { useUserRole } from "@/firebase/useUserRole";

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState(null);
  const role = useUserRole(user);
  const isAdmin = role === "ADMIN";
  const canOpenIncident = role === "VILLAGE_HEAD" || role === "ADMIN";

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => setUser(currentUser));
    return () => unsubscribe();
  }, []);

  // หน้าสถานะสาธารณะ (/status) ไม่ต้องมี navbar เลย เพราะเปิดให้คนภายนอกดูโดยไม่ต้อง login
  if (pathname === "/status") return null;

  const navLinks = [
    { href: "/dashboard", label: "📊 แดชบอร์ด" },
    ...(canOpenIncident ? [{ href: "/incidents", label: "🚨 เปิดเหตุ" }] : []),
    { href: "/sop", label: "📋 ติดตาม SOP" },
    { href: "/status", label: "📡 สถานะสาธารณะ" },
    ...(isAdmin ? [{ href: "/users", label: "⚙️ จัดการสมาชิก" }] : []),
  ];

  const handleLogout = async () => {
    await logoutUser();
    router.push("/login");
  };

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

          {pathname !== "/login" && (
            user ? (
              <button
                onClick={handleLogout}
                className="ml-1 px-2.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-medium text-red-600 hover:bg-red-50 whitespace-nowrap transition"
              >
                ออกจากระบบ
              </button>
            ) : (
              <Link
                href="/login"
                className="ml-1 px-2.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-medium text-blue-600 hover:bg-blue-50 whitespace-nowrap transition"
              >
                เข้าสู่ระบบ
              </Link>
            )
          )}
        </div>
      </div>
    </nav>
  );
}
