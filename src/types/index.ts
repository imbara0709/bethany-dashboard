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
  INFANT:      "INFANT",      // 더드림 영아부
  KINDER:      "KINDER",      // 더드림 유치부
  ELEM1:       "ELEM1",       // 두드림 유년부
  ELEM2:       "ELEM2",       // 두드림 초등부
  ELEM3:       "ELEM3",       // 두드림 소년부
  YOUTH:       "YOUTH",       // 업드림 청소년부
  EDU:         "EDU",         // 교육부
  BABY:        "BABY",        // 아기학교
  WORSHIP_EDU: "WORSHIP_EDU", // 찬양교육
  MAIN:        "MAIN",        // 본교회
} as const;
export type ScheduleType = typeof ScheduleType[keyof typeof ScheduleType];

export const TaskStatus = {
  TODO:        "TODO",
  IN_PROGRESS: "IN_PROGRESS",
  REVIEW:      "REVIEW",
  DONE:        "DONE",
} as const;
export type TaskStatus = typeof TaskStatus[keyof typeof TaskStatus];

// 요청(Request) 상태
export const RequestStatus = {
  PENDING:     "PENDING",
  ACCEPTED:    "ACCEPTED",
  IN_PROGRESS: "IN_PROGRESS",
  REVIEW:      "REVIEW",
  DONE:        "DONE",
  HOLD:        "HOLD",
  REJECTED:    "REJECTED",
} as const;
export type RequestStatus = typeof RequestStatus[keyof typeof RequestStatus];

// 요청 우선순위
export const RequestPriority = {
  LOW:    "LOW",
  MEDIUM: "MEDIUM",
  HIGH:   "HIGH",
} as const;
export type RequestPriority = typeof RequestPriority[keyof typeof RequestPriority];

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
  [ScheduleType.INFANT]:      "더드림 영아부",
  [ScheduleType.KINDER]:      "더드림 유치부",
  [ScheduleType.ELEM1]:       "두드림 유년부",
  [ScheduleType.ELEM2]:       "두드림 초등부",
  [ScheduleType.ELEM3]:       "두드림 소년부",
  [ScheduleType.YOUTH]:       "업드림 청소년부",
  [ScheduleType.EDU]:         "교육부",
  [ScheduleType.BABY]:        "아기학교",
  [ScheduleType.WORSHIP_EDU]: "찬양교육",
  [ScheduleType.MAIN]:        "본교회",
};

export const LOCATION_LIST: string[] = [
  "가나홀",
  "영아예배실",
  "생명 (구 무지개1실)",
  "위로 (구 무지개2실)",
  "소망 (구 무지개3실)",
  "헌신 (구 무지개4실)",
  "축복 (구 무지개5실)",
  "최후승리실 (구 무지개6실)",
  "소그룹1실",
  "소그룹2실",
  "소그룹3실",
  "소그룹4실",
  "소그룹5실",
  "소그룹6실",
  "소그룹7실",
  "소그룹8실",
  "도서관 열 소그룹실",
  "드림온실",
];

// 카테고리별 배경·텍스트·테두리 색상 (뱃지용)
export const SCHEDULE_TYPE_COLORS: Record<ScheduleType, string> = {
  [ScheduleType.INFANT]:      "bg-rose-100   text-rose-800   border-rose-300",
  [ScheduleType.KINDER]:      "bg-orange-100 text-orange-800 border-orange-300",
  [ScheduleType.ELEM1]:       "bg-amber-100  text-amber-800  border-amber-300",
  [ScheduleType.ELEM2]:       "bg-green-100  text-green-800  border-green-300",
  [ScheduleType.ELEM3]:       "bg-teal-100   text-teal-800   border-teal-300",
  [ScheduleType.YOUTH]:       "bg-blue-100   text-blue-800   border-blue-300",
  [ScheduleType.EDU]:         "bg-cyan-100   text-cyan-800   border-cyan-300",
  [ScheduleType.BABY]:        "bg-pink-100   text-pink-800   border-pink-300",
  [ScheduleType.WORSHIP_EDU]: "bg-indigo-100 text-indigo-800 border-indigo-300",
  [ScheduleType.MAIN]:        "bg-violet-100 text-violet-800 border-violet-300",
};

// 카드 상단 컬러 바용 (Tailwind JIT 퍼지 방지를 위해 명시적 클래스)
export const SCHEDULE_TYPE_BAR: Record<ScheduleType, string> = {
  [ScheduleType.INFANT]:      "bg-rose-400",
  [ScheduleType.KINDER]:      "bg-orange-400",
  [ScheduleType.ELEM1]:       "bg-amber-400",
  [ScheduleType.ELEM2]:       "bg-green-400",
  [ScheduleType.ELEM3]:       "bg-teal-400",
  [ScheduleType.YOUTH]:       "bg-blue-400",
  [ScheduleType.EDU]:         "bg-cyan-400",
  [ScheduleType.BABY]:        "bg-pink-400",
  [ScheduleType.WORSHIP_EDU]: "bg-indigo-400",
  [ScheduleType.MAIN]:        "bg-violet-400",
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  [TaskStatus.TODO]:        "할 일",
  [TaskStatus.IN_PROGRESS]: "진행 중",
  [TaskStatus.REVIEW]:      "확인 필요",
  [TaskStatus.DONE]:        "완료",
};

