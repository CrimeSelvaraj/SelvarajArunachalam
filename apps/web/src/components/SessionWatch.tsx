"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { currentDevice } from "@/lib/device";

export function SessionWatch() {
  const router = useRouter();

  useEffect(() => {
    let stop = false;

    async function check() {
      let deviceId = "";
      try {
        deviceId = currentDevice().id;
      } catch {
        deviceId = "";
      }
      const response = await fetch("/api/auth/session", {
        cache: "no-store",
        headers: deviceId ? { "x-atoz-device": deviceId } : {},
      });
      if (stop || response.ok) return;
      const body = (await response.json().catch(() => null)) as { reason?: string } | null;
      if (body?.reason === "ended" || body?.reason === "other-device") {
        sessionStorage.setItem(
          "atoz.notice",
          "This system was signed out. The session moved to another device. Sign in again to take it back.",
        );
      }
      router.refresh();
    }

    void check();
    const timer = window.setInterval(() => void check(), 4000);
    return () => {
      stop = true;
      window.clearInterval(timer);
    };
  }, [router]);

  return null;
}
