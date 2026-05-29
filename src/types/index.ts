export const Role = {
  PASTOR:   "PASTOR",   // 목사
  TRAINEE:  "TRAINEE",  // 수련목회자
  FULLTIME: "FULLTIME", // 풀타임전도사
  PARTTIME: "PARTTIME", // 파트타임전도사
  ADMIN:    "ADMIN",    // 관리자(시스템)
} as const;
export type Role = typeof Role[keyof typeof Role];

// 부서 카테고리 (이전 ScheduleType 대체)
export const ScheduleType = {
  INFANT: "INFANT",   // 더드림 영아부
  KINDER: "KINDER",   // 더드림 유치부
  ELEM1:  "ELEM1",    // 두드림 유년부
  ELEM2:  "ELEM2",    // 두드림 초등부
  ELEM3:  "ELEM3",    // 두드림 소년부
  YOUTH:  "YOUTH",    // 업드림 청소년부
  MAIN:   "MAIN",     // 본교회
} as const;
export type ScheduleType = typeof ScheduleType[keyof typeof ScheduleType];

export const TaskStatus = { TODO: "TODO", IN_PROGRESS: "IN_PROGRESS", DONE: "DONE" } as const;
export type TaskStatus = typeof TaskStatus[keyof typeof TaskStatus];

export const ROLE_RANK: Record<Role, number> = {
  [Role.PARTTIME]: 0,
  [Role.FULLTIME]: 1,
  [Role.TRAINEE]:  2,
  [Role.PASTOR]:   3,
  [Role.ADMIN]:    4,
};

// 화면 표시 순서 (목사 → 수련목회자 → 풀타임 → 파트타임)
export const ROLE_ORDER: Role[] = ["PASTOR", "TRAINEE", "FULLTIME", "PARTTIME"];

export function hasMinRole(userRole: Role | string, required: Role | string): boolean {
  return (ROLE_RANK[userRole as Role] ?? -1) >= (ROLE_RANK[required as Role] ?? 0);
}

export const ROLE_LABELS: Record<Role, string> = {
  [Role.PASTOR]:   "목사",
  [Role.TRAINEE]:  "수련목회자",
  [Role.FULLTIME]: "풀타임전도사",
  [Role.PARTTIME]: "파트타임전도사",
  [Role.ADMIN]:    "관리자",
};

export const SCHEDULE_TYPE_LABELS: Record<ScheduleType, string> = {
  [ScheduleType.INFANT]: "더드림 영아부",
  [ScheduleType.KINDER]: "더드림 유치부",
  [ScheduleType.ELEM1]:  "두드림 유년부",
  [ScheduleType.ELEM2]:  "두드림 초등부",
  [ScheduleType.ELEM3]:  "두드림 소년부",
  [ScheduleType.YOUTH]:  "업드림 청소년부",
  [ScheduleType.MAIN]:   "본교회",
};

// 카테고리별 배경·텍스트·테두리 색상 (뱃지용)
export const SCHEDULE_TYPE_COLORS: Record<ScheduleType, string> = {
  [ScheduleType.INFANT]: "bg-rose-100   text-rose-800   border-rose-300",
  [ScheduleType.KINDER]: "bg-orange-100 text-orange-800 border-orange-300",
  [ScheduleType.ELEM1]:  "bg-amber-100  text-amber-800  border-amber-300",
  [ScheduleType.ELEM2]:  "bg-green-100  text-green-800  border-green-300",
  [ScheduleType.ELEM3]:  "bg-teal-100   text-teal-800   border-teal-300",
  [ScheduleType.YOUTH]:  "bg-blue-100   text-blue-800   border-blue-300",
  [ScheduleType.MAIN]:   "bg-violet-100 text-violet-800 border-violet-300",
};

// 카드 상단 컬러 바용 (Tailwind JIT 퍼지 방지를 위해 명시적 클래스)
export const SCHEDULE_TYPE_BAR: Record<ScheduleType, string> = {
  [ScheduleType.INFANT]: "bg-rose-400",
  [ScheduleType.KINDER]: "bg-orange-400",
  [ScheduleType.ELEM1]:  "bg-amber-400",
  [ScheduleType.ELEM2]:  "bg-green-400",
  [ScheduleType.ELEM3]:  "bg-teal-400",
  [ScheduleType.YOUTH]:  "bg-blue-400",
  [ScheduleType.MAIN]:   "bg-violet-400",
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  [TaskStatus.TODO]:        "할 일",
  [TaskStatus.IN_PROGRESS]: "진행 중",
  [TaskStatus.DONE]:        "완료",
};

export const TASK_STATUS_COLORS: Record<TaskStatus, string> = {
  [TaskStatus.TODO]:        "bg-slate-100 text-slate-700",
  [TaskStatus.IN_PROGRESS]: "bg-amber-100 text-amber-700",
  [TaskStatus.DONE]:        "bg-emerald-100 text-emerald-700",
};

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  team: string | null;
  phone: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface Schedule {
  id: string;
  title: string;
  type: ScheduleType;
  date: string;       // YYYY-MM-DD (시작일)
  endDate?: string | null; // YYYY-MM-DD (종료일, 없으면 하루)
  startTime: string | null;
  endTime: string | null;
  location: string | null;
  description: string | null;
  createdById: string;
  createdBy?: { id: string; name: string };
  tasks?: Task[];
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  deadline: string | null;
  assignedTo: { id: string; name: string };
  assignedBy: { id: string; name: string };
  schedule: { id: string; title: string; date: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface Notification {
  id: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error: string | null;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[] | null;
  error: string | null;
  meta: { total: number; page: number; limit: number };
}

export interface GetSchedulesParams {
  year?: number;
  month?: number;
  type?: ScheduleType;
}

export interface GetTasksParams {
  status?: TaskStatus;
  mine?: boolean;
  scheduleId?: string;
}

export interface GetMembersParams {
  role?: Role;
  team?: string;
}

export interface CreateScheduleInput {
  title: string;
  type: ScheduleType;
  date: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  location?: string;
  description?: string;
}

export interface UpdateScheduleInput extends Partial<CreateScheduleInput> {}

export interface CreateTaskInput {
  title: string;
  description?: string;
  assignedToId: string;
  deadline?: string;
  scheduleId?: string;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  status?: TaskStatus;
  assignedToId?: string;
  deadline?: string;
  scheduleId?: string;
}

export interface CreateMemberInput {
  name: string;
  email: string;
  password: string;
  role: Role;
  team?: string;
  phone?: string;
}

export interface UpdateMemberInput {
  name?: string;
  phone?: string;
  role?: Role;
  team?: string;
  isActive?: boolean;
}
