/**
 * MetaDJ Soundscape - Homepage
 * Redirects to the Soundscape experience
 */

import { redirect } from "next/navigation";

export default function Home() {
  redirect("/soundscape");
}
