"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  Shortcut,
  ShortcutDraft,
  DEFAULT_SHORTCUTS,
  SHORTCUT_LIMITS,
} from "@/types/shortcut";
import {
  loadShortcuts,
  saveShortcuts,
  shouldSeedDefaults,
  markSeeded,
} from "@/lib/shortcuts-storage";
import { getFaviconUrl, normalizeUrl, initialOf } from "@/lib/url-utils";

function generateId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `sc-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function draftToShortcut(draft: ShortcutDraft): Shortcut {
  return {
    id: generateId(),
    name: draft.name.trim(),
    url: normalizeUrl(draft.url) ?? draft.url,
    createdAt: new Date().toISOString(),
  };
}

interface FaviconImageProps {
  url: string;
  name: string;
  size?: number;
}

function FaviconImage({ url, name, size = 32 }: FaviconImageProps) {
  const [hasError, setHasError] = useState(false);
  const src = useMemo(() => getFaviconUrl(url, size * 2), [url, size]);

  if (hasError || !src) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#F2F4F6] text-[#3182F6] font-bold text-[20px]">
        {initialOf(name)}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      onError={() => setHasError(true)}
      className="w-8 h-8 object-contain"
    />
  );
}

interface ShortcutCardProps {
  shortcut: Shortcut;
  onDelete: (id: string) => void;
}

function ShortcutCard({ shortcut, onDelete }: ShortcutCardProps) {
  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (typeof window === "undefined") return;
    if (window.confirm(`'${shortcut.name}'을(를) 삭제하시겠습니까?`)) {
      onDelete(shortcut.id);
    }
  };

  return (
    <a
      href={shortcut.url}
      target="_blank"
      rel="noopener noreferrer"
      role="listitem"
      aria-label={`${shortcut.name}을 새 탭에서 열기`}
      className="group relative flex flex-col items-center justify-center gap-3 bg-white rounded-2xl border border-[#E5E8EB] p-4 aspect-square hover:shadow-md hover:-translate-y-0.5 hover:border-[#D1D6DB] transition"
    >
      <button
        type="button"
        onClick={handleDelete}
        aria-label={`${shortcut.name} 삭제`}
        className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/95 border border-[#E5E8EB] flex items-center justify-center text-[#8B95A1] hover:text-[#E84A5F] hover:border-[#FFD1D6] opacity-0 group-hover:opacity-100 focus:opacity-100 transition"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
      <div className="w-12 h-12 rounded-xl bg-[#F7F8FA] flex items-center justify-center overflow-hidden">
        <FaviconImage url={shortcut.url} name={shortcut.name} />
      </div>
      <div className="text-[14px] font-medium text-[#191F28] text-center truncate w-full px-1">
        {shortcut.name}
      </div>
    </a>
  );
}

interface AddShortcutModalProps {
  open: boolean;
  existingUrls: ReadonlyArray<string>;
  onSubmit: (draft: { name: string; url: string }) => void;
  onClose: () => void;
}

interface AddErrors {
  name?: string;
  url?: string;
}

function AddShortcutModal({
  open,
  existingUrls,
  onSubmit,
  onClose,
}: AddShortcutModalProps) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [errors, setErrors] = useState<AddErrors>({});

  useEffect(() => {
    if (open) {
      setName("");
      setUrl("");
      setErrors({});
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  const handleSubmit = () => {
    const trimmedName = name.trim();
    const found: AddErrors = {};

    if (trimmedName.length === 0) found.name = "이름을 입력해주세요";
    else if (trimmedName.length > SHORTCUT_LIMITS.NAME_MAX)
      found.name = `이름은 ${SHORTCUT_LIMITS.NAME_MAX}자 이내로 입력해주세요`;

    const trimmedUrl = url.trim();
    if (trimmedUrl.length === 0) {
      found.url = "URL을 입력해주세요";
    } else {
      const normalized = normalizeUrl(trimmedUrl);
      if (!normalized) {
        found.url = "http:// 또는 https://로 시작하는 올바른 URL을 입력해주세요";
      } else if (existingUrls.includes(normalized)) {
        found.url = "이미 등록된 사이트입니다";
      }
    }

    setErrors(found);
    if (Object.keys(found).length > 0) return;

    const normalized = normalizeUrl(trimmedUrl);
    if (!normalized) return;
    onSubmit({ name: trimmedName, url: normalized });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-shortcut-title"
    >
      <div
        className="bg-white rounded-3xl max-w-[480px] w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2
            id="add-shortcut-title"
            className="text-[18px] font-bold text-[#191F28]"
          >
            사이트 추가
          </h2>
          <button
            type="button"
            onClick={onClose}
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
              이름 <span className="text-[#3182F6]">*</span>
            </label>
            <input
              autoFocus
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 교회 홈페이지"
              maxLength={SHORTCUT_LIMITS.NAME_MAX + 10}
              className="w-full h-12 rounded-xl border border-[#E5E8EB] px-4 text-[15px] focus:outline-none focus:border-[#3182F6]"
            />
            {errors.name && (
              <p className="mt-1.5 text-[12px] text-[#E84A5F]">{errors.name}</p>
            )}
          </div>

          <div>
            <label className="block text-[13px] font-semibold text-[#191F28] mb-1.5">
              URL <span className="text-[#3182F6]">*</span>
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://"
              className="w-full h-12 rounded-xl border border-[#E5E8EB] px-4 text-[15px] focus:outline-none focus:border-[#3182F6]"
            />
            {errors.url ? (
              <p className="mt-1.5 text-[12px] text-[#E84A5F]">{errors.url}</p>
            ) : (
              <p className="mt-1.5 text-[12px] text-[#8B95A1]">
                http:// 또는 https://로 시작해야 합니다
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 mt-6">
          <button
            type="button"
            onClick={onClose}
            className="h-12 px-5 rounded-xl text-[15px] font-semibold text-[#4E5968] bg-[#F2F4F6] hover:bg-[#E5E8EB]"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="h-12 px-5 rounded-xl text-[15px] font-semibold text-white bg-[#3182F6] hover:bg-[#1B64DA]"
          >
            추가
          </button>
        </div>
      </div>
    </div>
  );
}

function AddCard({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="사이트 추가"
      className="flex flex-col items-center justify-center gap-3 bg-transparent rounded-2xl border-2 border-dashed border-[#D1D6DB] p-4 aspect-square text-[#8B95A1] hover:border-[#3182F6] hover:text-[#3182F6] hover:bg-[#EBF2FE]/30 transition"
    >
      <div className="w-12 h-12 rounded-xl bg-[#F7F8FA] flex items-center justify-center">
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </div>
      <span className="text-[13px] font-medium">사이트 추가</span>
    </button>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="bg-white rounded-2xl border border-[#F2F4F6] aspect-square animate-pulse"
        />
      ))}
    </div>
  );
}

export default function Shortcuts() {
  const [shortcuts, setShortcuts] = useState<Shortcut[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isAddOpen, setAddOpen] = useState(false);

  useEffect(() => {
    const stored = loadShortcuts();
    if (stored.length === 0 && shouldSeedDefaults()) {
      const seeded = DEFAULT_SHORTCUTS.map(draftToShortcut);
      setShortcuts(seeded);
      saveShortcuts(seeded);
      markSeeded();
    } else {
      setShortcuts(stored);
    }
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (isHydrated) saveShortcuts(shortcuts);
  }, [shortcuts, isHydrated]);

  const existingUrls = useMemo(
    () => shortcuts.map((s) => s.url),
    [shortcuts]
  );

  const handleDelete = useCallback((id: string) => {
    setShortcuts((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const handleAdd = useCallback(
    (draft: { name: string; url: string }) => {
      const next: Shortcut = {
        id: generateId(),
        name: draft.name,
        url: draft.url,
        createdAt: new Date().toISOString(),
      };
      setShortcuts((prev) => [...prev, next]);
      setAddOpen(false);
    },
    []
  );

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[20px] font-bold text-[#191F28]">바로가기</h2>
          <p className="text-[13px] text-[#8B95A1] mt-1">
            자주 사용하는 사이트를 모아두세요
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="flex items-center gap-1.5 h-11 px-4 rounded-xl text-[14px] font-semibold text-white bg-[#3182F6] hover:bg-[#1B64DA]"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M12 4v16m8-8H4" />
          </svg>
          사이트 추가
        </button>
      </div>

      {!isHydrated ? (
        <SkeletonGrid />
      ) : (
        <div
          role="list"
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4"
        >
          {shortcuts.map((shortcut) => (
            <ShortcutCard
              key={shortcut.id}
              shortcut={shortcut}
              onDelete={handleDelete}
            />
          ))}
          <AddCard onClick={() => setAddOpen(true)} />
        </div>
      )}

      <AddShortcutModal
        open={isAddOpen}
        existingUrls={existingUrls}
        onSubmit={handleAdd}
        onClose={() => setAddOpen(false)}
      />
    </div>
  );
}
