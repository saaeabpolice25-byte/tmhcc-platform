// app/incidents/[id]/page.jsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { db } from "@/firebase/config";
import { doc, getDoc } from "firebase/firestore";
import TaskTable from "@/components/TaskTable";
import { createConditionalTask } from "@/services/sopService";
import { closeIncident, formatDateTime } from "@/services/aarService";
import { sendTaskNotification } from "@/services/notifyService";
import { useRequireAuth } from "@/firebase/useRequireAuth";

const getActorName = () => {
  if (typeof window === "undefined") return "ไม่ระบุชื่อ";
  return localStorage.getItem("userName") || "ไม่ระบุชื่อ";
};

export default function IncidentDetailPage() {
  const user = useRequireAuth();
  const { id } = useParams();
  const [incident, setIncident] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [closing, setClosing] = useState(false);
  const [callingPolice, setCallingPolice] = useState(false);

  const fetchIncident = useCallback(async () => {
    setLoading(true);
    try {
      const snap = await getDoc(doc(db, "incidents", id));
      if (snap.exists()) {
        setIncident({ docId: snap.id, ...snap.data() });
      } else {
        setNotFound(true);
      }
    } catch (error) {
      console.error("Error fetching incident:", error);
      setNotFound(true);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    if (!user) return;
    fetchIncident();
  }, [user, fetchIncident]);

  const handleCallPolice = async () => {
    setCallingPolice(true);
    const actor = getActorName();
    const result = await createConditionalTask(
      incident.id,
      "POLICE",
      "ตำรวจ",
      "สนับสนุนความปลอดภัยและควบคุมสถานการณ์",
      actor
    );
    if (result.success) {
      await sendTaskNotification(incident, result.task);
    }
    setCallingPolice(false);
    if (result.success) {
      alert("แจ้งตำรวจแล้ว");
    } else {
      alert("แจ้งตำรวจไม่สำเร็จ: " + result.error);
    }
  };

  const handleClose = async () => {
    if (!confirm("ยืนยันปิดเหตุการณ์นี้และสร้างสรุปเหตุการณ์ (AAR)?")) return;
    setClosing(true);
    const actor = getActorName();
    const result = await closeIncident(incident.docId, incident.id, actor);
    setClosing(false);
    if (result.success) {
      fetchIncident();
    } else {
      alert("ปิดเหตุการณ์ไม่สำเร็จ: " + result.error);
    }
  };

  if (!user) return <div className="p-6 text-slate-500">กำลังตรวจสอบสิทธิ์การเข้าใช้งาน...</div>;
  if (loading) return <div className="p-6 text-slate-500">กำลังโหลดข้อมูลเหตุการณ์...</div>;
  if (notFound || !incident) return <div className="p-6 text-slate-500">ไม่พบเหตุการณ์นี้ในระบบ</div>;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="p-4 sm:p-6 max-w-6xl mx-auto">
        <header className="mb-6 border-b pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-800">เหตุการณ์ {incident.id}</h1>
            <p className="text-xs text-slate-400 mt-0.5">
              แจ้งเหตุเมื่อ {formatDateTime(incident.createdAt)}
              {incident.patientName ? ` · ผู้ป่วย: ${incident.patientName}` : ""}
            </p>
            <p className="text-sm text-slate-500">
              {incident.title} · {incident.village}
              {incident.location && incident.location.lat && (
                <>
                  {" · "}
                  <a
                    href={`https://www.google.com/maps?q=${incident.location.lat},${incident.location.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    📍 เปิดแผนที่
                  </a>
                </>
              )}
            </p>
          </div>
          <span className={`self-start sm:self-auto px-2.5 py-1 rounded-full text-xs font-bold ${
            incident.status === "CLOSED" ? "bg-slate-200 text-slate-600" : "bg-emerald-100 text-emerald-700"
          }`}>
            {incident.status === "CLOSED" ? "ปิดเหตุแล้ว" : "กำลังดำเนินการ"}
          </span>
        </header>

        {incident.status !== "CLOSED" && (
          <div className="flex flex-wrap gap-2 mb-6">
            <button
              onClick={handleCallPolice}
              disabled={callingPolice}
              className="px-4 py-2 bg-slate-800 text-white rounded-xl text-sm font-bold hover:bg-slate-900 transition disabled:bg-slate-400"
            >
              {callingPolice ? "กำลังแจ้ง..." : "🚓 แจ้งตำรวจ (กรณีจำเป็น)"}
            </button>
            <button
              onClick={handleClose}
              disabled={closing}
              className="px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 transition disabled:bg-red-300"
            >
              {closing ? "กำลังปิดเหตุ..." : "✓ ปิดเหตุและสร้างสรุป AAR"}
            </button>
          </div>
        )}

        <TaskTable incidentId={incident.id} />

        {incident.aar && (
          <div className="mt-8 bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
            <h3 className="font-bold text-slate-800 mb-3">📄 สรุปเหตุการณ์ (After Action Report)</h3>
            <pre className="whitespace-pre-wrap text-sm text-slate-600 font-sans">{incident.aar.summaryText}</pre>
          </div>
        )}
      </div>
    </div>
  );
}
