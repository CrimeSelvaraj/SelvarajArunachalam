import { redirect } from "next/navigation";
import { getViewer } from "./auth";
import type { User } from "./types";

export async function gateUser(): Promise<User> {
  const viewer = await getViewer();
  if (viewer.kind === "replaced") redirect("/login?reason=replaced");
  if (viewer.kind !== "user") redirect("/login");
  return viewer.user;
}

export async function gatePaid(): Promise<User> {
  const user = await gateUser();
  if (!user.paid) redirect("/access");
  return user;
}
