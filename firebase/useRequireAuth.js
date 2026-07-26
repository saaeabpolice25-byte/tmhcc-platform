// firebase/useRequireAuth.js
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./config";

// ใช้ในหน้าที่ต้อง login ก่อนถึงจะเข้าได้ (คู่กับ Firestore rules ที่ต้องการ request.auth != null)
// คืนค่า: undefined = กำลังตรวจสอบ, object = login แล้ว (ถ้ายังไม่ login จะ redirect ไป /login ให้เอง)
export function useRequireAuth() {
  const router = useRouter();
  const [user, setUser] = useState(undefined);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        router.replace("/login");
      } else {
        setUser(currentUser);
      }
    });
    return () => unsubscribe();
  }, [router]);

  return user;
}
