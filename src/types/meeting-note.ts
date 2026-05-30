export interface MeetingNote {
  id: string;
  title: string;
  date: string;        // "YYYY-MM-DD"
  content: string;
  createdAt: string;   // ISO 8601
  updatedAt: string;   // ISO 8601
  authorName?: string;
}

export interface MeetingNoteDraft {
  title: string;
  date: string;
  content: string;
}

export const MEETING_NOTE_LIMITS = {
  TITLE_MAX: 100,
  CONTENT_MAX: 5000,
} as const;
