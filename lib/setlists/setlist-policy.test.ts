import { describe, expect, it } from "vitest";

import type { Actor } from "@/lib/auth/actor";
import { DEFAULT_ORGANIZATION_ID } from "@/lib/persistence/organization-scope";

import {
  canPerform,
  type SetlistAccess,
  type SetlistAction,
} from "./setlist-policy";

const ORG = DEFAULT_ORGANIZATION_ID;
const OTHER_ORG = "org-other";

const admin: Actor = {
  kind: "user",
  userId: "user-admin",
  organizationId: ORG,
  roles: ["admin"],
  teams: [],
};

const ownerLeader: Actor = {
  kind: "user",
  userId: "user-leader",
  organizationId: ORG,
  roles: ["worship_leader"],
  teams: [{ teamId: "team-louvor", role: "leader" }],
};

const otherLeader: Actor = {
  kind: "user",
  userId: "user-jovens-leader",
  organizationId: ORG,
  roles: ["worship_leader"],
  teams: [{ teamId: "team-jovens", role: "leader" }],
};

const ownerMember: Actor = {
  kind: "user",
  userId: "user-musician",
  organizationId: ORG,
  roles: ["musician"],
  teams: [{ teamId: "team-louvor", role: "member" }],
};

const followerMember: Actor = {
  kind: "user",
  userId: "user-follower",
  organizationId: ORG,
  roles: ["musician"],
  teams: [{ teamId: "team-jovens", role: "member" }],
};

const orgMember: Actor = {
  kind: "user",
  userId: "user-org",
  organizationId: ORG,
  roles: ["musician"],
  teams: [],
};

const otherOrgUser: Actor = {
  kind: "user",
  userId: "user-other",
  organizationId: OTHER_ORG,
  roles: ["admin"],
  teams: [],
};

const anonymous: Actor = { kind: "anonymous" };

function setlist(overrides: Partial<SetlistAccess> = {}): SetlistAccess {
  return {
    organizationId: ORG,
    ownerTeamId: "team-louvor",
    status: "published",
    visibility: "team",
    deletedAt: null,
    followerTeamIds: ["team-jovens"],
    ...overrides,
  };
}

type MatrixCase = {
  name: string;
  actor: Actor;
  action: SetlistAction;
  target: Parameters<typeof canPerform>[2];
  expected: boolean;
};

const destinationTeam = { type: "destination" as const, organizationId: ORG, teamId: "team-louvor" };
const destinationOrg = { type: "destination" as const, organizationId: ORG, teamId: null };
const manageOrg = { type: "organization" as const, organizationId: ORG };

