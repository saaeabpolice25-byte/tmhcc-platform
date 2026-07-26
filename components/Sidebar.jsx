// components/Sidebar.jsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Sidebar() {
  const [role, setRole] = useState("");
  const [name, setName] = useState("");
  const pathname = usePathname();

  useEffect(() => {
    // ดึงข้อมูล Role ที่เก็บไว้ตอน Login
    const userRole = localStorage.getItem("userRole") || "VILLAGE_HEAD";
    const userName = localStorage.getItem("userName") || "เจ้าหน้าที่";
    setRole(userRole);
    setName(userName);
  }, []);

  // กำหนดป้ายแสดงชื่อ Role เป็นภาษาไทย
  const roleLabels = {
    ADMIN: "ผู้ดูแลระบบ (Admin)",
    SUBDISTRICT_MANAGER: "ผู้จัดการตำบล (Subdistrict)",
    VILLAGE_HEAD: "ผู้ใหญ่บ้าน (Village Head)",
    HEALTH_VOLUNTEER: "อสม. (Volunteer)",
    HOSPITAL: "รพ.สต. (Hospital)",
    EMS: "ทีมกู้ชีพ (EMS)"
  };

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col min-h-screen p-4 border-r border-slate-800">
      <div className="mb-8 px-2">
        <h2 className="text-xl font-bold text-white tracking-wide">TMHCC Platform</h2>
        <p className="text-xs text-slate-400 mt-0.5">ศูนย์บัญชาการสุขภาพจิตตำบล</p>
      </div>

      {/* ข้อมูลผู้ใช้งานปัจจุบัน */}
      <div className="mb-6 p-3 bg-slate-800/80 rounded-xl border border-slate-700/50">
        <p className="text-xs text-slate-400">ผู้ใช้งานระบบ:</p>
        <p className="text-sm font-semibold text-white truncate">{name}</p>
        <span className="inline-block mt-2 px-2 py-0.5 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded text-[10px] font-bold uppercase">
          {roleLabels[role] || role}
        </span>
      </div>

      {/* เมนูนำทางตามสิทธิ์ */}
      <nav className="space-y-1.5 flex-1">
        <Link
          href="/dashboard"
          className={`block px-4 py-2.5 rounded-xl text-sm font-medium transition ${
            pathname === "/dashboard" ? "bg-blue-600 text-white shadow-md" : "hover:bg-slate-800 text-slate-300"
          }`}
        >
          📊 แดชบอร์ดภาพรวม
        </Link>

        {/* สิทธิ์ที่สามารถเปิดเหตุได้: ADMIN หรือ VILLAGE_HEAD */}
        {(role === "ADMIN" || role === "VILLAGE_HEAD") && (
          <Link
            href="/incidents"
            className={`block px-4 py-2.5 rounded-xl text-sm font-medium transition ${
              pathname === "/incidents" ? "bg-blue-600 text-white shadow-md" : "hover:bg-slate-800 text-slate-300"
            }`}
          >
            🚨 ระบบเปิดเหตุ (Incident)
          </Link>
        )}

        {/* เมนูงาน SOP สำหรับทุกบทบาทที่เกี่ยวข้อง */}
        <Link
          href="/tasks"
          className={`block px-4 py-2.5 rounded-xl text-sm font-medium transition ${
            pathname === "/tasks" ? "bg-blue-600 text-white shadow-md" : "hover:bg-slate-800 text-slate-300"
          }`}
        >
          📋 รายการงาน SOP
        </Link>

        {/* เมนูจัดการผู้ใช้เฉพาะ Admin */}
        {role === "ADMIN" && (
          <Link
            href="/users"
            className={`block px-4 py-2.5 rounded-xl text-sm font-medium transition ${
              pathname === "/users" ? "bg-blue-600 text-white shadow-md" : "hover:bg-slate-800 text-slate-300"
            }`}
          >
            ⚙️ จัดการสิทธิ์ผู้ใช้งาน
          </Link>
        )}
      </nav>

      {/* ปุ่มออกจากระบบ */}
      <div className="pt-4 border-t border-slate-800">
        <button
          onClick={() => {
            localStorage.clear();
            window.location.href = "/login";
          }}
          className="w-full px-4 py-2 bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl text-sm font-medium hover:bg-red-500/20 transition text-center"
        >
          ออกจากระบบ
        </button>
      </div>
    </aside>
  );
}