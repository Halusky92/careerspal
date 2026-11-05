"use client";


import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSupabaseAuth } from "./Providers";
import { postingOwnerKey, readPostingItem, writePostingItem } from "../lib/postingSession";
import { Job, PlanType } from '../types';
import { CATEGORIES, CATEGORY_FILTER_LABELS } from '../constants';
import { PLAN_PRICES } from '../lib/plans';
import { filterJobTitleSuggestions } from "../lib/jobTitleSuggestions";
import { toggleTool, toolsForCategory, toolsToKeywords } from "../lib/postingTools";
import StartPackMeter from "./StartPackMeter";
import type { StartPackStatus } from "../lib/founding";
import { DESCRIPTION_MAX, localListingIssues } from "../lib/jobs/listingFieldChecks";
import {
  composeJobDescription,
  EXAMPLE_PAY_AND_BENEFITS,
  EXAMPLE_WHO_YOU_ARE,
  parseJobDescription,
  SECTION_MAX,
} from "../lib/jobDescriptionSections";

export type ListingScreenIssue = { field: string; message: string };

interface PostJobProps {
  onComplete: (data: Job, meta?: { screenToken?: string | null }) => void | Promise<void>;
  selectedPlan: { type: PlanType; price: number };
  onUpgradePlan: (type: PlanType, price: number) => void;
  showTestPlan?: boolean;
  foundingEligible?: boolean;
  foundingStatus?: StartPackStatus | null;
  onCompanyForFounding?: (company: string) => void;
  initialJob?: Partial<Job>;
  submitting?: boolean;
  submitError?: string;
  submitIssues?: ListingScreenIssue[];
}

const FIELD_STEP: Record<string, 1 | 2> = {
  title: 1,
  description: 1,
  salary: 1,
  category: 1,
  applyUrl: 2,
  company: 2,
};

type JobFormData = Omit<Job, 'id' | 'postedAt' | 'isFeatured' | 'planType' | 'plan' | 'timestamp' | 'status' | 'views' | 'matches'> & {
  workScope?: string;
  whoYouNeed?: string;
  payAndBenefits?: string;
  aboutTeam?: string;
};

type DraftPost = { step?: number; formData?: Partial<JobFormData>; logoFileName?: string };

const AccordionRow = ({
  id,
  title,
  openId,
  onToggle,
  children,
}: {
  id: "get" | "requirements" | "review";
  title: string;
  openId: "get" | "requirements" | "review" | null;
  onToggle: (id: "get" | "requirements" | "review") => void;
  children: React.ReactNode;
}) => {
  const isOpen = openId === id;
  return (
    <div className="rounded-2xl border border-slate-200/60 bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => onToggle(id)}
        className="w-full px-3 py-2.5 flex items-center justify-between gap-3 text-left"
        aria-expanded={isOpen}
      >
        <span className="text-sm font-black text-slate-900">{title}</span>
        <span className="text-slate-400 font-black">{isOpen ? "−" : "+"}</span>
      </button>
      {isOpen && <div className="px-3 pb-3">{children}</div>}
    </div>
  );
};

const readDraftPost = (owner: string): DraftPost | null => {
  try {
    const raw = readPostingItem("cp_draft_post", owner);
    return raw ? (JSON.parse(raw) as DraftPost) : null;
  } catch {
    return null;
  }
};

const formFromJob = (job?: Partial<Job> | null, draft?: DraftPost | null): JobFormData => {
  const description = job?.description || draft?.formData?.description || "";
  const parsed = parseJobDescription(description);
  return {
    title: job?.title || draft?.formData?.title || "",
    keywords: job?.keywords || draft?.formData?.keywords || "",
    description,
    workScope: draft?.formData?.workScope ?? parsed.work,
    whoYouNeed: draft?.formData?.whoYouNeed ?? parsed.who,
    payAndBenefits: draft?.formData?.payAndBenefits ?? parsed.pay,
    aboutTeam: draft?.formData?.aboutTeam ?? parsed.about,
    company: job?.company || draft?.formData?.company || "",
    companyWebsite: job?.companyWebsite || draft?.formData?.companyWebsite || "",
    logo: job?.logo || draft?.formData?.logo || "",
    salary: job?.salary || draft?.formData?.salary || "",
    location: job?.location || draft?.formData?.location || "",
    type: (job?.type as JobFormData["type"]) || (draft?.formData?.type as JobFormData["type"]) || "Full-time",
    remotePolicy: job?.remotePolicy || draft?.formData?.remotePolicy || "Remote (Global)",
    category: job?.category || draft?.formData?.category || "Operations",
    applyUrl: job?.applyUrl || draft?.formData?.applyUrl || "",
    tags: job?.tags?.length ? job.tags : draft?.formData?.tags?.length ? draft.formData.tags : [],
    tools: job?.tools?.length ? job.tools : draft?.formData?.tools?.length ? draft.formData.tools : [],
  };
};

