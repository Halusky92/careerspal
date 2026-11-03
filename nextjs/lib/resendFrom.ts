/** Default transactional From after careerspal.com is verified in Resend. */
export const DEFAULT_RESEND_FROM = "CareersPal <no-reply@careerspal.com>";

export function getResendFrom() {
  const configured = (process.env.RESEND_FROM || "").trim();
  return configured || DEFAULT_RESEND_FROM;
}

export function resendFromHost() {
  const from = getResendFrom();
  const match = from.match(/@([^>]+)/);
  return (match?.[1] || "").trim().toLowerCase();
}
