// services/incidentService.js
import { db } from "@/firebase/config";
import { collection, addDoc, getDocs, query, orderBy, limit, serverTimestamp } from "firebase/firestore";
import { createSopTasksForIncident } from "./sopService";
import { sendTaskNotifications } from "./notifyService";

// ฟังก์ชันสร้างเลขรหัสเหตุการณ์อัตโนมัติ (เช่น INC-2026-000001)
const generateIncidentId = async () => {
  const currentYear = new Date().getFullYear();
  const q = query(collection(db, "incidents"), orderBy("createdAt", "desc"), limit(1));
  const querySnapshot = await getDocs(q);

  let runningNumber = 1;
  if (!querySnapshot.empty) {
    const lastDoc = querySnapshot.docs[0].data();
    const lastId = lastDoc.id; 
    if (lastId && lastId.includes("-")) {
      const parts = lastId.split("-");
      const lastNum = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastNum)) {
        runningNumber = lastNum + 1;
      }
    }
  }

  const paddedNum = String(runningNumber).padStart(6, "0");
  return `INC-${currentYear}-${paddedNum}`;
};

// ฟังก์ชันเปิดเหตุใหม่ — ใช้ได้ทั้งจากหน้าเว็บ (baseUrl ว่าง) และจาก server route อื่น เช่น LIFF
// (ใส่ origin เต็ม + internalSecret เพื่อยืนยันกับ /api/notify-line ว่าเรียกจาก server ที่เชื่อถือได้)
export const createIncident = async (incidentData, baseUrl = "", internalSecret = null) => {
  try {
    const newId = await generateIncidentId();

    const payload = {
      id: newId,
      type: incidentData.type,
      title: incidentData.title,
      patientName: incidentData.patientName || "",
      level: incidentData.level || "RED",
      village: incidentData.village || "หมู่ 3",
      location: incidentData.location || null, // { lat, lng } ถ้าแนบตำแหน่งมาด้วย (เช่นจากฟอร์ม LIFF)
      status: "ACTIVE",
      createdBy: incidentData.createdBy || "ผู้ใหญ่บ้าน",
      createdByLineUserId: incidentData.createdByLineUserId || null,
      reportedVia: incidentData.reportedVia || "WEB",
      createdAt: serverTimestamp(),
    };

    // 1. บันทึกลง Collection incidents ใน Firestore
    const incidentRef = await addDoc(collection(db, "incidents"), payload);

    // 2. สร้าง Task ขั้นแรกของ SOP (ผู้ใหญ่บ้าน) — ขั้นถัดไปจะสร้างเองเมื่อขั้นก่อนหน้าเสร็จ
    const sopResult = await createSopTasksForIncident(newId);

    // 3. ส่งแจ้งเตือนผ่าน LINE OA ไปยังกลุ่มของหน่วยงานที่รับผิดชอบขั้นแรก
    await sendTaskNotifications(payload, sopResult.tasks || [], baseUrl, internalSecret);

    return { success: true, id: newId, docId: incidentRef.id };
  } catch (error) {
    return { success: false, error: error.message };
  }
};