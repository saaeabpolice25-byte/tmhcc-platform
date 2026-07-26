// firebase/serverAuth.js
// ใช้เฉพาะใน API route (server) ที่ต้องเขียน Firestore แทนผู้ใช้จริง เช่น LINE webhook
// เนื่องจาก firestore.rules กำหนดให้ต้อง request.auth != null ทุก collection (ยกเว้น units อ่านได้อย่างเดียว)
// จึงต้อง sign in ด้วยบัญชี "ระบบ" ก่อนเขียนข้อมูล — ต้องสร้างบัญชีนี้เองใน Firebase Console
// (Authentication → Add User) แล้วตั้งอีเมล/รหัสผ่านไว้ใน SYSTEM_ACCOUNT_EMAIL / SYSTEM_ACCOUNT_PASSWORD
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "./config";

export const ensureServerAuth = async () => {
  if (auth.currentUser) return auth.currentUser;

  const email = process.env.SYSTEM_ACCOUNT_EMAIL;
  const password = process.env.SYSTEM_ACCOUNT_PASSWORD;
  if (!email || !password) {
    throw new Error("Missing SYSTEM_ACCOUNT_EMAIL / SYSTEM_ACCOUNT_PASSWORD environment variables");
  }

  const credential = await signInWithEmailAndPassword(auth, email, password);
  return credential.user;
};
