"use client";

import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { requestsApi } from "@/lib/api";
import {
  RequestDetail,
  RequestStatus,
  REQUEST_STATUS_LABELS,
  REQUEST_STATUS_COLORS,
  REQUEST_PRIORITY_LABELS,
  REQUEST_PRIORITY_COLORS,
  SCHEDULE_TYPE_LABELS,
  ScheduleType,
  TaskStatus,
  TASK_STATUS_LABELS,
} from "@/types";

interface Props {
  requestId: string | null;
  onClose: () => void;
  onEdit?: (req: RequestDetail) => void;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

const ACTION_LABELS: Record<string, string> = {
  CREATED:       "요청 생성",
  ACCEPTED:      "수락",
  HELD:          "보류",
  REJECTED:      "거절",
  STATUS_CHANGED:"상태 변경",
  COMMENTED:     "댓글",
  TASK_CREATED:  "업무 생성됨",
  SCHEDULE_CREATED: "일정 생성됨",
  REASSIGNED:    "담당자 변경",
};

function ActionDot({ action }: { action: string }) {
  const color =
    action === "ACCEPTED"  ? "bg-blue-500" :
    action === "HELD"      ? "bg-amber-400" :
    action === "REJECTED"  ? "bg-rose-500" :
    action === "CREATED"   ? "bg-[#3182F6]" :
    "bg-gray-300";
  return <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1 ${color}`} />;
}

export default function RequestDetailModal({ requestId, onClose, onEdit }: Props) {
  const { data: session } = useSession();
  const userId = session?.user?.id as string | undefined;
  const qc = useQueryClient();

  const { data: req, isLoading } = useQuery({
    queryKey: ["request", requestId],
    queryFn: () => requestsApi.get(requestId!),
    enabled: !!requestId,
    select: (res) => res.data,
  });

  useEffect(() => {
    if (!requestId) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [requestId, onClose]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["requests"] });
    qc.invalidateQueries({ queryKey: ["request", requestId] });
    qc.invalidateQueries({ queryKey: ["home-summary"] });
  };

  const acceptMut  = useMutation({ mutationFn: () => requestsApi.accept(requestId!),  onSuccess: invalidate });
  const holdMut    = useMutation({ mutationFn: () => requestsApi.hold(requestId!),    onSuccess: invalidate });
  const rejectMut  = useMutation({ mutationFn: () => requestsApi.reject(requestId!, ""), onSuccess: invalidate });

  if (!requestId) return null;

  const isAssignee  = req?.assignee.id === userId;
  const isRequester = req?.requester.id === userId;
  const isPending   = req?.status === RequestStatus.PENDING;
  const isActive    = req?.status === RequestStatus.ACCEPTED || req?.status === RequestStatus.IN_PROGRESS;
  const isMutating  = acceptMut.isPending || holdMut.isPending || rejectMut.isPending;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-end bg-black/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white h-full w-full max-w-[480px] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="sticky top-0 bg-white border-b border-[#F2F4F6] px-5 py-4 flex items-center justify-between z-10">
          <h2 className="text-[16px] font-bold text-[#191F28]">요청 상세</h2>
          <button onClick={onClose} className="p-1.5 rounded-xl text-[#8B95A1] hover:bg-[#F7F8FA]">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center h-40 text-[#8B95A1] text-sm">불러오는 중...</div>
        )}

        {req && (
          <div className="p-5 space-y-5">
            {/* 상태 + 우선순위 */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-xs px-2.5 py-1 rounded-full border font-semibold ${REQUEST_STATUS_COLORS[req.status as RequestStatus] ?? "bg-gray-100 text-gray-600 border-gray-200"}`}>
                {REQUEST_STATUS_LABELS[req.status as RequestStatus] ?? req.status}
              </span>
              <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${REQUEST_PRIORITY_COLORS[req.priority as keyof typeof REQUEST_PRIORITY_COLORS] ?? "bg-gray-100 text-gray-600 border-gray-200"}`}>
                {REQUEST_PRIORITY_LABELS[req.priority as keyof typeof REQUEST_PRIORITY_LABELS] ?? req.priority}
              </span>
              {req.department && (
                <span className="text-xs px-2.5 py-1 rounded-full bg-[#F7F8FA] text-[#4E5968] border border-[#E5E8EB]">
                  {SCHEDULE_TYPE_LABELS[req.department as ScheduleType] ?? req.department}
                </span>
              )}
            </div>

            {/* 제목 */}
            <div>
              <h3 className="text-[18px] font-bold text-[#191F28] leading-snug">{req.title}</h3>
              {req.description && (
                <p className="mt-2 text-[14px] text-[#4E5968] leading-relaxed whitespace-pre-wrap">{req.description}</p>
              )}
            </div>

            {/* 메타 정보 */}
            <div className="bg-[#F7F8FA] rounded-2xl p-4 space-y-2.5 text-[13px]">
              <div className="flex items-center justify-between">
                <span className="text-[#8B95A1]">요청자</span>
                <span className="font-medium text-[#191F28]">{req.requester.name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#8B95A1]">담당자</span>
                <span className="font-medium text-[#191F28]">{req.assignee.name}</span>
              </div>
              {req.deadline && (
                <div className="flex items-center justify-between">
                  <span className="text-[#8B95A1]">마감일</span>
                  <span className="font-medium text-[#191F28]">{formatDate(req.deadline)}</span>
                </div>
              )}
              {req.schedule && (
                <div className="flex items-center justify-between">
                  <span className="text-[#8B95A1]">관련 일정</span>
                  <span className="font-medium text-[#191F28] truncate max-w-[200px]">{req.schedule.title}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-[#8B95A1]">생성일</span>
                <span className="text-[#4E5968]">{formatDate(req.createdAt)}</span>
              </div>
            </div>

            {/* 수락/보류 버튼 (담당자이고 PENDING 상태) */}
            {isAssignee && isPending && (
              <div className="flex gap-2">
                <button
                  onClick={() => acceptMut.mutate()}
                  disabled={isMutating}
                  className="flex-1 h-11 rounded-xl text-[14px] font-semibold text-white bg-[#3182F6] hover:bg-[#1B64DA] disabled:opacity-50"
                >
                  {acceptMut.isPending ? "처리 중..." : "수락"}
                </button>
                <button
                  onClick={() => holdMut.mutate()}
                  disabled={isMutating}
                  className="flex-1 h-11 rounded-xl text-[14px] font-semibold text-[#4E5968] bg-[#F2F4F6] hover:bg-[#E5E8EB] disabled:opacity-50"
                >
                  보류
                </button>
                <button
                  onClick={() => rejectMut.mutate()}
                  disabled={isMutating}
                  className="h-11 px-4 rounded-xl text-[14px] font-semibold text-[#E84A5F] bg-[#FFF0F1] hover:bg-[#FFE0E3] disabled:opacity-50"
                >
                  거절
                </button>
              </div>
            )}

            {/* 연결된 업무 */}
            {req.tasks && req.tasks.length > 0 && (
              <div>
                <h4 className="text-[13px] font-semibold text-[#8B95A1] mb-2">연결된 업무 ({req.tasks.length})</h4>
                <div className="space-y-1.5">
                  {req.tasks.map((t) => (
                    <div key={t.id} className="flex items-center justify-between bg-[#F7F8FA] rounded-xl px-3 py-2.5">
                      <span className="text-[13px] font-medium text-[#191F28] truncate">{t.title}</span>
                      <span className={`ml-2 flex-shrink-0 text-[11px] px-2 py-0.5 rounded-full font-medium ${
                        t.status === "DONE"        ? "bg-emerald-100 text-emerald-700" :
                        t.status === "IN_PROGRESS" ? "bg-amber-100 text-amber-700" :
                        t.status === "REVIEW"      ? "bg-indigo-100 text-indigo-700" :
                        "bg-slate-100 text-slate-700"
                      }`}>
                        {TASK_STATUS_LABELS[t.status as TaskStatus] ?? t.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 활동 타임라인 */}
            {req.activities && req.activities.length > 0 && (
              <div>
                <h4 className="text-[13px] font-semibold text-[#8B95A1] mb-3">활동 기록</h4>
                <div className="relative pl-5">
                  <div className="absolute left-1.5 top-0 bottom-0 w-px bg-[#E5E8EB]" />
                  <div className="space-y-4">
                    {req.activities.map((act) => {
                      let detail = act.detail;
                      try { if (detail) detail = JSON.parse(detail).text ?? detail; } catch { /* keep as is */ }
                      return (
                        <div key={act.id} className="flex items-start gap-3">
                          <ActionDot action={act.action} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[13px] font-semibold text-[#191F28]">{act.actor.name}</span>
                              <span className="text-[12px] text-[#8B95A1]">{ACTION_LABELS[act.action] ?? act.action}</span>
                              <span className="text-[11px] text-[#B0B8C1] ml-auto">{formatDateTime(act.createdAt)}</span>
                            </div>
                            {detail && (
                              <p className="mt-0.5 text-[12px] text-[#4E5968] whitespace-pre-wrap">{detail}</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
