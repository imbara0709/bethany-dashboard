import { Shortcut } from "@/types/shortcut";

const STORAGE_KEY = "church-shortcuts";
const SEED_FLAG_KEY = "church-shortcuts:seeded";

function isValidShortcut(value: unknown): value is Shortcut {
  if (typeof value !== "object" || value === null) return false;
  const s = value as Partial<Shortcut>;
  return (
    typeof s.id === "string" &&
    typeof s.name === "string" &&
    typeof s.url === "string" &&
    typeof s.createdAt === "string"
  );
}

export function loadShortcuts(): Shortcut[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidShortcut);
  } catch {
    return [];
  }
}

export function saveShortcuts(items: ReadonlyArray<Shortcut>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Quota exceeded 등은 조용히 무시
  }
}

export function shouldSeedDefaults(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(SEED_FLAG_KEY) !== "true";
}

export function markSeeded(): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SEED_FLAG_KEY, "true");
}
