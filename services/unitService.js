// services/unitService.js
import { db } from "@/firebase/config";
import { collection, doc, getDoc, getDocs, setDoc, updateDoc } from "firebase/firestore";

// นิยามหน่วยงานทั้งหมดในระบบ SOP — unitCode ใช้เป็น key เชื่อมกับกลุ่ม LINE ในอนาคต
export const UNIT_DEFINITIONS = [
  { unitCode: "VILLAGE_HEAD", unitLabel: "ผู้ใหญ่บ้าน", stepOrder: 1, isConditional: false },
  { unitCode: "VHV", unitLabel: "อสม.", stepOrder: 2, isConditional: false },
  { unitCode: "HEALTH_CENTER", unitLabel: "รพ.สต.", stepOrder: 3, isConditional: false },
  { unitCode: "HOSPITAL", unitLabel: "โรงพยาบาล", stepOrder: 4, isConditional: false },
  { unitCode: "EMS", unitLabel: "EMS", stepOrder: 5, isConditional: false },
  { unitCode: "POLICE", unitLabel: "ตำรวจ", stepOrder: null, isConditional: true },
];

// สร้าง doc หน่วยงานที่ยังไม่มีในฐานข้อมูล (เรียกซ้ำได้ปลอดภัย ไม่ทับของเดิม)
export const ensureUnitsSeeded = async () => {
  for (const def of UNIT_DEFINITIONS) {
    const ref = doc(db, "units", def.unitCode);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        ...def,
        lineGroupId: null,
        active: true,
        updatedAt: new Date(),
        updatedBy: "system",
      });
    }
  }
};

export const getUnits = async () => {
  await ensureUnitsSeeded();
  const snapshot = await getDocs(collection(db, "units"));
  const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  return list.sort((a, b) => (a.stepOrder ?? 999) - (b.stepOrder ?? 999));
};

export const updateUnitLineGroup = async (unitCode, { lineGroupId, active }, updatedBy) => {
  await updateDoc(doc(db, "units", unitCode), {
    lineGroupId: lineGroupId || null,
    active,
    updatedAt: new Date(),
    updatedBy: updatedBy || "ไม่ระบุชื่อ",
  });
};
