"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { membersApi, schedulesApi, requestsApi } from "@/lib/api";
import {
  User, Schedule,
  ScheduleType, SCHEDULE_TYPE_LABELS,
  RequestPriority, REQUEST_PRIORITY_LABELS,
  CreateRequestInput,
  Role, hasMinRole,
} from "@/types";

interface RequestFormModalProps {
  onClose: () => void;
  defaultAssigneeId?: string;
  defaultDepartment?: ScheduleType;
}

function dateInputToIso(value: string): string | undefined {
  if (!value) return undefined;
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

export default function RequestFormModal({
  onClose,
  defaultAssigneeId,
  defaultDepartment,
}: RequestFormModalProps) {
  const qc = useQueryClient();
  const router = useRouter();
  const { data: session } = useSession();
  const userRole = session?.user?.role as Role | undefined;
  const canBulk = userRole ? hasMinRole(userRole, "PASTOR") : false;

  const [title,        setTitle]        = useState("");
  const [assigneeId,   setAssigneeId]   = useState(defaultAssigneeId ?? "");
  const [deadline,     setDeadline]     = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [description,  setDescription]  = useState("");
  const [department,   setDepartment]   = useState<ScheduleType | "">(defaultDepartment ?? "");
  const [scheduleId,   setScheduleId]   = useState("");
  const [priority,     setPriority]     = useState<RequestPriority>(RequestPriority.MEDIUM);
  const [bulkMode,     setBulkMode]     = useState(false);
  const [errorMsg,     setErrorMsg]     = useState<string | null>(null);

  const { data: members = [] } = useQuery({
    queryKey: ["members", "all-active"],
    queryFn: async () => {
      const res = await membersApi.list();
      return (res.data ?? []).filter((m: User) => m.isActive);
    },
  });

  const today = new Date();
  const { data: schedules = [] } = useQuery({
    queryKey: ["schedules", "linkable", today.getFullYear(), today.getMonth() + 1],
    queryFn: async () =>
      (await schedulesApi.list({ year: today.getFullYear(), month: today.getMonth() + 1 })).data ?? [],
    enabled: showAdvanced,
  });

  const createMutation = useMutation({
    mutationFn: (body: CreateRequestInput) => requestsApi.create(body),
    onSuccess: (res) => {
      if (!res.success) {
        setErrorMsg(res.error ?? "요청 생성 실패");
        return;
      }
      qc.invalidateQueries({ queryKey: ["requests"] });
      qc.invalidateQueries({ queryKey: ["home", "summary"] });
      onClose();
      router.push("/requests?tab=sent");
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);

    if (!title.trim()) {
      setErrorMsg("제목을 입력해주세요.");
      return;
    }

    const isBulk = bulkMode && canBulk && !!department;
    if (!isBulk && !assigneeId) {
      setErrorMsg("담당자를 선택해주세요.");
      return;
    }
    if (!deadline) {
      setErrorMsg("마감일을 선택해주세요.");
      return;
    }

    const body: CreateRequestInput = {
      title: title.trim(),
      description: description.trim() || undefined,
      deadline: dateInputToIso(deadline),
      priority,
      department: (department || undefined) as ScheduleType | undefined,
      scheduleId: scheduleId || undefined,
    };

    if (isBulk) {
      body.bulkDepartment = department as ScheduleType;
    } else {
      body.assigneeId = assigneeId;
    }

    createMutation.mutate(body);
  }

  const isSubmitting = createMutation.isPending;
  const canSubmit =
    !!title.trim() && !!deadline && (bulkMode ? !!department : !!assigneeId);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#F2F4F6] sticky top-0 bg-white">
          <h3 className="text-base font-bold text-[#191F28]">새 요청</h3>
          <button onClick={onClose} className="text-[#8B95A1] hover:text-[#4E5968]" aria-label="닫기">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {errorMsg && (
            <div className="text-sm px-3 py-2 rounded-xl bg-red-50 border border-red-100 text-red-600">
              {errorMsg}
            </div>
          )}

          {/* 제목 */}
          <div>
            <label className="block text-sm font-medium text-[#191F28] mb-1.5">
              제목 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={120}
              placeholder="예: 어린이주일 광고 디자인 부탁드립니다"
              className="w-full px-3 py-2.5 border border-[#E5E8EB] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#3182F6]"
            />
          </div>

          {/* 담당자 */}
          {!bulkMode && (
            <div>
              <label className="block text-sm font-medium text-[#191F28] mb-1.5">
                담당자 <span className="text-red-500">*</span>
              </label>
              <select
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                className="w-full px-3 py-2.5 border border-[#E5E8EB] rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#3182F6]"
              >
                <option value="">담당자 선택</option>
                {members.map((m: User) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                    {m.team ? ` (${m.team})` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* 마감일 */}
          <div>
            <label className="block text-sm font-medium text-[#191F28] mb-1.5">
              마감일 <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-full px-3 py-2.5 border border-[#E5E8EB] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#3182F6]"
            />
          </div>

          {/* 고급 설정 토글 */}
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="w-full flex items-center justify-between px-3 py-2 -mx-1 rounded-xl hover:bg-[#F7F8FA] text-sm font-medium text-[#4E5968]"
          >
            <span>{showAdvanced ? "고급 설정 접기" : "고급 설정"}</span>
            <svg
              className={`w-4 h-4 transition-transform ${showAdvanced ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showAdvanced && (
            <div className="space-y-4 pt-1">
              {/* 설명 */}
              <div>
                <label className="block text-sm font-medium text-[#191F28] mb-1.5">설명</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  maxLength={2000}
                  placeholder="필요한 내용, 참고 자료 등을 적어주세요"
                  className="w-full px-3 py-2.5 border border-[#E5E8EB] rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#3182F6]"
                />
              </div>

              {/* 부서 */}
              <div>
                <label className="block text-sm font-medium text-[#191F28] mb-1.5">관련 부서</label>
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value as ScheduleType | "")}
                  className="w-full px-3 py-2.5 border border-[#E5E8EB] rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#3182F6]"
                >
                  <option value="">선택 안 함</option>
                  {(Object.values(ScheduleType) as ScheduleType[]).map((t) => (
                    <option key={t} value={t}>
                      {SCHEDULE_TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </div>

              {/* 부서 일괄 전송 (PASTOR/ADMIN) */}
              {canBulk && department && (
                <label className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-[#FFF8EB] border border-[#FFE3A8] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={bulkMode}
                    onChange={(e) => setBulkMode(e.target.checked)}
                    className="w-4 h-4 rounded accent-[#3182F6]"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-[#191F28]">
                      이 부서 전원에게 보내기
                    </div>
                    <div className="text-xs text-[#8B95A1]">
                      {SCHEDULE_TYPE_LABELS[department as ScheduleType]} 사역자 전원에게 개별 요청이 생성됩니다.
                    </div>
                  </div>
                </label>
              )}

              {/* 연결 일정 */}
              <div>
                <label className="block text-sm font-medium text-[#191F28] mb-1.5">관련 일정</label>
                <select
                  value={scheduleId}
                  onChange={(e) => setScheduleId(e.target.value)}
                  className="w-full px-3 py-2.5 border border-[#E5E8EB] rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#3182F6]"
                >
                  <option value="">연결 안 함</option>
                  {schedules.map((s: Schedule) => (
                    <option key={s.id} value={s.id}>
                      {s.date} · {s.title}
                    </option>
                  ))}
                </select>
              </div>

              {/* 우선순위 */}
              <div>
                <label className="block text-sm font-medium text-[#191F28] mb-1.5">우선순위</label>
                <div className="flex gap-1.5">
                  {(Object.values(RequestPriority) as RequestPriority[]).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPriority(p)}
                      className={`flex-1 px-3 py-2 rounded-xl text-sm font-medium border transition-colors ${
                        priority === p
                          ? "bg-[#3182F6] text-white border-[#3182F6]"
                          : "bg-white text-[#4E5968] border-[#E5E8EB] hover:bg-[#F7F8FA]"
                      }`}
                    >
                      {REQUEST_PRIORITY_LABELS[p]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 버튼 */}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-[#4E5968] border border-[#E5E8EB] rounded-xl hover:bg-[#F7F8FA] disabled:opacity-50"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !canSubmit}
              className="flex-1 px-4 py-2.5 text-sm font-semibold bg-[#3182F6] text-white rounded-xl hover:bg-[#1B64DA] disabled:opacity-50"
            >
              {isSubmitting ? "전송 중..." : bulkMode ? "부서 전체에 보내기" : "요청 보내기"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
