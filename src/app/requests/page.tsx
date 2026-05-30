"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Layout from "@/components/Layout";
import RequestFormModal from "@/components/RequestFormModal";
import RequestDetailModal from "@/components/RequestDetailModal";
import { requestsApi } from "@/lib/api";
import {
  RequestSummary, RequestStatus, RequestTab,
  REQUEST_STATUS_LABELS, REQUEST_STATUS_COLORS,
  REQUEST_PRIORITY_LABELS, REQUEST_PRIORITY_COLORS,
  RequestPriority, ScheduleType, SCHEDULE_TYPE_LABELS,
} from "@/types";

function toDateStr(iso: string | null | undefined): string {
  if (!iso) return "";
  return iso.slice(0, 10).replace(/-/g, ".");
}

function isOverdueRequest(req: RequestSummary): boolean {
  if (!req.deadline) return false;
  if (req.status === RequestStatus.DONE || req.status === RequestStatus.REJECTED) return false;
  return new Date(req.deadline) < new Date(new Date().toDateString());
}

const STATUS_FILTER_OPTIONS: { label: string; value: RequestStatus | "" }[] = [
  { label: "전체", value: "" },
  { label: "대기중", value: RequestStatus.PENDING },
  { label: "수락됨", value: RequestStatus.ACCEPTED },
  { label: "진행중", value: RequestStatus.IN_PROGRESS },
  { label: "확인 필요", value: RequestStatus.REVIEW },
  { label: "보류", value: RequestStatus.HOLD },
  { label: "거절됨", value: RequestStatus.REJECTED },
];

function RequestCard({
  req,
  tab,
  onOpen,
  onAccept,
  onHold,
  isMutating,
}: {
  req: RequestSummary;
  tab: RequestTab;
  onOpen: (id: string) => void;
  onAccept: (id: string) => void;
  onHold: (id: string) => void;
  isMutating: boolean;
}) {
  const overdue = isOverdueRequest(req);
  const isPending = req.status === RequestStatus.PENDING;
  const isReceived = tab === "received";

  return (
    <div
      className={`bg-white rounded-2xl border p-4 hover:shadow-md transition-shadow cursor-pointer ${
        overdue ? "border-rose-200" : "border-[#E5E8EB]"
      }`}
      onClick={() => onOpen(req.id)}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${
            REQUEST_STATUS_COLORS[req.status as RequestStatus] ?? "bg-gray-100 text-gray-600 border-gray-200"
          }`}>
            {REQUEST_STATUS_LABELS[req.status as RequestStatus] ?? req.status}
          </span>
          {req.priority && req.priority !== RequestPriority.MEDIUM && (
            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
              REQUEST_PRIORITY_COLORS[req.priority as RequestPriority] ?? ""
            }`}>
              {REQUEST_PRIORITY_LABELS[req.priority as RequestPriority]}
            </span>
          )}
          {req.department && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-[#F7F8FA] text-[#4E5968] border border-[#E5E8EB]">
              {SCHEDULE_TYPE_LABELS[req.department as ScheduleType] ?? req.department}
            </span>
          )}
        </div>
        {req.deadline && (
          <span className={`text-xs flex-shrink-0 font-medium ${overdue ? "text-rose-500" : "text-[#8B95A1]"}`}>
            ~{toDateStr(req.deadline)}
          </span>
        )}
      </div>

      <h3 className={`text-[15px] font-semibold leading-snug mb-1 ${overdue ? "text-rose-800" : "text-[#191F28]"}`}>
        {req.title}
      </h3>

      <div className="flex items-center gap-3 text-[12px] text-[#8B95A1] mt-2">
        <span>요청자 {req.requester.name}</span>
        <span>·</span>
        <span>담당 {req.assignee.name}</span>
      </div>

      {/* 받은 요청 + PENDING: 수락/보류 버튼 */}
      {isReceived && isPending && (
        <div className="flex gap-2 mt-3" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => onAccept(req.id)}
            disabled={isMutating}
            className="flex-1 h-9 rounded-xl text-[13px] font-semibold text-white bg-[#3182F6] hover:bg-[#1B64DA] disabled:opacity-50"
          >
            수락
          </button>
          <button
            onClick={() => onHold(req.id)}
            disabled={isMutating}
            className="flex-1 h-9 rounded-xl text-[13px] font-semibold text-[#4E5968] bg-[#F2F4F6] hover:bg-[#E5E8EB] disabled:opacity-50"
          >
            보류
          </button>
        </div>
      )}
    </div>
  );
}

