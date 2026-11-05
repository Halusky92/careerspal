import type { Metadata } from "next";
import ApplyContinue from "../../../components/ApplyContinue";

export const metadata: Metadata = {
  title: "Continue apply",
  robots: { index: false, follow: false },
};

export default function ApplyContinuePage() {
  return <ApplyContinue />;
}
