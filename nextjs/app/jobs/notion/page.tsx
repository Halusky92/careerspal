import { redirect } from "next/navigation";

export default function NotionJobsPage() {
  // Minimal support: use existing search behavior.
  redirect("/jobs?q=notion");
}

