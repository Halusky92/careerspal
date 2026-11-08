export function publicOperator() {
  const name = (process.env.NEXT_PUBLIC_OPERATOR_NAME || "Mgr. Marek Bilek").trim();
  const address = (process.env.NEXT_PUBLIC_OPERATOR_ADDRESS || "").trim();
  const companyId = (process.env.NEXT_PUBLIC_OPERATOR_COMPANY_ID || "").trim();
  const vatId = (process.env.NEXT_PUBLIC_OPERATOR_VAT_ID || "").trim();
  const lines = [
    companyId ? `Company ID ${companyId}` : null,
    vatId ? `VAT ${vatId}` : null,
    address || null,
  ].filter(Boolean) as string[];
  return {
    name,
    email: "info@careerspal.com",
    country: "Slovak Republic",
    lines,
  };
}
