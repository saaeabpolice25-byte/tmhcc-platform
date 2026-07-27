// app/api/public-status/route.js
// สรุปสถานะภาพรวมสำหรับหน้า /status ที่เปิดให้คนภายนอกดูได้โดยไม่ต้อง login
// คำนวณตัวเลขสรุปฝั่งเซิร์ฟเวอร์ด้วย Firebase Admin SDK เท่านั้น แล้วส่งกลับเฉพาะตัวเลข
// (ไม่ส่งรหัสเคส ชื่อผู้ป่วย หรือพื้นที่ออกไปให้ฝั่ง client เห็นเด็ดขาด เพื่อป้องกันข้อมูลผู้ป่วยรั่วไหล)
import { NextResponse } from "next/server";
import { adminDb } from "@/firebase/admin";

const UNIT_ORDER = ["อสม.", "รพ.สต.", "โรงพยาบาล", "EMS"];

export async function GET() {
  if (!adminDb) {
    return NextResponse.json({ success: false, error: "ระบบยังไม่ได้ตั้งค่า Firebase Admin SDK" }, { status: 500 });
  }

  try {
    const [incidentsSnap, tasksSnap] = await Promise.all([
      adminDb.collection("incidents").get(),
      adminDb.collection("tasks").get(),
    ]);

    const levels = { RED: 0, ORANGE: 0, YELLOW: 0 };
    let closed = 0;
    incidentsSnap.docs.forEach((d) => {
      const data = d.data();
      if (data.status === "CLOSED") {
        closed += 1;
      } else if (levels[data.level] !== undefined) {
        levels[data.level] += 1;
      }
    });
    const active = levels.RED + levels.ORANGE + levels.YELLOW;

    const pendingCounts = Object.fromEntries(UNIT_ORDER.map((u) => [u, 0]));
    tasksSnap.docs.forEach((d) => {
      const data = d.data();
      if (data.status !== "COMPLETED" && pendingCounts[data.unit] !== undefined) {
        pendingCounts[data.unit] += 1;
      }
    });

    return NextResponse.json({
      success: true,
      updatedAt: new Date().toISOString(),
      levels,
      totals: { active, closed, all: active + closed },
      pendingByUnit: UNIT_ORDER.map((unit) => ({ unit, count: pendingCounts[unit] })),
    });
  } catch (error) {
    console.error("public-status error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
