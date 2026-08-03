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
        email,
        role: role || "VHV",
        village: village || "",
        createdAt: new Date().toISOString(),
      });

      return NextResponse.json({ success: true, uid: newUser.uid });
    }

    if (action === "update") {
      const { uid, name, role, village, email } = body;
      if (!uid) return NextResponse.json({ success: false, error: "ไม่พบรหัสผู้ใช้งาน" }, { status: 400 });
      if (!name) return NextResponse.json({ success: false, error: "กรุณากรอกชื่อ" }, { status: 400 });
      if (!email) return NextResponse.json({ success: false, error: "กรุณากรอกอีเมล" }, { status: 400 });

      // อัปเดต Firebase Auth ก่อน (ชื่อที่แสดง + อีเมล login) แล้วค่อย sync ไปที่ Firestore
      // ถ้าอีเมลซ้ำกับบัญชีอื่นจะ throw auth/email-already-exists ออกไปให้ catch ชั้นนอกจัดการ —
      // ตั้งใจไม่ wrap แยก try/catch เพื่อไม่ให้ Firestore กับ Auth ค้างไม่ตรงกันเหมือน bug เดิมที่เคยแก้ไปแล้วในฝั่งลบ
      await adminAuth.updateUser(uid, { displayName: name, email });

      await adminDb.collection("users").doc(uid).update({
        name,
        email,
        role: role || "VHV",
        village: village || "",
      });

      return NextResponse.json({ success: true });
    }

    if (action === "reset-password") {
      const { uid, password } = body;
      if (!uid) return NextResponse.json({ success: false, error: "ไม่พบรหัสผู้ใช้งาน" }, { status: 400 });
      if (!password || password.length < 6) {
        return NextResponse.json({ success: false, error: "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร" }, { status: 400 });
      }

      await adminAuth.updateUser(uid, { password });
      return NextResponse.json({ success: true });
    }

    if (action === "delete") {
      const { uid } = body;
      if (!uid) return NextResponse.json({ success: false, error: "ไม่พบรหัสผู้ใช้งาน" }, { status: 400 });

      await adminDb.collection("users").doc(uid).delete();
      let authDeleteFailed = false;
      try {
        await adminAuth.deleteUser(uid);
      } catch (error) {
        if (error.code === "auth/user-not-found") {
          // รายชื่อเก่าก่อนอัปเดตนี้อาจไม่มีบัญชี Auth คู่กันอยู่แล้ว ข้ามได้ตามปกติ
        } else {
          // error อื่น (เช่น เครือข่าย/สิทธิ์ Admin SDK) ต้อง log ไว้และแจ้งกลับ ไม่ใช่กลืนแล้วบอกว่าสำเร็จเฉยๆ
          // เพราะถ้าลบบัญชี Auth ไม่สำเร็จจริง คนนั้นจะยัง login เข้าระบบได้อยู่ทั้งที่ Admin คิดว่าลบไปแล้ว
          console.error(`ลบบัญชี Auth ของ uid=${uid} ไม่สำเร็จ:`, error);
          authDeleteFailed = true;
        }
      }

      return NextResponse.json({
        success: true,
        warning: authDeleteFailed
          ? "ลบข้อมูลออกจากระบบแล้ว แต่ลบบัญชี Login ไม่สำเร็จ (อาจยัง login เข้าใช้งานได้อยู่) กรุณาลองลบอีกครั้งหรือแจ้งผู้ดูแลระบบ"
          : undefined,
      });
    }

    return NextResponse.json({ success: false, error: "ไม่รู้จักคำสั่งนี้" }, { status: 400 });
  } catch (error) {
    console.error("manage-member error:", error);
    const message = error.code === "auth/email-already-exists" ? "อีเมลนี้มีบัญชีอยู่แล้วในระบบ" : (error.message || "เกิดข้อผิดพลาด");
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
