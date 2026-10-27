"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import type { PublicViewer } from "@/lib/types";
import { LoopMark } from "./LoopMark";
import styles from "./shell.module.css";

const LINKS = [
  { href: "/library", label: "Library" },
  { href: "/read/sample", label: "Sample drill" },
  { href: "/badges", label: "Badges" },
  { href: "/access", label: "Access" },
];

export function AppShell({
  viewer,
  children,
}: {
  viewer: PublicViewer;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [navPath, setNavPath] = useState<string | null>(null);
  const [menuState, setMenuState] = useState<{ name: "read" | "account"; path: string } | null>(null);
  const navOpen = navPath === pathname;
  const openMenu = menuState?.path === pathname ? menuState.name : null;
  const menusRef = useRef<HTMLDivElement>(null);
  const readId = useId();
  const accountId = useId();

  useEffect(() => {
    function onPointer(event: MouseEvent) {
      if (!menusRef.current?.contains(event.target as Node)) setMenuState(null);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuState(null);
        setNavPath(null);
      }
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  function current(href: string): boolean {
    if (href === "/library") {
      return pathname === "/library" || (pathname.startsWith("/read/") && pathname !== "/read/sample");
    }
    return pathname === href;
  }

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.refresh();
    router.push("/");
  }

  return (
    <div className={styles.frame}>
      <a className={styles.skip} href="#main">
        Skip to content
      </a>
      <header className={styles.header}>
        <button
          type="button"
          className={styles.burger}
          aria-expanded={navOpen}
          aria-controls="side-panel"
          onClick={() => setNavPath(navOpen ? null : pathname)}
        >
          Menu
        </button>
        <Link href="/" className={styles.brand}>
          <LoopMark />
          <span className={styles.brandText}>
            <span className={styles.wordmark}>LOOP READ</span>
          </span>
        </Link>
        <p className={styles.tagline}>Read Faster...Think Smarter</p>
        <div className={styles.menus} ref={menusRef}>
          <div className={styles.menu}>
            <button
              type="button"
              className={styles.trigger}
              aria-expanded={openMenu === "read"}
              aria-controls={readId}
              onClick={() => setMenuState(openMenu === "read" ? null : { name: "read", path: pathname })}
            >
              Read
            </button>
            {openMenu === "read" ? (
              <div className={styles.panel} id={readId} role="menu">
                <Link role="menuitem" href="/read/sample" onClick={() => setMenuState(null)}>
                  Sample drill
                </Link>
                <Link role="menuitem" href="/library" onClick={() => setMenuState(null)}>
                  Library
                </Link>
              </div>
            ) : null}
          </div>
          <div className={styles.menu}>
            <button
              type="button"
              className={styles.trigger}
              aria-expanded={openMenu === "account"}
              aria-controls={accountId}
              onClick={() => setMenuState(openMenu === "account" ? null : { name: "account", path: pathname })}
            >
              Account
            </button>
            {openMenu === "account" ? (
              <div className={styles.panel} id={accountId} role="menu">
                {viewer.kind === "user" ? (
                  <>
                    <p className={styles.quiet}>{viewer.email}</p>
                    <p className={styles.quiet}>{viewer.paid ? "Access unlocked" : "Access due · 1 USD"}</p>
                    <Link role="menuitem" href="/access" onClick={() => setMenuState(null)}>
                      Access
                    </Link>
                    <button type="button" role="menuitem" onClick={() => void signOut()}>
                      Sign out
                    </button>
                  </>
                ) : (
                  <Link role="menuitem" href="/login" onClick={() => setMenuState(null)}>
                    Sign in
                  </Link>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </header>
      <div className={styles.body}>
        {navOpen ? (
          <button type="button" className={styles.backdrop} aria-label="Close menu" onClick={() => setNavPath(null)} />
        ) : null}
        <aside id="side-panel" className={`${styles.side} ${navOpen ? styles.sideOpen : ""}`}>
          <nav className={styles.nav} aria-label="Primary">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                aria-current={current(link.href) ? "page" : undefined}
                onClick={() => setNavPath(null)}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <p className={styles.sideNote}>Read Faster...Think Smarter</p>
        </aside>
        <main id="main" className={styles.main}>
          {children}
        </main>
      </div>
    </div>
  );
}
