"use client";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Layout from "@/components/Layout";
import TaskFormModal from "@/components/TaskFormModal";
import {
  Task, User, Role,
  TaskStatus, TASK_STATUS_LABELS, TASK_STATUS_COLORS,
  ROLE_LABELS, hasMinRole,
} from "@/types";
import { tasksApi, membersApi } from "@/lib/api";

function toYMD(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

const STATUS_DOT: Record<TaskStatus, string> = {
  IN_PROGRESS: "bg-amber-400",
  TODO:        "bg-gray-300",
  REVIEW:      "bg-indigo-400",
  DONE:        "bg-emerald-400",
};
const STATUS_BADGE: Record<TaskStatus, string> = {
  IN_PROGRESS: "bg-amber-100 text-amber-700 border-amber-200",
  TODO:        "bg-gray-100  text-gray-600  border-[#E5E8EB]",
  REVIEW:      "bg-indigo-100 text-indigo-700 border-indigo-200",
  DONE:        "bg-emerald-100 text-emerald-700 border-emerald-200",
};

function isOverdue(t: Task) {
  return !!t.deadline && t.status !== "DONE" && new Date(t.deadline) < new Date();
}

export default function TasksPage() {
  const { data: session, status } = useSession();
  const qc = useQueryClient();

  // ── Hooks (조건부 return 이전에 모두 선언) ──────────────────────────────────
  const [showForm,    setShowForm]    = useState(false);
  const [editTask,    setEditTask]    = useState<Task | null>(null);
  const [filterStatus, setFilterStatus] = useState<TaskStatus | "">("");
  const [search,      setSearch]      = useState("");

  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks-all"],
    queryFn: async () => (await tasksApi.list({})).data as Task[] ?? [],
    enabled: !!session,
  });
  const { data: members = [] } = useQuery({
    queryKey: ["members"],
    queryFn: async () => (await membersApi.list({})).data as User[] ?? [],
    enabled: !!session,
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, s }: { id: string; s: TaskStatus }) => tasksApi.update(id, { status: s }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks-all"] }),
  });

  const VALID_ROLES = ["PASTOR", "TRAINEE", "FULLTIME", "PARTTIME", "ADMIN"];

  // ── 조건부 return ────────────────────────────────────────────────────────────
  if (status === "loading") return <div className="min-h-screen flex items-center justify-center text-gray-500">로딩 중...</div>;
  if (!session) redirect("/login");

  const userRole    = session.user?.role as Role | undefined;
  const currentUserId = session.user?.id as string | undefined;
  const canManageAll = userRole ? hasMinRole(userRole, "PASTOR") : false;
  const todayYMD    = toYMD(new Date());

  const activeMembers = members.filter((m) => m.isActive && VALID_ROLES.includes(m.role));
  const tasksByMember = (memberId: string) =>
    tasks.filter((t) =>
      t.assignedTo.id === memberId &&
      (!filterStatus || t.status === filterStatus) &&
      (!search || t.title.includes(search) || t.assignedTo.name.includes(search))
    ).sort((a, b) => {
      const order: Record<TaskStatus, number> = { IN_PROGRESS: 0, REVIEW: 1, TODO: 2, DONE: 3 };
      return order[a.status as TaskStatus] - order[b.status as TaskStatus];
    });

  const totalByStatus = (s: TaskStatus) => tasks.filter((t) => t.status === s).length;
  const overdueCount  = tasks.filter(isOverdue).length;

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-6">

        {/* 헤더 */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-gray-900">업무 현황</h1>
            <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
              <span>전체 {tasks.length}건</span>
              <span className="text-amber-600 font-medium">진행중 {totalByStatus("IN_PROGRESS")}</span>
              <span>할일 {totalByStatus("TODO")}</span>
              <span className="text-emerald-600">완료 {totalByStatus("DONE")}</span>
              {overdueCount > 0 && <span className="text-red-500 font-semibold">⚠ 지연 {overdueCount}</span>}
            </div>
          </div>
          {canManageAll && (
            <button onClick={() => { setEditTask(null); setShowForm(true); }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#3182F6] text-white rounded-lg text-sm font-medium hover:bg-[#1B64DA]">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
              업무 추가
            </button>
          )}
        </div>

        {/* 필터/검색 */}
        <div className="flex flex-wrap gap-2 items-center">
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="업무명·사역자 검색"
            className="border border-[#E5E8EB] rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#3182F6] w-44" />
          <button onClick={() => setFilterStatus("")}
            className={`px-3 py-1 rounded-full text-xs font-medium border ${filterStatus==="" ? "bg-gray-800 text-white border-gray-800" : "bg-white text-gray-600 border-[#E5E8EB]"}`}>
            전체
          </button>
          {(["IN_PROGRESS","REVIEW","TODO","DONE"] as TaskStatus[]).map((s) => (
            <button key={s} onClick={() => setFilterStatus(filterStatus===s ? "" : s)}
              className={`px-3 py-1 rounded-full text-xs font-medium border ${filterStatus===s ? STATUS_BADGE[s] : "bg-white text-gray-600 border-[#E5E8EB]"}`}>
              {TASK_STATUS_LABELS[s]} ({totalByStatus(s)})
            </button>
          ))}
        </div>

        {/* 사역자 카드 그리드 */}
        {activeMembers.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#E5E8EB] p-12 text-center text-sm text-gray-400">
            등록된 사역자가 없습니다.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {activeMembers.map((member) => {
              const memberTasks = tasksByMember(member.id);
              const inProg = memberTasks.filter((t) => t.status === "IN_PROGRESS");
              const todo   = memberTasks.filter((t) => t.status === "TODO");
              const done   = memberTasks.filter((t) => t.status === "DONE");
              if (memberTasks.length === 0 && (filterStatus || search)) return null;

              return (
                <div key={member.id} className="bg-white rounded-2xl border border-[#E5E8EB] overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                  {/* 멤버 헤더 */}
                  <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border-b border-[#F2F4F6]">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center flex-shrink-0 shadow-sm">
                      <span className="text-sm font-bold text-white">{member.name.charAt(0)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm text-gray-900">{member.name}</div>
                      <div className="text-xs text-gray-400 truncate">
                        {ROLE_LABELS[member.role as Role]}{member.team ? ` · ${member.team}` : ""}
                      </div>
                    </div>
                    <div className="flex gap-1.5 flex-shrink-0">
                      {inProg.length > 0 && <span className="text-xs px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-full font-medium">{inProg.length}</span>}
                      {todo.length  > 0 && <span className="text-xs px-1.5 py-0.5 bg-gray-100  text-gray-600  rounded-full font-medium">{todo.length}</span>}
                      {done.length  > 0 && <span className="text-xs px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded-full font-medium">✓{done.length}</span>}
                    </div>
                  </div>

                  {/* 업무 목록 */}
                  <div className="divide-y divide-gray-50">
                    {memberTasks.length === 0 && (
                      <div className="px-4 py-5 text-center text-xs text-gray-300">진행 중인 업무 없음</div>
                    )}
                    {memberTasks.map((t) => {
                      const overdue = isOverdue(t);
                      const deadlineStr = t.deadline
                        ? (t.deadline.slice(0,10) === todayYMD ? "오늘 마감" : t.deadline.slice(5,10))
                        : null;
                      return (
                        <div key={t.id} className="px-4 py-3 flex items-start gap-2.5 group hover:bg-gray-50 transition-colors">
                          {/* 상태 표시 점 */}
                          <div className={`mt-1.5 w-3 h-3 rounded-full flex-shrink-0 ${
                            t.status === "DONE"
                              ? "bg-emerald-400"
                              : t.status === "IN_PROGRESS"
                              ? "bg-amber-400"
                              : t.status === "REVIEW"
                              ? "bg-indigo-400"
                              : "bg-gray-300"
                          }`} />
                          {/* 업무 내용 */}
                          <div className="flex-1 min-w-0">
                            <div className={`text-sm font-medium truncate ${t.status === "DONE" ? "line-through text-gray-400" : "text-gray-800"}`}>
                              {t.title}
                            </div>
                            {t.description && (
                              <div className="text-xs text-gray-400 truncate mt-0.5">{t.description}</div>
                            )}
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              {/* 상태 선택: 본인 담당 또는 관리자만 변경 가능 */}
                              {(canManageAll || t.assignedTo.id === currentUserId) ? (
                                <select
                                  value={t.status}
                                  onChange={(e) => updateStatus.mutate({ id: t.id, s: e.target.value as TaskStatus })}
                                  className={`text-xs px-1.5 py-0.5 rounded border font-medium cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-400 ${STATUS_BADGE[t.status as TaskStatus]}`}
                                >
                                  {(Object.keys(TASK_STATUS_LABELS) as TaskStatus[]).map((s) => (
                                    <option key={s} value={s}>{TASK_STATUS_LABELS[s]}</option>
                                  ))}
                                </select>
                              ) : (
                                <span className={`text-xs px-1.5 py-0.5 rounded border font-medium ${STATUS_BADGE[t.status as TaskStatus]}`}>
                                  {TASK_STATUS_LABELS[t.status as TaskStatus]}
                                </span>
                              )}
                              {deadlineStr && (
                                <span className={`text-xs flex items-center gap-0.5 ${
                                  overdue ? "text-red-500 font-semibold" :
                                  deadlineStr === "오늘 마감" ? "text-orange-500 font-medium" : "text-gray-400"
                                }`}>
                                  {overdue && "⚠ "}{deadlineStr}
                                </span>
                              )}
                              {t.schedule && (
                                <span className="text-xs text-blue-400 truncate max-w-[80px]">
                                  📅 {t.schedule.title}
                                </span>
                              )}
                            </div>
                          </div>
                          {/* 수정 버튼: 관리자 또는 본인 담당 업무만 */}
                          {canManageAll && (
                            <button
                              onClick={() => { setEditTask(t); setShowForm(true); }}
                              className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-gray-600 flex-shrink-0 mt-0.5"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* 하단: 관리자만 타인에게 업무 추가 가능 */}
                  {canManageAll && (
                    <div className="px-4 py-2 border-t border-gray-50 bg-gray-50/50">
                      <button
                        onClick={() => { setEditTask(null); setShowForm(true); }}
                        className="text-xs text-gray-400 hover:text-[#3182F6] transition-colors"
                      >
                        + {member.name}에게 업무 추가
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {showForm && (
          <TaskFormModal
            task={editTask ?? undefined}
            onClose={() => { setShowForm(false); setEditTask(null); }}
          />
        )}
      </div>
    </Layout>
  );
}
