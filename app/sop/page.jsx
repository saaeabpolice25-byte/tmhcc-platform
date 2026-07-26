// app/sop/page.jsx
"use client";

import TaskTable from "@/components/TaskTable";

export default function SopPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="p-4 sm:p-6 max-w-6xl mx-auto">
        <header className="mb-6 sm:mb-8 border-b pb-4">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">📋 ติดตามและจัดการภารกิจตามขั้นตอน SOP</h1>
          <p className="text-sm text-slate-500">อัปเดตสถานะการปฏิบัติงานของหน่วยงาน อสม., รพ.สต., โรงพยาบาล, EMS และหน่วยเสริม</p>
        </header>

        <TaskTable />
      </div>
    </div>
  );
}
