"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { tasksApi } from "@/lib/api";
import {
  Task,
  TaskStatus,
  TASK_STATUS_LABELS,
  hasMinRole,
  Role,
} from "@/types";
import { useSession } from "next-auth/react";
import TaskFormModal from "@/components/TaskFormModal";

type Tab = "mine" | "team";

const STATUS_COLUMNS: TaskStatus[] = ["TODO", "IN_PROGRESS", "DONE"];

const STATUS_COLUMN_COLOR: Record<TaskStatus, string> = {
  TODO: "bg-gray-50 border-[#E5E8EB]",
  IN_PROGRESS: "bg-[#EBF2FE] border-blue-200",
  DONE: "bg-green-50 border-green-200",
};

const STATUS_HEADER_COLOR: Record<TaskStatus, string> = {
  TODO: "text-gray-600",
  IN_PROGRESS: "text-[#3182F6]",
  DONE: "text-green-600",
};

function isOverdue(task: Task): boolean {
  if (!task.deadline || task.status === "DONE") return false;
  return new Date(task.deadline) < new Date(new Date().toDateString());
}

function StatusSelect({
  task,
  onChange,
}: {
  task: Task;
  onChange: (status: TaskStatus) => void;
}) {
  return (
    <select
      value={task.status}
      onChange={(e) => onChange(e.target.value as TaskStatus)}
      onClick={(e) => e.stopPropagation()}
      className="text-xs border-0 bg-transparent text-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-400 rounded cursor-pointer"
    >
      {(Object.keys(TASK_STATUS_LABELS) as TaskStatus[]).map((s) => (
        <option key={s} value={s}>
          {TASK_STATUS_LABELS[s]}
        </option>
      ))}
    </select>
  );
}

function TaskCard({
  task,
  canEdit,
  onStatusChange,
  onEdit,
}: {
  task: Task;
  canEdit: boolean;
  onStatusChange: (id: string, status: TaskStatus) => void;
  onEdit: (task: Task) => void;
}) {
  const overdue = isOverdue(task);

  return (
    <div
      className={`bg-white rounded-xl border p-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer ${
        overdue ? "border-red-300 bg-red-50/30" : "border-[#E5E8EB]"
      }`}
      onClick={() => canEdit && onEdit(task)}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className={`text-sm font-medium leading-snug ${overdue ? "text-red-800" : "text-gray-800"}`}>
          {task.title}
        </p>
        {overdue && (
          <span className="flex-shrink-0 text-xs px-1.5 py-0.5 bg-red-100 text-red-600 rounded-full">
            기한초과
          </span>
        )}
      </div>

      {task.description && (
        <p className="text-xs text-gray-500 mb-2 line-clamp-2">{task.description}</p>
      )}

      <div className="flex items-center justify-between flex-wrap gap-1">
        <div className="flex items-center gap-2">
          {task.assignedTo && (
            <span className="text-xs text-gray-400">{task.assignedTo.name}</span>
          )}
          {task.deadline && (
            <span className={`text-xs ${overdue ? "text-red-500" : "text-gray-400"}`}>
              ~{task.deadline}
            </span>
          )}
        </div>
        <StatusSelect
          task={task}
          onChange={(status) => onStatusChange(task.id, status)}
        />
      </div>
    </div>
  );
}

export default function TasksPage() {
  const [tab, setTab] = useState<Tab>("mine");
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<Task | null>(null);

  const { data: session } = useSession();
  const userRole = session?.user?.role as Role | undefined;
  const currentUserId = session?.user?.id as string | undefined;
  const canCreate = userRole ? hasMinRole(userRole, "DEACON") : false;
  const canViewTeam = userRole ? hasMinRole(userRole, "DEACON") : false;

  const qc = useQueryClient();

  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks", tab],
    queryFn: async () => {
      const res = await tasksApi.list(tab === "mine" ? { mine: true } : {});
      return res.data ?? [];
    },
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: TaskStatus }) =>
      tasksApi.update(id, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });

  function tasksByStatus(status: TaskStatus): Task[] {
    return tasks.filter((t) => t.status === status);
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit">
          <button
            onClick={() => setTab("mine")}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
              tab === "mine"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            내 업무
          </button>
          {canViewTeam && (
            <button
              onClick={() => setTab("team")}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                tab === "team"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              팀 업무
            </button>
          )}
        </div>

        {canCreate && (
          <button
            onClick={() => { setEditTarget(null); setShowForm(true); }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#3182F6] text-white rounded-xl text-sm font-medium hover:bg-[#1B64DA] transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            업무 추가
          </button>
        )}
      </div>

      {/* Kanban board */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {STATUS_COLUMNS.map((status) => {
          const columnTasks = tasksByStatus(status);
          return (
            <div
              key={status}
              className={`rounded-xl border p-3 ${STATUS_COLUMN_COLOR[status]}`}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className={`text-sm font-semibold ${STATUS_HEADER_COLOR[status]}`}>
                  {TASK_STATUS_LABELS[status]}
                </h3>
                <span className="text-xs bg-white border border-[#E5E8EB] text-gray-500 rounded-full px-2 py-0.5">
                  {columnTasks.length}
                </span>
              </div>

              <div className="space-y-2">
                {columnTasks.length === 0 ? (
                  <div className="py-6 text-center text-xs text-gray-400">
                    업무 없음
                  </div>
                ) : (
                  columnTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      canEdit={canCreate || task.assignedTo?.id === currentUserId}
                      onStatusChange={(id, status) =>
                        updateStatus.mutate({ id, status })
                      }
                      onEdit={(t) => { setEditTarget(t); setShowForm(true); }}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {showForm && (
        <TaskFormModal
          task={editTarget ?? undefined}
          onClose={() => { setShowForm(false); setEditTarget(null); }}
        />
      )}
    </div>
  );
}
