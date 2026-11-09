const siteUrl = () =>
  (process.env.NEXT_PUBLIC_SITE_URL || "https://www.careerspal.com").replace(/\/+$/, "");

const escapeHtml = (value?: string | null) =>
  (value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export type DigestJob = {
  title: string;
  company: string;
  location: string;
  salary: string;
  href: string;
};

export function renderAlertEmail(args: {
  title: string;
  preheader: string;
  introHtml: string;
  jobs?: DigestJob[];
  cta?: { label: string; href: string };
  unsubscribeUrl: string;
  footerNote?: string;
}) {
  const rows = (args.jobs || [])
    .map(
      (job) => `
        <tr>
          <td style="padding:16px;border:1px solid #e8eaf0;border-radius:12px;background:#fbfbff;">
            <div style="font-weight:600;color:#111827;margin-bottom:4px;">${escapeHtml(job.title)}</div>
            <div style="color:#6b7280;font-size:13px;margin-bottom:6px;">${escapeHtml(job.company)} · ${escapeHtml(job.location)}</div>
            <div style="color:#6b7280;font-size:13px;margin-bottom:12px;">${escapeHtml(job.salary)}</div>
            <a href="${escapeHtml(job.href)}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;padding:8px 12px;border-radius:8px;font-size:13px;font-weight:600;">
              View on CareersPal
            </a>
          </td>
        </tr>
        <tr><td style="height:12px;"></td></tr>
      `,
    )
    .join("");

  return `
  <!doctype html>
  <html>
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>${escapeHtml(args.title)}</title>
    </head>
    <body style="margin:0;padding:0;background:#f6f7fb;font-family:Inter,Segoe UI,Arial,sans-serif;">
      <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
        ${escapeHtml(args.preheader)}
      </div>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f7fb;">
        <tr>
          <td align="center" style="padding:32px 16px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border-radius:16px;overflow:hidden;">
              <tr>
                <td style="padding:28px 28px 8px;">
                  <img src="${siteUrl()}/logo.png" width="36" height="36" alt="CareersPal" style="display:block;border-radius:8px;margin-bottom:12px;" />
                  <div style="font-size:12px;letter-spacing:1.2px;text-transform:uppercase;color:#64748b;">CareersPal</div>
                  <h1 style="margin:10px 0 0;font-size:22px;line-height:1.3;color:#111827;">${escapeHtml(args.title)}</h1>
                </td>
              </tr>
              <tr>
                <td style="padding:8px 28px 0;font-size:15px;line-height:1.6;color:#111827;">
                  ${args.introHtml}
                  ${rows ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:16px;">${rows}</table>` : ""}
                </td>
              </tr>
              ${
                args.cta
                  ? `<tr><td style="padding:8px 28px 24px;"><a href="${escapeHtml(args.cta.href)}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;padding:12px 16px;border-radius:10px;font-weight:600;">${escapeHtml(args.cta.label)}</a></td></tr>`
                  : ""
              }
              <tr>
                <td style="padding:16px 28px 24px;border-top:1px solid #eef0f5;font-size:12px;color:#6b7280;">
                  ${escapeHtml(args.footerNote || "Two emails a week, Tuesday and Friday.")}
                  <div style="margin-top:8px;"><a href="${escapeHtml(args.unsubscribeUrl)}" style="color:#4f46e5;">Unsubscribe</a></div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
  </html>
`;
}

export { escapeHtml };