const matrix: MatrixCase[] = [
  { name: "admin edits team setlist", actor: admin, action: "edit", target: { type: "setlist", setlist: setlist() }, expected: true },
  { name: "owner leader edits", actor: ownerLeader, action: "edit", target: { type: "setlist", setlist: setlist() }, expected: true },
  { name: "other leader denied edit", actor: otherLeader, action: "edit", target: { type: "setlist", setlist: setlist() }, expected: false },
  { name: "member denied edit", actor: ownerMember, action: "edit", target: { type: "setlist", setlist: setlist() }, expected: false },
  { name: "anonymous denied edit", actor: anonymous, action: "edit", target: { type: "setlist", setlist: setlist() }, expected: false },
  { name: "other org denied edit", actor: otherOrgUser, action: "edit", target: { type: "setlist", setlist: setlist() }, expected: false },

  { name: "admin changeStatus", actor: admin, action: "changeStatus", target: { type: "setlist", setlist: setlist() }, expected: true },
  { name: "owner leader changeStatus", actor: ownerLeader, action: "changeStatus", target: { type: "setlist", setlist: setlist() }, expected: true },
  { name: "member denied changeStatus", actor: ownerMember, action: "changeStatus", target: { type: "setlist", setlist: setlist() }, expected: false },

  { name: "admin delete", actor: admin, action: "delete", target: { type: "setlist", setlist: setlist() }, expected: true },
  { name: "owner leader delete", actor: ownerLeader, action: "delete", target: { type: "setlist", setlist: setlist() }, expected: true },
  { name: "follower member denied delete", actor: followerMember, action: "delete", target: { type: "setlist", setlist: setlist() }, expected: false },

  { name: "admin create team destination", actor: admin, action: "create", target: destinationTeam, expected: true },
  { name: "owner leader create team destination", actor: ownerLeader, action: "create", target: destinationTeam, expected: true },
  { name: "member denied create", actor: ownerMember, action: "create", target: destinationTeam, expected: false },
  { name: "admin create org destination", actor: admin, action: "create", target: destinationOrg, expected: true },
  { name: "leader denied org create", actor: ownerLeader, action: "create", target: destinationOrg, expected: false },

  { name: "admin follow", actor: admin, action: "follow", target: destinationTeam, expected: true },
  { name: "other leader follow", actor: otherLeader, action: "follow", target: { type: "destination", organizationId: ORG, teamId: "team-jovens" }, expected: true },
  { name: "member denied follow", actor: followerMember, action: "follow", target: { type: "destination", organizationId: ORG, teamId: "team-jovens" }, expected: false },

  { name: "admin clone team", actor: admin, action: "clone", target: destinationTeam, expected: true },
  { name: "leader clone own team", actor: ownerLeader, action: "clone", target: destinationTeam, expected: true },
  { name: "admin clone org", actor: admin, action: "clone", target: destinationOrg, expected: true },
  { name: "leader denied clone org", actor: ownerLeader, action: "clone", target: destinationOrg, expected: false },

  { name: "admin manageTeams", actor: admin, action: "manageTeams", target: manageOrg, expected: true },
  { name: "leader denied manageTeams", actor: ownerLeader, action: "manageTeams", target: manageOrg, expected: false },
  { name: "member denied manageTeams", actor: orgMember, action: "manageTeams", target: manageOrg, expected: false },

  { name: "org setlist edit admin only", actor: admin, action: "edit", target: { type: "setlist", setlist: setlist({ ownerTeamId: null }) }, expected: true },
  { name: "org setlist edit leader denied", actor: ownerLeader, action: "edit", target: { type: "setlist", setlist: setlist({ ownerTeamId: null }) }, expected: false },

  { name: "read deleted denied", actor: admin, action: "read", target: { type: "setlist", setlist: setlist({ deletedAt: "2026-01-01T00:00:00.000Z" }) }, expected: false },
  { name: "read draft needs edit", actor: ownerMember, action: "read", target: { type: "setlist", setlist: setlist({ status: "draft" }) }, expected: false },
  { name: "read draft leader ok", actor: ownerLeader, action: "read", target: { type: "setlist", setlist: setlist({ status: "draft" }) }, expected: true },
  { name: "read private member denied", actor: ownerMember, action: "read", target: { type: "setlist", setlist: setlist({ visibility: "private" }) }, expected: false },
  { name: "read team owner member", actor: ownerMember, action: "read", target: { type: "setlist", setlist: setlist() }, expected: true },
  { name: "read team follower member", actor: followerMember, action: "read", target: { type: "setlist", setlist: setlist() }, expected: true },
  { name: "read team outsider denied", actor: orgMember, action: "read", target: { type: "setlist", setlist: setlist() }, expected: false },
  { name: "read organization member", actor: orgMember, action: "read", target: { type: "setlist", setlist: setlist({ visibility: "organization", ownerTeamId: null }) }, expected: true },
  { name: "read organization anonymous denied", actor: anonymous, action: "read", target: { type: "setlist", setlist: setlist({ visibility: "organization", ownerTeamId: null }) }, expected: false },
  { name: "read organization anonymous other org denied", actor: anonymous, action: "read", target: { type: "setlist", setlist: setlist({ organizationId: OTHER_ORG, visibility: "organization", ownerTeamId: null }) }, expected: false },
  { name: "read public published anonymous denied", actor: anonymous, action: "read", target: { type: "setlist", setlist: setlist({ visibility: "public" }) }, expected: false },
  { name: "read public draft anonymous denied", actor: anonymous, action: "read", target: { type: "setlist", setlist: setlist({ visibility: "public", status: "draft" }) }, expected: false },
  { name: "read cross-org public published", actor: otherOrgUser, action: "read", target: { type: "setlist", setlist: setlist({ visibility: "public" }) }, expected: true },
  { name: "read cross-org team denied", actor: otherOrgUser, action: "read", target: { type: "setlist", setlist: setlist({ visibility: "team" }) }, expected: false },
  { name: "create foreign org denied", actor: otherOrgUser, action: "create", target: { type: "destination", organizationId: ORG, teamId: "team-louvor" }, expected: false },
  { name: "follow cross-org denied", actor: otherOrgUser, action: "follow", target: { type: "destination", organizationId: ORG, teamId: "team-louvor" }, expected: false },
];

describe("canPerform matrix", () => {
  it.each(matrix)("$name", ({ actor, action, target, expected }) => {
    expect(canPerform(actor, action, target)).toBe(expected);
  });

  it("has at least 40 table cases", () => {
    expect(matrix.length).toBeGreaterThanOrEqual(40);
  });
});
