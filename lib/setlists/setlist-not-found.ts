import { notFound } from "next/navigation";

import { SetlistError } from "@/lib/setlists/setlist-errors";

export function notFoundIfSetlistMissing(error: unknown): never {
  if (error instanceof SetlistError && error.code === "SETLIST_NOT_FOUND") {
    notFound();
  }
  throw error;
}
