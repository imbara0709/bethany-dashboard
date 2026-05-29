"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { schedulesApi } from "@/lib/api";
import {
  Schedule,
  ScheduleType,
  SCHEDULE_TYPE_LABELS,
  SCHEDULE_TYPE_COLORS,
  hasMinRole,
  Role,
} from "@/types";
import { useSession } from "next-auth/react";
import ScheduleFormModal from "@/components/ScheduleFormModal";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

function getDaysInMonth(year: number, month: number): (Date | null)[] {
  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month - 1, d));
  return cells;
}

function toYMD(date: Date): string {
  return date.toISOString().split("T")[0];
}

export default function CalendarPage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [typeFilter, setTypeFilter] = useState<ScheduleType | "">("");
  const [selected, setSelected] = useState<Schedule | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<Schedule | null>(null);

  const { data: session } = useSession();
  const userRole = session?.user?.role as Role | undefined;
  const currentUserId = session?.user?.id as string | undefined;
  const canCreate = userRole ? hasMinRole(userRole, "DEACON") : false;
  const isAdmin = userRole ? hasMinRole(userRole, "ADMIN") : false;

  const { data: schedules = [] } = useQuery({
    queryKey: ["schedules", year, month, typeFilter],
    queryFn: async () => {
      const res = await schedulesApi.list({
        year,
        month,
        ...(typeFilter ? { type: typeFilter as ScheduleType } : {}),
      });
      return res.data ?? [];
    },
  });

  const cells = getDaysInMonth(year, month);

  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  }

  function schedulesForDate(date: Date): Schedule[] {
    const ymd = toYMD(date);
    return schedules.filter((s) => s.date === ymd || (s.startTime && s.date === ymd));
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <button onClick={prevMonth} className="p-1.5 rounded-xl hover:bg-gray-100 text-gray-500">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h2 className="text-lg font-semibold text-gray-900 min-w-[6rem] text-center">
            {year}년 {month}월
          </h2>
          <button onClick={nextMonth} className="p-1.5 rounded-xl hover:bg-gray-100 text-gray-500">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <button
            onClick={() => { setYear(today.getFullYear()); setMonth(today.getMonth() + 1); }}
            className="text-xs px-2 py-1 rounded-md bg-gray-100 text-gray-600 hover:bg-gray-200 ml-1"
          >
            오늘
          </button>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as ScheduleType | "")}
            className="text-sm border border-[#E5E8EB] rounded-xl px-2 py-1.5 text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#3182F6]"
          >
            <option value="">전체 유형</option>
            {(Object.keys(SCHEDULE_TYPE_LABELS) as ScheduleType[]).map((t) => (
              <option key={t} value={t}>{SCHEDULE_TYPE_LABELS[t]}</option>
            ))}
          </select>

          {canCreate && (
            <button
              onClick={() => { setEditTarget(null); setShowForm(true); }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#3182F6] text-white rounded-xl text-sm font-medium hover:bg-[#1B64DA] transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              일정 추가
            </button>
          )}
        </div>
      </div>

      {/* Calendar grid */}
      <div className="bg-white rounded-xl border border-[#E5E8EB] overflow-hidden">
        <div className="grid grid-cols-7 border-b border-[#F2F4F6]">
          {WEEKDAYS.map((d, i) => (
            <div
              key={d}
              className={`py-2 text-center text-xs font-medium ${
                i === 0 ? "text-red-500" : i === 6 ? "text-blue-500" : "text-gray-500"
              }`}
            >
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {cells.map((date, idx) => {
            const isToday = date && toYMD(date) === toYMD(today);
            const daySchedules = date ? schedulesForDate(date) : [];
            const col = idx % 7;

            return (
              <div
                key={idx}
                className={`min-h-[80px] p-1.5 border-b border-r border-gray-50 ${
                  !date ? "bg-gray-50/50" : "hover:bg-gray-50/70 cursor-default"
                } ${col === 6 ? "border-r-0" : ""}`}
              >
                {date && (
                  <>
                    <span
                      className={`text-xs font-medium inline-flex items-center justify-center w-6 h-6 rounded-full ${
                        isToday
                          ? "bg-[#3182F6] text-white"
                          : col === 0
                          ? "text-red-500"
                          : col === 6
                          ? "text-blue-500"
                          : "text-gray-700"
                      }`}
                    >
                      {date.getDate()}
                    </span>
                    <div className="mt-1 space-y-0.5">
                      {daySchedules.slice(0, 3).map((s) => (
                        <button
                          key={s.id}
                          onClick={() => setSelected(s)}
                          className={`w-full text-left text-xs px-1 py-0.5 rounded truncate ${
                            SCHEDULE_TYPE_COLORS[s.type]
                          } hover:opacity-80 transition-opacity`}
                        >
                          {s.title}
                        </button>
                      ))}
                      {daySchedules.length > 3 && (
                        <span className="text-xs text-gray-400 pl-1">
                          +{daySchedules.length - 3}
                        </span>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Schedule detail modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-5">
            <div className="flex items-start justify-between mb-3">
              <div>
                <span className={`inline-block text-xs px-2 py-0.5 rounded-full mb-1 ${SCHEDULE_TYPE_COLORS[selected.type as ScheduleType]}`}>
                  {SCHEDULE_TYPE_LABELS[selected.type as ScheduleType]}
                </span>
                <h3 className="text-base font-semibold text-gray-900">{selected.title}</h3>
              </div>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 ml-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="text-sm text-gray-600 space-y-1">
              <p>날짜: {selected.date}</p>
              {selected.startTime && <p>시간: {selected.startTime}{selected.endTime ? ` ~ ${selected.endTime}` : ""}</p>}
              {selected.location && <p>장소: {selected.location}</p>}
              {selected.description && <p className="mt-2 text-gray-500">{selected.description}</p>}
            </div>
            {(selected.createdById === currentUserId || isAdmin) && (
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => { setEditTarget(selected); setSelected(null); setShowForm(true); }}
                  className="flex-1 text-sm px-3 py-2 border border-[#E5E8EB] rounded-xl hover:bg-gray-50 transition-colors"
                >
                  수정
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {showForm && (
        <ScheduleFormModal
          schedule={editTarget ?? undefined}
          defaultDate={editTarget ? undefined : `${year}-${String(month).padStart(2, "0")}-01`}
          onClose={() => { setShowForm(false); setEditTarget(null); }}
        />
      )}
    </div>
  );
}
