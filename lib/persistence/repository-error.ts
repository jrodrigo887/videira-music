export type ValidationIssue = {
  path: string;
  message: string;
};

export class RepositoryError extends Error {
  readonly code: string;
  readonly status: number;
  readonly issues?: ValidationIssue[];
  readonly existingChartId?: string;

  constructor(
    code: string,
    status: number,
    message: string,
    extras?: { issues?: ValidationIssue[]; existingChartId?: string },
  ) {
    super(message);
    this.name = "RepositoryError";
    this.code = code;
    this.status = status;
    this.issues = extras?.issues;
    this.existingChartId = extras?.existingChartId;
  }
}

export class OriginUrlConflictError extends Error {
  readonly existingChartId: string;

  constructor(existingChartId: string) {
    super("Origin URL already in use");
    this.name = "OriginUrlConflictError";
    this.existingChartId = existingChartId;
  }
}

export class SongNotFoundError extends Error {
  constructor() {
    super("Song not found");
    this.name = "SongNotFoundError";
  }
}
