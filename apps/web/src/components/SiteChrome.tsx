"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState } from "react";
import styles from "./SiteChrome.module.css";

type NavItem = {
  href: string;
  label: string;
  hint?: string;
};

type NavGroup = {
  id: string;
  label: string;
  items: NavItem[];
};

const PRIMARY: NavItem[] = [
  { href: "/", label: "New article" },
  { href: "/jobs", label: "Recent jobs" },
  { href: "/about", label: "About" },
];

const SIDE_GROUPS: NavGroup[] = [
  {
    id: "create",
    label: "Create",
    items: [
      { href: "/", label: "New article", hint: "Start a research topic" },
      { href: "/jobs", label: "Recent jobs", hint: "In-memory session history" },
    ],
  },
  {
    id: "learn",
    label: "Learn",
    items: [
      {
        href: "/about",
        label: "How it works",
        hint: "OpenAlex → screen → evidence → draft",
      },
      {
        href: "/docs",
        label: "Docs & export",
        hint: "Pandoc MD/HTML/DOCX + BibTeX",
      },
    ],
  },
  {
    id: "account",
    label: "Preferences",
    items: [
      {
        href: "/settings",
        label: "Settings",
        hint: "Depth, citations — placeholders",
      },
    ],
  },
];

export function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const panelId = useId();
  const [sideOpen, setSideOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    create: true,
    learn: true,
    account: false,
  });

  useEffect(() => {
    if (!sideOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSideOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sideOpen]);

  function closeSide() {
    setSideOpen(false);
  }

  function toggleGroup(id: string) {
    setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <div className={styles.root} data-side-open={sideOpen || undefined}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <button
            type="button"
            className={styles.menuBtn}
            aria-expanded={sideOpen}
            aria-controls={panelId}
            onClick={() => setSideOpen((v) => !v)}
          >
            <span className={styles.menuIcon} aria-hidden />
            Menu
          </button>

          <Link href="/" className={styles.brandMark}>
            ProofPress
          </Link>

          <nav className={styles.primaryNav} aria-label="Primary">
            {PRIMARY.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={styles.primaryLink}
                data-active={isActive(item.href) || undefined}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <Link href="/docs" className={styles.headerAside}>
            Docs
          </Link>
        </div>
      </header>

      <div
        className={styles.backdrop}
        aria-hidden={!sideOpen}
        onClick={closeSide}
      />

      <aside
        id={panelId}
        className={styles.side}
        aria-label="Site menu"
        aria-hidden={!sideOpen}
      >
        <div className={styles.sideHead}>
          <p className={styles.sideTitle}>Navigate</p>
          <button type="button" className={styles.closeBtn} onClick={closeSide}>
            Close
          </button>
        </div>

        {SIDE_GROUPS.map((group) => {
          const expanded = Boolean(openGroups[group.id]);
          return (
            <div key={group.id} className={styles.group}>
              <button
                type="button"
                className={styles.groupToggle}
                aria-expanded={expanded}
                onClick={() => toggleGroup(group.id)}
              >
                <span>{group.label}</span>
                <span className={styles.chevron} aria-hidden>
                  {expanded ? "−" : "+"}
                </span>
              </button>
              {expanded ? (
                <ul className={styles.groupList}>
                  {group.items.map((item) => (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={styles.sideLink}
                        data-active={isActive(item.href) || undefined}
                        onClick={closeSide}
                      >
                        <span className={styles.sideLinkLabel}>{item.label}</span>
                        {item.hint ? (
                          <span className={styles.sideLinkHint}>{item.hint}</span>
                        ) : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          );
        })}
      </aside>

      <div className={styles.content}>{children}</div>
    </div>
  );
}