export const TASK_STATUS_COLORS: Record<TaskStatus, string> = {
  [TaskStatus.TODO]:        "bg-slate-100 text-slate-700",
  [TaskStatus.IN_PROGRESS]: "bg-amber-100 text-amber-700",
  [TaskStatus.REVIEW]:      "bg-indigo-100 text-indigo-700",
  [TaskStatus.DONE]:        "bg-emerald-100 text-emerald-700",
};

// 요청 상태 라벨
export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  [RequestStatus.PENDING]:     "대기중",
  [RequestStatus.ACCEPTED]:    "수락됨",
  [RequestStatus.IN_PROGRESS]: "진행중",
  [RequestStatus.REVIEW]:      "확인 필요",
  [RequestStatus.DONE]:        "완료",
  [RequestStatus.HOLD]:        "보류",
  [RequestStatus.REJECTED]:    "거절됨",
};

export const REQUEST_STATUS_COLORS: Record<RequestStatus, string> = {
  [RequestStatus.PENDING]:     "bg-amber-50 text-amber-700 border-amber-200",
  [RequestStatus.ACCEPTED]:    "bg-blue-50 text-blue-700 border-blue-200",
  [RequestStatus.IN_PROGRESS]: "bg-sky-50 text-sky-700 border-sky-200",
  [RequestStatus.REVIEW]:      "bg-indigo-50 text-indigo-700 border-indigo-200",
  [RequestStatus.DONE]:        "bg-emerald-50 text-emerald-700 border-emerald-200",
  [RequestStatus.HOLD]:        "bg-slate-100 text-slate-600 border-slate-200",
  [RequestStatus.REJECTED]:    "bg-rose-50 text-rose-700 border-rose-200",
};

export const REQUEST_PRIORITY_LABELS: Record<RequestPriority, string> = {
  [RequestPriority.LOW]:    "낮음",
  [RequestPriority.MEDIUM]: "보통",
  [RequestPriority.HIGH]:   "높음",
};

export const REQUEST_PRIORITY_COLORS: Record<RequestPriority, string> = {
  [RequestPriority.LOW]:    "bg-slate-50 text-slate-600 border-slate-200",
  [RequestPriority.MEDIUM]: "bg-blue-50 text-blue-700 border-blue-200",
  [RequestPriority.HIGH]:   "bg-rose-50 text-rose-700 border-rose-200",
};

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  team: string | null;
  phone: string | null;
  avatar: string | null;
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
  requestId: string | null;
  request?: { id: string; title: string } | null;
  createdAt: string;
  updatedAt: string;
}

export type RequestActivityAction =
  | "CREATED"
  | "ACCEPTED"
  | "HELD"
  | "REJECTED"
  | "STATUS_CHANGED"
  | "ASSIGNEE_CHANGED"
  | "DEADLINE_CHANGED"
  | "PRIORITY_CHANGED"
  | "COMMENTED"
  | "TASK_CREATED"
  | "SCHEDULE_CREATED"
  | "COMPLETED";

export interface RequestActivity {
  id: string;
  requestId: string;
  actorId: string;
  actor: { id: string; name: string };
  action: RequestActivityAction;
  detail: string | null;
  createdAt: string;
}

export interface RequestSummary {
  id: string;
  title: string;
  description: string | null;
  status: RequestStatus;
  priority: RequestPriority;
  department: ScheduleType | null;
  deadline: string | null;
  requester: { id: string; name: string; role?: Role };
  assignee:  { id: string; name: string; role?: Role };
  schedule: { id: string; title: string; date: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface RequestDetail extends RequestSummary {
  tasks: { id: string; title: string; status: TaskStatus }[];
  activities: RequestActivity[];
}

export interface HomeSummary {
  pendingRequestCount: number;
  activeTaskCount: number;
  weeklyDeadlineCount: number;
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
  fromRequest?: boolean;
}

export type RequestTab = "received" | "sent" | "done";

export interface GetRequestsParams {
  tab?: RequestTab;
  status?: RequestStatus;
  department?: ScheduleType;
  search?: string;
}

export interface CreateRequestInput {
  title: string;
  description?: string;
  assigneeId?: string;
  deadline?: string;
  department?: ScheduleType;
  scheduleId?: string;
  priority?: RequestPriority;
  bulkDepartment?: ScheduleType;
}

export interface UpdateRequestInput {
  title?: string;
  description?: string;
  assigneeId?: string;
  deadline?: string;
  department?: ScheduleType | null;
  scheduleId?: string | null;
  priority?: RequestPriority;
}

export interface CreateRequestBulkResponse {
  count: number;
  ids: string[];
}

export interface AcceptRequestResponse {
  request: RequestSummary;
  task: Task;
  schedule: Schedule | null;
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
  avatar?: string;
}

export interface UpdateMemberInput {
  name?: string;
  phone?: string;
  role?: Role;
  team?: string;
  isActive?: boolean;
  avatar?: string | null;
}
