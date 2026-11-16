import { cookies } from "next/headers";
import { publicListTierFromRequest } from "./boardAccessServer";

/** Real guest / account / Premium tier. The board-cap switch does not turn a guest into Premium. */
export async function viewerTier() {
  const token = (await cookies()).get("cp_access_token")?.value || "";
  return publicListTierFromRequest(
    new Request("https://www.careerspal.com/", {
      headers: token ? { authorization: `Bearer ${token}` } : {},
    }),
  );
}
