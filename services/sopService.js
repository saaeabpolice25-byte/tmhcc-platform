// services/sopService.js
import { db } from "@/firebase/config";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

// ลำดับขั้นตอนมาตรฐาน (SOP) ที่สร้างอัตโนมัติทุกเหตุการณ์
export const AUTOMATIC_TASKS = [
  { unitCode: "VILLAGE_HEAD", unit: "ผู้ใหญ่บ้าน", task: "รับแจ้งเหตุและคัดกรองเบื้องต้น", order: 1 },
  { unitCode: "VHV", unit: "อสม.", task: "ตรวจสอบข้อมูลและเฝ้าระวังพื้นที่", order: 2 },
  { unitCode: "HEALTH_CENTER", unit: "รพ.สต.", task: "ประเมินอาการและวินิจฉัยสุขภาพจิต", order: 3 },
  { unitCode: "HOSPITAL", unit: "โรงพยาบาล", task: "เตรียมรับและประเมินจิตแพทย์", order: 4 },
  { unitCode: "EMS", unit: "EMS", task: "เตรียมส่งต่อและเคลื่อนย้ายผู้ป่วย", order: 5 },
];

const baseTaskFields = () => ({
  status: "PENDING",
  completedAt: null,
  completedBy: null,
  acknowledgedAt: null,
  acknowledgedBy: null,
  escalation: { count: 0, lastEscalatedAt: null },
  createdAt: serverTimestamp(),
});

export const createSopTasksForIncident = async (incidentId) => {
  try {
    for (const item of AUTOMATIC_TASKS) {
      await addDoc(collection(db, "tasks"), {
        incidentId,
        unitCode: item.unitCode,
        unit: item.unit,
        task: item.task,
        stepOrder: item.order,
        isConditional: false,
        history: [
          {
            status: "PENDING",
            actorType: "SYSTEM",
            actorId: null,
            actorDisplayName: "ระบบ",
            timestamp: new Date(),
            note: "สร้างภารกิจอัตโนมัติตาม SOP",
          },
        ],
        ...baseTaskFields(),
      });
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// สร้างภารกิจเสริมกรณีจำเป็น เช่น แจ้งตำรวจ — ไม่ได้เกิดขึ้นอัตโนมัติทุกเคส ต้องกดสั่งเอง
export const createConditionalTask = async (incidentId, unitCode, unitLabel, taskDescription, createdBy) => {
  try {
    await addDoc(collection(db, "tasks"), {
      incidentId,
      unitCode,
      unit: unitLabel,
      task: taskDescription,
      stepOrder: null,
      isConditional: true,
      history: [
        {
          status: "PENDING",
          actorType: "WEB",
          actorId: null,
          actorDisplayName: createdBy || "ไม่ระบุชื่อ",
          timestamp: new Date(),
          note: "เปิดภารกิจเสริมโดยเจ้าหน้าที่",
        },
      ],
      ...baseTaskFields(),
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};
