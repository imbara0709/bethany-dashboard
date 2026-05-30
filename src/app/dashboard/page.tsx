"use client";
import { useState, useMemo } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Layout from "@/components/Layout";
import ScheduleFormModal from "@/components/ScheduleFormModal";
import {
  Schedule, ScheduleType,
  SCHEDULE_TYPE_LABELS, SCHEDULE_TYPE_COLORS, SCHEDULE_TYPE_BAR,
  Role,
} from "@/types";
import { schedulesApi, homeApi } from "@/lib/api";
import Link from "next/link";

type ViewMode = "week" | "month";

function toYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function getWeekRange(base: Date) {
  const d = new Date(base), dow = d.getDay(), diff = dow === 0 ? -6 : 1 - dow;
  const start = new Date(d); start.setDate(d.getDate()+diff); start.setHours(0,0,0,0);
  const end = new Date(start); end.setDate(start.getDate()+6); end.setHours(23,59,59,999);
  return { start, end };
}
function fmtWeek(s: Date, e: Date) {
  const f = (d: Date) => `${d.getMonth()+1}월 ${d.getDate()}일`;
  return `${s.getFullYear()}년 ${f(s)} ~ ${f(e)}`;
}

const WD_KO     = ["월","화","수","목","금","토","일"];
const WD_COLORS = ["text-gray-600","text-gray-600","text-gray-600","text-gray-600","text-gray-600","text-blue-500","text-red-500"];

// ── 월간 달력 컴포넌트 ────────────────────────────────────────────────────────
interface MonthCalendarProps {
  year: number;
  month: number; // 0-indexed
  schedules: Schedule[];
  filterType: ScheduleType | "";
  todayYMD: string;
  canCreate: boolean;
  isAdmin: boolean;
  userId: string | undefined;
  onAddClick: (date: string) => void;
  onEditClick: (s: Schedule) => void;
}

