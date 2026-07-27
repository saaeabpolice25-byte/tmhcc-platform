// app/status/page.jsx
// หน้าสถานะสาธารณะ — ให้คนภายนอก (เช่น ผู้บริหาร/ประชาชน) ดูภาพรวมได้โดยไม่ต้อง login
// แสดงเฉพาะตัวเลขสรุปจาก /api/public-status เท่านั้น ไม่มีรหัสเคส ชื่อผู้ป่วย หรือพื้นที่ เพื่อความเป็นส่วนตัวของผู้ป่วย
"use client";

import { useState, useEffect } from "react";

const POLL_MS = 20000;

const formatUpdatedAt = (iso) => {
  if (!iso) return "-";
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())} น.`;
};

export default function PublicStatusPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/public-status", { cache: "no-store" });
        const json = await res.json().catch(() => ({ success: false, error: "การเชื่อมต่อผิดพลาด" }));
        if (cancelled) return;
        if (json.success) {
          setData(json);
          setError(null);
        } else {
          setError(json.error || "โหลดข้อมูลไม่สำเร็จ");
        }
      } catch {
        if (!cancelled) setError("การเชื่อมต่อผิดพลาด");
      }
    };
    load();
    const interval = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  if (error && !data) {
    return <div className="p-6 max-w-lg mx-auto text-center text-red-600">{error}</div>;
  }
  if (!data) {
    return <div className="p-6 text-center text-slate-500">กำลังโหลดสถานะ...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="p-4 sm:p-6 max-w-5xl mx-auto">
        <header className="mb-6 sm:mb-8 text-center">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-800">📡 สถานะภาพรวมระบบเฝ้าระวังสุขภาพจิตตำบล</h1>
          <p className="text-sm text-slate-500 mt-2">TMHCC Platform — หน้าสถานะสาธารณะ แสดงเฉพาะภาพรวม ไม่มีข้อมูลส่วนบุคคลของผู้ป่วย</p>
        </header>

        <section className="mb-8">
          <h2 className="text-base sm:text-lg font-bold text-slate-700 mb-4 text-center">เคสที่กำลังเฝ้าระวังอยู่ขณะนี้</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-red-50 border border-red-200 rounded-2xl p-6 shadow-sm text-center">
              <p className="text-xs font-bold text-red-600 uppercase tracking-wider">🔴 วิกฤต</p>
              <p className="text-4xl sm:text-5xl font-extrabold text-red-700 mt-2">{data.levels.RED}</p>
            </div>
            <div className="bg-orange-50 border border-orange-200 rounded-2xl p-6 shadow-sm text-center">
              <p className="text-xs font-bold text-orange-600 uppercase tracking-wider">🟠 เร่งด่วน</p>
              <p className="text-4xl sm:text-5xl font-extrabold text-orange-700 mt-2">{data.levels.ORANGE}</p>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-6 shadow-sm text-center">
              <p className="text-xs font-bold text-yellow-600 uppercase tracking-wider">🟡 ติดตามอาการ</p>
              <p className="text-4xl sm:text-5xl font-extrabold text-yellow-700 mt-2">{data.levels.YELLOW}</p>
            </div>
          </div>
        </section>

        <section className="mb-8">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm text-center">
              <p className="text-xs font-semibold text-slate-500 uppercase">กำลังดำเนินการรวม</p>
              <p className="text-3xl font-bold text-slate-800 mt-2">{data.totals.active}</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm text-center">
              <p className="text-xs font-semibold text-slate-500 uppercase">ปิดเหตุแล้วสะสม</p>
              <p className="text-3xl font-bold text-emerald-600 mt-2">{data.totals.closed}</p>
            </div>
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-base sm:text-lg font-bold text-slate-700 mb-4 text-center">ภารกิจที่กำลังดำเนินการตามหน่วยงาน</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {data.pendingByUnit.map((u) => (
              <div key={u.unit} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm text-center">
                <p className="text-xs font-semibold text-slate-500 uppercase">{u.unit}</p>
                <p className="text-2xl sm:text-3xl font-bold text-slate-800 mt-2">{u.count}</p>
              </div>
            ))}
          </div>
        </section>

        <p className="text-center text-xs text-slate-400">
          อัปเดตล่าสุด: {formatUpdatedAt(data.updatedAt)} · ข้อมูลรีเฟรชอัตโนมัติทุก 20 วินาที
        </p>
      </div>
    </div>
  );
}
