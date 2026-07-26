// components/TaskTable.jsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { db } from "@/firebase/config";
import { collection, getDocs, query, where, updateDoc, doc, serverTimestamp, arrayUnion } from "firebase/firestore";
import { useRequireAuth } from "@/firebase/useRequireAuth";

const UNIT_FILTERS = ["ALL", "ผู้ใหญ่บ้าน", "อสม.", "รพ.สต.", "โรงพยาบาล", "EMS", "ตำรวจ"];

// ถ้าส่ง incidentId มา จะแสดงเฉพาะภารกิจของเหตุการณ์นั้น (ใช้ในหน้ารายละเอียดเหตุการณ์)
// ถ้าไม่ส่งมา จะแสดงภารกิจทั้งหมดในระบบ พร้อมตัวกรองตามหน่วยงาน (ใช้ในหน้า /sop)
export default function TaskTable({ incidentId }) {
  const user = useRequireAuth();
  const [tasks, setTasks] = useState([]);
  const [filteredTasks, setFilteredTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUnit, setSelectedUnit] = useState("ALL");

  const fetchTasks = useCallback(async () => {
    try {
      const tasksRef = collection(db, "tasks");
      const q = incidentId ? query(tasksRef, where("incidentId", "==", incidentId)) : tasksRef;
      const querySnapshot = await getDocs(q);
      const taskList = [];
      querySnapshot.forEach((docItem) => {
        taskList.push({ id: docItem.id, ...docItem.data() });
      });
      taskList.sort((a, b) => (a.stepOrder ?? 999) - (b.stepOrder ?? 999));
      setTasks(taskList);
      setFilteredTasks(taskList);
    } catch (error) {
      console.error("Error fetching tasks:", error);
    }
    setLoading(false);
  }, [incidentId]);

  useEffect(() => {
    if (!user) return;
    fetchTasks();
  }, [user, fetchTasks]);

  const handleFilter = (unit) => {
    setSelectedUnit(unit);
    setFilteredTasks(unit === "ALL" ? tasks : tasks.filter((t) => t.unit === unit));
  };

  const getActorName = () => {
    if (typeof window === "undefined") return "ไม่ระบุชื่อ";
    return localStorage.getItem("userName") || "ไม่ระบุชื่อ";
  };

  const handleUpdateStatus = async (task, newStatus) => {
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
      fetchTasks();
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
                onClick={() => handleFilter(unit)}
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
                    {t.status !== "COMPLETED" ? (
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
                        เสร็จสิ้นแล้ว{t.completedBy ? ` โดย ${t.completedBy}` : ""}
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
