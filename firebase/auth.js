// firebase/auth.js
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";
import { auth, db } from "./config";
import { doc, getDoc } from "firebase/firestore";

// ฟังก์ชันเข้าสู่ระบบ
export const loginUser = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // ดึงข้อมูล Role เพิ่มเติมจาก Firestore Collection "users"
    const userDocRef = doc(db, "users", user.uid);
    const userDoc = await getDoc(userDocRef);
    
    if (userDoc.exists()) {
      return { success: true, user: user, roleData: userDoc.data() };
    } else {
      return { success: false, error: "ไม่พบข้อมูลผู้ใช้งานในระบบฐานข้อมูล" };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// ฟังก์ชันออกจากระบบ
export const logoutUser = async () => {
  try {
    await signOut(auth);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};