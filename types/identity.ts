export type UserId = string;
export type WorshipTeamId = string;

/** Papel do usuário na igreja (organização). Papéis se acumulam. */
export type OrganizationRole = "admin" | "manager" | "worship_leader" | "musician";

/** Papel do usuário dentro de um grupo de louvor. */
export type WorshipTeamRole = "leader" | "member";

export type User = {
  id: UserId;
  organizationId: string;
  name: string;
  email: string;
  roles: ReadonlyArray<OrganizationRole>;
  status?: "active" | "deactivated";
};

export type WorshipTeam = {
  id: WorshipTeamId;
  organizationId: string;
  slug: string;
  name: string;
  archivedAt?: string;
};

export type WorshipTeamMembership = {
  teamId: WorshipTeamId;
  userId: UserId;
  role: WorshipTeamRole;
};
