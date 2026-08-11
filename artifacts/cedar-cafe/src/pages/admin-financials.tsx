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
  businessName: "Cedar Cafe", registrationNumber: "", address: "Road Town, Tortola, BVI",
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

const FIN_INPUT: React.CSSProperties = {
  flex:1, padding:"8px 10px", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8,
  fontSize:13, background:"#0d1612", color:"#e8f5ed", outline:"none",
};
const FIN_PREFIX: React.CSSProperties = {
  padding:"8px 10px", background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)",
  borderRight:"none", borderRadius:"8px 0 0 8px", fontSize:12, color:"#5a8a6a",
};
const FIN_LABEL: React.CSSProperties = {
  display:"block", fontSize:12, fontWeight:600, color:"#5a8a6a", marginBottom:4,
};
const FIN_HINT: React.CSSProperties = { display:"block", fontSize:11, color:"#5a8a6a", marginBottom:4, opacity:0.7 };

function numInput(
  label: string, value: number,
  onChange: (v: number) => void,
  hint?: string,
  prefix = "$",
) {
  return (
    <label style={{ display:"block" }}>
      <span style={FIN_LABEL}>{label}</span>
      {hint && <span style={FIN_HINT}>{hint}</span>}
      <div style={{ display:"flex", alignItems:"center" }}>
        {prefix && <span style={FIN_PREFIX}>{prefix}</span>}
        <input
          type="number" step="0.01" min="0"
          value={value || ""}
          onChange={e => onChange(parseFloat(e.target.value) || 0)}
          style={{ ...FIN_INPUT, borderRadius: prefix ? "0 8px 8px 0" : 8 }}
          placeholder="0.00"
        />
      </div>
    </label>
  );
}

