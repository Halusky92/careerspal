import { isOnNicheJob } from "../lib/nicheScope";

const pass = [
  "Marketing Operations Program Manager",
  "Sales Operations Analyst",
  "Strategy & Operations Business Partner",
  "Support Operations",
  "Technical Operations Engineer",
  "Chief of Staff",
  "RevOps Manager",
  "Head of Operations",
  "Systems Architect (Make/Zapier)",
  "Business Systems Analyst",
];

const fail = [
  "Head of IT Systems Engineering",
  "Legal Operations Analyst",
  "Corporate Security Infrastructure PM",
  "Renewal Manager",
  "Commercial Solutions PM",
  "Creative Program Manager",
  "Banking Regulatory Compliance Lead",
  "Workplace Experience Manager",
  "Strategic Sourcing Manager",
  "Staff Software Engineer",
  "Account Executive",
  "Senior Firmware Automation Engineer",
  "Benefits Operations Specialist - APAC",
];

let bad = 0;
for (const title of pass) {
  if (!isOnNicheJob({ title })) {
    console.error(`expected PASS: ${title}`);
    bad += 1;
  }
}
for (const title of fail) {
  if (isOnNicheJob({ title })) {
    console.error(`expected FAIL: ${title}`);
    bad += 1;
  }
}
if (bad) {
  process.exit(1);
}
console.log(`ok pass=${pass.length} fail=${fail.length}`);
