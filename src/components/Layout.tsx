"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import NotificationDropdown from "@/components/Notifications";
import { Role, ROLE_LABELS, hasMinRole } from "@/types";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  minRole?: Role;
}

const NAV_ITEMS: NavItem[] = [
  {
    href: "/dashboard",
    label: "주간 현황",
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    href: "/tasks",
    label: "업무 현황",
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
  },
  {
    href: "/members",
    label: "사역자",
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
  },
];

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "주간 현황",
  "/tasks":     "업무 현황",
  "/members":   "사역자",
};

function Sidebar({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const userRole = session?.user?.role as Role | undefined;

  return (
    <nav className="flex flex-col h-full bg-white">
      {/* 앱 제목 */}
      <div className="px-5 pt-6 pb-5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#3182F6] flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <div className="text-[15px] font-bold text-[#191F28] leading-tight">교회 사역</div>
            <div className="text-[11px] text-[#8B95A1] leading-tight">일정 & 업무 관리</div>
          </div>
        </div>
      </div>

      {/* 로그인 사용자 */}
      {session?.user && (
        <div className="mx-3 mb-4 px-3 py-2.5 bg-[#F7F8FA] rounded-xl">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-[#3182F6] flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-bold text-white">{session.user.name?.charAt(0)}</span>
            </div>
            <div className="min-w-0">
              <div className="text-[13px] font-semibold text-[#191F28] truncate">{session.user.name}</div>
              <div className="text-[11px] text-[#8B95A1]">{userRole ? ROLE_LABELS[userRole] : ""}</div>
            </div>
          </div>
        </div>
      )}

      {/* 네비게이션 */}
      <ul className="flex-1 px-3 space-y-0.5">
        {NAV_ITEMS.filter(
          (item) => !item.minRole || !userRole || hasMinRole(userRole, item.minRole)
        ).map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={onClose}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-[14px] font-medium transition-all ${
                  isActive
                    ? "bg-[#EBF2FE] text-[#3182F6]"
                    : "text-[#4E5968] hover:bg-[#F7F8FA] hover:text-[#191F28]"
                }`}
              >
                <span className={`flex-shrink-0 ${isActive ? "text-[#3182F6]" : "text-[#B0B8C1]"}`}>
                  {item.icon}
                </span>
                {item.label}
                {isActive && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#3182F6]" />
                )}
              </Link>
            </li>
          );
        })}
      </ul>

      {/* 로그아웃 */}
      <div className="px-3 pb-5 pt-3 border-t border-[#F2F4F6]">
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl text-[13px] text-[#8B95A1] hover:bg-[#F7F8FA] hover:text-[#4E5968] transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          로그아웃
        </button>
      </div>
    </nav>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();
  const pageTitle = PAGE_TITLES[pathname] ?? "";

  return (
    <div className="flex h-screen bg-[#F7F8FA]">
      {/* 데스크탑 사이드바 */}
      <aside className="hidden md:flex w-[220px] flex-col bg-white border-r border-[#F2F4F6] flex-shrink-0">
        <Sidebar />
      </aside>

      {/* 모바일 오버레이 */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm md:hidden" onClick={() => setDrawerOpen(false)} />
      )}

      {/* 모바일 드로어 */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-[220px] bg-white border-r border-[#F2F4F6] transition-transform duration-200 md:hidden ${drawerOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <Sidebar onClose={() => setDrawerOpen(false)} />
      </aside>

      {/* 메인 */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* 헤더 */}
        <header className="flex items-center justify-between px-5 h-[56px] bg-white border-b border-[#F2F4F6] flex-shrink-0">
          {/* 모바일 햄버거 */}
          <button onClick={() => setDrawerOpen(true)} className="md:hidden p-1.5 -ml-1 rounded-xl text-[#8B95A1] hover:text-[#4E5968] hover:bg-[#F7F8FA]" aria-label="메뉴">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {/* 페이지 제목 (데스크탑) */}
          <span className="hidden md:block text-[15px] font-bold text-[#191F28]">{pageTitle}</span>

          {/* 모바일 앱명 */}
          <span className="md:hidden text-[15px] font-bold text-[#191F28]">교회 사역</span>

          <NotificationDropdown />
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6 md:pt-5">
          {children}
        </main>
      </div>
    </div>
  );
}
