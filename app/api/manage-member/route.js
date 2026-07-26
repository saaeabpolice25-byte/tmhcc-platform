// app/api/manage-member/route.js
// เพิ่ม/ลบสมาชิก (บัญชี Firebase Auth จริง + doc ใน Firestore users) — เฉพาะผู้เรียกที่มี role=ADMIN เท่านั้น
// ต้องทำฝั่ง server ด้วย Firebase Admin SDK เพราะ:
// 1) การสร้างบัญชีใหม่ผ่าน client SDK จะทำให้ผู้ดูแลที่ login อยู่หลุดออกจากระบบทันที (ข้อจำกัดของ Firebase Auth)
// 2) ต้องตรวจสอบ role ของผู้เรียกอย่างน่าเชื่อถือ ซึ่ง client ปลอมแปลงค่าที่ส่งมาเองได้
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
    return NextResponse.json(
      { success: false, error: "ระบบยังไม่ได้ตั้งค่า Firebase Admin SDK — ติดต่อผู้ดูแลระบบ" },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const { idToken, action } = body;

    try {
      await requireAdmin(idToken);
    } catch (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status || 401 });
    }

    if (action === "create") {
      const { name, role, village, email, password } = body;
      if (!name || !email || !password) {
        return NextResponse.json({ success: false, error: "กรุณากรอกชื่อ อีเมล และรหัสผ่านให้ครบ" }, { status: 400 });
      }
      if (password.length < 6) {
        return NextResponse.json({ success: false, error: "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร" }, { status: 400 });
      }

      const newUser = await adminAuth.createUser({ email, password, displayName: name });
      await adminDb.collection("users").doc(newUser.uid).set({
        name,
        role: role || "VHV",
        village: village || "",
        createdAt: new Date().toISOString(),
      });

      return NextResponse.json({ success: true, uid: newUser.uid });
    }

    if (action === "delete") {
      const { uid } = body;
      if (!uid) return NextResponse.json({ success: false, error: "ไม่พบรหัสผู้ใช้งาน" }, { status: 400 });

      await adminDb.collection("users").doc(uid).delete();
      try {
        await adminAuth.deleteUser(uid);
      } catch {
        // รายชื่อเก่าก่อนอัปเดตนี้อาจไม่มีบัญชี Auth คู่กันอยู่แล้ว ข้ามได้
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: "ไม่รู้จักคำสั่งนี้" }, { status: 400 });
  } catch (error) {
    console.error("manage-member error:", error);
    const message = error.code === "auth/email-already-exists" ? "อีเมลนี้มีบัญชีอยู่แล้วในระบบ" : (error.message || "เกิดข้อผิดพลาด");
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
