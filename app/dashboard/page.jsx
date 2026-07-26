// app/dashboard/page.jsx
"use client";

import { useState, useEffect } from "react";
import { db } from "@/firebase/config";
import { collection, onSnapshot } from "firebase/firestore";
import Link from "next/link";
import { useRequireAuth } from "@/firebase/useRequireAuth";
import { formatDateTime } from "@/services/aarService";

export default function DashboardPage() {
  const user = useRequireAuth();
  const [incidents, setIncidents] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  // ใช้ onSnapshot แทน getDocs ครั้งเดียว เพื่อให้แดชบอร์ดอัปเดตสดทันทีที่มีเคส/สถานะงานเปลี่ยน
  // (เช่น หน่วยอื่นกดยืนยันผ่านไลน์ หรือมีคนเปิดเหตุใหม่จากเครื่องอื่น) โดยไม่ต้องกด refresh เอง
  useEffect(() => {
    if (!user) return;

    const unsubIncidents = onSnapshot(
      collection(db, "incidents"),
      (snapshot) => {
        setIncidents(snapshot.docs.map((doc) => ({ docId: doc.id, ...doc.data() })));
        setLoading(false);
      },
      (error) => {
        console.error("Error watching incidents:", error);
        setLoading(false);
      }
    );

    const unsubTasks = onSnapshot(collection(db, "tasks"), (snapshot) => {
      setTasks(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    }, (error) => console.error("Error watching tasks:", error));

    return () => {
      unsubIncidents();
      unsubTasks();
    };
  }, [user]);

  const redCount = incidents.filter(i => i.level === "RED").length;
  const orangeCount = incidents.filter(i => i.level === "ORANGE").length;
  const yellowCount = incidents.filter(i => i.level === "YELLOW").length;

  const getTaskCountByUnit = (unitName) => {
    return tasks.filter(t => t.unit === unitName && t.status !== "COMPLETED").length;
  };

  // งานที่ยังไม่เสร็จของเคสนี้ (ในโซ่ SOP หลักก่อน ถ้าไม่มีค่อยดูภารกิจเสริมอย่างตำรวจ)
  const getCurrentStageTask = (incidentCode) => {
    const incidentTasks = tasks.filter(t => t.incidentId === incidentCode);
    return (
      incidentTasks.find(t => !t.isConditional && t.status !== "COMPLETED") ||
      incidentTasks.find(t => t.isConditional && t.status !== "COMPLETED") ||
      null
    );
  };

  if (!user) return <div className="p-6 text-slate-500">กำลังตรวจสอบสิทธิ์การเข้าใช้งาน...</div>;
  if (loading) return <div className="p-6 text-slate-500">กำลังโหลดข้อมูลแดชบอร์ด...</div>;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* เนื้อหาหน้าแดชบอร์ดหลัก */}
      <div className="p-4 sm:p-6 max-w-7xl mx-auto">
        <header className="mb-6 sm:mb-8 border-b pb-4">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">📊 แดชบอร์ดศูนย์บัญชาการสุขภาพจิตตำบล</h1>
          <p className="text-sm text-slate-500">TMHCC Platform - ติดตามสถานการณ์และภารกิจฉุกเฉินแบบ Real-time</p>
        </header>

        {/* สรุปสถิติเหตุการณ์ปัจจุบันตามระดับความรุนแรง */}
        <section className="mb-8">
          <h2 className="text-lg font-bold text-slate-700 mb-4">สถานการณ์เคสปัจจุบัน (Incidents Overview)</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-red-50 border border-red-200 rounded-2xl p-5 shadow-sm">
              <p className="text-xs font-bold text-red-600 uppercase tracking-wider">วิกฤต (Red Level)</p>
              <p className="text-3xl sm:text-4xl font-extrabold text-red-700 mt-2">{redCount}</p>
              <p className="text-xs text-red-500 mt-1">เคสเร่งด่วนต้องช่วยเหลือทันที</p>
            </div>

            <div className="bg-orange-50 border border-orange-200 rounded-2xl p-5 shadow-sm">
              <p className="text-xs font-bold text-orange-600 uppercase tracking-wider">เร่งด่วน (Orange Level)</p>
              <p className="text-3xl sm:text-4xl font-extrabold text-orange-700 mt-2">{orangeCount}</p>
              <p className="text-xs text-orange-500 mt-1">เคสเฝ้าระวังใกล้ชิด</p>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-5 shadow-sm">
              <p className="text-xs font-bold text-yellow-600 uppercase tracking-wider">ติดตาม (Yellow Level)</p>
              <p className="text-3xl sm:text-4xl font-extrabold text-yellow-700 mt-2">{yellowCount}</p>
              <p className="text-xs text-yellow-600 mt-1">เคสติดตามอาการต่อเนื่อง</p>
            </div>
          </div>
        </section>

        {/* สรุปภารกิจรอดำเนินการตาม SOP แยกตามหน่วยงาน */}
        <section className="mb-8">
          <h2 className="text-lg font-bold text-slate-700 mb-4">ภารกิจรอดำเนินการตามขั้นตอน SOP (Pending Tasks)</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
              <p className="text-xs font-semibold text-slate-500 uppercase">อสม. (Village Health)</p>
              <p className="text-2xl sm:text-3xl font-bold text-slate-800 mt-2">{getTaskCountByUnit("อสม.")}</p>
              <p className="text-xs text-slate-400 mt-1">งานเฝ้าระวังและสำรวจพื้นที่</p>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
              <p className="text-xs font-semibold text-slate-500 uppercase">รพ.สต. (Health Center)</p>
              <p className="text-2xl sm:text-3xl font-bold text-slate-800 mt-2">{getTaskCountByUnit("รพ.สต.")}</p>
              <p className="text-xs text-slate-400 mt-1">งานประเมินอาการทางจิตเวช</p>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
              <p className="text-xs font-semibold text-slate-500 uppercase">โรงพยาบาล (Hospital)</p>
              <p className="text-2xl sm:text-3xl font-bold text-slate-800 mt-2">{getTaskCountByUnit("โรงพยาบาล")}</p>
              <p className="text-xs text-slate-400 mt-1">งานรับผู้ป่วยและประเมินจิตแพทย์</p>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
              <p className="text-xs font-semibold text-slate-500 uppercase">EMS (Emergency)</p>
              <p className="text-2xl sm:text-3xl font-bold text-slate-800 mt-2">{getTaskCountByUnit("EMS")}</p>
              <p className="text-xs text-slate-400 mt-1">งานส่งต่อและเคลื่อนย้ายผู้ป่วย</p>
            </div>
          </div>
        </section>

        {/* ตารางแสดงรายการเคสล่าสุดทั้งหมด */}
        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 border-b bg-slate-50">
            <h3 className="font-bold text-slate-800">รายการเหตุการณ์ทั้งหมดในระบบ</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b bg-slate-100/60 text-xs font-semibold text-slate-600 uppercase">
                  <th className="p-3 sm:p-4">รหัสเคส</th>
                  <th className="p-3 sm:p-4">วันที่/เวลาแจ้งเหตุ</th>
                  <th className="p-3 sm:p-4">ผู้ป่วย</th>
                  <th className="p-3 sm:p-4">ประเภท</th>
                  <th className="p-3 sm:p-4">ระดับ</th>
                  <th className="p-3 sm:p-4">กำลังดำเนินการที่</th>
                  <th className="p-3 sm:p-4">พื้นที่ (หมู่บ้าน)</th>
                  <th className="p-3 sm:p-4">หัวข้อเหตุการณ์</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                {incidents.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="p-6 text-center text-slate-400">ยังไม่มีประวัติเหตุการณ์ในระบบ</td>
                  </tr>
                ) : (
                  incidents.map((inc) => {
                    const stageTask = getCurrentStageTask(inc.id);
                    return (
                      <tr key={inc.docId} className="hover:bg-slate-50/50">
                        <td className="p-4 font-medium text-blue-600">
                          <Link href={`/incidents/${inc.docId}`} className="hover:underline">{inc.id}</Link>
                        </td>
                        <td className="p-3 sm:p-4 text-slate-500 whitespace-nowrap">{formatDateTime(inc.createdAt)}</td>
                        <td className="p-3 sm:p-4">{inc.patientName || "-"}</td>
                        <td className="p-3 sm:p-4">{inc.type}</td>
                        <td className="p-3 sm:p-4">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                            inc.level === "RED" ? "bg-red-100 text-red-700" :
                            inc.level === "ORANGE" ? "bg-orange-100 text-orange-700" : "bg-yellow-100 text-yellow-700"
                          }`}>
                            {inc.level}
                          </span>
                        </td>
                        <td className="p-3 sm:p-4">
                          {inc.status === "CLOSED" ? (
                            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-200 text-slate-600">ปิดเหตุแล้ว</span>
                          ) : stageTask ? (
                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                              stageTask.status === "IN_PROGRESS" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"
                            }`}>
                              {stageTask.unit}{stageTask.status === "IN_PROGRESS" ? " (กำลังทำ)" : " (รอดำเนินการ)"}
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">ครบขั้นตอน SOP</span>
                          )}
                        </td>
                        <td className="p-3 sm:p-4">{inc.village}</td>
                        <td className="p-4 text-slate-600">{inc.title}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}