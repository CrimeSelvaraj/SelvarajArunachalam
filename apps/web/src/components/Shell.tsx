"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Boundary } from "@/components/Boundary";
import { SessionWatch } from "@/components/SessionWatch";
import { Notice } from "@/components/ui";
import { features, featuresIn, groups, type Feature } from "@/features";

function normalize(path: string): string {
  if (path.length > 1 && path.endsWith("/")) return path.slice(0, -1);
  return path || "/";
}

function BenchLink({
  feature,
  pathname,
  onNavigate,
  detail,
}: {
  feature: Feature;
  pathname: string;
  onNavigate?: () => void;
  detail?: boolean;
}) {
  const active = normalize(pathname) === normalize(feature.path);
  return (
    <Link
      href={feature.path}
      aria-current={active ? "page" : undefined}
      className={detail ? "menu-link" : undefined}
      onClick={onNavigate}
    >
      <strong>{feature.name}</strong>
      {detail ? <span>{feature.summary}</span> : null}
    </Link>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/";
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.body.classList.toggle("nav-open", open);
    return () => document.body.classList.remove("nav-open");
  }, [open]);

  useEffect(() => {
    if (!open && !menuOpen) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        setMenuOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, menuOpen]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onPointer = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [menuOpen]);

  const needle = query.trim().toLowerCase();
  const closeAll = () => {
    setOpen(false);
    setMenuOpen(false);
  };

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.refresh();
  }

  return (
    <div className="shell">
      <SessionWatch />
      <a className="skip" href="#content">
        Skip to content
      </a>
      <aside className={open ? "side open" : "side"}>
        <div className="side-top">
          <div className="side-brand-row">
            <Link href="/" className="side-brand" onClick={closeAll}>
              ATOZ
            </Link>
            <button type="button" className="btn quiet side-close" onClick={() => setOpen(false)}>
              Close
            </button>
          </div>
          <label className="side-search">
            <span className="visually-hidden">Find a bench</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Find a bench"
              type="search"
            />
          </label>
        </div>
        <nav className="side-nav" aria-label="Benches">
          {needle && features.filter((feature) => feature.name.toLowerCase().includes(needle) || feature.summary.toLowerCase().includes(needle)).length === 0 ? (
            <Notice tone="empty" title="No bench matches">Try a shorter word, like voice, arena, or photo.</Notice>
          ) : null}
          {groups.map((group) => {
            const items = featuresIn(group.id).filter(
              (feature) => !needle || feature.name.toLowerCase().includes(needle) || feature.summary.toLowerCase().includes(needle),
            );
            if (items.length === 0) return null;
            const isOpen = Boolean(needle) || !collapsed[group.id];
            return (
              <div className="nav-group" key={group.id}>
                <button
                  type="button"
                  className="nav-label"
                  aria-expanded={isOpen}
                  onClick={() => setCollapsed((current) => ({ ...current, [group.id]: !current[group.id] }))}
                >
                  <span>{group.label}</span>
                  <span className="count">{items.length}</span>
                </button>
                {isOpen ? (
                  <div className="nav-links">
                    {items.map((feature) => (
                      <BenchLink key={feature.id} feature={feature} pathname={pathname} onNavigate={closeAll} />
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </nav>
      </aside>
      {open ? (
        <button type="button" className="backdrop" aria-label="Close benches" onClick={() => setOpen(false)} />
      ) : null}
      <div className="main-col">
        <header className="header">
          <button type="button" className="btn menu-btn" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
            Benches
          </button>
          <Link href="/" className="brand" onClick={closeAll}>
            <span className="brand-seal" aria-hidden="true" />
            <span className="brand-name">ATOZ</span>
          </Link>
          <div className="header-spacer" />
          <div className="all-benches menu" ref={menuRef}>
            <button
              type="button"
              className="btn menu-trigger"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((value) => !value)}
            >
              All benches
            </button>
            {menuOpen ? (
              <div className="menu-panel" role="menu">
                {groups.map((group) => (
                  <div className="menu-block" key={group.id}>
                    <p className="menu-group">{group.label}</p>
                    {featuresIn(group.id).map((feature) => (
                      <BenchLink
                        key={feature.id}
                        feature={feature}
                        pathname={pathname}
                        detail
                        onNavigate={closeAll}
                      />
                    ))}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
          <button type="button" className="btn quiet header-signout" onClick={() => void signOut()}>
            Sign out
          </button>
          <Link href="/" className="btn primary header-cta" onClick={closeAll}>
            New prompt
          </Link>
        </header>
        <main id="content" tabIndex={-1}>
          <Boundary resetKey={pathname}>{children}</Boundary>
        </main>
        <footer className="colophon">Workshop files stay on this system. Sign-in and the one-dollar payment are checked with this site.</footer>
      </div>
    </div>
  );
}
