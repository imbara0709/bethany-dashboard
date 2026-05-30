"use client";
import { useState, useMemo } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Layout from "@/components/Layout";
import ScheduleFormModal from "@/components/ScheduleFormModal";
import TaskFormModal from "@/components/TaskFormModal";
import {
  Schedule, ScheduleType,
  SCHEDULE_TYPE_LABELS, SCHEDULE_TYPE_COLORS, SCHEDULE_TYPE_BAR,
  Role, Task, TaskStatus, TASK_STATUS_LABELS,
} from "@/types";
import { schedulesApi, homeApi, tasksApi } from "@/lib/api";
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
const TASK_STATUS_DOT: Record<TaskStatus, string> = {
  TODO:        "bg-gray-300",
  IN_PROGRESS: "bg-amber-400",
  REVIEW:      "bg-indigo-400",
  DONE:        "bg-emerald-400",
};

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const qc = useQueryClient();
  const [viewMode,     setViewMode]     = useState<ViewMode>("week");
  const [baseDate,     setBaseDate]     = useState(new Date());
  const [showForm,     setShowForm]     = useState(false);
  const [editSchedule, setEditSchedule] = useState<Schedule | null>(null);
  const [clickedDate,  setClickedDate]  = useState<string | null>(null);
  const [filterType,   setFilterType]   = useState<ScheduleType | "">("");
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editTask,     setEditTask]     = useState<Task | null>(null);

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

  // 내 업무
  const { data: myTasks = [] } = useQuery({
    queryKey: ["my-tasks"],
    queryFn: async () => (await tasksApi.list({ mine: true })).data as Task[] ?? [],
    enabled: !!session,
  });

  const updateMyTaskStatus = useMutation({
    mutationFn: ({ id, s }: { id: string; s: TaskStatus }) => tasksApi.update(id, { status: s }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-tasks"] });
      qc.invalidateQueries({ queryKey: ["home-summary"] });
    },
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

        {/* 주간 뷰 - 스플릿 레이아웃 */}
        {viewMode === "week" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* 좌측 2/3: 주간 달력 + 이번주 일정 목록 */}
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-white rounded-2xl border border-[#E5E8EB] overflow-hidden shadow-sm">
                <div className="grid grid-cols-7 border-b border-[#F2F4F6]">
                  {weekDays.map((day,i) => {
                    const isToday = toYMD(day)===todayYMD;
                    return (
                      <div key={i} className={`py-2 text-center border-r border-gray-50 last:border-r-0 ${isToday?"bg-[#EBF2FE]":""}`}>
                        <div className={`text-[10px] font-semibold tracking-wide ${WD_COLORS[i]}`}>{WD_KO[i]}</div>
                        <div className={`mt-0.5 mx-auto w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold ${isToday?"bg-[#3182F6] text-white":WD_COLORS[i]}`}>
                          {day.getDate()}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="grid grid-cols-7 min-h-[150px]">
                  {weekDays.map((day,i) => {
                    const isToday = toYMD(day)===todayYMD;
                    const daySched = schedulesForDay(day);
                    return (
                      <div key={i}
                        onClick={() => { if(!canCreate) return; setEditSchedule(null); setClickedDate(toYMD(day)); setShowForm(true); }}
                        className={`p-1 border-r border-gray-50 last:border-r-0 ${isToday?"bg-[#EBF2FE]/30":""} ${canCreate?"cursor-pointer hover:bg-[#F7F8FA]/80":""}`}>
                        <div className="space-y-0.5">
                          {daySched.map((s) => {
                            const multi = s.endDate && s.endDate.slice(0,10)!==s.date.slice(0,10);
                            return (
                              <button key={s.id}
                                onClick={(e) => { e.stopPropagation(); if(s.createdById===userId||isAdmin){setEditSchedule(s);setShowForm(true);} }}
                                className={`w-full text-left text-[10px] px-1 py-0.5 rounded border transition-opacity hover:opacity-80 ${SCHEDULE_TYPE_COLORS[s.type as ScheduleType] ?? "bg-gray-100 text-gray-700 border-[#E5E8EB]"}`}>
                                <div className="font-semibold truncate flex items-center gap-0.5">
                                  {multi && <span className="opacity-60">↔</span>}
                                  {s.title}
                                </div>
                                {s.startTime && (
                                  <div className="opacity-70 text-[10px] truncate">
                                    {s.startTime}
                                  </div>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 이번 주 일정 - 단순 리스트 */}
              {(() => {
                const weekSchedules = allSchedules
                  .filter((s) => !filterType || s.type === filterType)
                  .sort((a, b) => a.date.localeCompare(b.date) || (a.startTime ?? "").localeCompare(b.startTime ?? ""));
                if (weekSchedules.length === 0) return null;
                return (
                  <div className="bg-white rounded-2xl border border-[#E5E8EB] shadow-sm overflow-hidden">
                    <div className="px-4 py-3 border-b border-[#F2F4F6]">
                      <h3 className="text-sm font-bold text-gray-700">
                        이번 주 일정 <span className="text-gray-400 font-normal ml-1">({weekSchedules.length}건)</span>
                      </h3>
                    </div>
                    <ul className="divide-y divide-gray-50">
                      {weekSchedules.map((s) => {
                        const color    = SCHEDULE_TYPE_COLORS[s.type as ScheduleType] ?? "bg-gray-100 text-gray-700 border-[#E5E8EB]";
                        const barColor = SCHEDULE_TYPE_BAR[s.type as ScheduleType]    ?? "bg-gray-300";
                        const isMulti = s.endDate && s.endDate.slice(0,10) !== s.date.slice(0,10);
                        return (
                          <li key={s.id}
                            onClick={() => { if (s.createdById === userId || isAdmin) { setEditSchedule(s); setShowForm(true); } }}
                            className="flex items-stretch gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer">
                            <div className={`w-1 rounded-full flex-shrink-0 ${barColor}`} />
                            <div className="flex-shrink-0 w-12 text-center">
                              <div className="text-[10px] text-gray-400 font-medium">{WD_KO[(new Date(s.date).getDay() + 6) % 7]}</div>
                              <div className="text-sm font-bold text-gray-700">{s.date.slice(8,10)}</div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className={`flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded border font-medium ${color}`}>
                                  {SCHEDULE_TYPE_LABELS[s.type as ScheduleType]}
                                </span>
                                <span className="font-semibold text-sm text-gray-900 truncate">{s.title}</span>
                              </div>
                              <div className="text-xs text-gray-500 truncate">
                                {s.startTime && <span>{s.startTime}{s.endTime && ` ~ ${s.endTime}`}</span>}
                                {isMulti && s.endDate && <span>{s.startTime && " · "}~ {s.endDate.slice(5,10).replace("-","/")}</span>}
                                {s.location && <span>{(s.startTime || isMulti) && " · "}{s.location}</span>}
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })()}
            </div>

            {/* 우측 1/3: 내 업무 패널 */}
            <div className="lg:col-span-1">
              <div className="lg:sticky lg:top-4 bg-white rounded-2xl border border-[#E5E8EB] shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-[#F2F4F6]">
                  <h3 className="text-sm font-semibold text-gray-800">내 업무</h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => { setEditTask(null); setShowTaskForm(true); }}
                      className="flex items-center gap-1 text-xs text-[#3182F6] font-medium hover:text-[#1B64DA]"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      추가
                    </button>
                    <Link href="/tasks" className="text-xs text-gray-400 hover:text-gray-600">
                      모두 →
                    </Link>
                  </div>
                </div>

                {myTasks.filter((t) => t.status !== "DONE").length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-gray-400">
                    진행 중인 업무가 없습니다
                    <button
                      onClick={() => { setEditTask(null); setShowTaskForm(true); }}
                      className="block mx-auto mt-2 text-xs text-[#3182F6] hover:underline"
                    >
                      + 업무 추가하기
                    </button>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-50 max-h-[600px] overflow-y-auto">
                    {myTasks
                      .filter((t) => t.status !== "DONE")
                      .sort((a, b) => {
                        const ord: Record<TaskStatus, number> = { IN_PROGRESS: 0, REVIEW: 1, TODO: 2, DONE: 3 };
                        return ord[a.status as TaskStatus] - ord[b.status as TaskStatus];
                      })
                      .map((t) => {
                        const isOverdueTask = t.deadline && new Date(t.deadline) < new Date();
                        return (
                          <div key={t.id} className="px-4 py-3 group hover:bg-gray-50">
                            <div className="flex items-start gap-2 mb-1.5">
                              <div className={`w-2.5 h-2.5 mt-1 rounded-full flex-shrink-0 ${TASK_STATUS_DOT[t.status as TaskStatus]}`} />
                              <div className="flex-1 min-w-0">
                                <span className="text-sm text-gray-800 break-words block">{t.title}</span>
                                {t.deadline && (
                                  <span className={`text-xs ${isOverdueTask ? "text-red-500" : "text-gray-400"}`}>
                                    {isOverdueTask && "⚠ "}~{t.deadline.slice(5, 10)}
                                  </span>
                                )}
                              </div>
                              <button
                                onClick={() => { setEditTask(t); setShowTaskForm(true); }}
                                className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-gray-600"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                            </div>
                            <select
                              value={t.status}
                              onChange={(e) => updateMyTaskStatus.mutate({ id: t.id, s: e.target.value as TaskStatus })}
                              className="w-full text-xs border border-[#E5E8EB] rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-[#3182F6] cursor-pointer"
                            >
                              {(Object.keys(TASK_STATUS_LABELS) as TaskStatus[]).map((s) => (
                                <option key={s} value={s}>{TASK_STATUS_LABELS[s]}</option>
                              ))}
                            </select>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 월간 뷰 */}
        {viewMode === "month" && (
          <div className="space-y-4">
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

            {/* 해당 월 일별 일정 목록 */}
            {(() => {
              const filtered = monthSchedules
                .filter((s) => !filterType || s.type === filterType)
                .sort((a, b) => a.date.localeCompare(b.date) || (a.startTime ?? "").localeCompare(b.startTime ?? ""));
              if (filtered.length === 0) {
                return (
                  <div className="bg-white rounded-2xl border border-[#E5E8EB] shadow-sm p-8 text-center text-sm text-gray-400">
                    이번 달 등록된 일정이 없습니다
                  </div>
                );
              }
              const grouped: Record<string, Schedule[]> = {};
              for (const s of filtered) {
                const dateKey = s.date.slice(0, 10);
                if (!grouped[dateKey]) grouped[dateKey] = [];
                grouped[dateKey].push(s);
              }
              const sortedKeys = Object.keys(grouped).sort();
              return (
                <div className="bg-white rounded-2xl border border-[#E5E8EB] shadow-sm overflow-hidden">
                  <div className="px-4 py-3 border-b border-[#F2F4F6]">
                    <h3 className="text-sm font-bold text-gray-700">
                      {monthMonth + 1}월 일정 <span className="text-gray-400 font-normal ml-1">({filtered.length}건)</span>
                    </h3>
                  </div>
                  <ul className="divide-y divide-gray-100">
                    {sortedKeys.map((dateKey) => {
                      const dateObj = new Date(dateKey);
                      const wdIdx = (dateObj.getDay() + 6) % 7;
                      const isToday = dateKey === todayYMD;
                      return (
                        <li key={dateKey} className="flex">
                          <div className={`flex-shrink-0 w-16 py-3 px-3 text-center border-r border-gray-50 ${isToday ? "bg-[#EBF2FE]/40" : "bg-gray-50/40"}`}>
                            <div className={`text-[10px] font-medium ${WD_COLORS[wdIdx]}`}>{WD_KO[wdIdx]}</div>
                            <div className={`text-lg font-bold ${isToday ? "text-[#3182F6]" : "text-gray-700"}`}>{dateObj.getDate()}</div>
                          </div>
                          <ul className="flex-1 divide-y divide-gray-50">
                            {grouped[dateKey].map((s) => {
                              const color    = SCHEDULE_TYPE_COLORS[s.type as ScheduleType] ?? "bg-gray-100 text-gray-700 border-[#E5E8EB]";
                              const barColor = SCHEDULE_TYPE_BAR[s.type as ScheduleType]    ?? "bg-gray-300";
                              const isMulti = s.endDate && s.endDate.slice(0,10) !== s.date.slice(0,10);
                              return (
                                <li key={s.id}
                                  onClick={() => { if (s.createdById === userId || isAdmin) { setEditSchedule(s); setShowForm(true); } }}
                                  className="flex items-stretch gap-3 px-3 py-2.5 hover:bg-gray-50 cursor-pointer">
                                  <div className={`w-1 rounded-full flex-shrink-0 ${barColor}`} />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-0.5">
                                      <span className={`flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded border font-medium ${color}`}>
                                        {SCHEDULE_TYPE_LABELS[s.type as ScheduleType]}
                                      </span>
                                      <span className="font-semibold text-sm text-gray-900 truncate">{s.title}</span>
                                    </div>
                                    <div className="text-xs text-gray-500 truncate">
                                      {s.startTime && <span>{s.startTime}{s.endTime && ` ~ ${s.endTime}`}</span>}
                                      {isMulti && s.endDate && <span>{s.startTime && " · "}~ {s.endDate.slice(5,10).replace("-","/")}</span>}
                                      {s.location && <span>{(s.startTime || isMulti) && " · "}{s.location}</span>}
                                    </div>
                                  </div>
                                </li>
                              );
                            })}
                          </ul>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })()}
          </div>
        )}

        {showForm && (
          <ScheduleFormModal
            schedule={editSchedule??undefined}
            defaultDate={clickedDate??undefined}
            onClose={() => { setShowForm(false); setEditSchedule(null); setClickedDate(null); refetch(); }}
          />
        )}

        {showTaskForm && (
          <TaskFormModal
            task={editTask ?? undefined}
            onClose={() => {
              setShowTaskForm(false);
              setEditTask(null);
              qc.invalidateQueries({ queryKey: ["my-tasks"] });
              qc.invalidateQueries({ queryKey: ["home-summary"] });
            }}
          />
        )}
      </div>
    </Layout>
  );
}
