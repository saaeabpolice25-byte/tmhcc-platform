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

// ฟังก์ชันเปิดเหตุใหม่แบบเดิม
export const createIncident = async (incidentData) => {
  try {
    const newId = await generateIncidentId();
    
    const payload = {
      id: newId,
      type: incidentData.type,
      title: incidentData.title,
      level: incidentData.level || "RED",
      village: incidentData.village || "หมู่ 3",
      status: "ACTIVE",
      createdBy: incidentData.createdBy || "ผู้ใหญ่บ้าน",
      createdAt: serverTimestamp(),
    };

    // 1. บันทึกลง Collection incidents ใน Firestore
    await addDoc(collection(db, "incidents"), payload);

    // 2. สร้าง Task ตาม SOP อัตโนมัติทันที
    const sopResult = await createSopTasksForIncident(newId);

    // 3. ส่งแจ้งเตือนผ่าน LINE OA แยกกลุ่มตามหน่วยงาน (1 ข้อความ/หน่วย/task)
    await sendTaskNotifications(payload, sopResult.tasks || []);

    return { success: true, id: newId };
  } catch (error) {
    return { success: false, error: error.message };
  }
};