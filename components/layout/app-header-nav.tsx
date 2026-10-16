"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";

import { signOut } from "@/lib/auth/auth-actions";

type AppHeaderNavProps = {
  loggedIn: boolean;
  importLinkVisible: boolean;
  groupsLinkVisible: boolean;
  usersLinkVisible: boolean;
};

const desktopLinkClass =
  "shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 transition hover:bg-surface-muted hover:text-primary";

const mobileLinkClass =
  "block rounded-xl px-4 py-3 text-base font-semibold text-content transition hover:bg-surface-muted hover:text-primary";

function MenuIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" className="text-current">
      <path
        d="M3 5h14M3 10h14M3 15h14"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" className="text-current">
      <path
        d="m5 5 10 10M15 5 5 15"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function AppHeaderNav({
  loggedIn,
  importLinkVisible,
  groupsLinkVisible,
  usersLinkVisible,
}: AppHeaderNavProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const panelId = useId();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    }

    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [menuOpen]);

  function closeMenu() {
    setMenuOpen(false);
  }

  const navLinks = loggedIn ? (
    <>
      <Link className={desktopLinkClass} href="/songs">
        Biblioteca
      </Link>
      {importLinkVisible ? (
        <Link className={desktopLinkClass} href="/import">
          Importar
        </Link>
      ) : null}
      <Link className={desktopLinkClass} href="/setlists">
        Setlists
      </Link>
      {groupsLinkVisible ? (
        <Link className={desktopLinkClass} href="/groups">
          Grupos
        </Link>
      ) : null}
      {usersLinkVisible ? (
        <Link className={desktopLinkClass} href="/usuarios">
          Usuários
        </Link>
      ) : null}
      <form action={signOut} className="inline shrink-0">
        <button type="submit" className={desktopLinkClass}>
          Sair
        </button>
      </form>
    </>
  ) : (
    <Link className={desktopLinkClass} href="/entrar">
      Entrar
    </Link>
  );

  const mobileNavLinks = loggedIn ? (
    <>
      <Link className={mobileLinkClass} href="/songs" onClick={closeMenu}>
        Biblioteca
      </Link>
      {importLinkVisible ? (
        <Link className={mobileLinkClass} href="/import" onClick={closeMenu}>
          Importar
        </Link>
      ) : null}
      <Link className={mobileLinkClass} href="/setlists" onClick={closeMenu}>
        Setlists
      </Link>
      {groupsLinkVisible ? (
        <Link className={mobileLinkClass} href="/groups" onClick={closeMenu}>
          Grupos
        </Link>
      ) : null}
      {usersLinkVisible ? (
        <Link className={mobileLinkClass} href="/usuarios" onClick={closeMenu}>
          Usuários
        </Link>
      ) : null}
      <form action={signOut} className="block">
        <button type="submit" className={`${mobileLinkClass} w-full text-left`}>
          Sair
        </button>
      </form>
    </>
  ) : (
    <Link className={mobileLinkClass} href="/entrar" onClick={closeMenu}>
      Entrar
    </Link>
  );

  return (
    <>
      <nav
        className="hidden min-w-0 items-center justify-end gap-6 text-sm font-semibold text-content-muted md:flex"
        aria-label="Navegação principal"
      >
        {navLinks}
      </nav>

      <button
        type="button"
        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-content shadow-xs transition hover:border-primary hover:text-primary md:hidden"
        aria-expanded={menuOpen}
        aria-controls={panelId}
        aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
        onClick={() => setMenuOpen((open) => !open)}
      >
        {menuOpen ? <CloseIcon /> : <MenuIcon />}
      </button>

      {menuOpen && mounted
        ? createPortal(
            <div className="fixed inset-0 z-50 md:hidden">
              <button
                type="button"
                aria-label="Fechar menu"
                className="absolute inset-0 bg-content/35 backdrop-blur-sm"
                onClick={closeMenu}
              />
              <nav
                id={panelId}
                aria-label="Navegação principal"
                className="absolute inset-y-0 right-0 flex w-[min(100%,18rem)] flex-col border-l border-border bg-surface p-4 shadow-2xl"
              >
                <div className="mb-4 flex items-center justify-between gap-3">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Menu</p>
                  <button
                    type="button"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface text-content shadow-xs transition hover:border-primary hover:text-primary"
                    aria-label="Fechar menu"
                    onClick={closeMenu}
                  >
                    <CloseIcon />
                  </button>
                </div>
                <div className="flex flex-col gap-1 overflow-y-auto">{mobileNavLinks}</div>
              </nav>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
