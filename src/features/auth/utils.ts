import { redirect } from "next/navigation";
import { auth } from "@/auth";

export const protectServer = async () => {
  const session = await auth();

  if (session) {
    return;
  }

  // If no session, redirect to sign-in
  // Middleware will handle first-visit logic
  redirect("/api/auth/signin");
};
