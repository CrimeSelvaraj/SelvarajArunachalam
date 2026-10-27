import { getViewer, toPublicViewer } from "@/lib/auth";
import { AppShell } from "./AppShell";

export async function Chrome({ children }: { children: React.ReactNode }) {
  const viewer = toPublicViewer(await getViewer());
  return <AppShell viewer={viewer}>{children}</AppShell>;
}
