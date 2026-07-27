// app/incidents/[id]/page.jsx
"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { db, auth } from "@/firebase/config";
import { doc, onSnapshot, getDoc } from "firebase/firestore";
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
  const router = useRouter();
  const { id } = useParams();
  const [incident, setIncident] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [closing, setClosing] = useState(false);
  const [callingPolice, setCallingPolice] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // เฉพาะบัญชี role=ADMIN เท่านั้นที่เห็นปุ่มลบเคส
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        setIsAdmin(snap.exists() && snap.data().role === "ADMIN");
      } catch (error) {
        console.error("Error checking admin role:", error);
        setIsAdmin(false);
      }
    })();
  }, [user]);

  // onSnapshot แทน getDoc ครั้งเดียว เพื่อให้เห็นสถานะ/AAR อัปเดตสดทันทีที่มีการเปลี่ยนแปลง
  // (เช่น โซ่ SOP ขยับไปหน่วยถัดไป หรือถูกปิดเหตุจากอีกเครื่อง) โดยไม่ต้อง refresh หน้าเอง
  useEffect(() => {
    if (!user) return;
    setLoading(true);
    const unsubscribe = onSnapshot(
      doc(db, "incidents", id),
      (snap) => {
        if (snap.exists()) {
          setIncident({ docId: snap.id, ...snap.data() });
        } else {
          setNotFound(true);
        }
        setLoading(false);
      },
      (error) => {
        console.error("Error watching incident:", error);
        setNotFound(true);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [user, id]);

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
    if (!result.success) {
      alert("ปิดเหตุการณ์ไม่สำเร็จ: " + result.error);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`ยืนยันลบเคส ${incident.id} ออกจากระบบถาวร?\n\nข้อมูลเหตุการณ์และภารกิจ SOP ทั้งหมดของเคสนี้จะหายไปและไม่สามารถกู้คืนได้`)) return;
    setDeleting(true);
    try {
      const idToken = await auth.currentUser.getIdToken();
      const res = await fetch("/api/manage-incident", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken, docId: incident.docId, incidentCode: incident.id }),
      });
      const result = await res.json().catch(() => ({ success: false, error: "การเชื่อมต่อผิดพลาด" }));
      if (result.success) {
        router.push("/dashboard");
      } else {
        alert("ลบไม่สำเร็จ: " + result.error);
        setDeleting(false);
      }
    } catch (error) {
      alert("ลบไม่สำเร็จ: " + error.message);
      setDeleting(false);
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

        {isAdmin && (
          <div className="mt-8 bg-red-50 border border-red-200 rounded-2xl p-5">
            <h3 className="font-bold text-red-700 mb-1 text-sm">⚠️ พื้นที่อันตราย (เฉพาะ Admin)</h3>
            <p className="text-xs text-red-500 mb-3">ลบเคสนี้ออกจากระบบถาวร พร้อมภารกิจ SOP ทั้งหมดที่เกี่ยวข้อง — กู้คืนไม่ได้</p>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="px-4 py-2 bg-white border border-red-300 text-red-600 rounded-xl text-sm font-bold hover:bg-red-100 transition disabled:opacity-40"
            >
              {deleting ? "กำลังลบ..." : "🗑️ ลบเคสนี้"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
