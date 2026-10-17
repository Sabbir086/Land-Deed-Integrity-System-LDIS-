"use client";
export default function PrintButton(){ return <button type="button" onClick={()=>window.print()} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white print:hidden">প্রিন্ট করুন · Print</button>; }
