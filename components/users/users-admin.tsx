"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { AccessRequestSummary } from "@/lib/access-requests/access-request-service";
import type { InviteSummary } from "@/lib/invites/invite-service";
import type { RoleRecord } from "@/lib/roles/role-service";
import type { WorshipTeam } from "@/types/identity";

import { InvitesPanel } from "./invites-panel";
import { MembersPanel } from "./members-panel";
import { RequestsPanel } from "./requests-panel";
import { RolesPanel } from "./roles-panel";
import type { MemberRow } from "./user-admin-shared";

export type { MemberRow };

const TABS = [
  { id: "membros", label: "Membros" },
  { id: "convites", label: "Convites" },
  { id: "pedidos", label: "Pedidos" },
  { id: "papeis", label: "Papéis" },
] as const;

export type UsersTab = (typeof TABS)[number]["id"];

type UsersAdminProps = {
  members: MemberRow[];
  invites: InviteSummary[];
  requests: AccessRequestSummary[];
  roles: RoleRecord[];
  teams: WorshipTeam[];
  canGrantAdmin: boolean;
  canEditCatalog: boolean;
  currentUserId: string;
  initialTab: UsersTab;
};

function normalizeTab(value: string | undefined): UsersTab {
  if (value === "convites" || value === "pedidos" || value === "papeis") {
    return value;
  }
  return "membros";
}

export function UsersAdmin({
  members,
  invites,
  requests,
  roles,
  teams,
  canGrantAdmin,
  canEditCatalog,
  currentUserId,
  initialTab,
}: UsersAdminProps) {
  const router = useRouter();
  const [tab, setTab] = useState<UsersTab>(normalizeTab(initialTab));
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function switchTab(next: UsersTab) {
    setTab(next);
    router.replace(`/usuarios?aba=${next}`);
  }

  async function refreshPage() {
    router.refresh();
  }

  return (
    <div className="space-y-8">
      <nav className="flex flex-wrap gap-2 border-b border-border pb-2">
        {TABS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            className={
              tab === entry.id
                ? "rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground"
                : "rounded-full px-4 py-1.5 text-sm font-semibold text-content-muted hover:bg-surface-muted"
            }
            onClick={() => switchTab(entry.id)}
          >
            {entry.label}
          </button>
        ))}
      </nav>

      {message ? (
        <p role="alert" className="rounded-xl border border-border bg-surface-muted px-4 py-3 text-sm text-content">
          {message}
        </p>
      ) : null}

      {tab === "membros" ? (
        <MembersPanel
          initialMembers={members}
          roles={roles}
          teams={teams}
          canGrantAdmin={canGrantAdmin}
          currentUserId={currentUserId}
          onMessage={setMessage}
          busy={busy}
          setBusy={setBusy}
          onRefresh={refreshPage}
        />
      ) : null}

      {tab === "convites" ? (
        <InvitesPanel
          initialInvites={invites}
          roles={roles}
          teams={teams}
          canGrantAdmin={canGrantAdmin}
          onMessage={setMessage}
          busy={busy}
          setBusy={setBusy}
          onRefresh={refreshPage}
        />
      ) : null}

      {tab === "pedidos" ? (
        <RequestsPanel
          initialRequests={requests}
          roles={roles}
          teams={teams}
          canGrantAdmin={canGrantAdmin}
          onMessage={setMessage}
          busy={busy}
          setBusy={setBusy}
          onRefresh={refreshPage}
        />
      ) : null}

      {tab === "papeis" ? (
        <RolesPanel
          initialRoles={roles}
          canEditCatalog={canEditCatalog}
          onMessage={setMessage}
          busy={busy}
          setBusy={setBusy}
          onRefresh={refreshPage}
        />
      ) : null}
    </div>
  );
}
