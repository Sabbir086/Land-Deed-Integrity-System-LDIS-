"use client";
import { Alert } from "@/components/ui";
import AppointmentPanel from "./AppointmentPanel";

export default function StepAppointment({ view, setView }) {
  if (!view.application.office_upazila) return <Alert tone="warn">আগে জমির তফসিল নির্বাচন করুন (ধাপ ২); অফিস সেখান থেকে নির্ধারিত হয়।</Alert>;
  return <AppointmentPanel appId={view.application.id} appointment={view.appointment} events={view.appointment_events} canChange onViewChange={setView} />;
}