const PostJob: React.FC<PostJobProps> = ({ onComplete, selectedPlan, onUpgradePlan, showTestPlan, foundingEligible, foundingStatus, onCompanyForFounding, initialJob, submitting, submitError, submitIssues }) => {
  const { user, profile, loading: authLoading } = useSupabaseAuth();
  const owner = postingOwnerKey(user?.id, profile?.email);
  const [step, setStep] = useState(1);
  const [logoFileName, setLogoFileName] = useState("");
  const [openInfoId, setOpenInfoId] = useState<("get" | "requirements" | "review") | null>("get");
  const [titleMenuOpen, setTitleMenuOpen] = useState(false);
  const [liveTitles, setLiveTitles] = useState<string[]>([]);
  const [screenIssues, setScreenIssues] = useState<ListingScreenIssue[]>([]);
  const [screening, setScreening] = useState(false);
  const [screenToken, setScreenToken] = useState<string | null>(null);
  const [aiChecking, setAiChecking] = useState(false);
  const [aiOk, setAiOk] = useState<boolean | null>(null);
  const [customTool, setCustomTool] = useState("");
  const titleBoxRef = useRef<HTMLDivElement>(null);
  const formatPrice = (value: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);

  const steps = [
    { id: 1, title: "Role details", desc: "Title, scope, salary" },
    { id: 2, title: "Company & apply", desc: "Brand + link" },
    { id: 3, title: "Preview & pay", desc: foundingEligible ? "Start pack — then review" : "Confirm & checkout" },
  ] as const;

  
  const [formData, setFormData] = useState<JobFormData>(() => formFromJob(initialJob));
  const [draftOwner, setDraftOwner] = useState<string | null>(null);

  useEffect(() => {
    if (!submitIssues?.length) return;
    setScreenIssues(submitIssues);
    const needsCompany = submitIssues.some((issue) => FIELD_STEP[issue.field] === 2);
    const needsRole = submitIssues.some((issue) => FIELD_STEP[issue.field] === 1);
    setStep(needsRole || !needsCompany ? 1 : 2);
  }, [submitIssues]);

  useEffect(() => {
    if (authLoading) return;
    if (initialJob?.id) {
      setFormData(formFromJob(initialJob));
      setLogoFileName("");
      setStep(1);
      setDraftOwner(owner);
      return;
    }
    const draft = readDraftPost(owner);
    const n = Number(draft?.step);
    setFormData(formFromJob(null, draft));
    setLogoFileName(draft?.logoFileName || "");
    setStep(n === 2 || n === 3 ? n : 1);
    setDraftOwner(owner);
  }, [authLoading, owner, initialJob?.id]);

  useEffect(() => {
    if (initialJob?.id) return;
    if (authLoading || draftOwner !== owner) return;
    const timer = window.setTimeout(() => {
      writePostingItem("cp_draft_post", owner, JSON.stringify({ step, formData, logoFileName }));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [step, formData, logoFileName, initialJob?.id, owner, authLoading, draftOwner]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/jobs?limit=50")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { jobs?: Array<{ title?: string }> } | null) => {
        if (cancelled || !data?.jobs) return;
        setLiveTitles(data.jobs.map((job) => job.title || "").filter(Boolean));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!titleBoxRef.current?.contains(event.target as Node)) {
        setTitleMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  const titleSuggestions = useMemo(
    () => filterJobTitleSuggestions(formData.title, liveTitles, 8, formData.category),
    [formData.title, liveTitles, formData.category],
  );
  const toolChips = useMemo(() => {
    const selected = formData.tools?.length ? formData.tools : [];
    const base = toolsForCategory(formData.category);
    const extras = selected.filter((name) => !base.some((item) => item.toLowerCase() === name.toLowerCase()));
    return [...base, ...extras];
  }, [formData.category, formData.tools]);

  const planHighlights = useMemo(() => {
    const base = [
      "Listing reviewed before publish",
      "30 days live on the board",
      "Included in search + filters",
      "Support via info@careerspal.com",
    ];
    if (selectedPlan.type === "Featured Pro") {
      return [
        ...base,
        "Featured zone on the board",
        "Pro badge on the listing",
      ];
    }
    if (selectedPlan.type === "Elite Managed") {
      return [
        ...base,
        "First in the featured zone",
        "Elite badge on the listing",
      ];
    }
    return base;
  }, [selectedPlan.type]);

  const toggleInfo = (id: "get" | "requirements" | "review") => {
    setOpenInfoId((prev) => (prev === id ? null : id));
  };

  const normalizeHttpUrl = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return trimmed;
    if (trimmed.startsWith("data:")) return trimmed;
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
    if (trimmed.includes(".") && !trimmed.includes(" ")) return `https://${trimmed}`;
    return trimmed;
  };

  const normalizeApplyUrl = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return trimmed;
    if (trimmed === "#" || trimmed.startsWith("/") || trimmed.startsWith("mailto:")) return trimmed;
    if (trimmed.includes("@") && !trimmed.includes(":")) return `mailto:${trimmed}`;
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
    if (trimmed.includes(".") && !trimmed.includes(" ")) return `https://${trimmed}`;
    return trimmed;
  };

  const localIssues = useMemo(
    () =>
      localListingIssues({
        title: formData.title,
        description: formData.description,
        salary: formData.salary,
        applyUrl: formData.applyUrl ? normalizeApplyUrl(formData.applyUrl) : formData.applyUrl,
        company: formData.company,
        location: formData.location,
        remotePolicy: formData.remotePolicy,
        category: formData.category,
      }),
    [
      formData.title,
      formData.description,
      formData.salary,
      formData.applyUrl,
      formData.company,
      formData.location,
      formData.remotePolicy,
      formData.category,
    ],
  );

  const fieldValue = (field: string) => {
    if (field === "title") return formData.title;
    if (field === "salary") return formData.salary;
    if (field === "description") return formData.description;
    if (field === "company") return formData.company;
    if (field === "applyUrl") return formData.applyUrl;
    return "";
  };

  const isLaterStepCopy = (message: string) =>
    /company|apply link|apply url|careers url/i.test(message);

  const issueFor = (field: string) => {
    const fromScreen = screenIssues.find((issue) => issue.field === field && (step !== 1 || !isLaterStepCopy(issue.message)));
    if (fromScreen) return fromScreen.message;
    const fromLocal = localIssues.find((issue) => issue.field === field && (step !== 1 || !isLaterStepCopy(issue.message)));
    return fromLocal?.message;
  };

  const issueStillApplies = (issue: { field: string; message: string }) => {
    if (issue.field === "company") return !formData.company.trim();
    if (issue.field === "applyUrl") return localIssues.some((item) => item.field === "applyUrl");
    if (issue.field === "salary") return localIssues.some((item) => item.field === "salary");
    if (issue.field === "title") {
      return localIssues.some((item) => item.field === "title");
    }
    if (issue.field === "description") {
      return screenIssues.some((item) => item.field === "description" && item.message === issue.message);
    }
    return true;
  };

  const showIssue = (field: string) => {
    const message = screenIssues.find((issue) => issue.field === field)?.message;
    if (!message) return false;
    if (step === 1 && isLaterStepCopy(message)) return false;
    return issueStillApplies({ field, message });
  };

  const applySections = (
    patch: Partial<Pick<JobFormData, "workScope" | "whoYouNeed" | "payAndBenefits" | "aboutTeam">>,
  ) => {
    setFormData((prev) => {
      const next = { ...prev, ...patch };
      next.workScope = String(next.workScope || "").slice(0, SECTION_MAX);
      next.whoYouNeed = String(next.whoYouNeed || "").slice(0, SECTION_MAX);
      next.payAndBenefits = String(next.payAndBenefits || "").slice(0, SECTION_MAX);
      next.aboutTeam = String(next.aboutTeam || "").slice(0, SECTION_MAX);
      next.description = composeJobDescription({
        work: next.workScope,
        who: next.whoYouNeed,
        pay: next.payAndBenefits,
        about: next.aboutTeam,
      }).slice(0, DESCRIPTION_MAX);
      return next;
    });
    setScreenIssues((prev) => prev.filter((issue) => issue.field !== "description"));
  };

  const titleLocalOk = formData.title.trim().length >= 4;

  const fieldReady = (field: string) => {
    if (field === "title") return titleLocalOk;
    if (field === "salary") return !localIssues.some((issue) => issue.field === "salary") && Boolean(formData.salary.trim());
    if (field === "description") {
      return formData.description.trim().length > 0 && formData.description.length <= DESCRIPTION_MAX;
    }
    if (field === "company") return Boolean(formData.company.trim()) && !localIssues.some((issue) => issue.field === "company");
    if (field === "applyUrl") return Boolean(formData.applyUrl.trim()) && !localIssues.some((issue) => issue.field === "applyUrl");
    return !localIssues.some((issue) => issue.field === field);
  };

  const hateBlocked = aiOk === false && screenIssues.some((issue) => /hate|abusive|discrimin|racist|violence/i.test(issue.message));
  const step1Ready = fieldReady("title") && fieldReady("salary") && fieldReady("description") && !hateBlocked;
  const allReady = step1Ready && fieldReady("applyUrl");

  const fieldMark = (field: "title" | "salary" | "description" | "company" | "applyUrl") => {
    const checking = (field === "title" || field === "description") && aiChecking && titleLocalOk;
    if (checking && field === "description") return { label: "…", className: "text-slate-400" };
    if (fieldReady(field) && !(field === "description" && hateBlocked)) {
      return { label: "✓", className: "text-emerald-600" };
    }
    return { label: "", className: "" };
  };

  useEffect(() => {
    setScreenIssues((prev) => prev.filter((issue) => issueStillApplies(issue)));
  }, [formData.company, formData.applyUrl, formData.salary, formData.title, formData.description]);

  useEffect(() => {
    const title = formData.title.trim();
    const description = formData.description.trim();
    if (title.length < 4 || description.length < 1) {
      setAiChecking(false);
      return;
    }
    const timer = window.setTimeout(async () => {
      setAiChecking(true);
      try {
        const response = await fetch("/api/employer/jobs/screen", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "niche",
            title: formData.title,
            description: formData.description,
            salary: formData.salary,
            applyUrl: normalizeApplyUrl(formData.applyUrl),
            company: formData.company,
            location: formData.location,
            remotePolicy: formData.remotePolicy,
            category: formData.category,
          }),
        });
        const payload = (await response.json()) as {
          ok?: boolean;
          issues?: ListingScreenIssue[];
          token?: string | null;
          error?: string;
        };
        const hateIssues = (payload.issues || []).filter(
          (issue) => issue.field === "description" && /hate|abusive|discrimin|racist|violence/i.test(issue.message),
        );
        if (hateIssues.length) {
          setAiOk(false);
          setScreenToken(null);
          setScreenIssues(hateIssues);
        } else {
          setAiOk(true);
          setScreenToken(payload.token || null);
          setScreenIssues((prev) => prev.filter((issue) => issue.field !== "title" && issue.field !== "description"));
        }
      } catch {
        setAiOk(null);
      } finally {
        setAiChecking(false);
      }
    }, 700);
    return () => window.clearTimeout(timer);
  }, [formData.title, formData.description, formData.category]);

  const handleStep1 = () => {
    const blocked = localIssues.filter(
      (issue) =>
        (issue.field === "title" || issue.field === "salary" || issue.field === "description") &&
        !isLaterStepCopy(issue.message),
    );
    if (blocked.length || hateBlocked) {
      setScreenIssues(blocked.length ? blocked : screenIssues.filter((issue) => !isLaterStepCopy(issue.message)));
      return;
    }
    setScreenIssues((prev) => prev.filter((issue) => FIELD_STEP[issue.field] === 2 && issueStillApplies(issue)));
    if (formData.company.trim()) onCompanyForFounding?.(formData.company.trim());
    setStep(2);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleStep2 = async () => {
    const blocked = localIssues.filter((issue) => issue.field === "applyUrl");
    if (blocked.length) {
      setScreenIssues(blocked);
      return;
    }
    if (allReady && (screenToken || aiOk === true || aiOk === null)) {
      setScreenIssues([]);
      if (formData.company.trim()) onCompanyForFounding?.(formData.company.trim());
      setStep(3);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setScreening(true);
    try {
      const response = await fetch("/api/employer/jobs/screen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description,
          salary: formData.salary,
          applyUrl: normalizeApplyUrl(formData.applyUrl),
          company: formData.company,
          location: formData.location,
          remotePolicy: formData.remotePolicy,
          category: formData.category,
        }),
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        issues?: ListingScreenIssue[];
        error?: string;
      };
      const issues = payload.issues || [];
      if (!payload.ok) {
        setScreenIssues(issues.length ? issues : [{ field: "title", message: payload.error || "This listing does not meet the board bar yet." }]);
        const needsRole = issues.some((issue) => FIELD_STEP[issue.field] === 1);
        setStep(needsRole || issues.length === 0 ? 1 : 2);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      setScreenIssues([]);
      if (formData.company.trim()) onCompanyForFounding?.(formData.company.trim());
      setStep(3);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setScreenIssues([{ field: "title", message: "Could not check the listing. Try again." }]);
      setStep(1);
    } finally {
      setScreening(false);
    }
  };

  const handleFinalSubmit = async () => {
    if (submitting) return;
    // Logic: Use provided logo, otherwise fall back to a random seed or placeholder
    const finalLogo = formData.logo.trim()
      ? normalizeHttpUrl(formData.logo)
      : `https://picsum.photos/seed/${formData.company.replace(/\s/g, '')}/100/100`;
    const selectedTools = formData.tools?.length ? formData.tools : [];
    const keywordTags = (formData.keywords || toolsToKeywords(selectedTools))
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
    const mergedTags = Array.from(new Set([...(formData.tags || []), ...selectedTools, ...keywordTags]));
    const normalizedApplyUrl = normalizeApplyUrl(formData.applyUrl);
    const normalizedCompanyWebsite = normalizeHttpUrl(formData.companyWebsite || "");

    const { workScope: _work, whoYouNeed: _who, payAndBenefits: _pay, aboutTeam: _about, ...jobFields } = formData;
    const finalJob: Job = { 
      ...jobFields,
      description: composeJobDescription({
        work: formData.workScope,
        who: formData.whoYouNeed,
        pay: formData.payAndBenefits,
        about: formData.aboutTeam,
      }).slice(0, DESCRIPTION_MAX) || formData.description,
      tags: mergedTags,
      tools: selectedTools,
      keywords: toolsToKeywords(selectedTools) || formData.keywords,
      applyUrl: normalizedApplyUrl,
      logo: finalLogo,
      companyWebsite: normalizedCompanyWebsite || undefined,
      postedAt: 'Just now', 
      id: `local-${Date.now()}`,
      isFeatured: selectedPlan.type !== 'Standard'
    };
    await onComplete(finalJob, { screenToken });
  };

  // Filter out 'All Roles' for the dropdown
  const categoryOptions = CATEGORIES.filter(c => c !== 'All Roles');

  // Preview Image Helper
  const previewLogo = formData.logo.trim()
    ? (formData.logo.startsWith("http://") || formData.logo.startsWith("https://") || formData.logo.startsWith("data:")
        ? formData.logo
        : `https://${formData.logo}`)
    : `https://picsum.photos/seed/${formData.company ? formData.company.replace(/\s/g, '') : 'random'}/100/100`;

  const handleLogoFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      setLogoFileName("");
      return;
    }
    if (!file.type.startsWith("image/")) {
      alert("Please upload an image file.");
      setLogoFileName("");
      return;
    }
    setLogoFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      if (result) {
        setFormData(prev => ({ ...prev, logo: result }));
      }
    };
    reader.readAsDataURL(file);
  };

  const usingStartPack = Boolean(foundingEligible && selectedPlan.type === "Standard" && selectedPlan.price !== 1);
  const isEmployerAccount = profile?.role === "employer" || profile?.role === "admin";
  const showPaidStandard = !usingStartPack && selectedPlan.price !== 1 && isEmployerAccount;
  const planChip = selectedPlan.price === 1
    ? "Current plan: Admin Stripe test · $1"
    : usingStartPack
      ? "Current plan: Start pack · Free"
      : !isEmployerAccount
        ? "Start pack: 10 free, then $79"
        : `Current plan: ${selectedPlan.type} · ${formatPrice(selectedPlan.price)} / 30 days`;

  const previewPlaceLabel = (() => {
    const policy = (formData.remotePolicy || "").trim();
    const loc = (formData.location || "").trim();
    const shortPolicy = policy.replace(/\s*\(global\)\s*/i, "").replace(/\s*\(regional\)\s*/i, " (region)").trim() || "Remote";
    const same =
      !loc ||
      loc.toLowerCase() === policy.toLowerCase() ||
      loc.toLowerCase() === shortPolicy.toLowerCase() ||
      loc.toLowerCase() === "remote (global)";
    if (same) return shortPolicy;
    return `${shortPolicy} · ${loc}`;
  })();

  const salaryInputValue = (formData.salary || "").replace(/^\$\s*/, "");
  const salaryPreview = (() => {
    const salary = (formData.salary || "").trim();
    if (!salary) return "";
    if (/\$/.test(salary)) return salary.replace(/\s*USD\b/gi, "").trim();
    if (/\d/.test(salary)) return `$${salary.replace(/\s*USD\b/gi, "").trim()}`;
    return salary;
  })();

  const previewChips = Array.from(
    new Set(
      [formData.type, salaryPreview, previewPlaceLabel]
        .map((v) => (v || "").trim())
        .filter(Boolean),
    ),
  );

  const fieldTone = (field: string) => {
    const mark = fieldMark(field as "title" | "salary" | "description" | "company" | "applyUrl");
    if (mark.label === "✓") return " border-emerald-300";
    if (showIssue(field)) return " border-rose-300 ring-1 ring-rose-200";
    return "";
  };
  const Mark = ({ field }: { field: "title" | "salary" | "description" | "company" | "applyUrl" }) => {
    const mark = fieldMark(field);
    if (!mark.label) return null;
    return <span className={`text-[11px] font-black ${mark.className}`}>{mark.label}</span>;
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3">
      {foundingStatus?.enabled && (
        <div className="mb-4">
          <StartPackMeter status={foundingStatus} pendingUse={usingStartPack} />
        </div>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-8">
          <div className="mb-3">
            <div className="flex items-start justify-between gap-6">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-indigo-100 px-3 py-1 mb-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-indigo-600" />
                  <span className="text-[10px] font-black text-indigo-800 uppercase tracking-[0.16em]">
                    {planChip}
                  </span>
                </div>
                <h1 className="text-xl sm:text-2xl font-semibold text-slate-900 tracking-tight">Post a role</h1>
              </div>

              <div className="sm:hidden">
                <div className="inline-flex items-center gap-2 rounded-2xl bg-white border border-slate-200/70 px-3 py-2 shadow-sm">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Step</span>
                  <span className="text-[10px] font-black text-indigo-700">{step} / {steps.length}</span>
                </div>
              </div>
            </div>

            <div className="mt-3 hidden sm:flex items-center gap-2">
              {steps.map((s) => {
                const isActive = step === s.id;
                const isDone = step > s.id;
                const canJump = s.id < step;
                return (
                  <div key={s.id} className="flex items-center gap-2 min-w-0">
                    <button
                      type="button"
                      disabled={!canJump}
                      onClick={() => {
                        if (!canJump) return;
                        setStep(s.id);
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                      className={[
                        "h-6 w-6 rounded-md flex items-center justify-center text-[11px] font-semibold",
                        isActive ? "bg-indigo-600 text-white" : isDone ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-400",
                        canJump ? "hover:bg-indigo-200 cursor-pointer" : "cursor-default",
                      ].join(" ")}
                      aria-current={isActive ? "step" : undefined}
                    >
                      {isDone ? "✓" : s.id}
                    </button>
                    <span className={["text-xs font-medium truncate", isActive ? "text-slate-900" : "text-slate-500"].join(" ")}>
                      {s.title}
                    </span>
                    {s.id !== steps.length && <span className="text-slate-300 px-1">/</span>}
                  </div>
                );
              })}
            </div>
          </div>

          {showTestPlan ? (
            <div className={`mb-3 rounded-xl border p-3 ${selectedPlan.price === 1 ? "border-emerald-300 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-amber-800">Only you</p>
                  <p className="text-sm font-medium text-slate-900">$1 Stripe test for a live post</p>
                </div>
                <button
                  type="button"
                  onClick={() => onUpgradePlan("Standard", 1)}
                  className="h-9 px-3 rounded-lg bg-emerald-600 text-white text-xs font-medium"
                >
                  {selectedPlan.price === 1 ? "Using $1 test" : "Use $1 Stripe test"}
                </button>
              </div>
            </div>
          ) : null}

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {step === 1 && (
              <div className="p-4 space-y-3">
                <h2 className="text-sm font-semibold tracking-tight">1. Job details</h2>
                <div className="flex flex-wrap gap-2 text-[11px] font-semibold">
                  {(["title", "salary", "description"] as const).map((field) => {
                    const mark = fieldMark(field);
                    return (
                      <span key={field} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 ${mark.label === "✓" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-500"}`}>
                        {mark.label === "✓" ? "✓" : "○"} {field[0].toUpperCase() + field.slice(1)}
                      </span>
                    );
                  })}
                </div>
                <div className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Category</label>
                      <select
                        className="cp-field w-full h-10 rounded-lg px-3 text-sm outline-none"
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      >
                        {categoryOptions.map((cat) => (
                          <option key={cat} value={cat}>{CATEGORY_FILTER_LABELS[cat] || cat}</option>
                        ))}
                      </select>
                      <p className="text-[11px] text-slate-500">Pick this first. Title suggestions follow the category.</p>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Job Type</label>
                      <select className="cp-field w-full h-10 rounded-lg px-3 text-sm outline-none" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value as Job['type']})}>
                        <option>Full-time</option>
                        <option>Contract</option>
                        <option>Part-time</option>
                      </select>
                    </div>
                  </div>
                  <div className="space-y-2" ref={titleBoxRef}>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">Job Title * <Mark field="title" /></label>
                    <div className="relative">
                      <input
                        type="text"
                        autoComplete="off"
                        placeholder="e.g. Operations Manager"
                        className={`cp-field w-full h-10 rounded-lg px-3 text-sm outline-none${fieldTone("title")}`}
                        value={formData.title}
                        onChange={(e) => {
                          setFormData({ ...formData, title: e.target.value });
                          setTitleMenuOpen(true);
                          setScreenIssues((prev) => prev.filter((issue) => issue.field !== "title"));
                        }}
                        onFocus={() => setTitleMenuOpen(true)}
                        aria-autocomplete="list"
                        aria-expanded={titleMenuOpen && titleSuggestions.length > 0}
                      />
                      {titleMenuOpen && titleSuggestions.length > 0 && (
                        <ul className="absolute z-30 mt-1 w-full max-h-56 overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                          {titleSuggestions.map((title) => (
                            <li key={title}>
                              <button
                                type="button"
                                className="w-full px-3 py-2 text-left text-sm text-slate-800 hover:bg-indigo-50 hover:text-indigo-800"
                                onMouseDown={(event) => {
                                  event.preventDefault();
                                  setFormData({ ...formData, title });
                                  setTitleMenuOpen(false);
                                }}
                              >
                                {title}
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    {showIssue("title") ? (
                      <p className="text-[11px] font-medium text-rose-700">{issueFor("title")}</p>
                    ) : (
                      <p className="text-[11px] text-slate-500">Suggestions are optional. Type your own title or pick one from the list.</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tools & skills</label>
                    <div className="flex flex-wrap gap-1.5">
                      {toolChips.map((name) => {
                        const on = (formData.tools || []).some((item) => item.toLowerCase() === name.toLowerCase());
                        return (
                          <button
                            key={name}
                            type="button"
                            onClick={() => {
                              const next = toggleTool(formData.tools || [], name);
                              setFormData({ ...formData, tools: next, tags: next, keywords: toolsToKeywords(next) });
                            }}
                            className={`h-8 px-2.5 rounded-full border text-xs font-medium ${
                              on ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-700 border-slate-200 hover:border-slate-400"
                            }`}
                          >
                            {name}
                          </button>
                        );
                      })}
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Add your own, e.g. n8n"
                        className="cp-field flex-1 h-9 rounded-lg px-3 text-sm outline-none"
                        value={customTool}
                        onChange={(e) => setCustomTool(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key !== "Enter") return;
                          e.preventDefault();
                          const next = toggleTool(formData.tools || [], customTool);
                          setFormData({ ...formData, tools: next, tags: next, keywords: toolsToKeywords(next) });
                          setCustomTool("");
                        }}
                      />
                      <button
                        type="button"
                        className="h-9 px-3 rounded-lg border border-slate-200 text-xs font-medium text-slate-700"
                        onClick={() => {
                          const next = toggleTool(formData.tools || [], customTool);
                          setFormData({ ...formData, tools: next, tags: next, keywords: toolsToKeywords(next) });
                          setCustomTool("");
                        }}
                      >
                        Add
                      </button>
                    </div>
                    {(formData.tools || []).length > 0 ? (
                      <p className="text-[11px] text-slate-500">Selected: {(formData.tools || []).join(", ")}</p>
                    ) : (
                      <p className="text-[11px] text-slate-500">Click tools the role actually uses. Add your own if it is missing.</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      Salary range * <Mark field="salary" />
                    </label>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-500">$</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="80,000 – 120,000"
                        className={`cp-field w-full h-10 rounded-lg pl-7 pr-14 text-sm outline-none${fieldTone("salary")}`}
                        value={salaryInputValue}
                        onChange={e => {
                          const next = e.target.value.replace(/^\$\s*/, "");
                          setFormData({...formData, salary: next});
                          setScreenIssues((prev) => prev.filter((issue) => issue.field !== "salary"));
                        }}
                      />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-slate-500">USD</span>
                    </div>
                    {showIssue("salary") ? (
                      <p className="text-[11px] font-semibold text-rose-700">{issueFor("salary")}</p>
                    ) : (
                      <p className="text-[11px] text-slate-500">Yearly range. Hourly only if you write / hour.</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center gap-3">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">Role write-up * <Mark field="description" /></label>
                      <span className={`text-[11px] ${formData.description.length >= DESCRIPTION_MAX ? "text-rose-700 font-medium" : "text-slate-400"}`}>
                        {formData.description.length} / {DESCRIPTION_MAX}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">What we do is enough to continue. The other boxes are optional. We only block abusive copy.</p>
                    <div className={`rounded-xl border bg-slate-50/70 p-3 space-y-1.5${showIssue("description") ? " border-rose-300" : " border-slate-200"}`}>
                      <label className="text-[11px] font-semibold text-slate-800">What we do</label>
                      <p className="text-[11px] text-slate-500">Write as the company. Day-to-day work of this role.</p>
                      <textarea
                        rows={4}
                        maxLength={SECTION_MAX}
                        placeholder="e.g. We run weekly ops reviews, keep Airtable clean, and roll out new workflows."
                        className="cp-field w-full rounded-lg px-3 py-2 text-sm outline-none min-h-[6rem]"
                        value={formData.workScope || ""}
                        onChange={(e) => applySections({ workScope: e.target.value })}
                      />
                      <p className="text-[10px] text-slate-400 text-right">{(formData.workScope || "").length} / {SECTION_MAX}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <label className="text-[11px] font-semibold text-slate-800">Who you are</label>
                          <p className="text-[11px] text-slate-500">Optional. Minimums vs preferred. Paste bullets if you have them.</p>
                        </div>
                        <button
                          type="button"
                          className="shrink-0 text-[11px] font-medium text-indigo-600 hover:text-indigo-800"
                          onClick={() => {
                            if (formData.whoYouNeed?.trim()) return;
                            applySections({ whoYouNeed: EXAMPLE_WHO_YOU_ARE });
                          }}
                        >
                          Use example
                        </button>
                      </div>
                      <textarea
                        rows={6}
                        maxLength={SECTION_MAX}
                        placeholder={EXAMPLE_WHO_YOU_ARE}
                        className="cp-field w-full rounded-lg px-3 py-2 text-sm outline-none min-h-[8rem]"
                        value={formData.whoYouNeed || ""}
                        onChange={(e) => applySections({ whoYouNeed: e.target.value })}
                      />
                      <p className="text-[10px] text-slate-400 text-right">{(formData.whoYouNeed || "").length} / {SECTION_MAX}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <label className="text-[11px] font-semibold text-slate-800">Pay and benefits</label>
                          <p className="text-[11px] text-slate-500">Optional. Salary range is above. Add equity, health, bonus, location notes.</p>
                        </div>
                        <button
                          type="button"
                          className="shrink-0 text-[11px] font-medium text-indigo-600 hover:text-indigo-800"
                          onClick={() => {
                            if (formData.payAndBenefits?.trim()) return;
                            applySections({ payAndBenefits: EXAMPLE_PAY_AND_BENEFITS });
                          }}
                        >
                          Use example
                        </button>
                      </div>
                      <textarea
                        rows={5}
                        maxLength={SECTION_MAX}
                        placeholder={EXAMPLE_PAY_AND_BENEFITS}
                        className="cp-field w-full rounded-lg px-3 py-2 text-sm outline-none min-h-[7rem]"
                        value={formData.payAndBenefits || ""}
                        onChange={(e) => applySections({ payAndBenefits: e.target.value })}
                      />
                      <p className="text-[10px] text-slate-400 text-right">{(formData.payAndBenefits || "").length} / {SECTION_MAX}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 space-y-1.5">
                      <label className="text-[11px] font-semibold text-slate-800">About the team</label>
                      <p className="text-[11px] text-slate-500">Optional. How the team works.</p>
                      <textarea
                        rows={3}
                        maxLength={SECTION_MAX}
                        placeholder="e.g. 12-person remote product team, async, no meeting-heavy culture."
                        className="cp-field w-full rounded-lg px-3 py-2 text-sm outline-none min-h-[5rem]"
                        value={formData.aboutTeam || ""}
                        onChange={(e) => applySections({ aboutTeam: e.target.value })}
                      />
                      <p className="text-[10px] text-slate-400 text-right">{(formData.aboutTeam || "").length} / {SECTION_MAX}</p>
                    </div>
                    {showIssue("description") && <p className="text-[11px] font-semibold text-rose-700">{issueFor("description")}</p>}
                  </div>
                </div>
                <button onClick={handleStep1} disabled={!step1Ready || aiChecking} className="w-full h-10 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-60">
                  {aiChecking ? "Checking listing…" : "Next"}
                </button>
              </div>
            )}

            {step === 2 && (
              <div className="p-4 space-y-3">
                <h2 className="text-sm font-semibold tracking-tight">2. Company & apply</h2>
                <div className="flex flex-wrap gap-2 text-[11px] font-semibold">
                  {(["company", "applyUrl"] as const).map((field) => {
                    const mark = fieldMark(field);
                    return (
                      <span key={field} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 ${mark.label === "✓" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-500"}`}>
                        {mark.label === "✓" ? "✓" : "○"} {field === "applyUrl" ? "Apply" : "Company"}
                      </span>
                    );
                  })}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">Company name <Mark field="company" /></label>
                    <input type="text" placeholder="Your Company Name" className={`cp-field w-full h-10 rounded-lg px-3 text-sm outline-none${fieldTone("company")}`} value={formData.company} onChange={e => { setFormData({...formData, company: e.target.value}); setScreenIssues((prev) => prev.filter((issue) => issue.field !== "company")); }} />
                    {showIssue("company") && <p className="text-[11px] font-semibold text-rose-700">{issueFor("company")}</p>}
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-slate-700">Work mode</label>
                    <select
                      className="cp-field w-full h-10 rounded-lg px-3 text-sm outline-none"
                      value={formData.remotePolicy}
                      onChange={(e) => {
                        const next = e.target.value;
                        setFormData((prev) => ({
                          ...prev,
                          remotePolicy: next,
                          location:
                            !prev.location.trim() ||
                            prev.location === prev.remotePolicy ||
                            prev.location === "Remote (Global)"
                              ? ""
                              : prev.location,
                        }));
                      }}
                    >
                      <option>Remote (Global)</option>
                      <option>Remote (Regional)</option>
                      <option>Hybrid</option>
                      <option>Onsite</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-slate-700">City / region (optional)</label>
                    <input
                      type="text"
                      placeholder="Only if needed — e.g. Europe, US, Berlin"
                      className="cp-field w-full h-10 rounded-lg px-3 text-sm outline-none"
                      value={formData.location === formData.remotePolicy || formData.location === "Remote (Global)" ? "" : formData.location}
                      onChange={e => setFormData({...formData, location: e.target.value})}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Company Website</label>
                  <input
                    type="text"
                    inputMode="url"
                    placeholder="company.com"
                    className="cp-field w-full h-10 rounded-lg px-3 text-sm outline-none"
                    value={formData.companyWebsite}
                    onChange={e => setFormData({...formData, companyWebsite: e.target.value})}
                    onBlur={() =>
                      setFormData((prev) => ({
                        ...prev,
                        companyWebsite: prev.companyWebsite ? normalizeHttpUrl(prev.companyWebsite) : prev.companyWebsite,
                      }))
                    }
                  />
                </div>
                
                {/* Optional Logo Input */}
                <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Company Logo (Optional)</label>
                   <div className="flex gap-4 items-center">
                      <input 
                        type="url" 
                        placeholder="https://company.com/logo.png (optional)" 
                        className="cp-field flex-1 h-10 rounded-lg px-3 text-sm outline-none" 
                        value={formData.logo.startsWith("data:") ? "" : formData.logo} 
                        onChange={e => setFormData({...formData, logo: e.target.value})}
                        onBlur={() =>
                          setFormData((prev) => ({
                            ...prev,
                            logo: prev.logo && !prev.logo.startsWith("data:") ? normalizeHttpUrl(prev.logo) : prev.logo,
                          }))
                        }
                      />
                      <div className="w-12 h-12 bg-white border border-slate-100 rounded-xl p-1 flex-shrink-0 flex items-center justify-center">
                         <img src={previewLogo} className="max-w-full max-h-full object-contain" alt="Preview" />
                      </div>
                   </div>
                   <div className="flex flex-wrap items-center gap-3">
                     <input
                       id="cp-logo-upload"
                       type="file"
                       accept="image/*"
                       onChange={handleLogoFileChange}
                       className="sr-only"
                     />
                     <label
                       htmlFor="cp-logo-upload"
                       className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-600 hover:border-indigo-200 hover:text-indigo-600 cursor-pointer"
                     >
                       Upload from computer
                     </label>
                     {logoFileName && (
                       <span className="text-[10px] font-bold text-slate-400 truncate max-w-[220px]" title={logoFileName}>
                         {logoFileName}
                       </span>
                     )}
                     {formData.logo && (
                       <button
                         type="button"
                         onClick={() => setFormData(prev => ({ ...prev, logo: "" }))}
                         className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600"
                       >
                         Remove logo
                       </button>
                     )}
                   </div>
                   <p className="text-[9px] text-slate-400 font-bold">
                     Paste a logo URL or upload from your computer (PNG/JPG/SVG).
                   </p>
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">Apply link * <Mark field="applyUrl" /></label>
                  <input
                    type="text"
                    inputMode="url"
                    placeholder="company.com/careers"
                    className={`cp-field w-full h-10 rounded-lg px-3 text-sm outline-none${fieldTone("applyUrl")}`}
                    value={formData.applyUrl}
                    onChange={e => {
                      setFormData({...formData, applyUrl: e.target.value});
                      setScreenIssues((prev) => prev.filter((issue) => issue.field !== "applyUrl"));
                    }}
                    onBlur={() =>
                      setFormData((prev) => ({
                        ...prev,
                        applyUrl: prev.applyUrl ? normalizeApplyUrl(prev.applyUrl) : prev.applyUrl,
                      }))
                    }
                  />
                  {showIssue("applyUrl") ? (
                    <p className="text-[11px] font-semibold text-rose-700">{issueFor("applyUrl")}</p>
                  ) : (
                    <p className="text-[9px] text-slate-400 font-bold">Auto-formats after you leave the field.</p>
                  )}
                </div>
                <div className="flex gap-2 pt-2">
                  <button onClick={() => setStep(1)} className="h-10 px-4 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50">Back</button>
                  <button onClick={handleStep2} disabled={screening} className="flex-1 h-10 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-60">
                    {screening ? "Checking listing…" : "Review listing"}
                  </button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="p-4 sm:p-5 text-center space-y-3">
                <div className="bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-lg border border-emerald-100 inline-block text-[11px] font-semibold uppercase tracking-wide">
                  {selectedPlan.price === 1
                    ? "Admin $1 Stripe test"
                    : foundingEligible && selectedPlan.type === "Standard"
                      ? "Ready to send for review"
                      : "Ready for checkout"}
                </div>
                <h2 className="text-lg font-semibold text-slate-900 tracking-tight">Preview</h2>
                <div className="bg-slate-50 p-4 sm:p-5 rounded-xl text-left border border-slate-200">
                   <div className="flex items-center gap-3 mb-3">
                      <div className="w-16 h-16 bg-white rounded-xl border flex items-center justify-center p-2">
                         <img src={previewLogo} alt="" className="max-h-full max-w-full object-contain" />
                      </div>
                      <div>
                        <h4 className="text-xl sm:text-2xl font-bold text-slate-900 leading-none mb-1">{formData.title}</h4>
                        <p className="text-indigo-600 font-semibold uppercase text-[10px] sm:text-xs tracking-wide">{formData.company}</p>
                        {formData.companyWebsite && (
                          <p className="text-[10px] font-medium text-slate-600 mt-1">{formData.companyWebsite}</p>
                        )}
                      </div>
                   </div>
                   <div className="text-slate-500 line-clamp-4 text-sm font-medium leading-relaxed">{formData.description}</div>
                   <div className="mt-6 flex gap-2 flex-wrap">
                      {previewChips.map((chip) => (
                        <span key={chip} className="bg-white border border-slate-100 px-3 py-1 rounded-lg text-[10px] font-semibold text-slate-600">
                          {chip}
                        </span>
                      ))}
                   </div>
                </div>
                <div className="flex flex-col gap-3">
                {submitError && !(/company name|company mail|jobs@/i.test(submitError) && formData.company.trim()) && (
                  <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800 text-left">{submitError}</p>
                )}
                <button
                  type="button"
                  disabled={Boolean(submitting)}
                  onClick={handleFinalSubmit}
                  className="w-full h-11 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                    {submitting
                      ? "Submitting…"
                      : selectedPlan.price === 1
                      ? "Pay $1 test (Stripe)"
                      : foundingEligible && selectedPlan.type === "Standard"
                      ? "Submit with Start pack"
                      : `Proceed to Payment (${formatPrice(selectedPlan.price)})`}
                  </button>
                  <button type="button" disabled={Boolean(submitting)} onClick={() => setStep(2)} className="text-slate-600 font-medium hover:text-indigo-600 transition-colors disabled:opacity-50">Edit details</button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-4 space-y-3 lg:sticky lg:top-20 self-start">
           {showTestPlan ? (
             <div className={`rounded-xl border p-4 ${selectedPlan.price === 1 ? "border-emerald-400 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
               <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">Admin only</p>
               <p className="mt-1 text-sm font-medium text-slate-900">Stripe test — $1</p>
               <p className="mt-1 text-xs text-slate-600">Real checkout and confirm emails. Not the $79 plan.</p>
               <button
                 type="button"
                 onClick={() => onUpgradePlan("Standard", 1)}
                 className="mt-3 h-9 px-3 rounded-lg bg-emerald-600 text-white text-xs font-medium"
               >
                 {selectedPlan.price === 1 ? "Using $1 test" : "Use $1 Stripe test"}
               </button>
             </div>
           ) : null}
           <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-indigo-600">For employers</div>
                  <h3 className="text-base font-semibold text-slate-900 mt-1">Reviewed before publish.</h3>
                  <p className="mt-2 text-sm font-medium text-slate-600">
                    Same board bar as pipeline listings. Candidates apply on your link.
                  </p>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                <AccordionRow
                  id="get"
                  openId={openInfoId}
                  onToggle={toggleInfo}
                  title={`What you get (${usingStartPack ? "Start pack" : selectedPlan.type})`}
                >
                  <ul className="space-y-2 text-sm font-medium text-slate-700">
                    {planHighlights.map((x) => (
                      <li key={x} className="flex items-start gap-2">
                        <span className="text-emerald-600 font-semibold mt-0.5">✓</span>
                        <span>{x}</span>
                      </li>
                    ))}
                  </ul>
                </AccordionRow>

                <AccordionRow id="requirements" openId={openInfoId} onToggle={toggleInfo} title="Requirements (for approval)">
                  <ul className="space-y-2 text-sm font-medium text-slate-700">
                    <li className="flex items-start gap-2"><span className="text-slate-900 font-semibold mt-0.5">•</span> Salary range included</li>
                    <li className="flex items-start gap-2"><span className="text-slate-900 font-semibold mt-0.5">•</span> Clear scope + responsibilities</li>
                    <li className="flex items-start gap-2"><span className="text-slate-900 font-semibold mt-0.5">•</span> Working apply link (URL or email)</li>
                    <li className="flex items-start gap-2"><span className="text-slate-900 font-semibold mt-0.5">•</span> No spam / vague listings</li>
                  </ul>
                </AccordionRow>

                <AccordionRow id="review" openId={openInfoId} onToggle={toggleInfo} title="Review & publish timeline">
                  <div className="space-y-2 text-sm font-medium text-slate-700">
                    <div className="flex items-start gap-2"><span className="text-indigo-600 font-semibold mt-0.5">1</span> Green ticks appear as each field meets the bar. Fix the red note and send again — no cooldown.</div>
                    <div className="flex items-start gap-2"><span className="text-indigo-600 font-semibold mt-0.5">2</span> When every required field is ticked, preview and send. Start pack and paid listings wait for a last check before they appear on the board.</div>
                    <div className="flex items-start gap-2"><span className="text-indigo-600 font-semibold mt-0.5">3</span> Apply stays on your link. No timed SLA.</div>
                    <p className="mt-3 text-xs text-slate-600">
                      A Start pack slot is used only after the listing is live. Failed checks stay as a draft so you can fix them.
                    </p>
                  </div>
                </AccordionRow>
              </div>

              <div className="mt-5 text-xs font-medium text-slate-600">
                Questions or edits? Email <span className="font-semibold text-slate-800">info@careerspal.com</span>.
              </div>
           </div>
           
           <div className="relative z-20 rounded-xl border-2 border-indigo-500 bg-indigo-50 p-4 sm:p-5 shadow-sm">
              <div className="flex items-center justify-between gap-2 mb-2">
                <h3 className="text-sm font-semibold text-indigo-950">
                  {usingStartPack || !isEmployerAccount ? "Listing plan" : "Selected plan"}
                </h3>
                {showPaidStandard || usingStartPack || selectedPlan.price === 1 ? (
                  <span className="inline-flex h-6 items-center rounded-full bg-indigo-600 px-2.5 text-[10px] font-bold uppercase tracking-wide text-white">
                    Current
                  </span>
                ) : null}
              </div>
              {usingStartPack ? (
                <>
                  <div className="text-3xl font-semibold text-indigo-700 mb-1 leading-none">
                    Free
                    <span className="text-base text-indigo-800/70 font-medium"> Start pack</span>
                  </div>
                  <div className="text-xs font-semibold text-indigo-800 uppercase tracking-wide mb-3">
                    {foundingStatus?.remainingJobs ?? 10} of {foundingStatus?.quota ?? 10} free listings left
                  </div>
                </>
              ) : !isEmployerAccount ? (
                <>
                  <div className="text-2xl font-semibold text-indigo-700 mb-1 leading-none">10 free, then $79</div>
                  <p className="text-sm text-indigo-900/80 mb-3">
                    Start pack is 10 Standard listings per company and account. Sign in as an employer to use it. After that, Standard is $79 / 30 days.
                  </p>
                </>
              ) : (
                <>
                  <div className="text-3xl font-semibold text-indigo-700 mb-1 leading-none">
                    {formatPrice(selectedPlan.price)}
                    <span className="text-base text-indigo-800/70 font-medium"> / 30 days</span>
                  </div>
                  <div className="text-xs font-semibold text-indigo-800 uppercase tracking-wide mb-3">
                    {selectedPlan.type}
                  </div>
                </>
              )}

              <details className="lg:hidden mb-3 rounded-lg border border-indigo-200 bg-white/70 px-3 py-2">
                <summary className="cursor-pointer text-sm font-medium text-indigo-900">Featured and Elite (optional)</summary>
                <p className="mt-2 text-xs text-indigo-800/80">Fill the role first. Upgrade is optional and only if you want extra placement.</p>
              </details>
              
              {/* Plan Upgrade Options */}
              {selectedPlan.type === 'Standard' && (
                <div className="bg-indigo-600 rounded-xl p-4 text-white text-center relative group/tooltip">
                  <div className="flex justify-between items-start mb-2">
                    <p className="text-xs font-black uppercase tracking-widest opacity-80 text-left">Boost Visibility</p>
                    <div className="relative">
                      <div className="w-5 h-5 rounded-full border border-white/40 flex items-center justify-center text-[10px] font-bold cursor-help hover:bg-white hover:text-indigo-600 transition-colors">?</div>
                      {/* Tooltip */}
                      <div className="absolute right-0 bottom-full mb-2 w-64 bg-white text-slate-900 p-4 rounded-xl shadow-2xl opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all duration-300 pointer-events-none z-50 transform translate-y-2 group-hover/tooltip:translate-y-0 text-left border border-slate-100">
                        <div className="text-xs font-black uppercase tracking-widest text-indigo-600 mb-3">Featured Pro</div>
                        <ul className="space-y-2">
                           <li className="flex items-start gap-2 text-[11px] font-bold text-slate-600 leading-tight">
                              <span className="text-indigo-600 mt-0.5">✓</span> Featured zone on the board
                           </li>
                           <li className="flex items-start gap-2 text-[11px] font-bold text-slate-600 leading-tight">
                              <span className="text-indigo-600 mt-0.5">✓</span> Prominent placement on the board
                           </li>
                        </ul>
                        <div className="absolute -bottom-2 right-1.5 w-4 h-4 bg-white transform rotate-45 border-r border-b border-slate-100"></div>
                      </div>
                    </div>
                  </div>
                  <p className="font-bold text-sm mb-4 text-left">Puts this listing in the featured zone on the board.</p>
                  <button 
                    onClick={() => onUpgradePlan('Featured Pro', PLAN_PRICES.pro)}
                    className="w-full bg-white text-indigo-800 py-3 rounded-xl font-black text-sm hover:bg-indigo-50 transition-colors"
                  >
                    Upgrade to Pro (+$70)
                  </button>
                </div>
              )}
              
              {selectedPlan.type === 'Featured Pro' && (
                <div className="bg-slate-900 rounded-xl p-4 text-white text-center relative group/tooltip">
                   <div className="flex justify-between items-start mb-2">
                     <p className="text-xs font-black uppercase tracking-widest opacity-80 text-left">Go Elite</p>
                     <div className="relative">
                      <div className="w-5 h-5 rounded-full border border-white/40 flex items-center justify-center text-[10px] font-bold cursor-help hover:bg-white hover:text-slate-900 transition-colors">?</div>
                      {/* Tooltip */}
                      <div className="absolute right-0 bottom-full mb-2 w-64 bg-white text-slate-900 p-4 rounded-xl shadow-2xl opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all duration-300 pointer-events-none z-50 transform translate-y-2 group-hover/tooltip:translate-y-0 text-left border border-slate-100">
                        <div className="text-xs font-black uppercase tracking-widest text-indigo-600 mb-3">Elite Managed</div>
                        <ul className="space-y-2">
                           <li className="flex items-start gap-2 text-[11px] font-bold text-slate-600 leading-tight">
                              <span className="text-indigo-600 mt-0.5">✓</span> First in the featured zone
                           </li>
                           <li className="flex items-start gap-2 text-[11px] font-bold text-slate-600 leading-tight">
                              <span className="text-indigo-600 mt-0.5">✓</span> Paid placement for 30 days
                           </li>
                        </ul>
                        <div className="absolute -bottom-2 right-1.5 w-4 h-4 bg-white transform rotate-45 border-r border-b border-slate-100"></div>
                      </div>
                    </div>
                   </div>
                   <p className="font-bold text-sm mb-4 text-left">First in the featured zone for 30 days.</p>
                   <button 
                    onClick={() => onUpgradePlan('Elite Managed', PLAN_PRICES.elite)}
                    className="w-full bg-white text-slate-900 py-3 rounded-xl font-black text-sm hover:bg-slate-200 transition-colors"
                   >
                     Upgrade to Elite (+${PLAN_PRICES.elite - PLAN_PRICES.pro})
                   </button>
                </div>
              )}

              {selectedPlan.type !== 'Standard' && (
                <button
                  onClick={() => onUpgradePlan('Standard', foundingEligible ? PLAN_PRICES.startPack : PLAN_PRICES.standard)}
                  className="mt-6 w-full px-4 py-3 rounded-xl border border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:border-indigo-200 hover:text-indigo-600 transition-colors"
                >
                  Switch to Standard (${PLAN_PRICES.standard})
                </button>
              )}

           </div>
        </div>
      </div>
    </div>
  );
};

export default PostJob;
