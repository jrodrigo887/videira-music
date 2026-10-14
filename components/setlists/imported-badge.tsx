type ImportedBadgeProps = {
  originUrl?: string;
};

export function ImportedBadge({ originUrl }: ImportedBadgeProps) {
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span className="ds-badge-accent">Importada</span>
      {originUrl ? (
        <a
          href={originUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="ds-link text-xs"
        >
          Fonte
        </a>
      ) : null}
    </span>
  );
}