function textInput(label: string, value: string, onChange: (v: string) => void, placeholder?: string, textarea?: boolean) {
  return (
    <label style={{ display:"block" }}>
      <span style={FIN_LABEL}>{label}</span>
      {textarea
        ? <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
            style={{ ...FIN_INPUT, width:"100%", minHeight:80, borderRadius:8, resize:"vertical" }} />
        : <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
            style={{ ...FIN_INPUT, width:"100%", borderRadius:8 }} />
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
    fetch("/cedar-api/api/auth/me", { credentials: "include", cache: "no-store", headers: authHeaders() })
      .then(r => r.json()).then(d => { if (!d.authed || d.role !== "admin") navigate(adminRoutes.login); })
      .catch(() => navigate(adminRoutes.login));
  }, [navigate]);

  // Load draft list
  const loadDrafts = useCallback(async () => {
    setLoadingDrafts(true);
    try {
      const r = await fetch("/cedar-api/api/financials/drafts", { credentials: "include", headers: authHeaders() });
      if (r.ok) setDrafts(await r.json());
    } finally { setLoadingDrafts(false); }
  }, []);

  useEffect(() => { loadDrafts(); }, [loadDrafts]);

  // Load specific draft
  useEffect(() => {
    if (!draftId) return;
    fetch(`/cedar-api/api/financials/drafts/${draftId}`, { credentials: "include", headers: authHeaders() })
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
        await fetch(`/cedar-api/api/financials/drafts/${draftId}`, {
          method: "PUT", credentials: "include",
          headers: { ...authHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify({ period_start: periodStart, period_end: periodEnd, data: payload }),
        });
      } else {
        const r = await fetch("/cedar-api/api/financials/drafts", {
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
      const r = await fetch(`/cedar-api/api/reports/sales?from=${periodStart}&to=${periodEnd}`, {
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
    await fetch(`/cedar-api/api/financials/drafts/${id}`, { method: "DELETE", credentials: "include", headers: authHeaders() });
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
      <div style={{ minHeight:"100dvh", background:"#0d1612", color:"#e8f5ed" }}>
        <div style={{ background:"#09100d", borderBottom:"1px solid rgba(255,255,255,0.06)", position:"sticky", top:0, zIndex:10 }}>
          <div style={{ maxWidth:896, margin:"0 auto", padding:"10px 16px", display:"flex", alignItems:"center", gap:12 }}>
            <button onClick={() => navigate(adminRoutes.dashboard)}
              style={{ padding:8, borderRadius:8, background:"transparent", border:"none", cursor:"pointer", color:"#5a8a6a", display:"flex" }}>
              <ArrowLeft style={{ width:20, height:20 }} />
            </button>
            <h1 style={{ fontSize:17, fontWeight:700, color:"#e8f5ed", flex:1, margin:0 }}>Financial Statements</h1>
            <button onClick={newDraft}
              style={{ display:"flex", alignItems:"center", gap:6, padding:"8px 16px", background:"#10b981", color:"#fff", border:"none", borderRadius:8, fontSize:13, fontWeight:600, cursor:"pointer" }}>
              <FilePlus style={{ width:16, height:16 }} /> New Statement
            </button>
          </div>
        </div>

        <div style={{ maxWidth:896, margin:"0 auto", padding:"32px 16px" }}>
          <div style={{ background:"rgba(48,209,88,0.08)", border:"1px solid rgba(48,209,88,0.2)", borderRadius:12, padding:16, marginBottom:24, display:"flex", gap:12 }}>
            <FileText style={{ width:18, height:18, color:"#34d399", flexShrink:0, marginTop:2 }} />
            <div style={{ fontSize:13, color:"#8cc4a0", lineHeight:1.6 }}>
              <strong style={{ color:"#e8f5ed" }}>BVI-Compliant Financial Statements</strong> — This wizard generates a
              Statement of Comprehensive Income and Statement of Financial Position following
              IFRS standards, as required under the BVI Business Companies Act. Revenue is
              automatically pulled from your POS. You provide expenses, assets, and liabilities.
              A certified accountant reviews and signs the final document.
            </div>
          </div>

          {loadingDrafts ? (
            <div style={{ textAlign:"center", paddingTop:64, color:"#5a8a6a" }}>Loading…</div>
          ) : drafts.length === 0 ? (
            <div style={{ textAlign:"center", paddingTop:80, paddingBottom:80, color:"#5a8a6a" }}>
              <FileText style={{ width:48, height:48, margin:"0 auto 12px", opacity:0.3 }} />
              <p style={{ fontWeight:600, color:"#8cc4a0", marginBottom:6 }}>No financial statements yet</p>
              <p style={{ fontSize:13 }}>Click "New Statement" to start your first one</p>
            </div>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              <h2 style={{ fontWeight:600, color:"#5a8a6a", fontSize:11, textTransform:"uppercase", letterSpacing:"0.08em", margin:"0 0 8px" }}>Saved Drafts</h2>
              {drafts.map(d => (
                <div key={d.id} style={{ background:"#162518", border:"1px solid rgba(255,255,255,0.06)", borderRadius:14, padding:"16px 20px", display:"flex", alignItems:"center", gap:16 }}>
                  <FileText style={{ width:22, height:22, color:"#34d399", flexShrink:0 }} />
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:600, color:"#e8f5ed", fontSize:15 }}>{d.business_name || "Cedar Cafe"}</div>
                    <div style={{ fontSize:13, color:"#5a8a6a", marginTop:2 }}>{d.period_start} → {d.period_end}</div>
                    <div style={{ fontSize:11, color:"#5a8a6a", marginTop:2, opacity:0.7 }}>Last saved {new Date(d.updated_at).toLocaleString()}</div>
                  </div>
                  <button onClick={() => openDraft(d)}
                    style={{ padding:"8px 16px", background:"#10b981", color:"#fff", border:"none", borderRadius:8, fontSize:13, fontWeight:500, cursor:"pointer" }}>
                    Open
                  </button>
                  <button onClick={() => deleteDraft(d.id)}
                    style={{ padding:8, background:"transparent", border:"none", borderRadius:8, cursor:"pointer", color:"#5a8a6a", display:"flex" }}>
                    <Trash2 style={{ width:16, height:16 }} />
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
  const FC = {
    card: { background:"#162518", borderRadius:14, border:"1px solid rgba(255,255,255,0.06)", padding:24 } as React.CSSProperties,
    h2: { fontWeight:700, color:"#e8f5ed", fontSize:17, margin:"0 0 16px" } as React.CSSProperties,
    desc: { fontSize:13, color:"#5a8a6a", margin:"0 0 16px", marginTop:-8 } as React.CSSProperties,
    subLabel: { fontSize:13, fontWeight:500, color:"#8cc4a0", margin:"0 0 8px" } as React.CSSProperties,
    inlineInput: { flex:1, padding:"7px 10px", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, fontSize:13, background:"#0d1612", color:"#e8f5ed", outline:"none" } as React.CSSProperties,
    inlinePrefix: { padding:"7px 10px", background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)", borderRight:"none", borderRadius:"8px 0 0 8px", fontSize:11, color:"#5a8a6a" } as React.CSSProperties,
    inlinePrefixR: { padding:"7px 10px", border:"1px solid rgba(255,255,255,0.1)", borderLeft:"none", borderRadius:"0 8px 8px 0", fontSize:13, background:"#0d1612", color:"#e8f5ed", outline:"none", flex:1, minWidth:0 } as React.CSSProperties,
    delBtn: { padding:6, background:"transparent", border:"none", cursor:"pointer", color:"#5a8a6a", display:"flex", borderRadius:6 } as React.CSSProperties,
    addBtn: { display:"flex", alignItems:"center", gap:4, fontSize:13, fontWeight:500, color:"#10b981", background:"transparent", border:"none", cursor:"pointer", padding:"4px 0" } as React.CSSProperties,
    sumRow: { display:"flex", justifyContent:"space-between", padding:"6px 0", borderBottom:"1px solid rgba(255,255,255,0.04)", fontSize:13 } as React.CSSProperties,
    sumCard: { background:"rgba(255,255,255,0.04)", borderRadius:10, padding:14, marginTop:4 } as React.CSSProperties,
    gridRow: { display:"flex", gap:8, alignItems:"center", marginBottom:8 } as React.CSSProperties,
  };

  return (
    <div style={{ minHeight:"100dvh", background:"#0d1612", color:"#e8f5ed" }}>
      <style>{`
        input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(0.6); cursor: pointer; }
        .fin-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .fin-grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }
        @media (max-width: 640px) { .fin-grid-2, .fin-grid-3 { grid-template-columns: 1fr; } }
      `}</style>

      {/* ── Header ── */}
      <div style={{ background:"#09100d", borderBottom:"1px solid rgba(255,255,255,0.06)", position:"sticky", top:0, zIndex:10 }}>
        <div style={{ maxWidth:896, margin:"0 auto", padding:"10px 16px", display:"flex", alignItems:"center", gap:12 }}>
          <button onClick={() => { setInWizard(false); setDraftId(null); setStep(0); loadDrafts(); }}
            style={{ padding:8, borderRadius:8, background:"transparent", border:"none", cursor:"pointer", color:"#5a8a6a", display:"flex" }}>
            <ArrowLeft style={{ width:20, height:20 }} />
          </button>
          <div style={{ flex:1, minWidth:0 }}>
            <h1 style={{ fontSize:15, fontWeight:700, color:"#e8f5ed", margin:0 }}>Financial Statement Wizard</h1>
            <p style={{ fontSize:11, color:"#5a8a6a", margin:0 }}>{periodStart} → {periodEnd}{draftId ? ` · Draft #${draftId}` : " · Unsaved"}</p>
          </div>
          <button onClick={() => save()} disabled={saving}
            style={{ display:"flex", alignItems:"center", gap:6, padding:"7px 14px", fontSize:13, fontWeight:500, color:"#8cc4a0", background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:8, cursor:saving?"not-allowed":"pointer", opacity:saving?0.6:1 }}>
            {saving ? <RefreshCw style={{ width:14, height:14 }} className="animate-spin" /> : null}
            {saving ? "Saving…" : "Save"}
          </button>
        </div>

        {/* Progress steps */}
        <div style={{ maxWidth:896, margin:"0 auto", padding:"0 16px 10px", overflowX:"auto" }}>
          <div style={{ display:"flex", gap:4, minWidth:"max-content" }}>
            {STEPS.map((s, i) => (
              <button key={i} onClick={() => { save(); setStep(i); }}
                style={{ padding:"5px 12px", borderRadius:20, fontSize:11, fontWeight:600, whiteSpace:"nowrap", cursor:"pointer", border:"none",
                  background: i === step ? "#10b981" : i < step ? "rgba(16,185,129,0.2)" : "rgba(255,255,255,0.06)",
                  color: i === step ? "#fff" : i < step ? "#6ee7b7" : "#5a8a6a" }}>
                {i + 1}. {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth:896, margin:"0 auto", padding:"24px 16px" }}>

        {/* Stat cards */}
        {(() => {
          const netRev    = data.grossSales - data.refunds + data.otherIncome;
          const cogs      = data.beginningInventory + data.purchases - data.endingInventory;
          const grossPro  = netRev - cogs;
          const totalExp  = data.expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
          const netProfit = grossPro - totalExp;
          const cards = [
            { art:"💰", grad:"linear-gradient(145deg,#10b981,#059669,#064e3b)", glow:"rgba(16,185,129,0.5)",   label:"Gross Sales",   value:`$${data.grossSales.toFixed(2)}`, sub:"total revenue" },
            { art:"📊", grad:"linear-gradient(145deg,#10b981,#0d9e72,#065f46)", glow:"rgba(16,185,129,0.55)", label:"Net Revenue",   value:`$${netRev.toFixed(2)}`,          sub:"after refunds" },
            { art:"📉", grad:"linear-gradient(145deg,#f59e0b,#f59e0b,#f87171)", glow:"rgba(255,107,0,0.55)",   label:"Expenses",      value:`$${totalExp.toFixed(2)}`,        sub:"operating costs" },
            { art: netProfit >= 0 ? "📈" : "📉", grad: netProfit >= 0 ? "linear-gradient(145deg,#10b981,#059669,#064e3b)" : "linear-gradient(145deg,#ef4444,#dc2626,#7f1d1d)", glow: netProfit >= 0 ? "rgba(16,185,129,0.5)" : "rgba(239,68,68,0.45)", label: netProfit >= 0 ? "Net Profit" : "Net Loss", value:`$${Math.abs(netProfit).toFixed(2)}`, sub: netProfit >= 0 ? "period earnings" : "period loss" },
          ];
          return (
            <div style={{ display:"flex", gap:14, marginBottom:24, overflowX:"auto" }}>
              {cards.map((fc) => (
                <div key={fc.label} style={{ width:168, flexShrink:0 }}>
                  <div style={{ background:fc.grad, borderRadius:20, padding:"16px 16px 14px", position:"relative", overflow:"hidden", boxShadow:`0 6px 24px ${fc.glow}`, height:108, display:"flex", flexDirection:"column", justifyContent:"flex-end" }}>
                    <div style={{ position:"absolute", inset:0, background:"linear-gradient(155deg,rgba(255,255,255,0.14) 0%,transparent 50%)", pointerEvents:"none" }} />
                    <div style={{ position:"absolute", top:-6, right:0, fontSize:62, opacity:0.22, lineHeight:1, transform:"rotate(14deg)", pointerEvents:"none", userSelect:"none" }}>{fc.art}</div>
                    <div style={{ position:"relative", zIndex:1 }}>
                      <div style={{ fontSize:10, fontWeight:700, color:"rgba(255,255,255,0.6)", letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:3 }}>{fc.label}</div>
                      <div style={{ fontSize:26, fontWeight:900, color:"#fff", letterSpacing:"-0.05em", lineHeight:1, marginBottom:3 }}>{fc.value}</div>
                      <div style={{ fontSize:11, color:"rgba(255,255,255,0.65)", fontWeight:500 }}>{fc.sub}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          );
        })()}

        {/* ── Step 0: Business Info ── */}
        {step === 0 && (
          <div style={FC.card}>
            <h2 style={FC.h2}>Business Information &amp; Period</h2>
            <div className="fin-grid-2" style={{ marginBottom:16 }}>
              <div>
                <label style={FIN_LABEL}>Financial Period</label>
                <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                  <input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)} style={{ ...FIN_INPUT, flex:1 }} />
                  <span style={{ color:"#5a8a6a", fontSize:13 }}>to</span>
                  <input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} style={{ ...FIN_INPUT, flex:1 }} />
                </div>
              </div>
              <div>{textInput("Currency", data.currencyCode, v => update({ currencyCode: v }), "USD")}</div>
            </div>
            <div className="fin-grid-2" style={{ marginBottom:16 }}>
              <div>{textInput("Business Name", data.businessName, v => update({ businessName: v }))}</div>
              <div>{textInput("BVI Company Registration No.", data.registrationNumber, v => update({ registrationNumber: v }), "e.g. 1234567")}</div>
            </div>
            <div style={{ marginBottom:16 }}>{textInput("Registered Address", data.address, v => update({ address: v }))}</div>
            <div>{textInput("Director(s)", data.directors, v => update({ directors: v }), "Full name(s) of authorized signatories")}</div>
          </div>
        )}

        {/* ── Step 1: Revenue ── */}
        {step === 1 && (
          <div style={FC.card}>
            <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:16, marginBottom:16 }}>
              <div>
                <h2 style={{ ...FC.h2, margin:0 }}>Revenue</h2>
                <p style={{ fontSize:13, color:"#5a8a6a", margin:"4px 0 0" }}>Sales data can be pulled automatically from your POS for the selected period.</p>
              </div>
              <button onClick={fetchPOSData} disabled={fetchingPOS}
                style={{ display:"flex", alignItems:"center", gap:6, padding:"8px 14px", background:"#10b981", color:"#fff", border:"none", borderRadius:8, fontSize:13, fontWeight:500, cursor:fetchingPOS?"not-allowed":"pointer", opacity:fetchingPOS?0.6:1, flexShrink:0 }}>
                <RefreshCw style={{ width:14, height:14 }} className={fetchingPOS?"animate-spin":""} />
                {fetchingPOS ? "Loading…" : "Import from POS"}
              </button>
            </div>
            {data.posDataFetched && (
              <div style={{ background:"rgba(48,209,88,0.08)", border:"1px solid rgba(48,209,88,0.2)", borderRadius:8, padding:"8px 14px", fontSize:13, color:"#34d399", display:"flex", alignItems:"center", gap:8, marginBottom:16 }}>
                <CheckCircle2 style={{ width:14, height:14, flexShrink:0 }} /> POS data imported for {periodStart} → {periodEnd}. Adjust below if needed.
              </div>
            )}
            <div className="fin-grid-2" style={{ marginBottom:16 }}>
              {numInput("Gross Sales", data.grossSales, v => update({ grossSales: v }))}
              {numInput("Total Refunds / Returns", data.refunds, v => update({ refunds: v }))}
            </div>
            <div className="fin-grid-2" style={{ marginBottom:16 }}>
              {numInput("Other Income", data.otherIncome, v => update({ otherIncome: v }), "Interest, catering events, etc.")}
              <div>{textInput("Other Income Description", data.otherIncomeDesc, v => update({ otherIncomeDesc: v }), "e.g. Catering revenue")}</div>
            </div>
            <div style={{ ...FC.sumCard, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <span style={{ fontWeight:600, color:"#8cc4a0" }}>Net Revenue</span>
              <span style={{ fontSize:18, fontWeight:800, color:"#34d399" }}>${fmtUSD(totals.netRevenue)}</span>
            </div>
          </div>
        )}

        {/* ── Step 2: COGS ── */}
        {step === 2 && (
          <div style={FC.card}>
            <h2 style={FC.h2}>Cost of Goods Sold</h2>
            <p style={FC.desc}>Enter food, beverage, and supply costs for this period.</p>
            <div className="fin-grid-3" style={{ marginBottom:16 }}>
              {numInput("Beginning Inventory", data.beginningInventory, v => update({ beginningInventory: v }), "Value of stock at period start")}
              {numInput("Purchases During Period", data.purchases, v => update({ purchases: v }), "Total food & supply purchases")}
              {numInput("Ending Inventory", data.endingInventory, v => update({ endingInventory: v }), "Value of stock at period end")}
            </div>
            <div style={{ ...FC.sumCard, display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
              <span style={{ fontWeight:600, color:"#8cc4a0" }}>Total COGS</span>
              <span style={{ fontSize:16, fontWeight:700, color:"#e8f5ed" }}>${fmtUSD(totals.cogs)}</span>
            </div>
            <div style={{ ...FC.sumCard, display:"flex", justifyContent:"space-between", alignItems:"center", background: totals.grossProfit >= 0 ? "rgba(48,209,88,0.08)" : "rgba(255,69,58,0.08)" }}>
              <span style={{ fontWeight:600, color:"#8cc4a0" }}>Gross Profit</span>
              <span style={{ fontSize:18, fontWeight:800, color: totals.grossProfit >= 0 ? "#34d399" : "#ff453a" }}>${fmtUSD(totals.grossProfit)}</span>
            </div>
          </div>
        )}

        {/* ── Step 3: Expenses ── */}
        {step === 3 && (
          <div style={FC.card}>
            <h2 style={FC.h2}>Operating Expenses</h2>
            <p style={FC.desc}>Enter each expense category for the period. Add custom rows as needed.</p>
            <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:16 }}>
              {data.expenses.map((e) => (
                <div key={e.id} style={FC.gridRow}>
                  <input type="text" value={e.label}
                    onChange={ev => update({ expenses: data.expenses.map(x => x.id === e.id ? { ...x, label: ev.target.value } : x) })}
                    style={FC.inlineInput} />
                  <div style={{ display:"flex", alignItems:"center", width:148 }}>
                    <span style={FC.inlinePrefix}>$</span>
                    <input type="number" step="0.01" min="0" value={e.amount || ""}
                      onChange={ev => update({ expenses: data.expenses.map(x => x.id === e.id ? { ...x, amount: parseFloat(ev.target.value)||0 } : x) })}
                      style={FC.inlinePrefixR} placeholder="0.00" />
                  </div>
                  <button onClick={() => update({ expenses: data.expenses.filter(x => x.id !== e.id) })} style={FC.delBtn}>
                    <Trash2 style={{ width:15, height:15 }} />
                  </button>
                </div>
              ))}
            </div>
            <button onClick={() => update({ expenses: [...data.expenses, { id: uid(), label: "New Expense", amount: 0 }] })} style={FC.addBtn}>
              <Plus style={{ width:15, height:15 }} /> Add expense line
            </button>
            <div style={{ ...FC.sumCard, display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:16, marginBottom:8 }}>
              <span style={{ fontWeight:600, color:"#8cc4a0" }}>Total Expenses</span>
              <span style={{ fontSize:16, fontWeight:700, color:"#e8f5ed" }}>${fmtUSD(totals.totalExpenses)}</span>
            </div>
            <div style={{ ...FC.sumCard, display:"flex", justifyContent:"space-between", alignItems:"center", background: totals.netProfit >= 0 ? "rgba(48,209,88,0.08)" : "rgba(255,69,58,0.08)" }}>
              <span style={{ fontWeight:600, color:"#8cc4a0" }}>{totals.netProfit >= 0 ? "Net Profit" : "Net Loss"}</span>
              <span style={{ fontSize:18, fontWeight:800, color: totals.netProfit >= 0 ? "#34d399" : "#ff453a" }}>${fmtUSD(Math.abs(totals.netProfit))}</span>
            </div>
          </div>
        )}

        {/* ── Step 4: Assets ── */}
        {step === 4 && (
          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
            {/* Current Assets */}
            <div style={FC.card}>
              <h2 style={FC.h2}>Current Assets</h2>
              <div className="fin-grid-2" style={{ marginBottom:16 }}>
                {numInput("Cash on Hand", data.cashOnHand, v => update({ cashOnHand: v }))}
              </div>
              <div style={{ marginBottom:16 }}>
                <p style={FC.subLabel}>Bank Accounts</p>
                {data.bankAccounts.map(b => (
                  <div key={b.id} style={FC.gridRow}>
                    <input type="text" value={b.bank} placeholder="Bank name / account"
                      onChange={e => update({ bankAccounts: data.bankAccounts.map(x => x.id === b.id ? { ...x, bank: e.target.value } : x) })}
                      style={FC.inlineInput} />
                    <div style={{ display:"flex", alignItems:"center", width:148 }}>
                      <span style={FC.inlinePrefix}>$</span>
                      <input type="number" step="0.01" min="0" value={b.amount || ""}
                        onChange={e => update({ bankAccounts: data.bankAccounts.map(x => x.id === b.id ? { ...x, amount: parseFloat(e.target.value)||0 } : x) })}
                        style={FC.inlinePrefixR} placeholder="0.00" />
                    </div>
                    <button onClick={() => update({ bankAccounts: data.bankAccounts.filter(x => x.id !== b.id) })} style={FC.delBtn}>
                      <Trash2 style={{ width:15, height:15 }} />
                    </button>
                  </div>
                ))}
                <button onClick={() => update({ bankAccounts: [...data.bankAccounts, { id: uid(), bank: "", amount: 0 }] })} style={FC.addBtn}>
                  <Plus style={{ width:15, height:15 }} /> Add account
                </button>
              </div>
              <div className="fin-grid-3" style={{ marginBottom:16 }}>
                {numInput("Accounts Receivable", data.accountsReceivable, v => update({ accountsReceivable: v }))}
                {numInput("Prepaid Expenses", data.prepaidExpenses, v => update({ prepaidExpenses: v }))}
                {numInput("Other Current Assets", data.otherCurrentAssets, v => update({ otherCurrentAssets: v }))}
              </div>
              <div style={{ ...FC.sumCard, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <span style={{ fontWeight:600, color:"#8cc4a0", fontSize:13 }}>Total Current Assets</span>
                <span style={{ fontWeight:700, color:"#e8f5ed" }}>${fmtUSD(totals.totalCurrentAssets)}</span>
              </div>
            </div>

            {/* Fixed Assets */}
            <div style={FC.card}>
              <h2 style={FC.h2}>Fixed (Non-Current) Assets</h2>
              <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:16 }}>
                {data.fixedAssets.map(a => (
                  <div key={a.id} style={{ display:"grid", gridTemplateColumns:"1fr 130px 140px 36px", gap:8, alignItems:"center" }}>
                    <input type="text" value={a.description} placeholder="Asset description"
                      onChange={e => update({ fixedAssets: data.fixedAssets.map(x => x.id === a.id ? { ...x, description: e.target.value } : x) })}
                      style={{ ...FC.inlineInput, flex:"unset" }} />
                    <div style={{ display:"flex", alignItems:"center" }}>
                      <span style={{ ...FC.inlinePrefix, fontSize:10, padding:"7px 6px" }}>Cost $</span>
                      <input type="number" step="0.01" min="0" value={a.cost || ""}
                        onChange={e => update({ fixedAssets: data.fixedAssets.map(x => x.id === a.id ? { ...x, cost: parseFloat(e.target.value)||0 } : x) })}
                        style={{ ...FC.inlinePrefixR, padding:"7px 6px", fontSize:12 }} placeholder="0" />
                    </div>
                    <div style={{ display:"flex", alignItems:"center" }}>
                      <span style={{ ...FC.inlinePrefix, fontSize:10, padding:"7px 6px" }}>Dep $</span>
                      <input type="number" step="0.01" min="0" value={a.accDepreciation || ""}
                        onChange={e => update({ fixedAssets: data.fixedAssets.map(x => x.id === a.id ? { ...x, accDepreciation: parseFloat(e.target.value)||0 } : x) })}
                        style={{ ...FC.inlinePrefixR, padding:"7px 6px", fontSize:12 }} placeholder="0" />
                    </div>
                    <button onClick={() => update({ fixedAssets: data.fixedAssets.filter(x => x.id !== a.id) })} style={FC.delBtn}>
                      <Trash2 style={{ width:15, height:15 }} />
                    </button>
                  </div>
                ))}
              </div>
              <button onClick={() => update({ fixedAssets: [...data.fixedAssets, { id: uid(), description: "", cost: 0, accDepreciation: 0 }] })} style={FC.addBtn}>
                <Plus style={{ width:15, height:15 }} /> Add fixed asset
              </button>
              <div className="fin-grid-2" style={{ margin:"16px 0" }}>
                {numInput("Other Non-Current Assets", data.otherNonCurrentAssets, v => update({ otherNonCurrentAssets: v }))}
              </div>
              <div style={{ ...FC.sumCard, display:"flex", justifyContent:"space-between", alignItems:"center", background:"rgba(48,209,88,0.08)" }}>
                <span style={{ fontWeight:600, color:"#8cc4a0", fontSize:13 }}>Total Assets</span>
                <span style={{ fontSize:18, fontWeight:800, color:"#34d399" }}>${fmtUSD(totals.totalAssets)}</span>
              </div>
            </div>
          </div>
        )}

        {/* ── Step 5: Liabilities ── */}
        {step === 5 && (
          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
            <div style={FC.card}>
              <h2 style={FC.h2}>Current Liabilities</h2>
              <div className="fin-grid-2" style={{ marginBottom:16 }}>
                {numInput("Accounts Payable", data.accountsPayable, v => update({ accountsPayable: v }), "Amounts owed to suppliers")}
                {numInput("Accrued Expenses", data.accruedExpenses, v => update({ accruedExpenses: v }), "Wages, rent accrued but unpaid")}
                {numInput("Taxes Payable", data.taxesPayable, v => update({ taxesPayable: v }), "Payroll tax, BVI business tax")}
                {numInput("Current Portion of Long-Term Debt", data.currentPortionLoans, v => update({ currentPortionLoans: v }))}
                {numInput("Other Current Liabilities", data.otherCurrentLiabilities, v => update({ otherCurrentLiabilities: v }))}
              </div>
              <div style={{ ...FC.sumCard, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <span style={{ fontWeight:600, color:"#8cc4a0", fontSize:13 }}>Total Current Liabilities</span>
                <span style={{ fontWeight:700, color:"#e8f5ed" }}>${fmtUSD(totals.totalCurrentLiab)}</span>
              </div>
            </div>

            <div style={FC.card}>
              <h2 style={FC.h2}>Long-Term Liabilities</h2>
              <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:16 }}>
                {data.longTermLoans.map(l => (
                  <div key={l.id} style={FC.gridRow}>
                    <input type="text" value={l.description} placeholder="Loan description"
                      onChange={e => update({ longTermLoans: data.longTermLoans.map(x => x.id === l.id ? { ...x, description: e.target.value } : x) })}
                      style={FC.inlineInput} />
                    <div style={{ display:"flex", alignItems:"center", width:148 }}>
                      <span style={FC.inlinePrefix}>$</span>
                      <input type="number" step="0.01" min="0" value={l.amount || ""}
                        onChange={e => update({ longTermLoans: data.longTermLoans.map(x => x.id === l.id ? { ...x, amount: parseFloat(e.target.value)||0 } : x) })}
                        style={FC.inlinePrefixR} placeholder="0.00" />
                    </div>
                    <button onClick={() => update({ longTermLoans: data.longTermLoans.filter(x => x.id !== l.id) })} style={FC.delBtn}>
                      <Trash2 style={{ width:15, height:15 }} />
                    </button>
                  </div>
                ))}
              </div>
              <button onClick={() => update({ longTermLoans: [...data.longTermLoans, { id: uid(), description: "Loan", amount: 0 }] })} style={FC.addBtn}>
                <Plus style={{ width:15, height:15 }} /> Add loan
              </button>
              <div style={{ margin:"16px 0" }}>{numInput("Other Long-Term Liabilities", data.otherLongTermLiabilities, v => update({ otherLongTermLiabilities: v }))}</div>
              <div style={{ ...FC.sumCard, display:"flex", justifyContent:"space-between", alignItems:"center", background:"rgba(255,69,58,0.08)" }}>
                <span style={{ fontWeight:600, color:"#8cc4a0", fontSize:13 }}>Total Liabilities</span>
                <span style={{ fontSize:18, fontWeight:800, color:"#ff453a" }}>${fmtUSD(totals.totalLiabilities)}</span>
              </div>
            </div>
          </div>
        )}

        {/* ── Step 6: Equity ── */}
        {step === 6 && (
          <div style={FC.card}>
            <h2 style={FC.h2}>Owner's Equity</h2>
            <div className="fin-grid-2" style={{ marginBottom:16 }}>
              {numInput("Contributed / Paid-In Capital", data.paidInCapital, v => update({ paidInCapital: v }), "Owner's initial investment")}
              {numInput("Retained Earnings (Beginning of Period)", data.retainedEarningsBeginning, v => update({ retainedEarningsBeginning: v }))}
              {numInput("Owner's Drawings During Period", data.ownerDrawings, v => update({ ownerDrawings: v }), "Cash withdrawn by the owner")}
              {numInput("Other Equity Changes", data.otherEquityChanges, v => update({ otherEquityChanges: v }), "Additional capital contributions, etc.")}
            </div>
            <div style={{ marginBottom:16 }}>{textInput("Description for Other Equity Changes", data.otherEquityChangesDesc, v => update({ otherEquityChangesDesc: v }))}</div>

            <div style={{ ...FC.sumCard, marginBottom:16 }}>
              {[
                ["Retained Earnings (Beginning)",                     n(data.retainedEarningsBeginning), false, false],
                [`Add: Net ${totals.netProfit >= 0 ? "Profit":"Loss"}`, totals.netProfit,                  false, false],
                ...(n(data.ownerDrawings) > 0 ? [["Less: Owner's Drawings", -n(data.ownerDrawings), false, true] as [string,number,boolean,boolean]] : []),
                ["Retained Earnings (End)",                           totals.retainedEarningsEnd,          true,  false],
                ["Add: Paid-In Capital",                              n(data.paidInCapital),               false, false],
                ["Total Equity",                                      totals.totalEquity,                  true,  false],
              ].map(([label, val, bold, red]) => (
                <div key={label as string} style={{ ...FC.sumRow, fontWeight: bold ? 700 : 400, borderTop: bold ? "1px solid rgba(255,255,255,0.08)" : "none", marginTop: bold ? 6 : 0, paddingTop: bold ? 10 : 6 }}>
                  <span style={{ color: red ? "#ff453a" : "#8cc4a0" }}>{label as string}</span>
                  <span style={{ color: red ? "#ff453a" : bold ? "#34d399" : "#e8f5ed" }}>${fmtUSD(val as number)}</span>
                </div>
              ))}
            </div>

            {textInput("Notes to Financial Statements (optional)", data.notes, v => update({ notes: v }),
              "Explanatory notes, accounting policies, or disclosures…", true)}
          </div>
        )}

        {/* ── Step 7: Review & Generate ── */}
        {step === 7 && (
          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
            {Math.abs(totals.balanceDiff) > 0.05 ? (
              <div style={{ background:"rgba(251,191,36,0.08)", border:"1px solid rgba(251,191,36,0.25)", borderRadius:12, padding:16, display:"flex", gap:12 }}>
                <AlertTriangle style={{ width:18, height:18, color:"#fbbf24", flexShrink:0, marginTop:2 }} />
                <div style={{ fontSize:13, color:"#fcd34d", lineHeight:1.6 }}>
                  <strong>Balance sheet gap: ${fmtUSD(Math.abs(totals.balanceDiff))}</strong><br />
                  Total Assets (${fmtUSD(totals.totalAssets)}) and Total Liabilities + Equity (${fmtUSD(totals.totalLiabAndEquity)}) do not match.
                  An accountant can identify and correct the discrepancy before signing off.
                </div>
              </div>
            ) : (
              <div style={{ background:"rgba(48,209,88,0.08)", border:"1px solid rgba(48,209,88,0.2)", borderRadius:12, padding:16, display:"flex", gap:12 }}>
                <CheckCircle2 style={{ width:18, height:18, color:"#34d399", flexShrink:0, marginTop:2 }} />
                <div style={{ fontSize:13, color:"#34d399" }}>
                  <strong>Balance sheet balances</strong> — Assets = Liabilities + Equity = ${fmtUSD(totals.totalAssets)}
                </div>
              </div>
            )}

            <div className="fin-grid-2">
              <div style={FC.card}>
                <h3 style={{ fontWeight:700, color:"#5a8a6a", fontSize:11, textTransform:"uppercase", letterSpacing:"0.08em", margin:"0 0 12px" }}>Profit &amp; Loss Summary</h3>
                {[
                  ["Net Revenue",    totals.netRevenue,    false],
                  ["Cost of Goods",  totals.cogs,          false],
                  ["Gross Profit",   totals.grossProfit,   true ],
                  ["Total Expenses", totals.totalExpenses, false],
                  [totals.netProfit >= 0 ? "Net Profit" : "Net Loss", totals.netProfit, true],
                ].map(([label, val, bold]) => (
                  <div key={label as string} style={{ ...FC.sumRow, fontWeight: bold ? 700 : 400, borderTop: bold ? "1px solid rgba(255,255,255,0.08)" : "none", marginTop: bold ? 4 : 0 }}>
                    <span style={{ color:"#8cc4a0" }}>{label as string}</span>
                    <span style={{ color: bold ? (totals.netProfit >= 0 ? "#34d399" : "#ff453a") : "#e8f5ed" }}>${fmtUSD(val as number)}</span>
                  </div>
                ))}
              </div>

              <div style={FC.card}>
                <h3 style={{ fontWeight:700, color:"#5a8a6a", fontSize:11, textTransform:"uppercase", letterSpacing:"0.08em", margin:"0 0 12px" }}>Balance Sheet Summary</h3>
                {[
                  ["Current Assets",     totals.totalCurrentAssets, false],
                  ["Fixed Assets (net)", totals.totalFixedNet,       false],
                  ["Total Assets",       totals.totalAssets,         true ],
                  ["Total Liabilities",  totals.totalLiabilities,    false],
                  ["Total Equity",       totals.totalEquity,         false],
                  ["Liab. + Equity",     totals.totalLiabAndEquity,  true ],
                ].map(([label, val, bold]) => (
                  <div key={label as string} style={{ ...FC.sumRow, fontWeight: bold ? 700 : 400, borderTop: bold ? "1px solid rgba(255,255,255,0.08)" : "none", marginTop: bold ? 4 : 0 }}>
                    <span style={{ color:"#8cc4a0" }}>{label as string}</span>
                    <span style={{ color: bold ? "#e8f5ed" : "#8cc4a0" }}>${fmtUSD(val as number)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={FC.card}>
              <h3 style={{ fontWeight:700, color:"#e8f5ed", fontSize:15, margin:"0 0 8px" }}>Generate Financial Statements</h3>
              <p style={{ fontSize:13, color:"#5a8a6a", margin:"0 0 20px", lineHeight:1.6 }}>
                Opens a formatted financial statement document — Statement of Comprehensive Income,
                Statement of Financial Position, and accountant certification page — ready to share
                with your CPA for review and sign-off.
              </p>
              <div style={{ display:"flex", flexWrap:"wrap", gap:12 }}>
                <button onClick={handleGenerate} disabled={generating}
                  style={{ display:"flex", alignItems:"center", gap:8, padding:"12px 24px", background:"#34d399", color:"#0a1a10", border:"none", borderRadius:12, fontSize:14, fontWeight:700, cursor:generating?"not-allowed":"pointer", opacity:generating?0.5:1 }}>
                  <FileText style={{ width:18, height:18 }} />
                  Open Statement (Review / Save PDF)
                </button>
                <button onClick={handlePrint} disabled={generating}
                  style={{ display:"flex", alignItems:"center", gap:8, padding:"12px 24px", background:"rgba(255,255,255,0.08)", color:"#e8f5ed", border:"1px solid rgba(255,255,255,0.1)", borderRadius:12, fontSize:14, fontWeight:600, cursor:generating?"not-allowed":"pointer", opacity:generating?0.5:1 }}>
                  <Printer style={{ width:18, height:18 }} />
                  Print Statement
                </button>
              </div>
              <p style={{ fontSize:11, color:"#5a8a6a", marginTop:12 }}>
                Tip: In the statement window, use "Save as PDF" or "Print → Save as PDF" to email to your accountant.
              </p>
            </div>
          </div>
        )}

        {/* ── Navigation ── */}
        <div style={{ display:"flex", justifyContent:"space-between", marginTop:24 }}>
          <button onClick={goPrev} disabled={step === 0}
            style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 20px", border:"1px solid rgba(255,255,255,0.08)", background:"rgba(255,255,255,0.04)", color:"#8cc4a0", borderRadius:12, fontSize:13, fontWeight:500, cursor:step===0?"not-allowed":"pointer", opacity:step===0?0.3:1 }}>
            <ChevronLeft style={{ width:16, height:16 }} /> Previous
          </button>
          {step < STEPS.length - 1 ? (
            <button onClick={goNext}
              style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 20px", background:"#10b981", color:"#fff", border:"none", borderRadius:12, fontSize:13, fontWeight:600, cursor:"pointer" }}>
              Next <ChevronRight style={{ width:16, height:16 }} />
            </button>
          ) : (
            <button onClick={() => save()}
              style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 20px", background:"#10b981", color:"#fff", border:"none", borderRadius:12, fontSize:13, fontWeight:600, cursor:"pointer" }}>
              {saving ? <RefreshCw style={{ width:16, height:16 }} className="animate-spin" /> : <Download style={{ width:16, height:16 }} />}
              Save Draft
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
