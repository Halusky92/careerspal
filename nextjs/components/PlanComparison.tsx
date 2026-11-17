type Cell = boolean | string;
type PlanId = "guest" | "account" | "premium";

const ROWS: { label: string; free: Cell; account: Cell; premium: Cell }[] = [
  { label: "Public board", free: true, account: true, premium: true },
  { label: "Search, salary, and tools", free: true, account: true, premium: true },
  { label: "Apply on the employer site", free: true, account: true, premium: true },
  { label: "Saved roles", free: "This browser", account: "In the account", premium: "In the account" },
  { label: "Saved searches", free: "—", account: "One", premium: "More than one" },
  {
    label: "Email",
    free: "Tuesday and Friday, if you subscribe",
    account: "Tuesday and Friday, after a role is public",
    premium: "After each search, including the first 24 hours",
  },
  { label: "Roles in the first 24 hours", free: false, account: false, premium: true },
];

const COLS: { id: PlanId; field: "free" | "account" | "premium"; title: string; price: string; note: string }[] = [
  { id: "guest", field: "free", title: "Free", price: "$0", note: "" },
  { id: "account", field: "account", title: "Free Account", price: "$0", note: "" },
  { id: "premium", field: "premium", title: "Premium", price: "$11.99", note: " / month" },
];

function Mark({ value, light }: { value: Cell; light?: boolean }) {
  if (value === true) return <span className={light ? "text-white" : "text-emerald-600"}>✓</span>;
  if (value === false || value === "—") return <span className={light ? "text-indigo-200" : "text-slate-300"}>—</span>;
  return <span className={light ? "text-indigo-50" : "text-slate-700"}>{value}</span>;
}

export default function PlanComparison({
  current = "guest",
  onCreateAccount,
  onGetPremium,
}: {
  current?: PlanId;
  onCreateAccount?: () => void;
  onGetPremium?: () => void;
}) {
  const action = (id: PlanId) => {
    if (id === "account" && current === "guest" && onCreateAccount) {
      return (
        <button type="button" onClick={onCreateAccount} className="mt-4 h-9 w-full rounded-lg bg-indigo-600 px-3 text-sm font-medium text-white hover:bg-indigo-700">
          Create account
        </button>
      );
    }
    if (id === "premium" && current !== "premium" && onGetPremium) {
      return (
        <button type="button" onClick={onGetPremium} className="mt-4 h-9 w-full rounded-lg bg-white px-3 text-sm font-medium text-indigo-700 hover:bg-indigo-50">
          Get Premium
        </button>
      );
    }
    return null;
  };

  return (
    <>
      <div className="grid grid-cols-1 gap-3 md:hidden">
        {COLS.map((col) => {
          const premium = col.id === "premium";
          const yours = current !== "guest" && current === col.id;
          return (
            <article key={col.id} className={`rounded-2xl border p-4 ${premium ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-200 bg-white"}`}>
              <div className="flex items-end justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold">{col.title}</h3>
                  {yours ? <p className={`text-[11px] font-medium ${premium ? "text-indigo-100" : "text-indigo-700"}`}>Your plan</p> : null}
                </div>
                <p className="text-2xl font-semibold tracking-tight">
                  {col.price}
                  {col.note ? <span className={`text-xs font-medium ${premium ? "text-indigo-100" : "text-slate-500"}`}>{col.note}</span> : null}
                </p>
              </div>
              <ul className="mt-3 space-y-2 text-sm">
                {ROWS.map((row) => (
                  <li key={row.label} className="flex items-start justify-between gap-3">
                    <span className={premium ? "text-indigo-100" : "text-slate-500"}>{row.label}</span>
                    <span className="text-right"><Mark value={row[col.field]} light={premium} /></span>
                  </li>
                ))}
              </ul>
              {action(col.id)}
            </article>
          );
        })}
      </div>

      <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white md:block">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="bg-white px-4 py-3" />
              {COLS.map((col) => {
                const yours = current !== "guest" && current === col.id;
                const premium = col.id === "premium";
                return (
                  <th key={col.id} className={`px-4 py-3 align-bottom ${premium ? "bg-indigo-600 text-white" : yours ? "bg-indigo-50 text-slate-900" : "bg-white text-slate-900"}`}>
                    <div className="text-sm font-semibold">{col.title}</div>
                    {yours ? <div className={`mt-0.5 text-[11px] font-medium ${premium ? "text-indigo-100" : "text-indigo-700"}`}>Your plan</div> : null}
                    <div className="mt-2 text-lg font-semibold tracking-tight">
                      {col.price}
                      {col.note ? <span className={`text-xs font-medium ${premium ? "text-indigo-100" : "text-slate-500"}`}>{col.note}</span> : null}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <tr key={row.label} className="border-b border-slate-100 last:border-0">
                <th className="bg-white px-4 py-2.5 text-xs font-medium text-slate-600">{row.label}</th>
                {COLS.map((col) => (
                  <td key={col.id} className={`px-4 py-2.5 ${col.id === "premium" ? "bg-indigo-600" : current === col.id ? "bg-indigo-50/70" : ""}`}>
                    <Mark value={row[col.field]} light={col.id === "premium"} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          {onCreateAccount || onGetPremium ? (
            <tfoot>
              <tr>
                <td />
                {COLS.map((col) => (
                  <td key={col.id} className={`px-4 py-3 ${col.id === "premium" ? "bg-indigo-600" : ""}`}>
                    {action(col.id)}
                  </td>
                ))}
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
    </>
  );
}