function MonthCalendar({
  year, month, schedules, filterType, todayYMD,
  canCreate, isAdmin, userId,
  onAddClick, onEditClick,
}: MonthCalendarProps) {
  const firstDay = new Date(year, month, 1);
  const lastDay  = new Date(year, month + 1, 0);
  // 0=Sun → start from Mon
  const startOffset = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
  const totalCells  = startOffset + lastDay.getDate();
  const rows        = Math.ceil(totalCells / 7);

  const cells = Array.from({ length: rows * 7 }, (_, i) => {
    const dayNum = i - startOffset + 1;
    if (dayNum < 1 || dayNum > lastDay.getDate()) return null;
    return new Date(year, month, dayNum);
  });

  function schedulesForDay(day: Date): Schedule[] {
    const ymd = toYMD(day);
    return schedules.filter((s) => {
      const sd = s.date.slice(0, 10), ed = s.endDate?.slice(0, 10) ?? sd;
      return ymd >= sd && ymd <= ed && (!filterType || s.type === filterType);
    });
  }

  return (
    <div className="bg-white rounded-2xl border border-[#E5E8EB] overflow-hidden shadow-sm">
      {/* 요일 헤더 */}
      <div className="grid grid-cols-7 border-b border-[#F2F4F6]">
        {WD_KO.map((w, i) => (
          <div key={w} className={`py-2 text-center text-xs font-semibold tracking-wide ${WD_COLORS[i]}`}>
            {w}
          </div>
        ))}
      </div>

      {/* 날짜 셀 */}
      <div className="grid grid-cols-7">
        {cells.map((day, idx) => {
          if (!day) return (
            <div key={`empty-${idx}`} className="min-h-[90px] border-r border-b border-gray-50 bg-gray-50/30" />
          );
          const ymd      = toYMD(day);
          const isToday  = ymd === todayYMD;
          const daySched = schedulesForDay(day);
          const colIdx   = idx % 7;

          return (
            <div
              key={ymd}
              onClick={() => canCreate && onAddClick(ymd)}
              className={`min-h-[90px] p-1.5 border-r border-b border-gray-50 last:border-r-0 ${
                isToday ? "bg-[#EBF2FE]/40" : ""
              } ${canCreate ? "cursor-pointer hover:bg-[#F7F8FA]/60" : ""}`}
            >
              {/* 날짜 숫자 */}
              <div className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold mb-1 ${
                isToday
                  ? "bg-[#3182F6] text-white"
                  : colIdx === 5 ? "text-blue-500"
                  : colIdx === 6 ? "text-red-500"
                  : "text-gray-700"
              }`}>
                {day.getDate()}
              </div>

              {/* 일정 뱃지 (최대 3개 표시) */}
              <div className="space-y-0.5">
                {daySched.slice(0, 3).map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (s.createdById === userId || isAdmin) onEditClick(s);
                    }}
                    className={`w-full text-left text-[10px] px-1.5 py-0.5 rounded truncate border font-medium ${
                      SCHEDULE_TYPE_COLORS[s.type as ScheduleType] ?? "bg-gray-100 text-gray-700 border-gray-200"
                    }`}
                  >
                    {s.startTime ? `${s.startTime} ` : ""}{s.title}
                  </button>
                ))}
                {daySched.length > 3 && (
                  <div className="text-[10px] text-gray-400 pl-1">+{daySched.length - 3}건</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── 메인 페이지 ───────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { data: session, status } = useSession();
  const [viewMode,     setViewMode]     = useState<ViewMode>("week");
  const [baseDate,     setBaseDate]     = useState(new Date());
  const [showForm,     setShowForm]     = useState(false);
  const [editSchedule, setEditSchedule] = useState<Schedule | null>(null);
  const [clickedDate,  setClickedDate]  = useState<string | null>(null);
  const [filterType,   setFilterType]   = useState<ScheduleType | "">("");

  const { start, end } = getWeekRange(baseDate);
  const crossMonth = end.getMonth() !== start.getMonth();

  // 월간 기준
  const monthYear  = baseDate.getFullYear();
  const monthMonth = baseDate.getMonth();

  // 주간 데이터
  const { data: schedules = [], refetch } = useQuery({
    queryKey: ["schedules", start.getFullYear(), start.getMonth()+1],
    queryFn: async () => (await schedulesApi.list({ year: start.getFullYear(), month: start.getMonth()+1 })).data as Schedule[] ?? [],
    enabled: !!session,
  });
  const { data: nextSchedules = [] } = useQuery({
    queryKey: ["schedules", end.getFullYear(), end.getMonth()+1],
    queryFn: async () => (await schedulesApi.list({ year: end.getFullYear(), month: end.getMonth()+1 })).data as Schedule[] ?? [],
    enabled: !!session && crossMonth,
  });

  // 홈 요약
  const { data: summary } = useQuery({
    queryKey: ["home-summary"],
    queryFn: async () => (await homeApi.summary()).data,
    enabled: !!session,
  });

  // 월간 데이터
  const { data: monthSchedules = [] } = useQuery({
    queryKey: ["schedules", monthYear, monthMonth + 1],
    queryFn: async () => (await schedulesApi.list({ year: monthYear, month: monthMonth + 1 })).data as Schedule[] ?? [],
    enabled: !!session && viewMode === "month",
  });

  const allSchedules = useMemo(() => {
    const startYMD = toYMD(start), endYMD = toYMD(end);
    return [...schedules, ...(crossMonth ? nextSchedules : [])].filter((s) => {
      const sd = s.date.slice(0,10), ed = s.endDate?.slice(0,10) ?? sd;
      return sd <= endYMD && ed >= startYMD;
    });
  }, [schedules, nextSchedules, crossMonth, start, end]);

  if (status === "loading") return <div className="min-h-screen flex items-center justify-center text-gray-500">로딩 중...</div>;
  if (!session) redirect("/login");

  const userRole  = session.user?.role as Role | undefined;
  const canCreate = !!userRole;
  const isAdmin   = userRole === "ADMIN" || userRole === "PASTOR";
  const userId    = session.user?.id as string | undefined;
  const weekDays  = Array.from({length:7}, (_,i) => { const d=new Date(start); d.setDate(start.getDate()+i); return d; });
  const todayYMD  = toYMD(new Date());

  const schedulesForDay = (day: Date) => {
    const ymd = toYMD(day);
    return allSchedules.filter((s) => {
      const sd = s.date.slice(0,10), ed = s.endDate?.slice(0,10) ?? sd;
      return ymd >= sd && ymd <= ed && (!filterType || s.type === filterType);
    });
  };
  const typeCounts = (Object.values(ScheduleType) as ScheduleType[]).reduce<Record<string,number>>(
    (acc,t) => ({...acc, [t]: (viewMode === "month" ? monthSchedules : allSchedules).filter((s) => s.type===t).length}), {}
  );

  function handlePrev() {
    setBaseDate((d) => {
      const n = new Date(d);
      if (viewMode === "week") n.setDate(n.getDate() - 7);
      else n.setMonth(n.getMonth() - 1);
      return n;
    });
  }
  function handleNext() {
    setBaseDate((d) => {
      const n = new Date(d);
      if (viewMode === "week") n.setDate(n.getDate() + 7);
      else n.setMonth(n.getMonth() + 1);
      return n;
    });
  }

  const headerTitle = viewMode === "week"
    ? fmtWeek(start, end)
    : `${monthYear}년 ${monthMonth + 1}월`;

  const displaySchedules = viewMode === "month" ? monthSchedules : allSchedules;

  return (
    <Layout>
      <div className="space-y-5 max-w-6xl mx-auto">

        {/* 요약 카드 */}
        {summary && (
          <div className="grid grid-cols-3 gap-3">
            <Link href="/requests?tab=received" className="bg-white rounded-2xl border border-[#E5E8EB] p-4 hover:shadow-md transition-shadow">
              <p className="text-[12px] text-[#8B95A1] font-medium mb-1">미처리 요청</p>
              <p className={`text-[26px] font-bold ${summary.pendingRequestCount > 0 ? "text-amber-500" : "text-[#191F28]"}`}>
                {summary.pendingRequestCount}
              </p>
            </Link>
            <Link href="/tasks" className="bg-white rounded-2xl border border-[#E5E8EB] p-4 hover:shadow-md transition-shadow">
              <p className="text-[12px] text-[#8B95A1] font-medium mb-1">진행중 업무</p>
              <p className="text-[26px] font-bold text-[#3182F6]">{summary.activeTaskCount}</p>
            </Link>
            <Link href="/tasks" className="bg-white rounded-2xl border border-[#E5E8EB] p-4 hover:shadow-md transition-shadow">
              <p className="text-[12px] text-[#8B95A1] font-medium mb-1">이번 주 마감</p>
              <p className={`text-[26px] font-bold ${summary.weeklyDeadlineCount > 0 ? "text-rose-500" : "text-[#191F28]"}`}>
                {summary.weeklyDeadlineCount}
              </p>
            </Link>
          </div>
        )}

        {/* 네비게이터 */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button onClick={handlePrev} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
            </button>
            <h2 className="text-base font-semibold text-gray-900 min-w-[230px] text-center">{headerTitle}</h2>
            <button onClick={handleNext} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
            </button>
            <button onClick={() => setBaseDate(new Date())} className="text-xs px-2.5 py-1 rounded-md bg-gray-100 text-gray-600 hover:bg-gray-200 ml-1">오늘</button>
          </div>

          <div className="flex items-center gap-2">
            {/* 주간/월간 토글 */}
            <div className="flex p-0.5 bg-gray-100 rounded-xl text-xs font-medium">
              <button
                onClick={() => setViewMode("week")}
                className={`px-3 py-1.5 rounded-lg transition-colors ${viewMode === "week" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
              >
                주간
              </button>
              <button
                onClick={() => setViewMode("month")}
                className={`px-3 py-1.5 rounded-lg transition-colors ${viewMode === "month" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
              >
                월간
              </button>
            </div>

            {canCreate && (
              <button onClick={() => { setEditSchedule(null); setClickedDate(null); setShowForm(true); }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#3182F6] text-white rounded-lg text-sm font-medium hover:bg-[#1B64DA]">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
                일정 추가
              </button>
            )}
          </div>
        </div>

        {/* 카테고리 필터 */}
        <div className="flex flex-wrap gap-1.5">
          <button onClick={() => setFilterType("")}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${filterType==="" ? "bg-gray-800 text-white border-gray-800" : "bg-white text-gray-600 border-[#E5E8EB] hover:bg-gray-50"}`}>
            전체 ({displaySchedules.length})
          </button>
          {(Object.values(ScheduleType) as ScheduleType[]).filter((t) => typeCounts[t]>0).map((t) => (
            <button key={t} onClick={() => setFilterType(filterType===t ? "" : t)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${filterType===t ? SCHEDULE_TYPE_COLORS[t] : "bg-white text-gray-600 border-[#E5E8EB] hover:bg-gray-50"}`}>
              {SCHEDULE_TYPE_LABELS[t]} ({typeCounts[t]})
            </button>
          ))}
        </div>

        {/* 주간 뷰 */}
        {viewMode === "week" && (
          <>
            <div className="bg-white rounded-2xl border border-[#E5E8EB] overflow-hidden shadow-sm">
              <div className="grid grid-cols-7 border-b border-[#F2F4F6]">
                {weekDays.map((day,i) => {
                  const isToday = toYMD(day)===todayYMD;
                  return (
                    <div key={i} className={`py-3 text-center border-r border-gray-50 last:border-r-0 ${isToday?"bg-[#EBF2FE]":""}`}>
                      <div className={`text-xs font-semibold tracking-wide ${WD_COLORS[i]}`}>{WD_KO[i]}</div>
                      <div className={`mt-1 mx-auto w-8 h-8 flex items-center justify-center rounded-full text-sm font-bold ${isToday?"bg-[#3182F6] text-white":WD_COLORS[i]}`}>
                        {day.getDate()}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="grid grid-cols-7 min-h-[180px]">
                {weekDays.map((day,i) => {
                  const isToday = toYMD(day)===todayYMD;
                  const daySched = schedulesForDay(day);
                  return (
                    <div key={i}
                      onClick={() => { if(!canCreate) return; setEditSchedule(null); setClickedDate(toYMD(day)); setShowForm(true); }}
                      className={`p-1.5 border-r border-gray-50 last:border-r-0 ${isToday?"bg-[#EBF2FE]/30":""} ${canCreate?"cursor-pointer hover:bg-[#F7F8FA]/80":""}`}>
                      <div className="space-y-0.5">
                        {daySched.map((s) => {
                          const multi = s.endDate && s.endDate.slice(0,10)!==s.date.slice(0,10);
                          return (
                            <button key={s.id}
                              onClick={(e) => { e.stopPropagation(); if(s.createdById===userId||isAdmin){setEditSchedule(s);setShowForm(true);} }}
                              className={`w-full text-left text-xs px-1.5 py-1 rounded-md border transition-opacity hover:opacity-80 ${SCHEDULE_TYPE_COLORS[s.type as ScheduleType] ?? "bg-gray-100 text-gray-700 border-[#E5E8EB]"}`}>
                              <div className="font-semibold truncate flex items-center gap-0.5">
                                {multi && <span className="opacity-60">↔</span>}
                                {s.title}
                              </div>
                              <div className="opacity-70 text-[10px] truncate">
                                {SCHEDULE_TYPE_LABELS[s.type as ScheduleType] ?? s.type}
                                {s.startTime && ` · ${s.startTime}`}
                                {multi && s.endDate && ` ~ ${s.endDate.slice(5,10)}`}
                              </div>
                            </button>
                          );
                        })}
                        {daySched.length===0 && canCreate && (
                          <div className="min-h-[120px] flex items-end justify-center pb-2">
                            <span className="text-xs text-gray-200">+</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 이번 주 일정 카드 목록 */}
            {(() => {
              const weekSchedules = allSchedules
                .filter((s) => !filterType || s.type === filterType)
                .sort((a, b) => a.date.localeCompare(b.date));
              if (weekSchedules.length === 0) return null;
              return (
                <div>
                  <h3 className="text-sm font-bold text-gray-700 mb-3">
                    이번 주 일정 <span className="text-gray-400 font-normal ml-1">({weekSchedules.length}건)</span>
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {weekSchedules.map((s) => {
                      const color    = SCHEDULE_TYPE_COLORS[s.type as ScheduleType] ?? "bg-gray-100 text-gray-700 border-[#E5E8EB]";
                      const barColor = SCHEDULE_TYPE_BAR[s.type as ScheduleType]    ?? "bg-gray-300";
                      const isMulti = s.endDate && s.endDate.slice(0,10) !== s.date.slice(0,10);
                      return (
                        <div key={s.id}
                          className="bg-white rounded-xl border border-[#E5E8EB] overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                          onClick={() => { if (s.createdById === userId || isAdmin) { setEditSchedule(s); setShowForm(true); } }}>
                          <div className={`h-1.5 ${barColor}`} />
                          <div className="p-4 space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <span className={`flex-shrink-0 text-xs px-2 py-0.5 rounded-full border font-medium ${color}`}>
                                {SCHEDULE_TYPE_LABELS[s.type as ScheduleType]}
                              </span>
                            </div>
                            <div className="font-semibold text-sm text-gray-900 leading-snug">{s.title}</div>
                            <div className="flex items-center gap-1.5 text-xs text-gray-500">
                              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              <span>
                                {s.date.slice(5,10).replace("-","/")}
                                {isMulti && s.endDate && ` ~ ${s.endDate.slice(5,10).replace("-","/")} `}
                                {s.startTime && ` · ${s.startTime}`}
                                {s.endTime && ` ~ ${s.endTime}`}
                              </span>
                            </div>
                            {s.location && (
                              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                                <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                <span className="truncate">{s.location}</span>
                              </div>
                            )}
                            {s.description && (
                              <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed">{s.description}</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </>
        )}

        {/* 월간 뷰 */}
        {viewMode === "month" && (
          <MonthCalendar
            year={monthYear}
            month={monthMonth}
            schedules={monthSchedules}
            filterType={filterType}
            todayYMD={todayYMD}
            canCreate={canCreate}
            isAdmin={isAdmin}
            userId={userId}
            onAddClick={(date) => { setEditSchedule(null); setClickedDate(date); setShowForm(true); }}
            onEditClick={(s) => { setEditSchedule(s); setShowForm(true); }}
          />
        )}

        {showForm && (
          <ScheduleFormModal
            schedule={editSchedule??undefined}
            defaultDate={clickedDate??undefined}
            onClose={() => { setShowForm(false); setEditSchedule(null); setClickedDate(null); refetch(); }}
          />
        )}
      </div>
    </Layout>
  );
}
