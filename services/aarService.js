// services/aarService.js
import { db } from "@/firebase/config";
import { collection, getDocs, query, where, doc, updateDoc, getDoc } from "firebase/firestore";

const toDate = (value) => {
  if (!value) return null;
  return typeof value.toDate === "function" ? value.toDate() : new Date(value);
};

// รูปแบบ วัน/เดือน/ปี(ค.ศ.) ชั่วโมง:นาที เช่น 26/07/2026 14:02 — เก็บเป็น log ให้ตรวจสอบย้อนหลังได้
// export ไว้ให้หน้าอื่น (รายละเอียดเหตุการณ์, dashboard, LINE webhook) ใช้รูปแบบเดียวกัน
//
// ใช้ Intl.DateTimeFormat ผูก timeZone: "Asia/Bangkok" ตรงๆ แทนการเรียก d.getHours()/d.getDate() เฉยๆ
// เพราะ getHours()/getDate() คืนค่าตาม timezone ของเครื่องที่รันโค้ด — ฝั่งเบราว์เซอร์ในไทยบังเอิญตรงกับเวลาไทยอยู่แล้ว
// แต่ฝั่ง server (Vercel serverless ใช้ UTC) จะได้เวลาเพี้ยนไป 7 ชั่วโมง (เช่น ตอนตอบกลับ LINE จาก line-webhook)
export const formatDateTime = (value) => {
  const d = toDate(value);
  if (!d) return "";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Bangkok",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const get = (type) => parts.find((p) => p.type === type)?.value || "00";
  return `${get("day")}/${get("month")}/${get("year")} ${get("hour")}:${get("minute")}`;
};

const statusLabel = (status) => {
  if (status === "COMPLETED") return "ดำเนินการเสร็จสิ้น";
  if (status === "IN_PROGRESS") return "เริ่มดำเนินการ";
  return "รับทราบภารกิจ";
};

// รวบรวม history จากทุก task ของเหตุการณ์นี้ เรียงตามเวลา แล้วสร้างสรุปข้อความ
export const generateAAR = async (incidentCode, incidentCreatedAt) => {
  const q = query(collection(db, "tasks"), where("incidentId", "==", incidentCode));
  const snapshot = await getDocs(q);

  const events = [];
  const createdDate = toDate(incidentCreatedAt);
  if (createdDate) {
    events.push({ raw: createdDate, time: formatDateTime(incidentCreatedAt), label: "รับแจ้งเหตุ / เปิดเหตุการณ์", actor: null, unitCode: null, taskId: null });
  }

  snapshot.forEach((docSnap) => {
    const t = docSnap.data();
    (t.history || []).forEach((h) => {
      const rawDate = toDate(h.timestamp);
      if (!rawDate) return;
      events.push({
        raw: rawDate,
        time: formatDateTime(h.timestamp),
        label: `${t.unit} ${statusLabel(h.status)}: ${t.task}`,
        actor: h.actorDisplayName || null,
        unitCode: t.unitCode || null,
        taskId: docSnap.id,
      });
    });
  });

  events.sort((a, b) => a.raw - b.raw);

  const now = new Date();
  const timeline = events.map((e) => ({ time: e.time, label: e.label, actor: e.actor, unitCode: e.unitCode, taskId: e.taskId }));
  timeline.push({ time: formatDateTime(now), label: "ปิดเหตุการณ์", actor: null, unitCode: null, taskId: null });

  const summaryText = timeline
    .map((e) => `${e.time} ${e.label}${e.actor ? ` (${e.actor})` : ""}`)
    .join("\n");

  return {
    generatedAt: now.toISOString(),
    timeline,
    summaryText,
  };
};

export const closeIncident = async (incidentDocId, incidentCode, closedBy) => {
  try {
    const incidentRef = doc(db, "incidents", incidentDocId);
    const incidentSnap = await getDoc(incidentRef);
    if (!incidentSnap.exists()) {
      return { success: false, error: "ไม่พบเหตุการณ์นี้ในระบบ" };
    }

    const aar = await generateAAR(incidentCode, incidentSnap.data().createdAt);

    await updateDoc(incidentRef, {
      status: "CLOSED",
      closedAt: new Date(),
      closedBy: closedBy || "ไม่ระบุชื่อ",
      aar,
    });

    return { success: true, aar };
  } catch (error) {
    return { success: false, error: error.message };
  }
};
