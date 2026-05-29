"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { tasksApi, membersApi, schedulesApi } from "@/lib/api";
import {
  Task, TaskStatus, User, Schedule,
  TASK_STATUS_LABELS, CreateTaskInput, UpdateTaskInput,
} from "@/types";

interface TaskFormModalProps {
  task?: Task;
  onClose: () => void;
}

function isoToDateInput(iso: string | null | undefined): string {
  if (!iso) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function dateInputToIso(value: string): string | undefined {
  if (!value) return undefined;
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

export default function TaskFormModal({ task, onClose }: TaskFormModalProps) {
  const isEdit = Boolean(task);
  const qc = useQueryClient();

  const [title,        setTitle]        = useState(task?.title ?? "");
  const [description,  setDescription]  = useState(task?.description ?? "");
  const [assigneeIds,  setAssigneeIds]  = useState<string[]>(
    task?.assignedTo?.id ? [task.assignedTo.id] : []
  );
  const [deadline,     setDeadline]     = useState(isoToDateInput(task?.deadline));
  const [scheduleId,   setScheduleId]   = useState(task?.schedule?.id ?? "");
  const [status,       setStatus]       = useState<TaskStatus>(task?.status ?? TaskStatus.TODO);
  const [errorMsg,     setErrorMsg]     = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setTitle(task?.title ?? "");
    setDescription(task?.description ?? "");
    setAssigneeIds(task?.assignedTo?.id ? [task.assignedTo.id] : []);
    setDeadline(isoToDateInput(task?.deadline));
    setScheduleId(task?.schedule?.id ?? "");
    setStatus(task?.status ?? TaskStatus.TODO);
    setErrorMsg(null);
  }, [task]);

  const { data: members = [] } = useQuery({
    queryKey: ["members", "all-active"],
    queryFn: async () => {
      const res = await membersApi.list();
      return (res.data ?? []).filter((m: User) => m.isActive);
    },
  });

  const today = new Date();
  const { data: schedules = [] } = useQuery({
    queryKey: ["schedules", "linkable", today.getFullYear(), today.getMonth()+1],
    queryFn: async () => (await schedulesApi.list({ year: today.getFullYear(), month: today.getMonth()+1 })).data ?? [],
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateTaskInput }) => tasksApi.update(id, body),
    onSuccess: (res) => {
      if (!res.success) { setErrorMsg(res.error ?? "수정 실패"); return; }
      qc.invalidateQueries({ queryKey: ["tasks"] });
      onClose();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => tasksApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tasks"] }); onClose(); },
  });

  // 담당자 토글
  function toggleAssignee(id: string) {
    setAssigneeIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }
  function toggleAll() {
    if (assigneeIds.length === members.length) {
      setAssigneeIds([]);
    } else {
      setAssigneeIds(members.map((m: User) => m.id));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    if (!title.trim()) { setErrorMsg("업무 제목을 입력해주세요."); return; }
    if (!isEdit && assigneeIds.length === 0) { setErrorMsg("담당자를 한 명 이상 선택해주세요."); return; }

    const isoDeadline = dateInputToIso(deadline);
    setIsSubmitting(true);

    try {
      if (isEdit && task) {
        // 수정: 단일 담당자
        const body: UpdateTaskInput = {
          title: title.trim(),
          description: description.trim() || undefined,
          assignedToId: assigneeIds[0],
          status,
          deadline: isoDeadline,
          scheduleId: scheduleId || undefined,
        };
        updateMutation.mutate({ id: task.id, body });
      } else {
        // 생성: 선택된 담당자마다 개별 Task 생성
        const results = await Promise.all(
          assigneeIds.map((aid) =>
            tasksApi.create({
              title: title.trim(),
              description: description.trim() || undefined,
              assignedToId: aid,
              deadline: isoDeadline,
              scheduleId: scheduleId || undefined,
            } as CreateTaskInput)
          )
        );
        const failed = results.find((r) => !r.success);
        if (failed) { setErrorMsg(failed.error ?? "일부 업무 생성 실패"); setIsSubmitting(false); return; }
        qc.invalidateQueries({ queryKey: ["tasks"] });
        onClose();
      }
    } catch {
      setErrorMsg("업무 처리 중 오류가 발생했습니다.");
      setIsSubmitting(false);
    }
  }

  const allSelected = members.length > 0 && assigneeIds.length === members.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#F2F4F6]">
          <h3 className="text-base font-bold text-[#191F28]">{isEdit ? "업무 수정" : "업무 배분"}</h3>
          <button onClick={onClose} className="text-[#8B95A1] hover:text-[#4E5968]">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {errorMsg && (
            <div className="text-sm px-3 py-2 rounded-xl bg-red-50 border border-red-100 text-red-600">{errorMsg}</div>
          )}

          {/* 제목 */}
          <div>
            <label className="block text-sm font-medium text-[#191F28] mb-1">제목 <span className="text-red-500">*</span></label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200}
              className="w-full px-3 py-2.5 border border-[#E5E8EB] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#3182F6]"
              placeholder="예: 주일 예배 음향 점검" />
          </div>

          {/* 담당자 (신규: 복수 선택, 수정: 단수) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-[#191F28]">
                담당자 <span className="text-red-500">*</span>
                {!isEdit && assigneeIds.length > 0 && (
                  <span className="ml-1.5 text-xs text-[#3182F6] font-normal">{assigneeIds.length}명 선택됨</span>
                )}
              </label>
              {!isEdit && (
                <button type="button" onClick={toggleAll}
                  className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors ${
                    allSelected
                      ? "bg-[#3182F6] text-white"
                      : "bg-[#F7F8FA] text-[#4E5968] hover:bg-[#EBF2FE] hover:text-[#3182F6]"
                  }`}>
                  {allSelected ? "전체 해제" : "전체 선택"}
                </button>
              )}
            </div>

            {isEdit ? (
              // 수정 모드: 단일 select
              <select value={assigneeIds[0] ?? ""} onChange={(e) => setAssigneeIds([e.target.value])}
                className="w-full px-3 py-2.5 border border-[#E5E8EB] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#3182F6] bg-white">
                <option value="">담당자 선택</option>
                {members.map((m: User) => (
                  <option key={m.id} value={m.id}>{m.name}{m.team ? ` (${m.team})` : ""}</option>
                ))}
              </select>
            ) : (
              // 신규 배분: 체크박스 목록
              <div className="border border-[#E5E8EB] rounded-xl overflow-hidden">
                {members.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-[#8B95A1]">등록된 사역자가 없습니다.</div>
                ) : (
                  members.map((m: User, i: number) => {
                    const checked = assigneeIds.includes(m.id);
                    return (
                      <label key={m.id}
                        className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${
                          i > 0 ? "border-t border-[#F2F4F6]" : ""
                        } ${checked ? "bg-[#EBF2FE]" : "hover:bg-[#F7F8FA]"}`}>
                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                          checked ? "bg-[#3182F6] border-[#3182F6]" : "border-[#D1D6DB]"
                        }`}>
                          {checked && (
                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <input type="checkbox" className="sr-only" checked={checked} onChange={() => toggleAssignee(m.id)} />
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium text-[#191F28]">{m.name}</span>
                          {m.team && <span className="ml-1.5 text-xs text-[#8B95A1]">{m.team}</span>}
                        </div>
                      </label>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* 마감일 / 상태 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-[#191F28] mb-1">마감일</label>
              <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)}
                className="w-full px-3 py-2.5 border border-[#E5E8EB] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#3182F6]" />
            </div>
            {isEdit && (
              <div>
                <label className="block text-sm font-medium text-[#191F28] mb-1">상태</label>
                <select value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)}
                  className="w-full px-3 py-2.5 border border-[#E5E8EB] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#3182F6] bg-white">
                  {(Object.keys(TASK_STATUS_LABELS) as TaskStatus[]).map((s) => (
                    <option key={s} value={s}>{TASK_STATUS_LABELS[s]}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* 연결 일정 */}
          <div>
            <label className="block text-sm font-medium text-[#191F28] mb-1">
              연결 일정 <span className="text-[#8B95A1] text-xs font-normal">(선택)</span>
            </label>
            <select value={scheduleId} onChange={(e) => setScheduleId(e.target.value)}
              className="w-full px-3 py-2.5 border border-[#E5E8EB] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#3182F6] bg-white">
              <option value="">연결 안 함</option>
              {schedules.map((s: Schedule) => (
                <option key={s.id} value={s.id}>{s.date} · {s.title}</option>
              ))}
            </select>
          </div>

          {/* 설명 */}
          <div>
            <label className="block text-sm font-medium text-[#191F28] mb-1">설명</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
              className="w-full px-3 py-2.5 border border-[#E5E8EB] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#3182F6] resize-none"
              placeholder="추가 안내 사항" />
          </div>

          {/* 버튼 */}
          <div className="flex gap-2 pt-1">
            {isEdit && (
              <button type="button" onClick={() => { if (confirm("삭제하시겠습니까?")) deleteMutation.mutate(task!.id); }}
                disabled={isSubmitting}
                className="px-3 py-2.5 text-sm text-red-500 border border-red-100 rounded-xl hover:bg-red-50 disabled:opacity-50">
                삭제
              </button>
            )}
            <div className="flex-1" />
            <button type="button" onClick={onClose} disabled={isSubmitting}
              className="px-4 py-2.5 text-sm text-[#4E5968] border border-[#E5E8EB] rounded-xl hover:bg-[#F7F8FA] disabled:opacity-50">
              취소
            </button>
            <button type="submit" disabled={isSubmitting}
              className="px-4 py-2.5 text-sm font-semibold bg-[#3182F6] text-white rounded-xl hover:bg-[#1B64DA] disabled:opacity-50">
              {isSubmitting ? "처리 중..." : isEdit ? "저장" : `배분${!isEdit && assigneeIds.length > 1 ? ` (${assigneeIds.length}명)` : ""}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
