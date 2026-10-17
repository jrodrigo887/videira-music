import type { Actor } from "@/lib/auth/actor";
import { hasCapability, teamRoleOf } from "@/lib/auth/actor";

export type SetlistAction =
  | "read"
  | "create"
  | "edit"
  | "changeStatus"
  | "delete"
  | "follow"
  | "clone"
  | "manageTeams";

export type SetlistAccess = {
  organizationId: string;
  ownerTeamId: string | null;
  createdByUserId: string | null;
  status: string;
  visibility: string;
  deletedAt: string | null;
  followerTeamIds: readonly string[];
};

export type PolicyTarget =
  | { type: "setlist"; setlist: SetlistAccess }
  | { type: "destination"; organizationId: string; teamId: string | null }
  | { type: "organization"; organizationId: string };

function actorOrganizationId(actor: Actor): string | undefined {
  return actor.kind === "user" ? actor.organizationId : undefined;
}

function isSameOrganization(actor: Actor, organizationId: string): boolean {
  return actor.kind === "user" && actor.organizationId === organizationId;
}

function isCrossOrganization(actor: Actor, organizationId: string): boolean {
  if (actor.kind === "anonymous") {
    return true;
  }
  return actor.organizationId !== organizationId;
}

function isMemberOfTeam(actor: Actor, teamId: string): boolean {
  return teamRoleOf(actor, teamId) !== undefined;
}

function canEditSetlistByCapability(actor: Actor, setlist: SetlistAccess): boolean {
  if (setlist.deletedAt) {
    return false;
  }
  if (!isSameOrganization(actor, setlist.organizationId)) {
    return false;
  }
  if (hasCapability(actor, "setlists:all", setlist.organizationId)) {
    return true;
  }
  if (setlist.ownerTeamId && teamRoleOf(actor, setlist.ownerTeamId) === "leader") {
    return hasCapability(actor, "setlists:led", setlist.organizationId);
  }
  return false;
}

export function canEditSetlistContent(actor: Actor, setlist: SetlistAccess): boolean {
  if (setlist.deletedAt) {
    return false;
  }
  if (!isSameOrganization(actor, setlist.organizationId)) {
    return false;
  }
  if (actor.kind === "user" && setlist.createdByUserId === actor.userId) {
    return true;
  }
  return canEditSetlistByCapability(actor, setlist);
}

function canActOnDestination(actor: Actor, organizationId: string, teamId: string | null): boolean {
  if (!isSameOrganization(actor, organizationId)) {
    return false;
  }
  if (hasCapability(actor, "setlists:all", organizationId)) {
    return true;
  }
  if (teamId && teamRoleOf(actor, teamId) === "leader") {
    return hasCapability(actor, "setlists:led", organizationId);
  }
  return false;
}

function canReadSetlist(actor: Actor, setlist: SetlistAccess): boolean {
  if (setlist.deletedAt) {
    return false;
  }

  if (setlist.status === "draft" || setlist.visibility === "private") {
    return canEditSetlistContent(actor, setlist);
  }

  if (actor.kind === "anonymous") {
    return false;
  }

  if (isCrossOrganization(actor, setlist.organizationId)) {
    return setlist.visibility === "public" && setlist.status === "published";
  }

  if (setlist.visibility === "team") {
    if (canEditSetlistContent(actor, setlist)) {
      return true;
    }
    if (setlist.ownerTeamId && isMemberOfTeam(actor, setlist.ownerTeamId)) {
      return true;
    }
    return setlist.followerTeamIds.some((teamId) => isMemberOfTeam(actor, teamId));
  }

  if (setlist.visibility === "organization") {
    return isSameOrganization(actor, setlist.organizationId);
  }

  if (setlist.visibility === "public") {
    return setlist.status === "published" || setlist.status === "archived";
  }

  return false;
}

export function canPerform(actor: Actor, action: SetlistAction, target: PolicyTarget): boolean {
  if (action === "read") {
    if (target.type !== "setlist") {
      return false;
    }
    return canReadSetlist(actor, target.setlist);
  }

  if (actor.kind === "anonymous") {
    return false;
  }

  if (action === "manageTeams") {
    return (
      target.type === "organization" &&
      hasCapability(actor, "teams:manage", target.organizationId)
    );
  }

  if (action === "create" || action === "follow" || action === "clone") {
    if (target.type !== "destination") {
      return false;
    }
    if (action === "create" || action === "clone") {
      if (target.teamId === null) {
        return hasCapability(actor, "setlists:all", target.organizationId);
      }
    }
    return canActOnDestination(actor, target.organizationId, target.teamId);
  }

  if (
    action === "edit" ||
    action === "changeStatus" ||
    action === "delete"
  ) {
    if (target.type !== "setlist") {
      return false;
    }
    const { setlist } = target;
    if (isCrossOrganization(actor, setlist.organizationId)) {
      return false;
    }
    if (action === "edit") {
      return canEditSetlistContent(actor, setlist);
    }
    return canEditSetlistByCapability(actor, setlist);
  }

  return false;
}

/** Expõe helpers para testes e serviços. */
export const setlistPolicyInternals = {
  canEditSetlistByCapability,
  canEditSetlistContent,
  canReadSetlist,
  actorOrganizationId,
};
