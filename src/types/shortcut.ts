export interface Shortcut {
  id: string;
  name: string;
  url: string;
  createdAt: string;
}

export interface ShortcutDraft {
  name: string;
  url: string;
}

export const DEFAULT_SHORTCUTS: ShortcutDraft[] = [
  { name: "Google", url: "https://www.google.com" },
  { name: "YouTube", url: "https://www.youtube.com" },
  {
    name: "유튜브 찬양",
    url: "https://www.youtube.com/results?search_query=ccm+%EC%B0%AC%EC%96%91",
  },
  { name: "두란노 QT", url: "https://www.duranno.com/qt/" },
];

export const SHORTCUT_LIMITS = {
  NAME_MAX: 30,
} as const;
