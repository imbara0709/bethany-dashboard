import {
  ApiResponse,
  User,
  Schedule,
  Task,
  Notification,
  CreateScheduleInput,
  UpdateScheduleInput,
  CreateTaskInput,
  UpdateTaskInput,
  CreateMemberInput,
  UpdateMemberInput,
  GetSchedulesParams,
  GetTasksParams,
  GetMembersParams,
  RequestSummary,
  RequestDetail,
  RequestActivity,
  RequestStatus,
  GetRequestsParams,
  CreateRequestInput,
  UpdateRequestInput,
  CreateRequestBulkResponse,
  AcceptRequestResponse,
  HomeSummary,
} from "@/types";

async function request<T>(
  url: string,
  options?: RequestInit
): Promise<ApiResponse<T>> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data: ApiResponse<T> = await res.json();
  return data;
}

// Members API
export const membersApi = {
  list: (params: GetMembersParams = {}) => {
    const q = new URLSearchParams();
    if (params.role) q.set("role", params.role);
    if (params.team) q.set("team", params.team);
    const qs = q.toString();
    return request<User[]>(`/api/members${qs ? `?${qs}` : ""}`);
  },
  get: (id: string) => request<User>(`/api/members/${id}`),
  create: (body: CreateMemberInput) =>
    request<User>("/api/members", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  update: (id: string, body: UpdateMemberInput) =>
    request<User>(`/api/members/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
};

// Schedules API
export const schedulesApi = {
  list: (params: GetSchedulesParams) => {
    const q = new URLSearchParams();
    if (params.year) q.set("year", String(params.year));
    if (params.month) q.set("month", String(params.month));
    if (params.type) q.set("type", params.type);
    const qs = q.toString();
    return request<Schedule[]>(`/api/schedules${qs ? `?${qs}` : ""}`);
  },
  get: (id: string) => request<Schedule>(`/api/schedules/${id}`),
  create: (body: CreateScheduleInput) =>
    request<Schedule>("/api/schedules", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  update: (id: string, body: UpdateScheduleInput) =>
    request<Schedule>(`/api/schedules/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  delete: (id: string) =>
    request<{ id: string }>(`/api/schedules/${id}`, { method: "DELETE" }),
};

// Tasks API
export const tasksApi = {
  list: (params: GetTasksParams = {}) => {
    const q = new URLSearchParams();
    if (params.scheduleId) q.set("scheduleId", params.scheduleId);
    if (params.status) q.set("status", params.status);
    if (params.mine) q.set("mine", "true");
    if (params.fromRequest !== undefined) q.set("fromRequest", String(params.fromRequest));
    const qs = q.toString();
    return request<Task[]>(`/api/tasks${qs ? `?${qs}` : ""}`);
  },
  get: (id: string) => request<Task>(`/api/tasks/${id}`),
  create: (body: CreateTaskInput) =>
    request<Task>("/api/tasks", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  update: (id: string, body: UpdateTaskInput) =>
    request<Task>(`/api/tasks/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  delete: (id: string) =>
    request<{ id: string }>(`/api/tasks/${id}`, { method: "DELETE" }),
};

// Requests API
export const requestsApi = {
  list: (params: GetRequestsParams = {}) => {
    const q = new URLSearchParams();
    if (params.tab) q.set("tab", params.tab);
    if (params.status) q.set("status", params.status);
    if (params.department) q.set("department", params.department);
    if (params.search) q.set("search", params.search);
    const qs = q.toString();
    return request<RequestSummary[]>(`/api/requests${qs ? `?${qs}` : ""}`);
  },
  get: (id: string) => request<RequestDetail>(`/api/requests/${id}`),
  create: (body: CreateRequestInput) =>
    request<RequestSummary | CreateRequestBulkResponse>("/api/requests", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  update: (id: string, body: UpdateRequestInput) =>
    request<RequestSummary>(`/api/requests/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  delete: (id: string) =>
    request<{ id: string }>(`/api/requests/${id}`, { method: "DELETE" }),
  accept: (id: string) =>
    request<AcceptRequestResponse>(`/api/requests/${id}/accept`, {
      method: "POST",
      body: JSON.stringify({}),
    }),
  hold: (id: string, reason?: string) =>
    request<RequestSummary>(`/api/requests/${id}/hold`, {
      method: "POST",
      body: JSON.stringify(reason ? { reason } : {}),
    }),
  reject: (id: string, reason: string) =>
    request<RequestSummary>(`/api/requests/${id}/reject`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),
  changeStatus: (id: string, to: RequestStatus) =>
    request<RequestSummary>(`/api/requests/${id}/status`, {
      method: "POST",
      body: JSON.stringify({ to }),
    }),
  comment: (id: string, text: string) =>
    request<RequestActivity>(`/api/requests/${id}/comment`, {
      method: "POST",
      body: JSON.stringify({ text }),
    }),
};

// Home API
export const homeApi = {
  summary: () => request<HomeSummary>("/api/home/summary"),
};

// Notifications API
export const notificationsApi = {
  list: (unread?: boolean) => {
    const qs = unread ? "?unread=true" : "";
    return request<Notification[]>(`/api/notifications${qs}`);
  },
  count: () => request<{ unreadCount: number }>("/api/notifications/count"),
  markRead: (id: string) =>
    request<Notification>(`/api/notifications/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ isRead: true }),
    }),
  markAllRead: () =>
    request<{ count: number }>("/api/notifications/read-all", { method: "PATCH" }),
};
