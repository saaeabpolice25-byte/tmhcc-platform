// app/users/page.jsx
"use client";

import { useState, useEffect } from "react";
import { db, auth } from "@/firebase/config";
import { collection, onSnapshot, doc, getDoc } from "firebase/firestore";
import { useRequireAuth } from "@/firebase/useRequireAuth";

export default function UsersPage() {
  const user = useRequireAuth();
  const [isAdmin, setIsAdmin] = useState(null); // null = กำลังตรวจสอบ, true/false = ผลตรวจ
  const [users, setUsers] = useState([]);
  const [name, setName] = useState("");
  const [role, setRole] = useState("VHV"); // VHV = อสม., HOSPITAL = รพ.สต., ADMIN = ผู้บริหาร
  const [village, setVillage] = useState("หมู่ 1");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState("VHV");
  const [editVillage, setEditVillage] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [resettingId, setResettingId] = useState(null);

  // เฉพาะบัญชี role=ADMIN เท่านั้นที่เข้าหน้านี้ได้
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        setIsAdmin(snap.exists() && snap.data().role === "ADMIN");
      } catch (error) {
        console.error("Error checking admin role:", error);
        setIsAdmin(false);
      }
    })();
  }, [user]);

  // onSnapshot แทน getDocs ครั้งเดียว ให้รายชื่ออัปเดตสดเมื่อมีคนเพิ่ม/ลบจากเครื่องอื่น
  useEffect(() => {
    if (!isAdmin) return;
    const unsubscribe = onSnapshot(
      collection(db, "users"),
      (snapshot) => {
        setUsers(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (error) => {
        console.error("Error watching users:", error);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [isAdmin]);

  const callManageMember = async (payload) => {
    const idToken = await auth.currentUser.getIdToken();
    const res = await fetch("/api/manage-member", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken, ...payload }),
    });
    return res.json().catch(() => ({ success: false, error: "การเชื่อมต่อผิดพลาด" }));
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    if (!name || !email || !password) return alert("กรุณากรอกชื่อ อีเมล และรหัสผ่านให้ครบ");

    setSaving(true);
    const result = await callManageMember({ action: "create", name, role, village, email, password });
    setSaving(false);

    if (result.success) {
      setName("");
      setEmail("");
      setPassword("");
      alert("เพิ่มสมาชิกสำเร็จ! บัญชีนี้ล็อกอินเข้าใช้งานได้ทันที");
    } else {
      alert("เพิ่มสมาชิกไม่สำเร็จ: " + result.error);
    }
  };

  const handleDeleteUser = async (id) => {
    if (id === user.uid) {
      alert("ไม่สามารถลบบัญชีของตัวเองได้");
      return;
    }
    if (!confirm("คุณต้องการลบสมาชิกนี้ใช่หรือไม่? บัญชี login ของคนนี้จะถูกลบไปด้วย")) return;

    setDeletingId(id);
    const result = await callManageMember({ action: "delete", uid: id });
    setDeletingId(null);
    if (!result.success) {
      alert("ลบไม่สำเร็จ: " + result.error);
    } else if (result.warning) {
      alert(result.warning);
    }
  };

  const startEdit = (u) => {
    setEditingId(u.id);
    setEditName(u.name || "");
    setEditEmail(u.email || "");
    setEditRole(u.role || "VHV");
    setEditVillage(u.village || "");
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const handleSaveEdit = async (id) => {
    if (!editName) return alert("กรุณากรอกชื่อ");
    if (!editEmail) return alert("กรุณากรอกอีเมล");
    setSavingEdit(true);
    const result = await callManageMember({ action: "update", uid: id, name: editName, email: editEmail, role: editRole, village: editVillage });
    setSavingEdit(false);
    if (result.success) {
      setEditingId(null);
    } else {
      alert("บันทึกไม่สำเร็จ: " + result.error);
    }
  };

  const handleResetPassword = async (u) => {
    const newPassword = prompt(`ตั้งรหัสผ่านใหม่สำหรับ "${u.name}" (อย่างน้อย 6 ตัวอักษร)`);
    if (!newPassword) return; // กดยกเลิก หรือไม่กรอกอะไรเลย
    if (newPassword.length < 6) {
      alert("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร");
      return;
    }
    setResettingId(u.id);
    const result = await callManageMember({ action: "reset-password", uid: u.id, password: newPassword });
    setResettingId(null);
    if (result.success) {
      alert(`ตั้งรหัสผ่านใหม่สำเร็จ — แจ้งรหัสผ่านนี้ให้ "${u.name}" ทราบเพื่อใช้ล็อกอินครั้งถัดไป`);
    } else {
      alert("ตั้งรหัสผ่านใหม่ไม่สำเร็จ: " + result.error);
    }
  };

  if (!user) return <div className="p-6 text-slate-500">กำลังตรวจสอบสิทธิ์การเข้าใช้งาน...</div>;
  if (isAdmin === null) return <div className="p-6 text-slate-500">กำลังตรวจสอบสิทธิ์ผู้ดูแลระบบ...</div>;
  if (!isAdmin) {
    return (
      <div className="p-6 max-w-lg mx-auto">
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
          หน้านี้จำกัดให้เฉพาะผู้ดูแลระบบ (Admin) เท่านั้น
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="p-4 sm:p-6 max-w-5xl mx-auto">
        <header className="mb-6 sm:mb-8 border-b pb-4">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">⚙️ ระบบจัดการสมาชิกและสิทธิ์ผู้ใช้งาน</h1>
          <p className="text-sm text-slate-500">เพิ่มสมาชิกใหม่พร้อมบัญชี login จริง กำหนดบทบาทหน้าที่ของเจ้าหน้าที่ อสม., รพ.สต. และผู้บริหารตำบล</p>
        </header>

        {/* ฟอร์มเพิ่มสมาชิก */}
        <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-200 mb-6 sm:mb-8">
          <h2 className="text-lg font-bold text-slate-700 mb-4">เพิ่มสมาชิกใหม่</h2>
          <form onSubmit={handleAddUser} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">ชื่อ -นามสกุล</label>
              <input
                type="text"
                autoComplete="off"
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
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">อีเมล (สำหรับ login)</label>
              <input
                type="email"
                required
                autoComplete="off"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@tmhcc.go.th"
                className="w-full border border-slate-200 rounded-xl p-2.5 text-sm outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">รหัสผ่านเริ่มต้น</label>
              <input
                type="text"
                required
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="อย่างน้อย 6 ตัวอักษร"
                className="w-full border border-slate-200 rounded-xl p-2.5 text-sm outline-none focus:border-blue-500"
              />
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                disabled={saving}
                className="w-full bg-blue-600 text-white font-bold py-2.5 rounded-xl text-sm hover:bg-blue-700 transition disabled:bg-blue-300"
              >
                {saving ? "กำลังบันทึก..." : "+ เพิ่มสมาชิก"}
              </button>
            </div>
          </form>
          <p className="text-xs text-slate-400 mt-3">
            แจ้งอีเมล/รหัสผ่านนี้ให้สมาชิกใหม่ทราบเอง เพื่อใช้ล็อกอินเข้าเว็บได้ทันที
          </p>
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
                  <th className="p-3 sm:p-4">อีเมล</th>
                  <th className="p-3 sm:p-4">บทบาท (Role)</th>
                  <th className="p-3 sm:p-4">พื้นที่</th>
                  <th className="p-4 text-center">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                {users.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="p-6 text-center text-slate-400">ยังไม่มีข้อมูลผู้ใช้งาน</td>
                  </tr>
                ) : (
                  users.map((u) =>
                    editingId === u.id ? (
                      <tr key={u.id} className="bg-blue-50/40">
                        <td className="p-3 sm:p-4">
                          <input
                            type="text"
                            autoComplete="off"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="w-full border border-slate-300 rounded-lg p-1.5 text-sm outline-none focus:border-blue-500"
                          />
                        </td>
                        <td className="p-3 sm:p-4">
                          <input
                            type="email"
                            autoComplete="off"
                            value={editEmail}
                            onChange={(e) => setEditEmail(e.target.value)}
                            className="w-full border border-slate-300 rounded-lg p-1.5 text-sm outline-none focus:border-blue-500"
                          />
                        </td>
                        <td className="p-3 sm:p-4">
                          <select
                            value={editRole}
                            onChange={(e) => setEditRole(e.target.value)}
                            className="w-full border border-slate-300 rounded-lg p-1.5 text-sm outline-none focus:border-blue-500 bg-white"
                          >
                            <option value="VHV">อสม.</option>
                            <option value="HOSPITAL">รพ.สต.</option>
                            <option value="ADMIN">ผู้บริหาร/Admin</option>
                          </select>
                        </td>
                        <td className="p-3 sm:p-4">
                          <input
                            type="text"
                            autoComplete="off"
                            value={editVillage}
                            onChange={(e) => setEditVillage(e.target.value)}
                            className="w-full border border-slate-300 rounded-lg p-1.5 text-sm outline-none focus:border-blue-500"
                          />
                        </td>
                        <td className="p-4 text-center space-x-2 whitespace-nowrap">
                          <button
                            onClick={() => handleSaveEdit(u.id)}
                            disabled={savingEdit}
                            className="px-3 py-1 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition disabled:opacity-40"
                          >
                            {savingEdit ? "กำลังบันทึก..." : "บันทึก"}
                          </button>
                          <button
                            onClick={cancelEdit}
                            disabled={savingEdit}
                            className="px-3 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-200 transition"
                          >
                            ยกเลิก
                          </button>
                        </td>
                      </tr>
                    ) : (
                      <tr key={u.id} className="hover:bg-slate-50/50">
                        <td className="p-4 font-medium text-slate-800">
                          {u.name}{u.id === user.uid ? " (คุณ)" : ""}
                        </td>
                        <td className="p-3 sm:p-4 text-slate-500">{u.email || "-"}</td>
                        <td className="p-3 sm:p-4">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                            u.role === "ADMIN" ? "bg-purple-100 text-purple-700" :
                            u.role === "HOSPITAL" ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"
                          }`}>
                            {u.role === "ADMIN" ? "ผู้บริหาร/Admin" : u.role === "HOSPITAL" ? "เจ้าหน้าที่ รพ.สต." : "อสม."}
                          </span>
                        </td>
                        <td className="p-3 sm:p-4">{u.village}</td>
                        <td className="p-4 text-center space-x-2 whitespace-nowrap">
                          <button
                            onClick={() => startEdit(u)}
                            className="px-3 py-1 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-lg text-xs font-bold transition"
                          >
                            แก้ไข
                          </button>
                          <button
                            onClick={() => handleResetPassword(u)}
                            disabled={resettingId === u.id}
                            className="px-3 py-1 bg-amber-50 text-amber-600 hover:bg-amber-100 rounded-lg text-xs font-bold transition disabled:opacity-40"
                          >
                            {resettingId === u.id ? "กำลังตั้ง..." : "เปลี่ยนรหัสผ่าน"}
                          </button>
                          <button
                            onClick={() => handleDeleteUser(u.id)}
                            disabled={deletingId === u.id || u.id === user.uid}
                            className="px-3 py-1 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg text-xs font-bold transition disabled:opacity-40"
                          >
                            {deletingId === u.id ? "กำลังลบ..." : "ลบ"}
                          </button>
                        </td>
                      </tr>
                    )
                  )
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
