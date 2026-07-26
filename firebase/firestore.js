// firebase/firestore.js
import { db } from "./config";
import { collection, getDocs, query, orderBy, limit } from "firebase/firestore";

// ดึงรายการเหตุการณ์ทั้งหมด (สำหรับ Dashboard)
export const getIncidents = async () => {
  try {
    const q = query(collection(db, "incidents"), orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(q);
    const incidents = [];
    querySnapshot.forEach((doc) => {
      incidents.push({ id: doc.id, ...doc.data() });
    });
    return { success: true, data: incidents };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// ดึงรายการ Task ตาม SOP
export const getTasks = async () => {
  try {
    const querySnapshot = await getDocs(collection(db, "tasks"));
    const tasks = [];
    querySnapshot.forEach((doc) => {
      tasks.push({ id: doc.id, ...doc.data() });
    });
    return { success: true, data: tasks };
  } catch (error) {
    return { success: false, error: error.message };
  }
};