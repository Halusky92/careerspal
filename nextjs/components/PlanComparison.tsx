type PlanId = "guest" | "account" | "premium";

const CARDS: {
  id: PlanId;
  title: string;
  price: string;
  note: string;
  lines: { ok: boolean; text: string }[];
}[] = [
  {
    id: "guest",
    title: "Free",
    price: "$0",
    note: "",
    lines: [
      { ok: true, text: "Public board" },
      { ok: true, text: "Search and filters" },
      { ok: true, text: "Apply on the company site" },
      { ok: false, text: "Saved search" },
      { ok: false, text: "Tuesday and Friday email" },
      { ok: false, text: "First 24 hours" },
    ],
  },
  {
    id: "account",
    title: "Free Account",
    price: "$0",
    note: "",
    lines: [
      { ok: true, text: "Public board" },
      { ok: true, text: "Search and filters" },
      { ok: true, text: "Apply on the company site" },
      { ok: true, text: "One saved search" },
      { ok: true, text: "Tuesday and Friday email" },
      { ok: false, text: "First 24 hours" },
    ],
  },
  {
    id: "premium",
    title: "Premium",
    price: "$11.99",
    note: " / month",
    lines: [
      { ok: true, text: "Public board" },
      { ok: true, text: "Search and filters" },
      { ok: true, text: "Apply on the company site" },
      { ok: true, text: "More than one saved search" },
      { ok: true, text: "Email after each search" },
      { ok: true, text: "First 24 hours" },
    ],
  },
];

export default function PlanComparison({
  current = "guest",
  onCreateAccount,
  onGetPremium,
  memberName,
}: {
  current?: PlanId;
  onCreateAccount?: () => void;
  onGetPremium?: () => void;
  memberName?: string | null;
}) {
  if (current === "premium") {
    const greeting = (memberName || "").trim() || "Your Premium account";
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <p className="text-base font-semibold text-slate-900">{greeting}</p>
        <p className="mt-1 text-sm text-slate-600">Premium is active.</p>
        <ul className="mt-3 space-y-1.5 text-sm text-slate-700">
          <li>New roles for their first 24 hours</li>
          <li>Email after each search when a saved search matches</li>
          <li>More than one saved search</li>
        </ul>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {CARDS.map((card) => {
        const premium = card.id === "premium";
        const yours = current !== "guest" && current === card.id;
        return (
          <article
            key={card.id}
            className={`flex flex-col rounded-2xl border p-5 ${premium ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-200 bg-white"}`}
          >
            <h3 className="text-base font-semibold">{card.title}</h3>
            {yours ? <p className={`text-[11px] font-medium ${premium ? "text-indigo-100" : "text-indigo-700"}`}>Your plan</p> : null}
            <ul className="mt-3 flex-1 space-y-1.5 text-sm">
              {card.lines.map((line) => (
                <li key={line.text} className="flex gap-2">
                  <span
                    aria-hidden="true"
                    className={line.ok ? (premium ? "text-white" : "text-emerald-600") : premium ? "text-red-200" : "text-red-600"}
                  >
                    {line.ok ? "✓" : "×"}
                  </span>
                  <span className={premium ? "text-indigo-50" : "text-slate-700"}>{line.text}</span>
                </li>
              ))}
            </ul>
            <p className="mt-5 text-3xl font-semibold tracking-tight">
              {card.price}
              {card.note ? <span className={`text-base font-medium ${premium ? "text-indigo-200" : "text-slate-500"}`}>{card.note}</span> : null}
            </p>
            {card.id === "account" && current === "guest" && onCreateAccount ? (
              <button type="button" onClick={onCreateAccount} className="mt-4 h-10 w-full rounded-lg bg-indigo-600 text-sm font-medium text-white hover:bg-indigo-700">
                Create account
              </button>
            ) : null}
            {card.id === "premium" && onGetPremium ? (
              <button type="button" onClick={onGetPremium} className="mt-4 h-10 w-full rounded-lg bg-white text-sm font-medium text-indigo-700 hover:bg-indigo-50">
                Get Premium
              </button>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
