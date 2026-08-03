// firebase/serverAuth.js
// ใช้เฉพาะใน API route (server) ที่ต้องเขียน Firestore แทนผู้ใช้จริง เช่น LINE webhook / liff-report
// เนื่องจาก firestore.rules กำหนดให้ต้อง request.auth != null ทุก collection (ยกเว้น units อ่านได้อย่างเดียว)
// จึงต้อง sign in ด้วยบัญชี "ระบบ" ก่อนเขียนข้อมูล — ตั้งใจแยกเป็นบัญชีเฉพาะ ไม่ใช้อีเมลส่วนตัวของแอดมินคนใดคนหนึ่ง
// เพื่อไม่ให้ถูกลบทิ้งไปพร้อมกับตอนที่ใครลบบัญชีของตัวเอง (เคยเกิดเหตุการณ์นี้มาแล้วเมื่อ 2026-08-03)
// สร้างผ่าน Firebase Console (Authentication → Add User) หรือ Admin SDK ก็ได้ แล้วตั้งอีเมล/รหัสผ่านไว้ใน
// SYSTEM_ACCOUNT_EMAIL / SYSTEM_ACCOUNT_PASSWORD ทั้งใน .env.local (dev) และ Vercel Environment Variables (prod)
// บัญชีนี้ไม่ต้องมี Firestore users/{uid} doc คู่กัน เพราะไม่เคยใช้ล็อกอินเข้าเว็บจริง
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
