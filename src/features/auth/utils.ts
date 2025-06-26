import { redirect } from "next/navigation";
import { auth } from "@/auth";

export const protectServer = async () => {
  const session = await auth();

  if (session) {
    return;
  }

  // If no session, redirect to try page
  redirect("/try");
};
