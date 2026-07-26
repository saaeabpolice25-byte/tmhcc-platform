// app/users/page.jsx
"use client";

import { useState, useEffect } from "react";
import { db } from "@/firebase/config";
import { collection, getDocs, addDoc, deleteDoc, doc } from "firebase/firestore";
import { useRequireAuth } from "@/firebase/useRequireAuth";

export default function UsersPage() {
  const user = useRequireAuth();
  const [users, setUsers] = useState([]);
  const [name, setName] = useState("");
  const [role, setRole] = useState("VHV"); // VHV = อสม., HOSPITAL = รพ.สต., ADMIN = ผู้บริหาร
  const [village, setVillage] = useState("หมู่ 1");
  const [loading, setLoading] = useState(true);

  const fetchUsers = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "users"));
      const userList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUsers(userList);
    } catch (error) {
      console.error("Error fetching users:", error);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!user) return;
    fetchUsers();
  }, [user]);

  const handleAddUser = async (e) => {
    e.preventDefault();
    if (!name) return alert("กรุณากรอกชื่อผู้ใช้งาน");

    try {
      await addDoc(collection(db, "users"), {
        name,
        role,
        village,
        createdAt: new Date().toISOString()
      });
      setName("");
      fetchUsers();
      alert("เพิ่มผู้ใช้งานสำเร็จ!");
    } catch (error) {
      console.error("Error adding user:", error);
      alert("เกิดข้อผิดพลาดในการบันทึก");
    }
  };

  const handleDeleteUser = async (id) => {
    if (confirm("คุณต้องการลบผู้ใช้นี้ใช่หรือไม่?")) {
      try {
        await deleteDoc(doc(db, "users", id));
        fetchUsers();
      } catch (error) {
        console.error("Error deleting user:", error);
      }
    }
  };

  if (!user) return <div className="p-6 text-slate-500">กำลังตรวจสอบสิทธิ์การเข้าใช้งาน...</div>;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="p-4 sm:p-6 max-w-5xl mx-auto">
        <header className="mb-6 sm:mb-8 border-b pb-4">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">⚙️ ระบบจัดการสิทธิ์ผู้ใช้งาน (User Roles)</h1>
          <p className="text-sm text-slate-500">กำหนดบทบาทหน้าที่ของเจ้าหน้าที่ อสม., รพ.สต. และผู้บริหารตำบล</p>
        </header>

        {/* ฟอร์มเพิ่มผู้ใช้งาน */}
        <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-200 mb-6 sm:mb-8">
          <h2 className="text-lg font-bold text-slate-700 mb-4">เพิ่มเจ้าหน้าที่ / บุคลากรในระบบ</h2>
          <form onSubmit={handleAddUser} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">ชื่อ -นามสกุล</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="เช่น สมชาย ใจดี"
                className="w-full border border-slate-200 rounded-xl p-2.5 text-sm outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">บทบาทสิทธิ์ (Role)</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full border border-slate-200 rounded-xl p-2.5 text-sm outline-none focus:border-blue-500 bg-white"
              >
                <option value="VHV">อสม. (สำรวจ/เฝ้าระวัง)</option>
                <option value="HOSPITAL">รพ.สต. (ประเมิน/รักษา)</option>
                <option value="ADMIN">ผู้บริหาร / Admin</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">พื้นที่รับผิดชอบ</label>
              <input
                type="text"
                value={village}
                onChange={(e) => setVillage(e.target.value)}
                placeholder="เช่น หมู่ 3"
                className="w-full border border-slate-200 rounded-xl p-2.5 text-sm outline-none focus:border-blue-500"
              />
            </div>
            <div className="flex items-end">
              <button type="submit" className="w-full bg-blue-600 text-white font-bold py-2.5 rounded-xl text-sm hover:bg-blue-700 transition">
                + บันทึกผู้ใช้
              </button>
            </div>
          </form>
        </div>

        {/* ตารางแสดงรายชื่อผู้ใช้งาน */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 border-b bg-slate-50">
            <h3 className="font-bold text-slate-800">รายชื่อบุคลากรทั้งหมดในระบบ</h3>
          </div>
          {loading ? (
            <div className="p-6 text-center text-slate-400">กำลังโหลดข้อมูล...</div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b bg-slate-100/60 text-xs font-semibold text-slate-600 uppercase">
                  <th className="p-3 sm:p-4">ชื่อ - นามสกุล</th>
                  <th className="p-3 sm:p-4">บทบาท (Role)</th>
                  <th className="p-3 sm:p-4">พื้นที่</th>
                  <th className="p-4 text-center">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                {users.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="p-6 text-center text-slate-400">ยังไม่มีข้อมูลผู้ใช้งาน</td>
                  </tr>
                ) : (
                  users.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50/50">
                      <td className="p-4 font-medium text-slate-800">{u.name}</td>
                      <td className="p-3 sm:p-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                          u.role === "ADMIN" ? "bg-purple-100 text-purple-700" :
                          u.role === "HOSPITAL" ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"
                        }`}>
                          {u.role === "ADMIN" ? "ผู้บริหาร/Admin" : u.role === "HOSPITAL" ? "เจ้าหน้าที่ รพ.สต." : "อสม."}
                        </span>
                      </td>
                      <td className="p-3 sm:p-4">{u.village}</td>
                      <td className="p-4 text-center">
                        <button
                          onClick={() => handleDeleteUser(u.id)}
                          className="px-3 py-1 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg text-xs font-bold transition"
                        >
                          ลบ
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}