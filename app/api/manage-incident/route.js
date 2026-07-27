// app/api/manage-incident/route.js
// ลบเคสเหตุการณ์ (incident + tasks ที่เกี่ยวข้องทั้งหมด) — เฉพาะผู้เรียกที่มี role=ADMIN เท่านั้น
// ต้องทำฝั่ง server ด้วย Firebase Admin SDK เพื่อลบ tasks หลายรายการพร้อมกันแบบ batch
// และตรวจสอบ role ของผู้เรียกอย่างน่าเชื่อถือ (client ปลอมแปลงค่าที่ส่งมาเองได้)
import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/firebase/admin";

const requireAdmin = async (idToken) => {
  if (!idToken) {
    const err = new Error("ไม่ได้ล็อกอิน");
    err.status = 401;
    throw err;
  }
  let decoded;
  try {
    decoded = await adminAuth.verifyIdToken(idToken);
  } catch {
    const err = new Error("เซสชันไม่ถูกต้อง กรุณาล็อกอินใหม่");
    err.status = 401;
    throw err;
  }
  const snap = await adminDb.collection("users").doc(decoded.uid).get();
  if (!snap.exists || snap.data().role !== "ADMIN") {
    const err = new Error("เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่ทำรายการนี้ได้");
    err.status = 403;
    throw err;
  }
  return decoded.uid;
};

export async function POST(request) {
  if (!adminAuth || !adminDb) {
    return NextResponse.json({ success: false, error: "ระบบยังไม่ได้ตั้งค่า Firebase Admin SDK" }, { status: 500 });
  }

  try {
    const body = await request.json();
    const { idToken, docId, incidentCode } = body;

    try {
      await requireAdmin(idToken);
    } catch (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status || 401 });
    }

    if (!docId || !incidentCode) {
      return NextResponse.json({ success: false, error: "ไม่พบรหัสเหตุการณ์" }, { status: 400 });
    }

    // ลบ tasks ทั้งหมดของเคสนี้พร้อมกับตัวเหตุการณ์ในทีเดียว (batch) ป้องกันข้อมูลค้าง
    const tasksSnap = await adminDb.collection("tasks").where("incidentId", "==", incidentCode).get();
    const batch = adminDb.batch();
    tasksSnap.docs.forEach((d) => batch.delete(d.ref));
    batch.delete(adminDb.collection("incidents").doc(docId));
    await batch.commit();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("manage-incident error:", error);
    return NextResponse.json({ success: false, error: error.message || "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}
