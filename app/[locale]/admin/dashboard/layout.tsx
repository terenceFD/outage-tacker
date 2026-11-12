import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import AdminSidebar from "./AdminSidebar";
import { isAdminUser } from "@/lib/data/admin";

// Admin console shell — "Outage Tracker / Admin console" layout from
// design.pdf pages 4–10: dark sidebar nav + wide content area. This is a
// desktop console (the mobile app keeps the BottomNav pages), so the
// centered single-column mobile rule from §6 does not apply here.
//
// Every route under /admin/dashboard re-verifies the admin role
// server-side (profiles.role via Supabase RLS) — non-admins are
// bounced back to /admin, which shows the locked card.
export default async function AdminLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  if (!(await isAdminUser())) {
    redirect(`/${locale}/admin`);
  }

  return (
    <div className="page-bg flex min-h-dvh">
      <AdminSidebar />
      <main className="min-w-0 flex-1 px-6 py-6 lg:px-10">{children}</main>
    </div>
  );
}
