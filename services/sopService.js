// services/sopService.js
import { db } from "@/firebase/config";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

// ลำดับขั้นตอนมาตรฐาน (SOP) — สร้างทีละขั้นเป็นโซ่ ไม่สร้างพร้อมกันทั้งหมด
// ขั้นถัดไปจะถูกสร้าง+แจ้งเตือนก็ต่อเมื่อขั้นก่อนหน้ากด "เสร็จสิ้น/ยืนยัน" แล้วเท่านั้น (ดู advanceSopChain)
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

const buildAutomaticTaskDoc = (incidentId, item, note) => ({
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
      note,
    },
  ],
  ...baseTaskFields(),
});

// เปิดเหตุใหม่ -> สร้างแค่ขั้นตอนแรกสุด (ผู้ใหญ่บ้าน) เท่านั้น
export const createSopTasksForIncident = async (incidentId) => {
  try {
    const firstItem = AUTOMATIC_TASKS[0];
    const ref = await addDoc(collection(db, "tasks"), buildAutomaticTaskDoc(incidentId, firstItem, "เปิดภารกิจขั้นแรกของ SOP"));
    const task = { taskId: ref.id, unitCode: firstItem.unitCode, unit: firstItem.unit, task: firstItem.task };
    return { success: true, tasks: [task] };
  } catch (error) {
    return { success: false, error: error.message, tasks: [] };
  }
};

// เรียกหลัง task ของขั้นตอนอัตโนมัติหนึ่งถูกกด "เสร็จสิ้น" แล้ว เพื่อสร้าง+ส่งแจ้งเตือนขั้นถัดไปในโซ่
// คืนค่า task: null ถ้าเป็นขั้นตอนสุดท้ายแล้ว (EMS เสร็จ = จบ SOP chain ไม่ต้องสร้างต่อ)
export const advanceSopChain = async (incidentId, completedStepOrder) => {
  const nextItem = AUTOMATIC_TASKS.find((item) => item.order === completedStepOrder + 1);
  if (!nextItem) return { success: true, task: null };

  try {
    const ref = await addDoc(collection(db, "tasks"), buildAutomaticTaskDoc(incidentId, nextItem, `เปิดภารกิจต่อจากขั้นที่ ${completedStepOrder} เสร็จสิ้น`));
    return { success: true, task: { taskId: ref.id, unitCode: nextItem.unitCode, unit: nextItem.unit, task: nextItem.task } };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// สร้างภารกิจเสริมกรณีจำเป็น เช่น แจ้งตำรวจ — ไม่ได้เกิดขึ้นอัตโนมัติทุกเคส ต้องกดสั่งเอง ไม่อยู่ในโซ่ SOP
export const createConditionalTask = async (incidentId, unitCode, unitLabel, taskDescription, createdBy) => {
  try {
    const ref = await addDoc(collection(db, "tasks"), {
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
    return { success: true, task: { taskId: ref.id, unitCode, unit: unitLabel, task: taskDescription } };
  } catch (error) {
    return { success: false, error: error.message };
  }
};
