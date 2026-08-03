// firebase/useUserRole.js
"use client";

import { useState, useEffect } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "./config";

// ดึง role ของผู้ใช้ที่ login อยู่จาก Firestore users/{uid}.role — ใช้คู่กับ useRequireAuth()
// คืนค่า: undefined = ยังไม่เริ่มตรวจสอบ/รอ user, null = ตรวจสอบแล้วแต่ไม่พบ role, string = role จริง
export function useUserRole(user) {
  const [role, setRole] = useState(undefined);

  useEffect(() => {
    if (!user) {
      setRole(undefined);
      return;
    }
    (async () => {
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        setRole(snap.exists() ? snap.data().role : null);
      } catch (error) {
        console.error("Error fetching user role:", error);
        setRole(null);
      }
    })();
  }, [user]);

  return role;
}
