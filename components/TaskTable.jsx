// components/TaskTable.jsx
"use client";

import { useState, useEffect } from "react";
import { db } from "@/firebase/config";
import { collection, onSnapshot, getDocs, query, where, limit, updateDoc, doc, serverTimestamp, arrayUnion } from "firebase/firestore";
import { useRequireAuth } from "@/firebase/useRequireAuth";
import { advanceSopChain } from "@/services/sopService";
import { sendTaskNotification } from "@/services/notifyService";

const UNIT_FILTERS = ["ALL", "ผู้ใหญ่บ้าน", "อสม.", "รพ.สต.", "โรงพยาบาล", "EMS", "ตำรวจ"];

// ถ้าส่ง incidentId มา จะแสดงเฉพาะภารกิจของเหตุการณ์นั้น (ใช้ในหน้ารายละเอียดเหตุการณ์)
// ถ้าไม่ส่งมา จะแสดงภารกิจทั้งหมดในระบบ พร้อมตัวกรองตามหน่วยงาน (ใช้ในหน้า /sop)
export default function TaskTable({ incidentId }) {
  const user = useRequireAuth();
  const [tasks, setTasks] = useState([]);
  const [closedIncidentIds, setClosedIncidentIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [selectedUnit, setSelectedUnit] = useState("ALL");

  // ใช้ onSnapshot แทน getDocs ครั้งเดียว เพื่อให้ตารางอัปเดตสดทันทีที่มีคนกดสถานะ
  // (ทั้งจากเว็บเครื่องอื่น หรือกดปุ่มยืนยันผ่านไลน์) โดยไม่ต้อง refresh หน้าเอง
  useEffect(() => {
    if (!user) return;

    const tasksRef = collection(db, "tasks");
    const q = incidentId ? query(tasksRef, where("incidentId", "==", incidentId)) : tasksRef;

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const taskList = [];
        snapshot.forEach((docItem) => taskList.push({ id: docItem.id, ...docItem.data() }));
        taskList.sort((a, b) => (a.stepOrder ?? 999) - (b.stepOrder ?? 999));
        setTasks(taskList);
        setLoading(false);
      },
      (error) => {
        console.error("Error watching tasks:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user, incidentId]);

  // เฝ้าดูสถานะ "ปิดเหตุแล้ว" ของทุกเหตุการณ์ เพื่อล็อกปุ่มของ task ที่เคสถูกปิดไปแล้ว
  // แม้ task นั้นเองจะยังไม่ถูกกดเสร็จสิ้นเป็นรายตัวก็ตาม (เช่น แอดมินปิดเหตุคาไว้)
  useEffect(() => {
    if (!user) return;
    const unsubscribe = onSnapshot(
      collection(db, "incidents"),
      (snapshot) => {
        const closed = new Set();
        snapshot.forEach((d) => {
          const data = d.data();
          if (data.status === "CLOSED") closed.add(data.id);
        });
        setClosedIncidentIds(closed);
      },
      (error) => console.error("Error watching incidents (closed status):", error)
    );
    return () => unsubscribe();
  }, [user]);

  const filteredTasks = selectedUnit === "ALL" ? tasks : tasks.filter((t) => t.unit === selectedUnit);

  const getActorName = () => {
    if (typeof window === "undefined") return "ไม่ระบุชื่อ";
    return localStorage.getItem("userName") || "ไม่ระบุชื่อ";
  };

  const handleUpdateStatus = async (task, newStatus) => {
    if (task.status === "COMPLETED" || closedIncidentIds.has(task.incidentId)) {
      alert("ภารกิจนี้เสร็จสิ้นแล้วหรือเหตุการณ์นี้ถูกปิดไปแล้ว ไม่สามารถแก้ไขสถานะซ้ำได้");
      return;
    }
    try {
      const actor = getActorName();
      const now = new Date();
      const updates = {
        status: newStatus,
        history: arrayUnion({
          status: newStatus,
          actorType: "WEB",
          actorId: null,
          actorDisplayName: actor,
          timestamp: now,
          note: null,
        }),
      };
      if (!task.acknowledgedAt) {
        updates.acknowledgedAt = now;
        updates.acknowledgedBy = actor;
      }
      if (newStatus === "COMPLETED") {
        updates.completedAt = serverTimestamp();
        updates.completedBy = actor;
      }
      await updateDoc(doc(db, "tasks", task.id), updates);

      // ถ้าเป็นขั้นตอนอัตโนมัติของ SOP (ไม่ใช่ภารกิจเสริม) และเพิ่งกดเสร็จสิ้น -> สร้าง+แจ้งเตือนขั้นถัดไปในโซ่
      if (newStatus === "COMPLETED" && task.stepOrder != null && !task.isConditional) {
        const advanceResult = await advanceSopChain(task.incidentId, task.stepOrder);
        if (advanceResult.success && advanceResult.task) {
          const incSnap = await getDocs(query(collection(db, "incidents"), where("id", "==", task.incidentId), limit(1)));
          if (!incSnap.empty) {
            const incidentData = incSnap.docs[0].data();
            await sendTaskNotification(incidentData, advanceResult.task);
          }
        }
      }
      // ไม่ต้องเรียก fetch ซ้ำ — onSnapshot ด้านบนจะอัปเดตตารางให้อัตโนมัติ
    } catch (error) {
      alert("เกิดข้อผิดพลาดในการอัปเดตสถานะ: " + error.message);
    }
  };

  if (!user) return <div className="p-4 text-slate-500">กำลังตรวจสอบสิทธิ์การเข้าใช้งาน...</div>;
  if (loading) return <div className="p-4 text-slate-500">กำลังโหลดรายการงาน SOP...</div>;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mt-6">
      <div className="p-4 border-b bg-slate-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h3 className="font-bold text-slate-800">รายการงานตามขั้นตอน SOP</h3>

        {!incidentId && (
          <div className="flex flex-wrap gap-1.5">
            {UNIT_FILTERS.map((unit) => (
              <button
                key={unit}
                onClick={() => setSelectedUnit(unit)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                  selectedUnit === unit
                    ? "bg-blue-600 text-white shadow-sm"
                    : "bg-white border border-slate-300 text-slate-600 hover:bg-slate-100"
                }`}
              >
                {unit === "ALL" ? "ทั้งหมด" : unit}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b bg-slate-100/60 text-xs font-semibold text-slate-600 uppercase">
              <th className="p-3 sm:p-4">รหัสเหตุการณ์</th>
              <th className="p-3 sm:p-4">หน่วยงานที่รับผิดชอบ</th>
              <th className="p-3 sm:p-4">ภารกิจ / Task</th>
              <th className="p-3 sm:p-4">สถานะ</th>
              <th className="p-3 sm:p-4 text-center">จัดการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
            {filteredTasks.length === 0 ? (
              <tr>
                <td colSpan="5" className="p-6 text-center text-slate-400">ไม่พบรายการงานในหน่วยงานนี้</td>
              </tr>
            ) : (
              filteredTasks.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50/50">
                  <td className="p-3 sm:p-4 font-medium text-blue-600">{t.incidentId}</td>
                  <td className="p-3 sm:p-4">
                    <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg text-xs font-medium">
                      {t.unit}{t.isConditional ? " (เสริม)" : ""}
                    </span>
                  </td>
                  <td className="p-3 sm:p-4">{t.task}</td>
                  <td className="p-3 sm:p-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                      t.status === "COMPLETED"
                        ? "bg-emerald-100 text-emerald-700"
                        : t.status === "IN_PROGRESS"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-slate-100 text-slate-600"
                    }`}>
                      {t.status === "COMPLETED" ? "✓ เสร็จสิ้น" : t.status === "IN_PROGRESS" ? "○ กำลังดำเนินการ" : "○ รอดำเนินการ"}
                    </span>
                  </td>
                  <td className="p-3 sm:p-4 text-center space-x-2">
                    {t.status !== "COMPLETED" && !closedIncidentIds.has(t.incidentId) ? (
                      <>
                        {t.status !== "IN_PROGRESS" && (
                          <button
                            onClick={() => handleUpdateStatus(t, "IN_PROGRESS")}
                            className="px-3 py-1.5 bg-amber-50 text-amber-600 hover:bg-amber-100 rounded-lg text-xs font-bold transition"
                          >
                            รับทราบ/กำลังทำ
                          </button>
                        )}
                        <button
                          onClick={() => handleUpdateStatus(t, "COMPLETED")}
                          className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition"
                        >
                          เสร็จสิ้น
                        </button>
                      </>
                    ) : (
                      <span className="text-xs text-slate-400">
                        {t.status === "COMPLETED"
                          ? `เสร็จสิ้นแล้ว${t.completedBy ? ` โดย ${t.completedBy}` : ""}`
                          : "ปิดเหตุแล้ว — ไม่รับดำเนินการเพิ่ม"}
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
