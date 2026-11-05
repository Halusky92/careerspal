const SUPPORT = "info@careerspal.com";
const OWNER = "mb.bilek@gmail.com";

export function adminNotifyEmails(extra: string[] = []) {
  return [
    ...new Set(
      [process.env.ADMIN_NOTIFICATION_EMAIL || SUPPORT, SUPPORT, OWNER, ...extra]
        .flatMap((value) => String(value || "").split(","))
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
}
