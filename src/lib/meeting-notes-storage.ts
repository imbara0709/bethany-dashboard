import { MeetingNote } from "@/types/meeting-note";

const STORAGE_KEY = "church-meeting-notes";

function isValidMeetingNote(value: unknown): value is MeetingNote {
  if (typeof value !== "object" || value === null) return false;
  const n = value as Partial<MeetingNote>;
  return (
    typeof n.id === "string" &&
    typeof n.title === "string" &&
    typeof n.date === "string" &&
    typeof n.content === "string" &&
    typeof n.createdAt === "string" &&
    (typeof n.updatedAt === "string" || n.updatedAt === undefined)
  );
}

export function loadMeetingNotes(): MeetingNote[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidMeetingNote);
  } catch {
    return [];
  }
}

export function saveMeetingNotes(notes: ReadonlyArray<MeetingNote>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  } catch {
    // Quota exceeded 등은 조용히 무시 — UI는 메모리 상에서 동작
  }
}
