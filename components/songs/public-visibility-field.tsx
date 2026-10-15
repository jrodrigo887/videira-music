"use client";

import { useId, useState } from "react";

export const PUBLIC_LYRICS_HELP =
  "Visível ao público: qualquer pessoa, mesmo sem login, poderá ler a letra desta música na página de letras. Os acordes continuam visíveis só para membros da igreja.";

type PublicVisibilityFieldProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  variant?: "checkbox" | "pill";
};

function PublicVisibilityHelpButton({
  disabled,
  showHelp,
  onToggle,
  helpId,
}: {
  disabled: boolean;
  showHelp: boolean;
  onToggle: () => void;
  helpId: string;
}) {
  return (
    <button
      type="button"
      aria-label="Informação sobre visibilidade pública"
      aria-expanded={showHelp}
      aria-controls={helpId}
      disabled={disabled}
      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border text-xs font-bold text-content-muted transition hover:border-primary hover:text-primary"
      onClick={onToggle}
    >
      i
    </button>
  );
}

export function PublicVisibilityField({
  checked,
  onChange,
  disabled = false,
  variant = "checkbox",
}: PublicVisibilityFieldProps) {
  const helpId = useId();
  const [showHelp, setShowHelp] = useState(false);
  const toggleHelp = () => setShowHelp((value) => !value);

  if (variant === "pill") {
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            aria-pressed={checked}
            aria-label="Visível ao público"
            disabled={disabled}
            onClick={() => onChange(!checked)}
            className={
              checked
                ? "inline-flex items-center rounded-full bg-content px-3 py-1 text-xs font-semibold text-content-inverse transition hover:opacity-90"
                : "inline-flex items-center rounded-full bg-surface-muted px-3 py-1 text-xs font-semibold text-content-muted transition hover:border-primary hover:text-primary"
            }
          >
            Visível ao público
          </button>
          <PublicVisibilityHelpButton
            disabled={disabled}
            showHelp={showHelp}
            onToggle={toggleHelp}
            helpId={helpId}
          />
        </div>
        {showHelp ? (
          <p id={helpId} className="text-xs text-content-muted">
            {PUBLIC_LYRICS_HELP}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <label className="flex flex-1 cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={checked}
            disabled={disabled}
            onChange={(event) => onChange(event.target.checked)}
            className="h-4 w-4 rounded border-border"
          />
          <span className="text-sm font-medium text-content">Visível ao público</span>
        </label>
        <PublicVisibilityHelpButton
          disabled={disabled}
          showHelp={showHelp}
          onToggle={toggleHelp}
          helpId={helpId}
        />
      </div>
      {showHelp ? (
        <p id={helpId} className="text-xs text-content-muted">
          {PUBLIC_LYRICS_HELP}
        </p>
      ) : null}
    </div>
  );
}