export default function RequestsPage() {
  const { data: session, status } = useSession();
  const [tab,          setTab]          = useState<RequestTab>("received");
  const [statusFilter, setStatusFilter] = useState<RequestStatus | "">("");
  const [search,       setSearch]       = useState("");
  const [showForm,     setShowForm]     = useState(false);
  const [detailId,     setDetailId]     = useState<string | null>(null);
  const qc = useQueryClient();

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["requests", tab, statusFilter, search],
    queryFn: async () => {
      const res = await requestsApi.list({
        tab,
        status: statusFilter || undefined,
        search: search.trim() || undefined,
      });
      return res.data ?? [];
    },
    enabled: !!session,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["requests"] });
    qc.invalidateQueries({ queryKey: ["home-summary"] });
  };

  const acceptMut = useMutation({
    mutationFn: (id: string) => requestsApi.accept(id),
    onSuccess: invalidate,
  });
  const holdMut = useMutation({
    mutationFn: (id: string) => requestsApi.hold(id),
    onSuccess: invalidate,
  });

  if (status === "loading") return <div className="min-h-screen flex items-center justify-center text-[#8B95A1]">로딩 중...</div>;
  if (!session) redirect("/login");

  const isMutating = acceptMut.isPending || holdMut.isPending;

  const tabLabels: { value: RequestTab; label: string }[] = [
    { value: "received", label: "받은 요청" },
    { value: "sent",     label: "보낸 요청" },
    { value: "done",     label: "완료된 요청" },
  ];

  const pendingCount = tab === "received"
    ? requests.filter((r) => r.status === RequestStatus.PENDING).length
    : 0;

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-5">
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[20px] font-bold text-[#191F28]">요청함</h2>
            {pendingCount > 0 && (
              <p className="text-[13px] text-amber-600 mt-0.5">미처리 요청 {pendingCount}건</p>
            )}
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 h-11 px-4 rounded-xl text-[14px] font-semibold text-white bg-[#3182F6] hover:bg-[#1B64DA]"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M12 4v16m8-8H4" />
            </svg>
            새 요청
          </button>
        </div>

        {/* 탭 */}
        <div className="flex gap-0.5 p-1 bg-[#F7F8FA] rounded-2xl w-fit">
          {tabLabels.map((t) => (
            <button
              key={t.value}
              onClick={() => { setTab(t.value); setStatusFilter(""); }}
              className={`px-4 py-2 rounded-xl text-[13px] font-semibold transition-colors ${
                tab === t.value
                  ? "bg-white text-[#191F28] shadow-sm"
                  : "text-[#8B95A1] hover:text-[#4E5968]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* 검색 + 상태 필터 */}
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="요청 제목, 담당자, 요청자 검색"
            className="flex-1 h-10 border border-[#E5E8EB] rounded-xl px-3 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#3182F6]"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as RequestStatus | "")}
            className="h-10 border border-[#E5E8EB] rounded-xl px-3 text-[14px] bg-white focus:outline-none focus:ring-2 focus:ring-[#3182F6]"
          >
            {STATUS_FILTER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* 요청 목록 */}
        {isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="bg-white rounded-2xl border border-[#F2F4F6] p-5 animate-pulse h-24" />
            ))}
          </div>
        ) : requests.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#E5E8EB] p-12 text-center">
            <div className="w-12 h-12 rounded-2xl bg-[#EBF2FE] flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-[#3182F6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 8l9 6 9-6M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-[14px] font-semibold text-[#191F28]">요청이 없습니다</p>
            <p className="text-[13px] text-[#8B95A1] mt-1">
              {tab === "received" ? "받은 요청이 없습니다" : tab === "sent" ? "보낸 요청이 없습니다" : "완료된 요청이 없습니다"}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map((req) => (
              <RequestCard
                key={req.id}
                req={req}
                tab={tab}
                onOpen={setDetailId}
                onAccept={(id) => acceptMut.mutate(id)}
                onHold={(id) => holdMut.mutate(id)}
                isMutating={isMutating}
              />
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <RequestFormModal
          onClose={() => { setShowForm(false); invalidate(); }}
        />
      )}

      <RequestDetailModal
        requestId={detailId}
        onClose={() => { setDetailId(null); invalidate(); }}
      />
    </Layout>
  );
}
