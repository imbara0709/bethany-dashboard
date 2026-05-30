"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import {
  MeetingNote,
  MeetingNoteDraft,
  MEETING_NOTE_LIMITS,
} from "@/types/meeting-note";
import {
  loadMeetingNotes,
  saveMeetingNotes,
} from "@/lib/meeting-notes-storage";

function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${y}-${m}-${day} ${hh}:${mm}`;
  } catch {
    return iso;
  }
}

function generateId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `note-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

interface FormErrors {
  title?: string;
  date?: string;
  content?: string;
}

function validateDraft(draft: MeetingNoteDraft): FormErrors {
  const errors: FormErrors = {};
  const title = draft.title.trim();
  if (title.length === 0) errors.title = "제목을 입력해주세요";
  else if (title.length > MEETING_NOTE_LIMITS.TITLE_MAX)
    errors.title = `제목은 ${MEETING_NOTE_LIMITS.TITLE_MAX}자 이내로 입력해주세요`;

  if (!draft.date) errors.date = "회의 날짜를 선택해주세요";
  else if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.date))
    errors.date = "날짜 형식이 올바르지 않습니다";

  const content = draft.content.trim();
  if (content.length === 0) errors.content = "본문을 입력해주세요";
  else if (content.length > MEETING_NOTE_LIMITS.CONTENT_MAX)
    errors.content = `본문은 ${MEETING_NOTE_LIMITS.CONTENT_MAX}자 이내로 입력해주세요`;

  return errors;
}

interface MeetingNoteFormModalProps {
  open: boolean;
  mode: "create" | "edit";
  initial?: MeetingNoteDraft;
  onSubmit: (draft: MeetingNoteDraft) => void;
  onClose: () => void;
}

