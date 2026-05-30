"use client";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { schedulesApi } from "@/lib/api";
import {
  Schedule, ScheduleType,
  SCHEDULE_TYPE_LABELS, SCHEDULE_TYPE_COLORS,
  LOCATION_LIST,
  Role, hasMinRole,
} from "@/types";

interface Props {
  schedule?: Schedule;
  defaultDate?: string;
  onClose: () => void;
}

export default function ScheduleFormModal({ schedule, defaultDate, onClose }: Props) {
  const qc = useQueryClient();
  const { data: session } = useSession();
  const userRole   = session?.user?.role as Role | undefined;
  const userId     = session?.user?.id as string | undefined;
  const isEdit     = !!schedule;
  const isCreator  = schedule?.createdById === userId;
  const isAdmin    = userRole ? hasMinRole(userRole, "ADMIN") : false;
  const canDelete  = isEdit && (isCreator || isAdmin);

  const [title,     setTitle]     = useState(schedule?.title     ?? "");
  const [type,      setType]      = useState<ScheduleType>(schedule?.type ?? ScheduleType.MAIN);
  const [date,      setDate]      = useState(schedule?.date      ?? defaultDate ?? "");
  const [endDate,   setEndDate]   = useState(schedule?.endDate   ?? "");
  const [startTime, setStartTime] = useState(schedule?.startTime ?? "");
  const [endTime,   setEndTime]   = useState(schedule?.endTime   ?? "");
  const [location,  setLocation]  = useState(schedule?.location  ?? "");
  const [desc,      setDesc]      = useState(schedule?.description ?? "");

  const invalidate = () => qc.invalidateQueries({ queryKey: ["schedules"] });

  const createMut = useMutation({
    mutationFn: () => schedulesApi.create({
      title, type, date,
      endDate:   endDate   || undefined,
      startTime: startTime || undefined,
      endTime:   endTime   || undefined,
      location:  location  || undefined,
      description: desc    || undefined,
    }),
    onSuccess: () => { invalidate(); onClose(); },
  });

  const updateMut = useMutation({
    mutationFn: () => schedulesApi.update(schedule!.id, {
      title, type, date,
      endDate:   endDate   || undefined,
      startTime: startTime || undefined,
      endTime:   endTime   || undefined,
      location:  location  || undefined,
      description: desc    || undefined,
    }),
    onSuccess: () => { invalidate(); onClose(); },
  });

  const deleteMut = useMutation({
    mutationFn: () => schedulesApi.delete(schedule!.id),
    onSuccess: () => { invalidate(); onClose(); },
  });

  const isPending = createMut.isPending || updateMut.isPending || deleteMut.isPending;
  const error     = createMut.error ?? updateMut.error ?? deleteMut.error;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !date) return;
    isEdit ? updateMut.mutate() : createMut.mutate();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* 헤더 */}
        <div className="px-5 py-4 border-b border-[#F2F4F6] flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">
            {isEdit ? "일정 수정" : "일정 추가"}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* 부서 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">부서 <span className="text-red-500">*</span></label>
            <div className="grid grid-cols-2 gap-1.5">
              {(Object.values(ScheduleType) as ScheduleType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`px-3 py-2 rounded-xl text-xs font-medium border transition-all ${
                    type === t
                      ? `${SCHEDULE_TYPE_COLORS[t]} ring-2 ring-offset-1 ring-current`
                      : "bg-white text-gray-500 border-[#E5E8EB] hover:bg-gray-50"
                  }`}
                >
                  {SCHEDULE_TYPE_LABELS[t]}
                </button>
              ))}
            </div>
          </div>

          {/* 제목 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">제목 *</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required
              className="w-full border border-[#E5E8EB] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3182F6]"
              placeholder="일정 제목" />
          </div>

          {/* 기간: 시작일 ~ 종료일 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">시작일 *</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required
                className="w-full border border-[#E5E8EB] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3182F6]" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                종료일 <span className="text-gray-400 font-normal">(선택)</span>
              </label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                min={date}
                className="w-full border border-[#E5E8EB] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3182F6]" />
            </div>
          </div>

          {/* 시간 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">시작 시간</label>
              <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)}
                className="w-full border border-[#E5E8EB] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3182F6]" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">종료 시간</label>
              <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)}
                className="w-full border border-[#E5E8EB] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3182F6]" />
            </div>
          </div>

          {/* 장소 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">장소</label>
            <input
              type="text"
              list="location-options"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full border border-[#E5E8EB] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3182F6]"
              placeholder="장소 선택 또는 직접 입력"
            />
            <datalist id="location-options">
              {LOCATION_LIST.map((loc) => (
                <option key={loc} value={loc} />
              ))}
            </datalist>
          </div>

          {/* 메모 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">메모</label>
            <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={2}
              className="w-full border border-[#E5E8EB] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3182F6] resize-none"
              placeholder="메모 (선택)" />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-xl">
              {(error as Error).message ?? "오류가 발생했습니다."}
            </p>
          )}

          <div className="flex gap-2 pt-1">
            {canDelete && (
              <button type="button" onClick={() => { if (confirm("삭제하시겠습니까?")) deleteMut.mutate(); }}
                disabled={isPending}
                className="px-4 py-2 text-sm text-red-600 border border-red-200 rounded-xl hover:bg-red-50 disabled:opacity-50">
                삭제
              </button>
            )}
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 text-sm border border-[#E5E8EB] rounded-xl hover:bg-gray-50">
              취소
            </button>
            <button type="submit" disabled={isPending}
              className="flex-1 px-4 py-2 text-sm bg-[#3182F6] text-white rounded-xl hover:bg-[#1B64DA] disabled:opacity-50">
              {isPending ? "저장 중..." : isEdit ? "수정" : "추가"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
