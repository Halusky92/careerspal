import { redirect } from "next/navigation";

export default function NotionJobsPage() {
  redirect("/jobs?query=notion");
}
