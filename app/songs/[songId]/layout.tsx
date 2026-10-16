import type { ReactNode } from "react";

export default function SongDetailLayout({ children }: { children: ReactNode }) {
  return (
    <div className="-mt-5 w-full min-w-0 sm:-mt-6">
      {children}
    </div>
  );
}
