import { Resend } from "resend";
import { getResendFrom } from "./resendFrom";

export function premiumReceiptText(until?: string | null) {
  const through = until ? ` Current period through ${until}.` : "";
  return `CareersPal Premium is $7.99 per month. It renews automatically until you cancel. Canceling keeps Premium until the end of the paid period. A refund ends it immediately.${through} This is a payment confirmation, not a tax invoice.`;
}

export async function sendPremiumReceipt(args: { to?: string | null; until?: string | null }) {
  const apiKey = (process.env.RESEND_API_KEY || "").trim();
  const to = (args.to || "").trim();
  if (!apiKey || !to) return "skipped" as const;
  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: getResendFrom(),
      to,
      subject: "CareersPal Premium payment received",
      text: premiumReceiptText(args.until),
    });
    return error ? "failed" as const : "sent" as const;
  } catch {
    return "failed" as const;
  }
}
