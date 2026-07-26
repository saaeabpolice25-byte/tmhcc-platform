// firebase/admin.js
// ใช้เฉพาะฝั่ง server (API routes) เท่านั้น — มีสิทธิ์เต็มข้ามผ่าน Firestore rules ได้
// ต้องสร้าง Service Account จาก Firebase Console > Project Settings > Service Accounts > Generate new private key
// แล้วตั้งค่า FIREBASE_ADMIN_PROJECT_ID / FIREBASE_ADMIN_CLIENT_EMAIL / FIREBASE_ADMIN_PRIVATE_KEY ใน .env.local และ Vercel
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

let adminAuth = null;
let adminDb = null;
let initError = null;

try {
  const privateKey = (process.env.FIREBASE_ADMIN_PRIVATE_KEY || "").replace(/\\n/g, "\n");
  if (!process.env.FIREBASE_ADMIN_PROJECT_ID || !process.env.FIREBASE_ADMIN_CLIENT_EMAIL || !privateKey) {
    throw new Error("ยังไม่ได้ตั้งค่า FIREBASE_ADMIN_PROJECT_ID / FIREBASE_ADMIN_CLIENT_EMAIL / FIREBASE_ADMIN_PRIVATE_KEY");
  }
  const app = getApps().length
    ? getApps()[0]
    : initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
          clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
          privateKey,
        }),
      });
  adminAuth = getAuth(app);
  adminDb = getFirestore(app);
} catch (error) {
  // ไม่ throw ตอน import — ปล่อยให้ route ที่เรียกใช้เช็ค adminAuth/adminDb เป็น null เองแล้วตอบ error สุภาพแทน
  initError = error.message;
}

export { adminAuth, adminDb, initError };