function MeetingNoteFormModal({
  open,
  mode,
  initial,
  onSubmit,
  onClose,
}: MeetingNoteFormModalProps) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [date, setDate] = useState(initial?.date ?? todayISO());
  const [content, setContent] = useState(initial?.content ?? "");
  const [errors, setErrors] = useState<FormErrors>({});
  const titleRef = useRef<HTMLInputElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      setTitle(initial?.title ?? "");
      setDate(initial?.date ?? todayISO());
      setContent(initial?.content ?? "");
      setErrors({});
    }
  }, [open, initial]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  const isDirty =
    title !== (initial?.title ?? "") ||
    date !== (initial?.date ?? todayISO()) ||
    content !== (initial?.content ?? "");

  const handleClose = () => {
    if (isDirty && typeof window !== "undefined") {
      if (!window.confirm("작성 중인 내용이 있습니다. 닫으시겠습니까?")) return;
    }
    onClose();
  };

  const handleSubmit = () => {
    const draft: MeetingNoteDraft = {
      title: title.trim(),
      date,
      content: content.trim(),
    };
    const found = validateDraft(draft);
    setErrors(found);
    if (Object.keys(found).length === 0) {
      onSubmit(draft);
    } else {
      if (found.title) titleRef.current?.focus();
      else if (found.date) dateRef.current?.focus();
      else if (found.content) contentRef.current?.focus();
    }
  };

  const overLimit = content.length > MEETING_NOTE_LIMITS.CONTENT_MAX;
  const counterColor = overLimit ? "text-[#E84A5F]" : "text-[#8B95A1]";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="meeting-note-form-title"
    >
      <div
        className="bg-white rounded-3xl max-w-[560px] w-full p-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2
            id="meeting-note-form-title"
            className="text-[18px] font-bold text-[#191F28]"
          >
            {mode === "create" ? "새 회의록" : "회의록 편집"}
          </h2>
          <button
            type="button"
            onClick={handleClose}
            aria-label="모달 닫기"
            className="p-1.5 -mr-1 rounded-xl text-[#8B95A1] hover:text-[#4E5968] hover:bg-[#F7F8FA]"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-[13px] font-semibold text-[#191F28] mb-1.5">
              제목 <span className="text-[#3182F6]">*</span>
            </label>
            <input
              ref={titleRef}
              autoFocus
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: 주일 예배 준비 회의"
              maxLength={MEETING_NOTE_LIMITS.TITLE_MAX + 20}
              className="w-full h-12 rounded-xl border border-[#E5E8EB] px-4 text-[15px] focus:outline-none focus:border-[#3182F6]"
            />
            {errors.title && (
              <p className="mt-1.5 text-[12px] text-[#E84A5F]">{errors.title}</p>
            )}
          </div>

          <div>
            <label className="block text-[13px] font-semibold text-[#191F28] mb-1.5">
              회의 날짜 <span className="text-[#3182F6]">*</span>
            </label>
            <input
              ref={dateRef}
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full h-12 rounded-xl border border-[#E5E8EB] px-4 text-[15px] focus:outline-none focus:border-[#3182F6]"
            />
            {errors.date && (
              <p className="mt-1.5 text-[12px] text-[#E84A5F]">{errors.date}</p>
            )}
          </div>

          <div>
            <label className="block text-[13px] font-semibold text-[#191F28] mb-1.5">
              본문 <span className="text-[#3182F6]">*</span>
            </label>
            <textarea
              ref={contentRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="회의 안건과 결정 사항을 자유롭게 작성하세요"
              className="w-full min-h-[240px] rounded-xl border border-[#E5E8EB] p-4 text-[15px] leading-relaxed focus:outline-none focus:border-[#3182F6] resize-y"
            />
            <div className="flex items-center justify-between mt-1.5">
              {errors.content ? (
                <p className="text-[12px] text-[#E84A5F]">{errors.content}</p>
              ) : (
                <span />
              )}
              <span className={`text-[12px] ${counterColor}`}>
                {content.length.toLocaleString()} / {MEETING_NOTE_LIMITS.CONTENT_MAX.toLocaleString()}자
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 mt-6">
          <button
            type="button"
            onClick={handleClose}
            className="h-12 px-5 rounded-xl text-[15px] font-semibold text-[#4E5968] bg-[#F2F4F6] hover:bg-[#E5E8EB]"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="h-12 px-5 rounded-xl text-[15px] font-semibold text-white bg-[#3182F6] hover:bg-[#1B64DA]"
          >
            저장
          </button>
        </div>
      </div>
    </div>
  );
}

interface MeetingNoteDetailModalProps {
  note: MeetingNote | null;
  onClose: () => void;
  onEdit: (note: MeetingNote) => void;
  onDelete: (id: string) => void;
}

function MeetingNoteDetailModal({
  note,
  onClose,
  onEdit,
  onDelete,
}: MeetingNoteDetailModalProps) {
  useEffect(() => {
    if (!note) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [note, onClose]);

  if (!note) return null;

  const handleDelete = () => {
    if (typeof window === "undefined") return;
    if (window.confirm("이 회의록을 삭제하시겠습니까?")) {
      onDelete(note.id);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="meeting-note-detail-title"
    >
      <div
        className="bg-white rounded-3xl max-w-[640px] w-full p-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 mb-2">
          <h2
            id="meeting-note-detail-title"
            className="text-[20px] font-bold text-[#191F28] leading-snug"
          >
            {note.title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="모달 닫기"
            className="p-1.5 -mr-1 rounded-xl text-[#8B95A1] hover:text-[#4E5968] hover:bg-[#F7F8FA] flex-shrink-0"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="text-[13px] text-[#8B95A1] mb-5">
          {note.date}
          {note.authorName ? ` · ${note.authorName}` : ""}
          {" · 작성 "}
          {formatDateTime(note.createdAt)}
          {note.updatedAt !== note.createdAt && (
            <> · 수정 {formatDateTime(note.updatedAt)}</>
          )}
        </div>

        <div className="text-[15px] text-[#191F28] leading-[1.75] whitespace-pre-wrap border-t border-[#F2F4F6] pt-5">
          {note.content}
        </div>

        <div className="flex items-center justify-end gap-2 mt-6 pt-4 border-t border-[#F2F4F6]">
          <button
            type="button"
            onClick={handleDelete}
            className="h-11 px-4 rounded-xl text-[14px] font-semibold text-[#E84A5F] bg-[#FFF0F1] hover:bg-[#FFE0E3]"
          >
            삭제
          </button>
          <button
            type="button"
            onClick={() => onEdit(note)}
            className="h-11 px-4 rounded-xl text-[14px] font-semibold text-[#4E5968] bg-[#F2F4F6] hover:bg-[#E5E8EB]"
          >
            편집
          </button>
          <button
            type="button"
            onClick={onClose}
            className="h-11 px-5 rounded-xl text-[14px] font-semibold text-white bg-[#3182F6] hover:bg-[#1B64DA]"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}

interface MeetingNoteCardProps {
  note: MeetingNote;
  onOpen: (note: MeetingNote) => void;
}

function MeetingNoteCard({ note, onOpen }: MeetingNoteCardProps) {
  return (
    <button
      type="button"
      onClick={() => onOpen(note)}
      className="w-full text-left bg-white rounded-2xl border border-[#E5E8EB] p-5 hover:shadow-md hover:border-[#D1D6DB] transition"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-[17px] font-semibold text-[#191F28] truncate flex-1">
          {note.title}
        </h3>
        <span className="text-[12px] text-[#8B95A1] flex-shrink-0 mt-0.5">
          {note.date}
        </span>
      </div>
      {note.authorName && (
        <div className="text-[12px] text-[#8B95A1] mt-0.5">{note.authorName}</div>
      )}
      <p className="text-[14px] text-[#4E5968] mt-3 line-clamp-2 whitespace-pre-wrap">
        {note.content}
      </p>
    </button>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="bg-white rounded-2xl border border-[#E5E8EB] p-12 flex flex-col items-center text-center">
      <div className="w-14 h-14 rounded-2xl bg-[#EBF2FE] flex items-center justify-center mb-4">
        <svg className="w-7 h-7 text-[#3182F6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.8}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      </div>
      <h3 className="text-[16px] font-semibold text-[#191F28]">
        아직 작성된 회의록이 없습니다
      </h3>
      <p className="text-[14px] text-[#8B95A1] mt-1">
        첫 회의록을 작성해보세요
      </p>
      <button
        type="button"
        onClick={onCreate}
        className="mt-5 h-12 px-5 rounded-xl text-[15px] font-semibold text-white bg-[#3182F6] hover:bg-[#1B64DA]"
      >
        + 새 회의록 작성
      </button>
    </div>
  );
}

function SkeletonList() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="bg-white rounded-2xl border border-[#F2F4F6] p-5 animate-pulse"
        >
          <div className="h-5 bg-[#F2F4F6] rounded w-1/3 mb-3" />
          <div className="h-3 bg-[#F2F4F6] rounded w-2/3" />
        </div>
      ))}
    </div>
  );
}

export default function MeetingNotes() {
  const { data: session } = useSession();
  const [notes, setNotes] = useState<MeetingNote[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isFormOpen, setFormOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<MeetingNote | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    setNotes(loadMeetingNotes());
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (isHydrated) saveMeetingNotes(notes);
  }, [notes, isHydrated]);

  const sortedNotes = useMemo(() => {
    return [...notes].sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      return a.createdAt < b.createdAt ? 1 : -1;
    });
  }, [notes]);

  const selectedNote = useMemo(
    () => notes.find((n) => n.id === selectedId) ?? null,
    [notes, selectedId]
  );

  const handleCreate = useCallback(() => {
    setEditingNote(null);
    setFormOpen(true);
  }, []);

  const handleSubmit = useCallback(
    (draft: MeetingNoteDraft) => {
      const now = new Date().toISOString();
      if (editingNote) {
        setNotes((prev) =>
          prev.map((n) =>
            n.id === editingNote.id
              ? { ...n, ...draft, updatedAt: now }
              : n
          )
        );
        setSelectedId(editingNote.id);
      } else {
        const next: MeetingNote = {
          id: generateId(),
          ...draft,
          createdAt: now,
          updatedAt: now,
          authorName: session?.user?.name ?? undefined,
        };
        setNotes((prev) => [next, ...prev]);
      }
      setFormOpen(false);
      setEditingNote(null);
    },
    [editingNote, session?.user?.name]
  );

  const handleDelete = useCallback((id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
    setSelectedId((current) => (current === id ? null : current));
  }, []);

  const handleEditFromDetail = useCallback((note: MeetingNote) => {
    setEditingNote(note);
    setSelectedId(null);
    setFormOpen(true);
  }, []);

  const editingDraft: MeetingNoteDraft | undefined = editingNote
    ? {
        title: editingNote.title,
        date: editingNote.date,
        content: editingNote.content,
      }
    : undefined;

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[20px] font-bold text-[#191F28]">회의록</h2>
          <p className="text-[13px] text-[#8B95A1] mt-1">
            {isHydrated ? `총 ${notes.length}건` : "불러오는 중..."}
          </p>
        </div>
        {sortedNotes.length > 0 && (
          <button
            type="button"
            onClick={handleCreate}
            className="flex items-center gap-1.5 h-11 px-4 rounded-xl text-[14px] font-semibold text-white bg-[#3182F6] hover:bg-[#1B64DA]"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M12 4v16m8-8H4" />
            </svg>
            새 회의록
          </button>
        )}
      </div>

      {!isHydrated ? (
        <SkeletonList />
      ) : sortedNotes.length === 0 ? (
        <EmptyState onCreate={handleCreate} />
      ) : (
        <div className="space-y-3">
          {sortedNotes.map((note) => (
            <MeetingNoteCard
              key={note.id}
              note={note}
              onOpen={(n) => setSelectedId(n.id)}
            />
          ))}
        </div>
      )}

      <MeetingNoteFormModal
        open={isFormOpen}
        mode={editingNote ? "edit" : "create"}
        initial={editingDraft}
        onSubmit={handleSubmit}
        onClose={() => {
          setFormOpen(false);
          setEditingNote(null);
        }}
      />

      <MeetingNoteDetailModal
        note={selectedNote}
        onClose={() => setSelectedId(null)}
        onEdit={handleEditFromDetail}
        onDelete={handleDelete}
      />
    </div>
  );
}
