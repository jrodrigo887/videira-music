"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

type DialogProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  closeOnOverlay?: boolean;
  children: ReactNode;
};

export function Dialog({
  open,
  title,
  onClose,
  closeOnOverlay = true,
  children,
}: DialogProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const previousOverflowRef = useRef("");

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const active = document.activeElement;
    previousFocusRef.current = active instanceof HTMLElement ? active : null;
    previousOverflowRef.current = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onCloseRef.current();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflowRef.current;
      const previous = previousFocusRef.current;
      if (previous) {
        previous.focus();
      }
    };
  }, [open]);

  if (!open) {
    return null;
  }

  function handleOverlayClick() {
    if (closeOnOverlay) {
      onCloseRef.current();
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={handleOverlayClick}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="ds-card max-w-md space-y-4"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id={titleId} className="text-lg font-bold text-content">
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}
