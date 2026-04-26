import { useState, useEffect, useCallback } from "react";
import { useLocation, useParams } from "wouter";
import { authHeaders } from "@/lib/auth";
import { adminRoutes } from "@/lib/admin-path";
import {
  ArrowLeft, Plus, Trash2, ChevronRight, ChevronLeft,
  FileText, RefreshCw, Download, Printer, AlertTriangle, CheckCircle2, FilePlus,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ExpenseRow   { id: string; label: string; amount: number }
interface BankRow      { id: string; bank: string; amount: number }
interface FixedAssetRow{ id: string; description: string; cost: number; accDepreciation: number }
interface LoanRow      { id: string; description: string; amount: number }

interface DraftData {
  // Step 1 — Business Info
  businessName: string; registrationNumber: string; address: string;
  directors: string; currencyCode: string;
  // Step 2 — Revenue
  grossSales: number; refunds: number; otherIncome: number; otherIncomeDesc: string;
  posDataFetched: boolean;
  // Step 3 — COGS
  beginningInventory: number; purchases: number; endingInventory: number;
  // Step 4 — Expenses
  expenses: ExpenseRow[];
  // Step 5 — Assets
  cashOnHand: number;
  bankAccounts: BankRow[];
  accountsReceivable: number; prepaidExpenses: number; otherCurrentAssets: number;
  fixedAssets: FixedAssetRow[];
  otherNonCurrentAssets: number;
  // Step 6 — Liabilities
  accountsPayable: number; accruedExpenses: number; taxesPayable: number;
  currentPortionLoans: number; otherCurrentLiabilities: number;
  longTermLoans: LoanRow[];
  otherLongTermLiabilities: number;
  // Step 7 — Equity
  paidInCapital: number; retainedEarningsBeginning: number;
  ownerDrawings: number; otherEquityChanges: number; otherEquityChangesDesc: string;
  // Notes
  notes: string;
}

const DEFAULT_EXPENSES: ExpenseRow[] = [
  { id: "e1",  label: "Salaries & Wages",                   amount: 0 },
  { id: "e2",  label: "Rent & Lease",                        amount: 0 },
  { id: "e3",  label: "Electricity & Utilities",             amount: 0 },
  { id: "e4",  label: "Water",                               amount: 0 },
  { id: "e5",  label: "Internet & Phone",                    amount: 0 },
  { id: "e6",  label: "Insurance",                           amount: 0 },
  { id: "e7",  label: "Supplies (Non-Food)",                 amount: 0 },
  { id: "e8",  label: "Marketing & Advertising",             amount: 0 },
  { id: "e9",  label: "Professional Fees (Accounting/Legal)",amount: 0 },
  { id: "e10", label: "Bank Charges & Fees",                 amount: 0 },
  { id: "e11", label: "Business License & Permits",          amount: 0 },
  { id: "e12", label: "Repairs & Maintenance",               amount: 0 },
  { id: "e13", label: "Depreciation",                        amount: 0 },
  { id: "e14", label: "Miscellaneous",                       amount: 0 },
];

const EMPTY_DRAFT: DraftData = {
  businessName: "Island Tacos", registrationNumber: "", address: "Wickhams Cay 1, Road Town, Tortola, BVI",
  directors: "", currencyCode: "USD",
  grossSales: 0, refunds: 0, otherIncome: 0, otherIncomeDesc: "", posDataFetched: false,
  beginningInventory: 0, purchases: 0, endingInventory: 0,
  expenses: DEFAULT_EXPENSES.map(e => ({ ...e })),
  cashOnHand: 0, bankAccounts: [{ id: "b1", bank: "FirstBank BVI", amount: 0 }],
  accountsReceivable: 0, prepaidExpenses: 0, otherCurrentAssets: 0,
  fixedAssets: [
    { id: "fa1", description: "Kitchen Equipment",    cost: 0, accDepreciation: 0 },
    { id: "fa2", description: "Furniture & Fixtures", cost: 0, accDepreciation: 0 },
    { id: "fa3", description: "POS / Computer Equipment", cost: 0, accDepreciation: 0 },
    { id: "fa4", description: "Leasehold Improvements",   cost: 0, accDepreciation: 0 },
  ],
  otherNonCurrentAssets: 0,
  accountsPayable: 0, accruedExpenses: 0, taxesPayable: 0,
  currentPortionLoans: 0, otherCurrentLiabilities: 0,
  longTermLoans: [{ id: "l1", description: "Bank Loan", amount: 0 }],
  otherLongTermLiabilities: 0,
  paidInCapital: 0, retainedEarningsBeginning: 0, ownerDrawings: 0,
  otherEquityChanges: 0, otherEquityChangesDesc: "",
  notes: "",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const uid = () => Math.random().toString(36).slice(2, 9);
const n = (v: unknown) => parseFloat(String(v ?? 0)) || 0;
const fmtUSD = (v: number) =>
  v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function computeTotals(d: DraftData, periodStart: string, periodEnd: string) {
  // P&L
  const netRevenue      = n(d.grossSales) - n(d.refunds) + n(d.otherIncome);
  const cogs            = n(d.beginningInventory) + n(d.purchases) - n(d.endingInventory);
  const grossProfit     = netRevenue - cogs;
  const totalExpenses   = d.expenses.reduce((s, e) => s + n(e.amount), 0);
  const netProfit       = grossProfit - totalExpenses;

  // Balance sheet — Assets
  const totalCash         = n(d.cashOnHand) + d.bankAccounts.reduce((s, b) => s + n(b.amount), 0);
  const totalCurrentAssets= totalCash + n(d.accountsReceivable) + n(d.prepaidExpenses)
                            + n(d.endingInventory) + n(d.otherCurrentAssets);
  const totalFixedNet     = d.fixedAssets.reduce((s, a) => s + n(a.cost) - n(a.accDepreciation), 0);
  const totalAssets       = totalCurrentAssets + totalFixedNet + n(d.otherNonCurrentAssets);

  // Liabilities
  const totalCurrentLiab  = n(d.accountsPayable) + n(d.accruedExpenses) + n(d.taxesPayable)
                            + n(d.currentPortionLoans) + n(d.otherCurrentLiabilities);
  const totalLtLiab       = d.longTermLoans.reduce((s, l) => s + n(l.amount), 0)
                            + n(d.otherLongTermLiabilities);
  const totalLiabilities  = totalCurrentLiab + totalLtLiab;

  // Equity
  const retainedEarningsEnd = n(d.retainedEarningsBeginning) + netProfit
                              - n(d.ownerDrawings) + n(d.otherEquityChanges);
  const totalEquity         = n(d.paidInCapital) + retainedEarningsEnd;
  const totalLiabAndEquity  = totalLiabilities + totalEquity;
  const balanceDiff         = totalAssets - totalLiabAndEquity;

  return {
    netRevenue, cogs, grossProfit, totalExpenses, netProfit,
    totalCash, totalCurrentAssets, totalFixedNet, totalAssets,
    totalCurrentLiab, totalLtLiab, totalLiabilities,
    retainedEarningsEnd, totalEquity, totalLiabAndEquity, balanceDiff,
    periodStart, periodEnd,
  };
}

// ─── Statement HTML Generator ─────────────────────────────────────────────────

function generateStatementHTML(d: DraftData, t: ReturnType<typeof computeTotals>): string {
  const period = t.periodStart === t.periodEnd
    ? `As at ${t.periodStart}`
    : `For the period ${t.periodStart} to ${t.periodEnd}`;
  const generated = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const cur = d.currencyCode || "USD";
  const row = (label: string, value: number | null, indent = 0, bold = false, underline = false, doubleUnderline = false) => {
    const style = [
      bold ? "font-weight:700" : "",
      underline ? "border-bottom:1.5px solid #111;padding-bottom:1px" : "",
      doubleUnderline ? "border-bottom:3px double #111;padding-bottom:1px" : "",
    ].filter(Boolean).join(";");
    return `<tr>
      <td style="padding:3px 0 3px ${indent * 16}px;font-size:13px;${bold?"font-weight:700":""}">${label}</td>
      <td style="text-align:right;padding:3px 0;font-size:13px;${style}">${value !== null ? fmtUSD(value) : ""}</td>
    </tr>`;
  };
  const space = () => `<tr><td colspan="2" style="height:8px"></td></tr>`;
  const section = (title: string) => `<tr><td colspan="2" style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#9ca3af;padding:14px 0 6px">${title}</td></tr>`;
  const divider = () => `<tr><td colspan="2" style="border-top:1px solid #e5e7eb;padding:0;height:1px"></td></tr>`;

  const css = `
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:-apple-system,'Helvetica Neue',Arial,sans-serif;background:#fff;color:#111}
    .page{max-width:760px;margin:0 auto;padding:0}
    .cover{background:linear-gradient(135deg,#059669 0%,#047857 100%);padding:56px 56px 48px;color:#fff}
    .cover .co{font-size:32px;font-weight:900;letter-spacing:-1px;margin-bottom:6px}
    .cover .addr{font-size:13px;opacity:.75;margin-bottom:4px}
    .cover .reg{font-size:12px;opacity:.6}
    .cover .title{font-size:20px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-top:36px;opacity:.9}
    .cover .period{font-size:14px;margin-top:6px;opacity:.75}
    .cover .std{font-size:11px;margin-top:24px;opacity:.6;font-style:italic}
    .section-page{padding:44px 56px;border-bottom:1px solid #f0f0f0}
    .section-page:last-of-type{border:none}
    .stmt-title{font-size:16px;font-weight:800;color:#111;margin-bottom:4px;text-transform:uppercase;letter-spacing:.5px}
    .stmt-subtitle{font-size:12px;color:#6b7280;margin-bottom:24px}
    table{width:100%;border-collapse:collapse}
    .cert{padding:44px 56px;background:#f9fafb;border-top:2px solid #e5e7eb}
    .sig-block{display:grid;grid-template-columns:1fr 1fr;gap:32px;margin-top:28px}
    .sig{border-top:1.5px solid #374151;padding-top:10px}
    .sig .role{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#6b7280}
    .sig .name-line{font-size:13px;margin-top:20px;color:#374151}
    .footer{display:flex;justify-content:space-between;padding:16px 56px;background:#f9fafb;border-top:1px solid #e5e7eb}
    .footer span{font-size:11px;color:#9ca3af}
    @media print{
      @page{margin:0;size:A4}
      body{print-color-adjust:exact;-webkit-print-color-adjust:exact}
      .page{max-width:100%}
    }`;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Financial Statements – ${d.businessName}</title>
<style>${css}</style></head><body><div class="page">

<!-- COVER PAGE -->
<div class="cover">
  <div class="co">${d.businessName}</div>
  <div class="addr">${d.address}</div>
  ${d.registrationNumber ? `<div class="reg">BVI Company Registration No. ${d.registrationNumber}</div>` : ""}
  <div class="title">Financial Statements</div>
  <div class="period">${period}</div>
  <div class="std">Prepared in accordance with International Financial Reporting Standards (IFRS)<br>
  British Virgin Islands · All amounts in ${cur}</div>
</div>

<!-- STATEMENT OF COMPREHENSIVE INCOME -->
<div class="section-page">
  <div class="stmt-title">Statement of Comprehensive Income</div>
  <div class="stmt-subtitle">${period} &nbsp;·&nbsp; All amounts in ${cur}</div>
  <table>
    ${section("Revenue")}
    ${row("Gross Sales", n(d.grossSales), 1)}
    ${n(d.refunds) > 0 ? row("Less: Refunds", -n(d.refunds), 1) : ""}
    ${n(d.otherIncome) > 0 ? row(d.otherIncomeDesc || "Other Income", n(d.otherIncome), 1) : ""}
    ${divider()}
    ${row("Net Revenue", t.netRevenue, 0, true, true)}
    ${space()}

    ${section("Cost of Goods Sold")}
    ${row("Beginning Inventory", n(d.beginningInventory), 1)}
    ${row("Add: Purchases", n(d.purchases), 1)}
    ${row("Less: Ending Inventory", -n(d.endingInventory), 1)}
    ${divider()}
    ${row("Total Cost of Goods Sold", t.cogs, 0, true, true)}
    ${space()}

    ${divider()}
    ${row("Gross Profit", t.grossProfit, 0, true)}
    ${space()}

    ${section("Operating Expenses")}
    ${d.expenses.filter(e => n(e.amount) > 0).map(e => row(e.label, n(e.amount), 1)).join("")}
    ${divider()}
    ${row("Total Operating Expenses", t.totalExpenses, 0, true, true)}
    ${space()}

    ${divider()}
    ${row(t.netProfit >= 0 ? "Net Profit for the Period" : "Net Loss for the Period", t.netProfit, 0, true, false, true)}
  </table>
</div>

<!-- STATEMENT OF FINANCIAL POSITION -->
<div class="section-page">
  <div class="stmt-title">Statement of Financial Position</div>
  <div class="stmt-subtitle">As at ${t.periodEnd} &nbsp;·&nbsp; All amounts in ${cur}</div>
  <table>
    ${section("Current Assets")}
    ${row("Cash on Hand", n(d.cashOnHand), 1)}
    ${d.bankAccounts.filter(b => n(b.amount) > 0).map(b => row(b.bank, n(b.amount), 1)).join("")}
    ${n(d.accountsReceivable) > 0 ? row("Accounts Receivable", n(d.accountsReceivable), 1) : ""}
    ${n(d.endingInventory) > 0 ? row("Inventory", n(d.endingInventory), 1) : ""}
    ${n(d.prepaidExpenses) > 0 ? row("Prepaid Expenses", n(d.prepaidExpenses), 1) : ""}
    ${n(d.otherCurrentAssets) > 0 ? row("Other Current Assets", n(d.otherCurrentAssets), 1) : ""}
    ${divider()}
    ${row("Total Current Assets", t.totalCurrentAssets, 0, true, true)}
    ${space()}

    ${section("Non-Current Assets")}
    ${d.fixedAssets.filter(a => n(a.cost) > 0).map(a => `
      ${row(a.description, n(a.cost), 1)}
      ${n(a.accDepreciation) > 0 ? row("Less: Accumulated Depreciation", -n(a.accDepreciation), 2) : ""}
    `).join("")}
    ${n(d.otherNonCurrentAssets) > 0 ? row("Other Non-Current Assets", n(d.otherNonCurrentAssets), 1) : ""}
    ${divider()}
    ${row("Total Non-Current Assets", t.totalFixedNet + n(d.otherNonCurrentAssets), 0, true, true)}
    ${space()}

    ${divider()}
    ${row("TOTAL ASSETS", t.totalAssets, 0, true, false, true)}
    ${space()}

    ${section("Current Liabilities")}
    ${n(d.accountsPayable) > 0 ? row("Accounts Payable", n(d.accountsPayable), 1) : ""}
    ${n(d.accruedExpenses) > 0 ? row("Accrued Expenses", n(d.accruedExpenses), 1) : ""}
    ${n(d.taxesPayable) > 0 ? row("Taxes Payable", n(d.taxesPayable), 1) : ""}
    ${n(d.currentPortionLoans) > 0 ? row("Current Portion of Long-Term Debt", n(d.currentPortionLoans), 1) : ""}
    ${n(d.otherCurrentLiabilities) > 0 ? row("Other Current Liabilities", n(d.otherCurrentLiabilities), 1) : ""}
    ${divider()}
    ${row("Total Current Liabilities", t.totalCurrentLiab, 0, true, true)}
    ${space()}

    ${section("Non-Current Liabilities")}
    ${d.longTermLoans.filter(l => n(l.amount) > 0).map(l => row(l.description, n(l.amount), 1)).join("")}
    ${n(d.otherLongTermLiabilities) > 0 ? row("Other Long-Term Liabilities", n(d.otherLongTermLiabilities), 1) : ""}
    ${divider()}
    ${row("Total Non-Current Liabilities", t.totalLtLiab, 0, true, true)}
    ${space()}

    ${divider()}
    ${row("TOTAL LIABILITIES", t.totalLiabilities, 0, true)}
    ${space()}

    ${section("Owner's Equity")}
    ${row("Contributed Capital", n(d.paidInCapital), 1)}
    ${row("Retained Earnings (Beginning of Period)", n(d.retainedEarningsBeginning), 1)}
    ${row("Add: Net " + (t.netProfit >= 0 ? "Profit" : "Loss"), t.netProfit, 1)}
    ${n(d.ownerDrawings) > 0 ? row("Less: Owner's Drawings", -n(d.ownerDrawings), 1) : ""}
    ${n(d.otherEquityChanges) !== 0 ? row(d.otherEquityChangesDesc || "Other Equity Changes", n(d.otherEquityChanges), 1) : ""}
    ${divider()}
    ${row("Retained Earnings (End of Period)", t.retainedEarningsEnd, 0, true, true)}
    ${space()}
    ${divider()}
    ${row("TOTAL EQUITY", t.totalEquity, 0, true)}
    ${space()}

    ${divider()}
    ${row("TOTAL LIABILITIES AND EQUITY", t.totalLiabAndEquity, 0, true, false, true)}
  </table>
  ${Math.abs(t.balanceDiff) > 0.05 ? `
  <div style="margin-top:16px;background:#fef3c7;border:1px solid #f59e0b;border-radius:8px;padding:12px 16px;font-size:12px;color:#92400e">
    <strong>Note:</strong> The balance sheet does not balance by ${fmtUSD(Math.abs(t.balanceDiff))} ${cur}.
    This difference should be reviewed and corrected before the accountant's sign-off.
  </div>` : ""}
</div>

<!-- NOTES -->
${d.notes ? `<div class="section-page">
  <div class="stmt-title">Notes to the Financial Statements</div>
  <div class="stmt-subtitle">&nbsp;</div>
  <div style="font-size:13px;line-height:1.7;color:#374151;white-space:pre-wrap">${d.notes}</div>
</div>` : ""}

<!-- ACCOUNTANT'S CERTIFICATION -->
<div class="cert">
  <div style="font-size:16px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;margin-bottom:12px">Independent Accountant's Report</div>
  <div style="font-size:12px;color:#374151;line-height:1.8;max-width:580px">
    To the Director(s) of ${d.businessName}:<br><br>
    I/We have reviewed the accompanying financial statements of <strong>${d.businessName}</strong>,
    which comprise the Statement of Financial Position as at ${t.periodEnd}, and the Statement of
    Comprehensive Income for the period ${t.periodStart} to ${t.periodEnd}, and a summary of significant
    accounting policies and other explanatory information.<br><br>
    These financial statements have been prepared in accordance with International Financial Reporting
    Standards (IFRS) and are the responsibility of the company's management. My/Our responsibility
    is to express a conclusion on these financial statements based on my/our review.<br><br>
    Based on my/our review, nothing has come to my/our attention that causes me/us to believe that
    the financial statements do not present fairly, in all material respects, the financial position
    of <strong>${d.businessName}</strong> as at ${t.periodEnd}, and the results of its operations for
    the period then ended in accordance with IFRS.
  </div>
  <div class="sig-block">
    <div class="sig">
      <div class="role">Certified Public Accountant</div>
      <div class="name-line">Name: ________________________________</div>
      <div class="name-line" style="margin-top:10px">License No.: ________________________</div>
      <div class="name-line" style="margin-top:10px">Firm: _______________________________</div>
      <div class="name-line" style="margin-top:10px">Date: _______________________________</div>
    </div>
    <div class="sig">
      <div class="role">Director / Authorized Signatory</div>
      ${d.directors ? `<div class="name-line">${d.directors}</div>` : '<div class="name-line">Name: ________________________________</div>'}
      <div class="name-line" style="margin-top:10px">Title: ______________________________</div>
      <div class="name-line" style="margin-top:10px">Date: _______________________________</div>
    </div>
  </div>
  <div style="margin-top:20px;font-size:11px;color:#9ca3af">
    Generated ${generated} &nbsp;·&nbsp; ${d.businessName} &nbsp;·&nbsp; ${d.address}
    ${d.registrationNumber ? ` &nbsp;·&nbsp; BVI Reg. ${d.registrationNumber}` : ""}
  </div>
</div>

<div class="footer">
  <span>${d.businessName} &nbsp;·&nbsp; Confidential Financial Statements</span>
  <span>Page 1</span>
</div>
</div></body></html>`;
}

// ─── Step components ──────────────────────────────────────────────────────────

const STEPS = [
  "Business Info",
  "Revenue",
  "Cost of Goods",
  "Expenses",
  "Assets",
  "Liabilities",
  "Equity",
  "Review & Generate",
];

function numInput(
  label: string, value: number,
  onChange: (v: number) => void,
  hint?: string,
  prefix = "$",
) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-gray-700 mb-1">{label}</span>
      {hint && <span className="block text-xs text-gray-400 mb-1">{hint}</span>}
      <div className="flex items-center">
        {prefix && <span className="px-3 py-2 bg-gray-100 border border-r-0 border-gray-200 rounded-l-lg text-sm text-gray-500">{prefix}</span>}
        <input
          type="number" step="0.01" min="0"
          value={value || ""}
          onChange={e => onChange(parseFloat(e.target.value) || 0)}
          className={`flex-1 px-3 py-2 border border-gray-200 ${prefix ? "rounded-r-lg" : "rounded-lg"} text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500`}
          placeholder="0.00"
        />
      </div>
    </label>
  );
}

function textInput(label: string, value: string, onChange: (v: string) => void, placeholder?: string, textarea?: boolean) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-gray-700 mb-1">{label}</span>
      {textarea
        ? <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[80px]" />
        : <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
      }
    </label>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface Draft {
  id: number; period_start: string; period_end: string;
  business_name?: string; updated_at: string;
}

export default function AdminFinancials() {
  const [, navigate] = useLocation();
  const params = useParams<{ id?: string }>();
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [draftId, setDraftId] = useState<number | null>(params.id ? Number(params.id) : null);
  const [periodStart, setPeriodStart] = useState(() => `${new Date().getFullYear()}-01-01`);
  const [periodEnd, setPeriodEnd]     = useState(() => new Date().toISOString().slice(0, 10));
  const [data, setData]   = useState<DraftData>({ ...EMPTY_DRAFT });
  const [step, setStep]   = useState(0);
  const [saving, setSaving] = useState(false);
  const [loadingDrafts, setLoadingDrafts] = useState(true);
  const [fetchingPOS, setFetchingPOS] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [inWizard, setInWizard] = useState(!!params.id);

  // Check auth
  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include", cache: "no-store", headers: authHeaders() })
      .then(r => r.json()).then(d => { if (!d.authed || d.role !== "admin") navigate(adminRoutes.login); })
      .catch(() => navigate(adminRoutes.login));
  }, [navigate]);

  // Load draft list
  const loadDrafts = useCallback(async () => {
    setLoadingDrafts(true);
    try {
      const r = await fetch("/api/financials/drafts", { credentials: "include", headers: authHeaders() });
      if (r.ok) setDrafts(await r.json());
    } finally { setLoadingDrafts(false); }
  }, []);

  useEffect(() => { loadDrafts(); }, [loadDrafts]);

  // Load specific draft
  useEffect(() => {
    if (!draftId) return;
    fetch(`/api/financials/drafts/${draftId}`, { credentials: "include", headers: authHeaders() })
      .then(r => r.json()).then(d => {
        if (d.period_start) setPeriodStart(d.period_start);
        if (d.period_end)   setPeriodEnd(d.period_end);
        if (d.data)         setData({ ...EMPTY_DRAFT, ...d.data });
      });
  }, [draftId]);

  const save = useCallback(async (overrideData?: DraftData) => {
    const payload = overrideData ?? data;
    setSaving(true);
    try {
      if (draftId) {
        await fetch(`/api/financials/drafts/${draftId}`, {
          method: "PUT", credentials: "include",
          headers: { ...authHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify({ period_start: periodStart, period_end: periodEnd, data: payload }),
        });
      } else {
        const r = await fetch("/api/financials/drafts", {
          method: "POST", credentials: "include",
          headers: { ...authHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify({ period_start: periodStart, period_end: periodEnd, data: payload }),
        });
        const created = await r.json();
        if (created.id) setDraftId(created.id);
      }
    } finally { setSaving(false); }
  }, [data, draftId, periodStart, periodEnd]);

  const update = (patch: Partial<DraftData>) => setData(prev => ({ ...prev, ...patch }));

  const fetchPOSData = async () => {
    setFetchingPOS(true);
    try {
      const r = await fetch(`/api/reports/sales?from=${periodStart}&to=${periodEnd}`, {
        credentials: "include", headers: authHeaders(),
      });
      if (!r.ok) throw new Error("Failed");
      const rpt = await r.json();
      update({
        grossSales: rpt.totalSales ?? 0,
        refunds: rpt.refundTotal ?? 0,
        posDataFetched: true,
      });
    } catch { alert("Could not load POS data. Enter manually."); }
    finally { setFetchingPOS(false); }
  };

  const goNext = async () => {
    await save();
    setStep(s => Math.min(s + 1, STEPS.length - 1));
  };

  const goPrev = () => setStep(s => Math.max(s - 1, 0));

  const deleteDraft = async (id: number) => {
    if (!confirm("Delete this draft? This cannot be undone.")) return;
    await fetch(`/api/financials/drafts/${id}`, { method: "DELETE", credentials: "include", headers: authHeaders() });
    await loadDrafts();
    if (draftId === id) { setDraftId(null); setData({ ...EMPTY_DRAFT }); setStep(0); setInWizard(false); }
  };

  const openDraft = (d: Draft) => {
    setDraftId(d.id);
    setPeriodStart(d.period_start);
    setPeriodEnd(d.period_end);
    setStep(0);
    setInWizard(true);
  };

  const newDraft = () => {
    setDraftId(null);
    setData({ ...EMPTY_DRAFT });
    setPeriodStart(`${new Date().getFullYear()}-01-01`);
    setPeriodEnd(new Date().toISOString().slice(0, 10));
    setStep(0);
    setInWizard(true);
  };

  const totals = computeTotals(data, periodStart, periodEnd);

  const handleGenerate = () => {
    setGenerating(true);
    try {
      const html = generateStatementHTML(data, totals);
      const win = window.open("", "_blank", "width=900,height=750");
      if (!win) { alert("Please allow popups for this site."); return; }
      win.document.write(html);
      win.document.close();
      win.onload = () => { win.focus(); };
    } finally { setGenerating(false); }
  };

  const handlePrint = () => {
    const html = generateStatementHTML(data, totals);
    const win = window.open("", "_blank", "width=900,height=750");
    if (!win) { alert("Please allow popups."); return; }
    win.document.write(html);
    win.document.close();
    win.onload = () => { win.focus(); win.print(); };
  };

  // ── If no draft is open, show list ───────────────────────────────────────
  if (!inWizard) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white border-b sticky top-0 z-10">
          <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
            <button onClick={() => navigate(adminRoutes.dashboard)} className="p-2 hover:bg-gray-100 rounded-lg">
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <h1 className="text-lg font-bold text-gray-900 flex-1">Financial Statements</h1>
            <button onClick={newDraft}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors">
              <FilePlus className="w-4 h-4" /> New Statement
            </button>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 py-8">
          {/* Info banner */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-6 flex gap-3">
            <FileText className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="text-sm text-emerald-800">
              <strong>BVI-Compliant Financial Statements</strong> — This wizard generates a
              Statement of Comprehensive Income and Statement of Financial Position following
              IFRS standards, as required under the BVI Business Companies Act. Revenue is
              automatically pulled from your POS. You provide expenses, assets, and liabilities.
              A certified accountant reviews and signs the final document.
            </div>
          </div>

          {drafts.length === 0 ? (
            <div className="text-center py-20 text-gray-400">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No financial statements yet</p>
              <p className="text-sm mt-1">Click "New Statement" to start your first one</p>
            </div>
          ) : (
            <div className="space-y-3">
              <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wide mb-2">Saved Drafts</h2>
              {drafts.map(d => (
                <div key={d.id} className="bg-white border border-gray-100 rounded-xl px-5 py-4 flex items-center gap-4 shadow-sm">
                  <FileText className="w-6 h-6 text-emerald-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-gray-900">{d.business_name || "Island Tacos"}</div>
                    <div className="text-sm text-gray-500">{d.period_start} → {d.period_end}</div>
                    <div className="text-xs text-gray-400 mt-0.5">Last saved {new Date(d.updated_at).toLocaleString()}</div>
                  </div>
                  <button onClick={() => openDraft(d)}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors">
                    Open
                  </button>
                  <button onClick={() => deleteDraft(d.id)}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Wizard ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => { setInWizard(false); setDraftId(null); setStep(0); loadDrafts(); }}
            className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold text-gray-900">Financial Statement Wizard</h1>
            <p className="text-xs text-gray-400">{periodStart} → {periodEnd}
              {draftId ? ` · Draft #${draftId}` : " · Unsaved"}</p>
          </div>
          <button onClick={() => save()} disabled={saving}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50">
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : null}
            {saving ? "Saving…" : "Save"}
          </button>
        </div>

        {/* Progress steps */}
        <div className="max-w-4xl mx-auto px-4 pb-3 overflow-x-auto">
          <div className="flex gap-1 min-w-max">
            {STEPS.map((s, i) => (
              <button key={i} onClick={() => { save(); setStep(i); }}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                  i === step ? "bg-emerald-600 text-white" :
                  i < step  ? "bg-emerald-100 text-emerald-700" :
                  "bg-gray-100 text-gray-500"
                }`}>
                {i + 1}. {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">

        {/* ── Step 0: Business Info ─────────────────────────────────────── */}
        {step === 0 && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-5">
            <h2 className="font-bold text-gray-900 text-lg">Business Information &amp; Period</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Financial Period</label>
                <div className="flex gap-2 items-center">
                  <input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                  <span className="text-gray-400 text-sm">to</span>
                  <input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                </div>
              </div>
              <div>{textInput("Currency", data.currencyCode, v => update({ currencyCode: v }), "USD")}</div>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div>{textInput("Business Name", data.businessName, v => update({ businessName: v }))}</div>
              <div>{textInput("BVI Company Registration No.", data.registrationNumber, v => update({ registrationNumber: v }), "e.g. 1234567")}</div>
            </div>
            <div>{textInput("Registered Address", data.address, v => update({ address: v }))}</div>
            <div>{textInput("Director(s)", data.directors, v => update({ directors: v }), "Full name(s) of authorized signatories")}</div>
          </div>
        )}

        {/* ── Step 1: Revenue ───────────────────────────────────────────── */}
        {step === 1 && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-bold text-gray-900 text-lg">Revenue</h2>
                <p className="text-sm text-gray-500 mt-1">Sales data can be pulled automatically from your POS system for the selected period.</p>
              </div>
              <button onClick={fetchPOSData} disabled={fetchingPOS}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg shrink-0 transition-colors">
                <RefreshCw className={`w-4 h-4 ${fetchingPOS ? "animate-spin" : ""}`} />
                {fetchingPOS ? "Loading…" : "Import from POS"}
              </button>
            </div>
            {data.posDataFetched && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2 text-sm text-emerald-700 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" /> POS data imported for {periodStart} → {periodEnd}. You can adjust values below if needed.
              </div>
            )}
            <div className="grid md:grid-cols-2 gap-4">
              {numInput("Gross Sales", data.grossSales, v => update({ grossSales: v }))}
              {numInput("Total Refunds / Returns", data.refunds, v => update({ refunds: v }))}
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              {numInput("Other Income", data.otherIncome, v => update({ otherIncome: v }), "Interest, catering events, etc.")}
              <div>{textInput("Other Income Description", data.otherIncomeDesc, v => update({ otherIncomeDesc: v }), "e.g. Catering revenue")}</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 flex justify-between items-center">
              <span className="font-semibold text-gray-700">Net Revenue</span>
              <span className="text-xl font-bold text-emerald-700">${fmtUSD(totals.netRevenue)}</span>
            </div>
          </div>
        )}

        {/* ── Step 2: COGS ─────────────────────────────────────────────── */}
        {step === 2 && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-5">
            <h2 className="font-bold text-gray-900 text-lg">Cost of Goods Sold</h2>
            <p className="text-sm text-gray-500">Enter food, beverage, and supply costs for this period.</p>
            <div className="grid md:grid-cols-3 gap-4">
              {numInput("Beginning Inventory", data.beginningInventory, v => update({ beginningInventory: v }), "Value of stock at period start")}
              {numInput("Purchases During Period", data.purchases, v => update({ purchases: v }), "Total food & supply purchases")}
              {numInput("Ending Inventory", data.endingInventory, v => update({ endingInventory: v }), "Value of stock at period end")}
            </div>
            <div className="bg-gray-50 rounded-lg p-4 flex justify-between items-center">
              <span className="font-semibold text-gray-700">Total COGS</span>
              <span className="text-xl font-bold text-gray-900">${fmtUSD(totals.cogs)}</span>
            </div>
            <div className="bg-emerald-50 rounded-lg p-4 flex justify-between items-center">
              <span className="font-semibold text-gray-700">Gross Profit</span>
              <span className={`text-xl font-bold ${totals.grossProfit >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                ${fmtUSD(totals.grossProfit)}
              </span>
            </div>
          </div>
        )}

        {/* ── Step 3: Expenses ─────────────────────────────────────────── */}
        {step === 3 && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
            <h2 className="font-bold text-gray-900 text-lg">Operating Expenses</h2>
            <p className="text-sm text-gray-500">Enter each expense category for the period. Add custom rows as needed.</p>
            <div className="space-y-2">
              {data.expenses.map((e) => (
                <div key={e.id} className="flex gap-2 items-center">
                  <input type="text" value={e.label}
                    onChange={ev => update({ expenses: data.expenses.map(x => x.id === e.id ? { ...x, label: ev.target.value } : x) })}
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                  <div className="flex items-center w-36">
                    <span className="px-2 py-2 bg-gray-100 border border-r-0 border-gray-200 rounded-l-lg text-xs text-gray-500">$</span>
                    <input type="number" step="0.01" min="0"
                      value={e.amount || ""}
                      onChange={ev => update({ expenses: data.expenses.map(x => x.id === e.id ? { ...x, amount: parseFloat(ev.target.value) || 0 } : x) })}
                      className="flex-1 px-2 py-2 border border-gray-200 rounded-r-lg text-sm w-24" placeholder="0.00" />
                  </div>
                  <button onClick={() => update({ expenses: data.expenses.filter(x => x.id !== e.id) })}
                    className="p-2 text-gray-300 hover:text-red-400 rounded-lg transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
            <button onClick={() => update({ expenses: [...data.expenses, { id: uid(), label: "New Expense", amount: 0 }] })}
              className="flex items-center gap-1.5 text-sm text-emerald-600 hover:text-emerald-700 font-medium">
              <Plus className="w-4 h-4" /> Add expense line
            </button>
            <div className="bg-gray-50 rounded-lg p-4 flex justify-between items-center">
              <span className="font-semibold text-gray-700">Total Expenses</span>
              <span className="text-xl font-bold text-gray-900">${fmtUSD(totals.totalExpenses)}</span>
            </div>
            <div className={`rounded-lg p-4 flex justify-between items-center ${totals.netProfit >= 0 ? "bg-emerald-50" : "bg-red-50"}`}>
              <span className="font-semibold text-gray-700">{totals.netProfit >= 0 ? "Net Profit" : "Net Loss"}</span>
              <span className={`text-xl font-bold ${totals.netProfit >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                ${fmtUSD(Math.abs(totals.netProfit))}
              </span>
            </div>
          </div>
        )}

        {/* ── Step 4: Assets ───────────────────────────────────────────── */}
        {step === 4 && (
          <div className="space-y-4">
            {/* Current Assets */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
              <h2 className="font-bold text-gray-900 text-lg">Current Assets</h2>
              <div className="grid md:grid-cols-2 gap-4">
                {numInput("Cash on Hand", data.cashOnHand, v => update({ cashOnHand: v }))}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Bank Accounts</p>
                {data.bankAccounts.map(b => (
                  <div key={b.id} className="flex gap-2 items-center mb-2">
                    <input type="text" value={b.bank} placeholder="Bank name / account"
                      onChange={e => update({ bankAccounts: data.bankAccounts.map(x => x.id === b.id ? { ...x, bank: e.target.value } : x) })}
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                    <div className="flex items-center w-36">
                      <span className="px-2 py-2 bg-gray-100 border border-r-0 border-gray-200 rounded-l-lg text-xs text-gray-500">$</span>
                      <input type="number" step="0.01" min="0" value={b.amount || ""}
                        onChange={e => update({ bankAccounts: data.bankAccounts.map(x => x.id === b.id ? { ...x, amount: parseFloat(e.target.value) || 0 } : x) })}
                        className="flex-1 px-2 py-2 border border-gray-200 rounded-r-lg text-sm" placeholder="0.00" />
                    </div>
                    <button onClick={() => update({ bankAccounts: data.bankAccounts.filter(x => x.id !== b.id) })}
                      className="p-2 text-gray-300 hover:text-red-400 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))}
                <button onClick={() => update({ bankAccounts: [...data.bankAccounts, { id: uid(), bank: "", amount: 0 }] })}
                  className="flex items-center gap-1 text-sm text-emerald-600 hover:text-emerald-700 font-medium">
                  <Plus className="w-4 h-4" /> Add account
                </button>
              </div>
              <div className="grid md:grid-cols-3 gap-4">
                {numInput("Accounts Receivable", data.accountsReceivable, v => update({ accountsReceivable: v }))}
                {numInput("Prepaid Expenses", data.prepaidExpenses, v => update({ prepaidExpenses: v }))}
                {numInput("Other Current Assets", data.otherCurrentAssets, v => update({ otherCurrentAssets: v }))}
              </div>
              <div className="bg-gray-50 rounded-lg p-3 flex justify-between text-sm">
                <span className="font-semibold text-gray-700">Total Current Assets</span>
                <span className="font-bold text-gray-900">${fmtUSD(totals.totalCurrentAssets)}</span>
              </div>
            </div>

            {/* Fixed Assets */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
              <h2 className="font-bold text-gray-900 text-lg">Fixed (Non-Current) Assets</h2>
              <div className="space-y-3">
                {data.fixedAssets.map(a => (
                  <div key={a.id} className="grid grid-cols-[1fr_130px_140px_36px] gap-2 items-center">
                    <input type="text" value={a.description} placeholder="Asset description"
                      onChange={e => update({ fixedAssets: data.fixedAssets.map(x => x.id === a.id ? { ...x, description: e.target.value } : x) })}
                      className="px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                    <div className="flex items-center">
                      <span className="px-2 py-2 bg-gray-100 border border-r-0 border-gray-200 rounded-l-lg text-xs text-gray-500">Cost $</span>
                      <input type="number" step="0.01" min="0" value={a.cost || ""}
                        onChange={e => update({ fixedAssets: data.fixedAssets.map(x => x.id === a.id ? { ...x, cost: parseFloat(e.target.value)||0 } : x) })}
                        className="flex-1 px-2 py-2 border border-gray-200 rounded-r-lg text-xs w-16" placeholder="0" />
                    </div>
                    <div className="flex items-center">
                      <span className="px-2 py-2 bg-gray-100 border border-r-0 border-gray-200 rounded-l-lg text-xs text-gray-500">Dep $</span>
                      <input type="number" step="0.01" min="0" value={a.accDepreciation || ""}
                        onChange={e => update({ fixedAssets: data.fixedAssets.map(x => x.id === a.id ? { ...x, accDepreciation: parseFloat(e.target.value)||0 } : x) })}
                        className="flex-1 px-2 py-2 border border-gray-200 rounded-r-lg text-xs w-16" placeholder="0" />
                    </div>
                    <button onClick={() => update({ fixedAssets: data.fixedAssets.filter(x => x.id !== a.id) })}
                      className="p-2 text-gray-300 hover:text-red-400 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>
              <button onClick={() => update({ fixedAssets: [...data.fixedAssets, { id: uid(), description: "", cost: 0, accDepreciation: 0 }] })}
                className="flex items-center gap-1 text-sm text-emerald-600 hover:text-emerald-700 font-medium">
                <Plus className="w-4 h-4" /> Add fixed asset
              </button>
              <div className="grid md:grid-cols-2 gap-4">
                {numInput("Other Non-Current Assets", data.otherNonCurrentAssets, v => update({ otherNonCurrentAssets: v }))}
              </div>
              <div className="bg-emerald-50 rounded-lg p-3 flex justify-between text-sm">
                <span className="font-semibold text-gray-700">Total Assets</span>
                <span className="font-bold text-emerald-700 text-lg">${fmtUSD(totals.totalAssets)}</span>
              </div>
            </div>
          </div>
        )}

        {/* ── Step 5: Liabilities ───────────────────────────────────────── */}
        {step === 5 && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
              <h2 className="font-bold text-gray-900 text-lg">Current Liabilities</h2>
              <div className="grid md:grid-cols-2 gap-4">
                {numInput("Accounts Payable", data.accountsPayable, v => update({ accountsPayable: v }), "Amounts owed to suppliers")}
                {numInput("Accrued Expenses", data.accruedExpenses, v => update({ accruedExpenses: v }), "Wages, rent accrued but unpaid")}
                {numInput("Taxes Payable", data.taxesPayable, v => update({ taxesPayable: v }), "Payroll tax, BVI business tax")}
                {numInput("Current Portion of Long-Term Debt", data.currentPortionLoans, v => update({ currentPortionLoans: v }))}
                {numInput("Other Current Liabilities", data.otherCurrentLiabilities, v => update({ otherCurrentLiabilities: v }))}
              </div>
              <div className="bg-gray-50 rounded-lg p-3 flex justify-between text-sm">
                <span className="font-semibold text-gray-700">Total Current Liabilities</span>
                <span className="font-bold text-gray-900">${fmtUSD(totals.totalCurrentLiab)}</span>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
              <h2 className="font-bold text-gray-900 text-lg">Long-Term Liabilities</h2>
              <div className="space-y-2">
                {data.longTermLoans.map(l => (
                  <div key={l.id} className="flex gap-2 items-center">
                    <input type="text" value={l.description} placeholder="Loan description"
                      onChange={e => update({ longTermLoans: data.longTermLoans.map(x => x.id === l.id ? { ...x, description: e.target.value } : x) })}
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                    <div className="flex items-center w-36">
                      <span className="px-2 py-2 bg-gray-100 border border-r-0 border-gray-200 rounded-l-lg text-xs text-gray-500">$</span>
                      <input type="number" step="0.01" min="0" value={l.amount || ""}
                        onChange={e => update({ longTermLoans: data.longTermLoans.map(x => x.id === l.id ? { ...x, amount: parseFloat(e.target.value)||0 } : x) })}
                        className="flex-1 px-2 py-2 border border-gray-200 rounded-r-lg text-sm" placeholder="0.00" />
                    </div>
                    <button onClick={() => update({ longTermLoans: data.longTermLoans.filter(x => x.id !== l.id) })}
                      className="p-2 text-gray-300 hover:text-red-400 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>
              <button onClick={() => update({ longTermLoans: [...data.longTermLoans, { id: uid(), description: "Loan", amount: 0 }] })}
                className="flex items-center gap-1 text-sm text-emerald-600 hover:text-emerald-700 font-medium">
                <Plus className="w-4 h-4" /> Add loan
              </button>
              {numInput("Other Long-Term Liabilities", data.otherLongTermLiabilities, v => update({ otherLongTermLiabilities: v }))}
              <div className="bg-red-50 rounded-lg p-3 flex justify-between text-sm">
                <span className="font-semibold text-gray-700">Total Liabilities</span>
                <span className="font-bold text-red-700 text-lg">${fmtUSD(totals.totalLiabilities)}</span>
              </div>
            </div>
          </div>
        )}

        {/* ── Step 6: Equity ─────────────────────────────────────────────── */}
        {step === 6 && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-5">
            <h2 className="font-bold text-gray-900 text-lg">Owner's Equity</h2>
            <div className="grid md:grid-cols-2 gap-4">
              {numInput("Contributed / Paid-In Capital", data.paidInCapital, v => update({ paidInCapital: v }), "Owner's initial investment in the business")}
              {numInput("Retained Earnings (Beginning of Period)", data.retainedEarningsBeginning, v => update({ retainedEarningsBeginning: v }))}
              {numInput("Owner's Drawings During Period", data.ownerDrawings, v => update({ ownerDrawings: v }), "Cash withdrawn by the owner")}
              {numInput("Other Equity Changes", data.otherEquityChanges, v => update({ otherEquityChanges: v }), "Additional capital contributions, etc.")}
            </div>
            <div>{textInput("Description for Other Equity Changes", data.otherEquityChangesDesc, v => update({ otherEquityChangesDesc: v }))}</div>

            <div className="bg-gray-50 rounded-lg p-4 space-y-1.5 text-sm">
              <div className="flex justify-between"><span>Retained Earnings (Beginning)</span><span>${fmtUSD(n(data.retainedEarningsBeginning))}</span></div>
              <div className="flex justify-between"><span>Add: Net {totals.netProfit >= 0 ? "Profit" : "Loss"}</span><span>${fmtUSD(totals.netProfit)}</span></div>
              {n(data.ownerDrawings) > 0 && <div className="flex justify-between text-red-600"><span>Less: Owner's Drawings</span><span>−${fmtUSD(n(data.ownerDrawings))}</span></div>}
              <div className="border-t border-gray-200 pt-1.5 flex justify-between font-semibold"><span>Retained Earnings (End)</span><span>${fmtUSD(totals.retainedEarningsEnd)}</span></div>
              <div className="flex justify-between"><span>Add: Paid-In Capital</span><span>${fmtUSD(n(data.paidInCapital))}</span></div>
              <div className="border-t border-gray-200 pt-1.5 flex justify-between font-bold text-emerald-700 text-base"><span>Total Equity</span><span>${fmtUSD(totals.totalEquity)}</span></div>
            </div>

            <div className="mt-4">
              {textInput("Notes to Financial Statements (optional)", data.notes, v => update({ notes: v }),
                "Enter any explanatory notes, accounting policies, or disclosures you want included in the financial statements…", true)}
            </div>
          </div>
        )}

        {/* ── Step 7: Review & Generate ────────────────────────────────── */}
        {step === 7 && (
          <div className="space-y-4">
            {/* Balance check */}
            {Math.abs(totals.balanceDiff) > 0.05 ? (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <div className="text-sm text-amber-800">
                  <strong>Balance sheet gap: ${fmtUSD(Math.abs(totals.balanceDiff))}</strong><br />
                  Total Assets (${fmtUSD(totals.totalAssets)}) and Total Liabilities + Equity (${fmtUSD(totals.totalLiabAndEquity)}) do not match.
                  An accountant can identify and correct the discrepancy before signing off.
                </div>
              </div>
            ) : (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                <div className="text-sm text-emerald-800">
                  <strong>Balance sheet balances</strong> — Assets = Liabilities + Equity = ${fmtUSD(totals.totalAssets)}
                </div>
              </div>
            )}

            {/* Two-column summary */}
            <div className="grid md:grid-cols-2 gap-4">
              {/* P&L */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                <h3 className="font-bold text-gray-800 mb-3 text-sm uppercase tracking-wide">Profit & Loss Summary</h3>
                {[
                  ["Net Revenue",     totals.netRevenue,     false],
                  ["Cost of Goods",   totals.cogs,           false],
                  ["Gross Profit",    totals.grossProfit,    true ],
                  ["Total Expenses",  totals.totalExpenses,  false],
                  [totals.netProfit >= 0 ? "Net Profit" : "Net Loss", totals.netProfit, true],
                ].map(([label, val, bold]) => (
                  <div key={label as string} className={`flex justify-between py-1.5 border-b border-gray-50 text-sm ${bold ? "font-bold border-t border-gray-200 mt-1 pt-2" : ""}`}>
                    <span className="text-gray-600">{label as string}</span>
                    <span className={bold ? (totals.netProfit >= 0 ? "text-emerald-700" : "text-red-600") : "text-gray-900"}>${fmtUSD(val as number)}</span>
                  </div>
                ))}
              </div>

              {/* Balance Sheet */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                <h3 className="font-bold text-gray-800 mb-3 text-sm uppercase tracking-wide">Balance Sheet Summary</h3>
                {[
                  ["Current Assets",   totals.totalCurrentAssets, false],
                  ["Fixed Assets (net)", totals.totalFixedNet,    false],
                  ["Total Assets",     totals.totalAssets,        true ],
                  ["Total Liabilities",totals.totalLiabilities,   false],
                  ["Total Equity",     totals.totalEquity,        false],
                  ["Liab. + Equity",   totals.totalLiabAndEquity, true ],
                ].map(([label, val, bold]) => (
                  <div key={label as string} className={`flex justify-between py-1.5 border-b border-gray-50 text-sm ${bold ? "font-bold border-t border-gray-200 mt-1 pt-2" : ""}`}>
                    <span className="text-gray-600">{label as string}</span>
                    <span className="text-gray-900">${fmtUSD(val as number)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Generate buttons */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
              <h3 className="font-bold text-gray-900 mb-2">Generate Financial Statements</h3>
              <p className="text-sm text-gray-500 mb-4">
                Opens a formatted financial statement document — Statement of Comprehensive Income,
                Statement of Financial Position, and accountant certification page — ready to share
                with your CPA for review and sign-off.
              </p>
              <div className="flex flex-wrap gap-3">
                <button onClick={handleGenerate} disabled={generating}
                  className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors text-sm">
                  <FileText className="w-5 h-5" />
                  Open Statement (Review / Save PDF)
                </button>
                <button onClick={handlePrint} disabled={generating}
                  className="flex items-center gap-2 px-6 py-3 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors text-sm">
                  <Printer className="w-5 h-5" />
                  Print Statement
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-3">
                Tip: In the statement window, use your browser's "Save as PDF" or "Print → Save as PDF"
                to create a file you can email to your accountant.
              </p>
            </div>
          </div>
        )}

        {/* ── Step navigation ───────────────────────────────────────────── */}
        <div className="flex justify-between mt-6">
          <button onClick={goPrev} disabled={step === 0}
            className="flex items-center gap-2 px-5 py-2.5 border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-30 text-gray-700 font-medium rounded-xl transition-colors text-sm">
            <ChevronLeft className="w-4 h-4" /> Previous
          </button>
          {step < STEPS.length - 1 ? (
            <button onClick={goNext}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl transition-colors text-sm">
              Next <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button onClick={() => save()}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl transition-colors text-sm">
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Save Draft
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
