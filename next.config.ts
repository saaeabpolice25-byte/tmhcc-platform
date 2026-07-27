// next.config.js
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  allowedDevOrigins: ['192.168.56.1', 'localhost:3000'],
  // firebase-admin ใช้ dynamic require/native bits ที่ bundler ของ Next แกะไม่ได้ตรงๆ
  // ถ้าไม่กันไว้ตรงนี้ route ที่ import firebase/admin.js จะ crash (500) ตอนรันจริงบน Vercel
  // แม้ build ผ่านและรันปกติตอน dev ในเครื่องก็ตาม
  serverExternalPackages: ['firebase-admin'],
};

export default nextConfig;