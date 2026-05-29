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
  Role, hasMinRole,
} from "@/types";
import { schedulesApi } from "@/lib/api";

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

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const [baseDate,     setBaseDate]     = useState(new Date());
  const [showForm,     setShowForm]     = useState(false);
  const [editSchedule, setEditSchedule] = useState<Schedule | null>(null);
  const [clickedDate,  setClickedDate]  = useState<string | null>(null);
  const [filterType,   setFilterType]   = useState<ScheduleType | "">("");

  const { start, end } = getWeekRange(baseDate);
  const crossMonth = end.getMonth() !== start.getMonth();

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
  const canCreate = userRole ? hasMinRole(userRole, "DEACON") : false;
  const isAdmin   = userRole ? hasMinRole(userRole, "ADMIN") : false;
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
    (acc,t) => ({...acc, [t]: allSchedules.filter((s) => s.type===t).length}), {}
  );

  return (
    <Layout>
      <div className="space-y-5 max-w-6xl mx-auto">

        {/* 네비게이터 */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button onClick={() => setBaseDate((d) => { const n=new Date(d); n.setDate(n.getDate()-7); return n; })} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
            </button>
            <h2 className="text-base font-semibold text-gray-900 min-w-[230px] text-center">{fmtWeek(start,end)}</h2>
            <button onClick={() => setBaseDate((d) => { const n=new Date(d); n.setDate(n.getDate()+7); return n; })} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
            </button>
            <button onClick={() => setBaseDate(new Date())} className="text-xs px-2.5 py-1 rounded-md bg-gray-100 text-gray-600 hover:bg-gray-200 ml-1">오늘</button>
          </div>
          {canCreate && (
            <button onClick={() => { setEditSchedule(null); setClickedDate(null); setShowForm(true); }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#3182F6] text-white rounded-lg text-sm font-medium hover:bg-[#1B64DA]">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
              일정 추가
            </button>
          )}
        </div>

        {/* 카테고리 필터 */}
        <div className="flex flex-wrap gap-1.5">
          <button onClick={() => setFilterType("")}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${filterType==="" ? "bg-gray-800 text-white border-gray-800" : "bg-white text-gray-600 border-[#E5E8EB] hover:bg-gray-50"}`}>
            전체 ({allSchedules.length})
          </button>
          {(Object.values(ScheduleType) as ScheduleType[]).filter((t) => typeCounts[t]>0).map((t) => (
            <button key={t} onClick={() => setFilterType(filterType===t ? "" : t)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${filterType===t ? SCHEDULE_TYPE_COLORS[t] : "bg-white text-gray-600 border-[#E5E8EB] hover:bg-gray-50"}`}>
              {SCHEDULE_TYPE_LABELS[t]} ({typeCounts[t]})
            </button>
          ))}
        </div>

        {/* 주간 그리드 */}
        <div className="bg-white rounded-2xl border border-[#E5E8EB] overflow-hidden shadow-sm">
          {/* 요일/날짜 헤더 2줄 */}
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

          {/* 일정 셀 */}
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
                          onClick={(e) => { e.stopPropagation(); if(s.createdById===session.user?.id||isAdmin){setEditSchedule(s);setShowForm(true);} }}
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
                    <div
                      key={s.id}
                      className="bg-white rounded-xl border border-[#E5E8EB] overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() => { if (s.createdById === session.user?.id || isAdmin) { setEditSchedule(s); setShowForm(true); } }}
                    >
                      {/* 상단 컬러 바 */}
                      <div className={`h-1.5 ${barColor}`} />
                      <div className="p-4 space-y-2">
                        {/* 부서 배지 + 제목 */}
                        <div className="flex items-start justify-between gap-2">
                          <span className={`flex-shrink-0 text-xs px-2 py-0.5 rounded-full border font-medium ${color}`}>
                            {SCHEDULE_TYPE_LABELS[s.type as ScheduleType]}
                          </span>
                          {(s.createdById === session.user?.id || isAdmin) && (
                            <svg className="w-3.5 h-3.5 text-gray-300 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          )}
                        </div>
                        <div className="font-semibold text-sm text-gray-900 leading-snug">{s.title}</div>

                        {/* 날짜/시간 */}
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

                        {/* 장소 */}
                        {s.location && (
                          <div className="flex items-center gap-1.5 text-xs text-gray-500">
                            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <span className="truncate">{s.location}</span>
                          </div>
                        )}

                        {/* 메모 */}
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
