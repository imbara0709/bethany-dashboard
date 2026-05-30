"use client";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Layout from "@/components/Layout";
import { membersApi } from "@/lib/api";
import {
  User, Role, ROLE_LABELS, ROLE_ORDER, hasMinRole,
  CreateMemberInput, UpdateMemberInput,
  ScheduleType, SCHEDULE_TYPE_LABELS,
} from "@/types";

const TEAM_OPTIONS = (Object.values(ScheduleType) as ScheduleType[]).map(
  (t) => SCHEDULE_TYPE_LABELS[t]
);

const ROLE_BADGE: Record<Role, string> = {
  PASTOR:   "bg-violet-100 text-violet-700",
  TRAINEE:  "bg-[#EBF2FE] text-[#3182F6]",
  FULLTIME: "bg-teal-100 text-teal-700",
  PARTTIME: "bg-[#F7F8FA] text-[#4E5968]",
  ADMIN:    "bg-orange-100 text-orange-700",
};

function MemberForm({ member, onClose, canSetAdmin }: { member?: User; onClose: () => void; canSetAdmin: boolean }) {
  const qc = useQueryClient();
  const isEdit = !!member;
  const [name,     setName]     = useState(member?.name     ?? "");
  const [email,    setEmail]    = useState(member?.email    ?? "");
  const [password, setPassword] = useState("");
  const [role,     setRole]     = useState<Role>((member?.role as Role) ?? "PARTTIME");
  const [team,     setTeam]     = useState(member?.team     ?? "");
  const [phone,    setPhone]    = useState(member?.phone    ?? "");
  const [avatar,   setAvatar]   = useState<string | null>(member?.avatar ?? null);
  const [error,    setError]    = useState<string | null>(null);

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setAvatar(reader.result as string);
    reader.readAsDataURL(file);
  }

  const createMut = useMutation({
    mutationFn: (body: CreateMemberInput) => membersApi.create(body),
    onSuccess: (res) => {
      if (!res.success) { setError(res.error ?? "생성 실패"); return; }
      qc.invalidateQueries({ queryKey: ["members"] });
      onClose();
    },
  });
  const updateMut = useMutation({
    mutationFn: (body: UpdateMemberInput) => membersApi.update(member!.id, body),
    onSuccess: (res) => {
      if (!res.success) { setError(res.error ?? "수정 실패"); return; }
      qc.invalidateQueries({ queryKey: ["members"] });
      onClose();
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (isEdit) {
      updateMut.mutate({ name, role, team: team || undefined, phone: phone || undefined, avatar });
    } else {
      if (!password) { setError("비밀번호를 입력하세요."); return; }
      createMut.mutate({ name, email, password, role, team: team || undefined, phone: phone || undefined, avatar: avatar ?? undefined });
    }
  }

  const isPending = createMut.isPending || updateMut.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-[#191F28]">{isEdit ? "사역자 수정" : "사역자 추가"}</h2>
          <button onClick={onClose} className="text-[#8B95A1] hover:text-[#4E5968]">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-xl">{error}</p>}

          {/* 사진 업로드 */}
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-[#EBF2FE] flex items-center justify-center overflow-hidden flex-shrink-0 border-2 border-[#E5E8EB]">
              {avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatar} alt="프로필" className="w-full h-full object-cover" />
              ) : (
                <span className="text-xl font-bold text-[#3182F6]">{name.charAt(0) || "?"}</span>
              )}
            </div>
            <div>
              <label className="cursor-pointer px-3 py-2 text-sm font-medium border border-[#E5E8EB] rounded-xl hover:bg-[#F7F8FA] text-[#4E5968]">
                사진 선택
                <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
              </label>
              {avatar && (
                <button type="button" onClick={() => setAvatar(null)} className="ml-2 text-xs text-red-500 hover:text-red-700">
                  삭제
                </button>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#191F28] mb-1">이름 *</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} required
              className="w-full border border-[#E5E8EB] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#3182F6]" />
          </div>
          {!isEdit && (
            <>
              <div>
                <label className="block text-sm font-medium text-[#191F28] mb-1">이메일 *</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                  className="w-full border border-[#E5E8EB] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#3182F6]" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#191F28] mb-1">비밀번호 *</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
                  className="w-full border border-[#E5E8EB] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#3182F6]" />
              </div>
            </>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-[#191F28] mb-1">역할 *</label>
              <select value={role} onChange={(e) => setRole(e.target.value as Role)}
                className="w-full border border-[#E5E8EB] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#3182F6] bg-white">
                {ROLE_ORDER.filter((r) => canSetAdmin || r !== "ADMIN").map((r) => (
                  <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#191F28] mb-1">부서/팀</label>
              <select value={team} onChange={(e) => setTeam(e.target.value)}
                className="w-full border border-[#E5E8EB] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#3182F6] bg-white">
                <option value="">선택 안 함</option>
                {TEAM_OPTIONS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-[#191F28] mb-1">전화번호</label>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="010-0000-0000"
              className="w-full border border-[#E5E8EB] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#3182F6]" />
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2.5 text-sm border border-[#E5E8EB] rounded-xl hover:bg-[#F7F8FA] text-[#4E5968]">
              취소
            </button>
            <button type="submit" disabled={isPending}
              className="flex-1 px-4 py-2.5 text-sm font-semibold bg-[#3182F6] text-white rounded-xl hover:bg-[#1B64DA] disabled:opacity-50">
              {isPending ? "저장 중..." : isEdit ? "수정" : "추가"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function MembersPage() {
  const { data: session, status } = useSession();
  const [showForm,   setShowForm]   = useState(false);
  const [editTarget, setEditTarget] = useState<User | null>(null);
  const [search,     setSearch]     = useState("");

  const { data: members = [] } = useQuery({
    queryKey: ["members"],
    queryFn: async () => (await membersApi.list({})).data as User[] ?? [],
    enabled: !!session,
  });

  if (status === "loading") return <div className="min-h-screen flex items-center justify-center text-[#8B95A1]">로딩 중...</div>;
  if (!session) redirect("/login");

  const userRole      = session.user?.role as Role | undefined;
  const isAdmin       = userRole === "ADMIN";
  const isPastorPlus  = userRole ? hasMinRole(userRole, "PASTOR") : false;

  const filtered = members.filter(
    (m) => m.name.includes(search) || m.email.includes(search) || (m.team ?? "").includes(search)
  );

  const grouped = ROLE_ORDER.reduce<Record<Role, User[]>>(
    (acc, r) => ({ ...acc, [r]: filtered.filter((m) => m.role === r && m.isActive) }),
    {} as Record<Role, User[]>
  );

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <p className="text-[13px] text-[#8B95A1]">활동 중 {members.filter((m) => m.isActive).length}명</p>
          {isPastorPlus && (
            <button onClick={() => { setEditTarget(null); setShowForm(true); }}
              className="flex items-center gap-1.5 px-3 py-2 bg-[#3182F6] text-white rounded-xl text-sm font-semibold hover:bg-[#1B64DA]">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              사역자 추가
            </button>
          )}
        </div>

        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="이름, 이메일, 부서로 검색"
          className="w-full border border-[#E5E8EB] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#3182F6]" />

        {ROLE_ORDER.map((r) => {
          const group = grouped[r];
          if (group.length === 0) return null;
          return (
            <div key={r}>
              <div className="flex items-center gap-2 mb-3">
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${ROLE_BADGE[r]}`}>
                  {ROLE_LABELS[r]}
                </span>
                <span className="text-xs text-[#8B95A1]">{group.length}명</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {group.map((m) => (
                  <div key={m.id}
                    className="bg-white rounded-2xl border border-[#E5E8EB] p-4 hover:shadow-sm hover:border-[#3182F6]/20 transition-all">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#EBF2FE] flex items-center justify-center flex-shrink-0 overflow-hidden border border-[#E5E8EB]">
                          {m.avatar ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={m.avatar} alt={m.name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-sm font-bold text-[#3182F6]">{m.name.charAt(0)}</span>
                          )}
                        </div>
                        <div>
                          <div className="font-semibold text-sm text-[#191F28]">{m.name}</div>
                          <div className="text-xs text-[#8B95A1]">{m.email}</div>
                          {m.team && <div className="text-xs text-[#4E5968] mt-0.5">{m.team}</div>}
                        </div>
                      </div>
                      {isPastorPlus && m.role !== "ADMIN" && (
                        <button onClick={() => { setEditTarget(m); setShowForm(true); }}
                          className="p-1.5 text-[#B0B8C1] hover:text-[#4E5968] rounded-lg hover:bg-[#F7F8FA]">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                      )}
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_BADGE[m.role as Role] ?? "bg-gray-100 text-gray-600"}`}>
                        {ROLE_LABELS[m.role as Role] ?? m.role}
                      </span>
                      {m.phone && <span className="text-xs text-[#8B95A1]">{m.phone}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="bg-white rounded-2xl border border-[#E5E8EB] p-12 text-center">
            <p className="text-sm text-[#8B95A1]">검색 결과가 없습니다.</p>
          </div>
        )}
      </div>

      {showForm && isPastorPlus && (
        <MemberForm
          member={editTarget ?? undefined}
          canSetAdmin={isAdmin}
          onClose={() => { setShowForm(false); setEditTarget(null); }}
        />
      )}
    </Layout>
  );
}
