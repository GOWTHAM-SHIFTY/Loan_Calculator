import React, { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "smart-loan-tracker-v1";

function createEmptyLoan() {
  return {
    name: "",
    totalAmount: "",
    tenureMonths: "",
    monthlyEmi: "",
    startMonth: "",
  };
}

function loadLoans() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

function saveLoans(loans) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(loans));
  } catch {
    // ignore
  }
}

function computeLoanStats(loan) {
  const total = Number(loan.totalAmount) || 0;
  const emi = Number(loan.monthlyEmi) || 0;
  const payments = Array.isArray(loan.payments) ? loan.payments : [];
  const paid = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const remaining = Math.max(total - paid, 0);

  const tenureMonths = Number(loan.tenureMonths) || 0;
  const alreadyPaidMonths = payments.length;
  let remainingMonthsByEmi = emi > 0 ? Math.ceil(remaining / emi) : 0;
  if (tenureMonths > 0) {
    const remainingByTenure = Math.max(tenureMonths - alreadyPaidMonths, 0);
    remainingMonthsByEmi = Math.min(
      remainingMonthsByEmi || remainingByTenure,
      remainingByTenure || remainingMonthsByEmi
    );
  }

  const isCompleted =
    remaining <= 0 || (tenureMonths > 0 && alreadyPaidMonths >= tenureMonths);

  return { total, emi, paid, remaining, remainingMonthsByEmi, isCompleted };
}

function formatCurrency(amount) {
  if (Number.isNaN(amount)) return "-";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatMonthLabel(value) {
  if (!value) return "-";
  const [year, month] = value.split("-").map(Number);
  if (!year || !month) return value;
  const date = new Date(year, month - 1, 1);
  return date.toLocaleDateString(undefined, {
    month: "short",
    year: "2-digit",
  });
}

function App() {
  const [loans, setLoans] = useState(() => loadLoans());
  const [selectedLoanId, setSelectedLoanId] = useState(null);
  const [loanForm, setLoanForm] = useState(createEmptyLoan);
  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    date: "",
    note: "",
  });

  useEffect(() => {
    saveLoans(loans);
  }, [loans]);

  useEffect(() => {
    const activeLoan = loans.find((l) => l.id === selectedLoanId);
    if (!activeLoan && loans.length > 0) {
      setSelectedLoanId(loans[0].id);
    }
  }, [loans, selectedLoanId]);

  const selectedLoan = loans.find((l) => l.id === selectedLoanId) || null;

  const dashboardStats = useMemo(() => {
    let totalBorrowed = 0;
    let totalPaid = 0;
    let totalRemaining = 0;
    let activeCount = 0;
    let completedCount = 0;

    loans.forEach((loan) => {
      const stats = computeLoanStats(loan);
      totalBorrowed += stats.total;
      totalPaid += stats.paid;
      totalRemaining += stats.remaining;
      if (stats.isCompleted) completedCount += 1;
      else activeCount += 1;
    });

    return {
      totalBorrowed,
      totalPaid,
      totalRemaining,
      activeCount,
      completedCount,
    };
  }, [loans]);

  function handleLoanFormChange(e) {
    const { name, value } = e.target;
    setLoanForm((prev) => ({ ...prev, [name]: value }));
  }

  function handleAddLoan(e) {
    e.preventDefault();
    if (!loanForm.name || !loanForm.totalAmount || !loanForm.monthlyEmi) return;

    const newLoan = {
      id: String(Date.now()),
      name: loanForm.name.trim(),
      totalAmount: Number(loanForm.totalAmount),
      tenureMonths: Number(loanForm.tenureMonths) || 0,
      monthlyEmi: Number(loanForm.monthlyEmi),
      startMonth: loanForm.startMonth || "",
      createdAt: new Date().toISOString(),
      payments: [],
    };

    setLoans((prev) => [newLoan, ...prev]);
    setLoanForm(createEmptyLoan());
    setSelectedLoanId(newLoan.id);
  }

  function handlePaymentFormChange(e) {
    const { name, value } = e.target;
    setPaymentForm((prev) => ({ ...prev, [name]: value }));
  }

  function handleAddPayment(e) {
    e.preventDefault();
    if (!selectedLoan) return;
    if (!paymentForm.amount || !paymentForm.date) return;

    const amount = Number(paymentForm.amount);
    if (!amount || amount <= 0) return;

    const payment = {
      id: String(Date.now()),
      amount,
      date: paymentForm.date,
      note: paymentForm.note.trim(),
      createdAt: new Date().toISOString(),
    };

    setLoans((prev) =>
      prev.map((loan) => {
        if (loan.id !== selectedLoan.id) return loan;
        const updated = {
          ...loan,
          payments: [payment, ...(loan.payments || [])],
        };
        const stats = computeLoanStats(updated);
        if (stats.isCompleted) {
          return { ...updated, completedAt: new Date().toISOString() };
        }
        return updated;
      })
    );

    setPaymentForm({ amount: "", date: "", note: "" });
  }

  function handleDeleteLoan(id) {
    if (!window.confirm("Delete this loan permanently?")) return;
    setLoans((prev) => prev.filter((l) => l.id !== id));
    if (selectedLoanId === id) {
      setSelectedLoanId(null);
    }
  }

  return (
    <div className="app-root">
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark">
            <span
              className="brand-emoji"
              role="img"
              aria-label="Financial growth"
            >
              📈
            </span>
          </span>
          <div>
            <h1>Smart Loan &amp; EMI Tracker</h1>
            <p className="subtitle">
              Track balances, EMIs, and progress in one clean dashboard.
            </p>
          </div>
        </div>
      </header>

      <main className="app-layout">
        <section className="panel stats-panel">
          <div className="panel-header">
            <h2>Overview</h2>
            <span className="pill pill-soft">Dashboard</span>
          </div>
          <div className="stats-grid">
            <div className="stat-card">
              <span className="stat-label">Total Borrowed</span>
              <span className="stat-value">
                {formatCurrency(dashboardStats.totalBorrowed)}
              </span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Total Paid</span>
              <span className="stat-value positive">
                {formatCurrency(dashboardStats.totalPaid)}
              </span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Outstanding</span>
              <span className="stat-value negative">
                {formatCurrency(dashboardStats.totalRemaining)}
              </span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Active / Completed</span>
              <span className="stat-value">
                {dashboardStats.activeCount} / {dashboardStats.completedCount}
              </span>
            </div>
          </div>
          <PortfolioCharts loans={loans} dashboardStats={dashboardStats} />
        </section>

        <section className="panel loans-panel">
          <div className="panel-header">
            <h2>Loans</h2>
            <span className="pill">
              {loans.length} {loans.length === 1 ? "loan" : "loans"}
            </span>
          </div>

          <form className="loan-form" onSubmit={handleAddLoan}>
            <div className="form-grid">
              <div className="field">
                <label>Loan name</label>
                <input
                  type="text"
                  name="name"
                  placeholder="e.g. Home Loan"
                  value={loanForm.name}
                  onChange={handleLoanFormChange}
                  required
                />
              </div>
              <div className="field">
                <label>Total loan amount</label>
                <input
                  type="number"
                  name="totalAmount"
                  placeholder="e.g. 1200000"
                  value={loanForm.totalAmount}
                  onChange={handleLoanFormChange}
                  min="0"
                  required
                />
              </div>
              <div className="field">
                <label>Tenure (months)</label>
                <input
                  type="number"
                  name="tenureMonths"
                  placeholder="e.g. 60"
                  value={loanForm.tenureMonths}
                  onChange={handleLoanFormChange}
                  min="0"
                />
              </div>
              <div className="field">
                <label>Monthly EMI</label>
                <input
                  type="number"
                  name="monthlyEmi"
                  placeholder="e.g. 25000"
                  value={loanForm.monthlyEmi}
                  onChange={handleLoanFormChange}
                  min="0"
                  required
                />
              </div>
              <div className="field">
                <label>Start month</label>
                <input
                  type="month"
                  name="startMonth"
                  value={loanForm.startMonth}
                  onChange={handleLoanFormChange}
                />
              </div>
            </div>
            <div className="form-actions">
              <button type="submit" className="btn-primary">
                Add loan
              </button>
            </div>
          </form>

          <div className="loan-list">
            {loans.length === 0 && (
              <div className="empty-state">
                <p>No loans yet. Add your first loan to start tracking EMIs.</p>
              </div>
            )}
            {loans.map((loan) => {
              const stats = computeLoanStats(loan);
              const isSelected = selectedLoanId === loan.id;
              return (
                <button
                  key={loan.id}
                  type="button"
                  className={`loan-row ${isSelected ? "selected" : ""} ${
                    stats.isCompleted ? "completed" : ""
                  }`}
                  onClick={() => setSelectedLoanId(loan.id)}
                >
                  <div className="loan-row-main">
                    <div className="loan-row-title">
                      <span className="loan-name">{loan.name}</span>
                      {stats.isCompleted && (
                        <span className="pill pill-success">Achieved</span>
                      )}
                    </div>
                    <div className="loan-row-meta">
                      <span>{formatCurrency(stats.remaining)} remaining</span>
                      {stats.remainingMonthsByEmi > 0 && (
                        <span>
                          ~{stats.remainingMonthsByEmi} month
                          {stats.remainingMonthsByEmi > 1 ? "s" : ""} left
                        </span>
                      )}
                      {loan.tenureMonths ? (
                        <span>{loan.tenureMonths} months tenure</span>
                      ) : null}
                    </div>
                  </div>
                  <div className="loan-row-progress">
                    <div className="progress-bar">
                      <div
                        className="progress-fill"
                        style={{
                          width: `${
                            stats.total === 0
                              ? 0
                              : Math.min((stats.paid / stats.total) * 100, 100)
                          }%`,
                        }}
                      />
                    </div>
                    <span className="loan-row-amounts">
                      {formatCurrency(stats.paid)} /{" "}
                      {formatCurrency(stats.total)} paid
                    </span>
                  </div>
                  <div className="loan-row-actions">
                    <button
                      type="button"
                      className="icon-btn delete"
                      onClick={(evt) => {
                        evt.stopPropagation();
                        handleDeleteLoan(loan.id);
                      }}
                    >
                      ✕
                    </button>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section className="panel detail-panel">
          <div className="panel-header">
            <h2>Details &amp; EMI history</h2>
          </div>

          {!selectedLoan && (
            <div className="empty-state">
              <p>Select a loan from the left to view details and add EMIs.</p>
            </div>
          )}

          {selectedLoan && (
            <>
              <LoanSummaryCard loan={selectedLoan} />

              <form className="payment-form" onSubmit={handleAddPayment}>
                <h3>Add EMI payment</h3>
                <div className="form-grid">
                  <div className="field">
                    <label>Amount</label>
                    <input
                      type="number"
                      name="amount"
                      placeholder={String(selectedLoan.monthlyEmi || "")}
                      value={paymentForm.amount}
                      onChange={handlePaymentFormChange}
                      min="0"
                      required
                    />
                  </div>
                  <div className="field">
                    <label>Payment month</label>
                    <input
                      type="month"
                      name="date"
                      value={paymentForm.date}
                      onChange={handlePaymentFormChange}
                      required
                    />
                  </div>
                  <div className="field full-width">
                    <label>Note (optional)</label>
                    <input
                      type="text"
                      name="note"
                      placeholder="e.g. Paid via net banking"
                      value={paymentForm.note}
                      onChange={handlePaymentFormChange}
                    />
                  </div>
                </div>
                <div className="form-actions">
                  <button type="submit" className="btn-secondary">
                    Add payment
                  </button>
                </div>
              </form>

              <PaymentHistory loan={selectedLoan} />
            </>
          )}
        </section>
      </main>
    </div>
  );
}

function LoanSummaryCard({ loan }) {
  const stats = computeLoanStats(loan);

  return (
    <div className="summary-card">
      <div className="summary-header">
        <div>
          <h3>{loan.name}</h3>
          {loan.startMonth && (
            <p className="muted">Started {formatMonthLabel(loan.startMonth)}</p>
          )}
        </div>
        {stats.isCompleted && (
          <span className="pill pill-success">Loan achieved</span>
        )}
      </div>
      <div className="summary-grid">
        <div className="summary-item">
          <span className="summary-label">Total loan</span>
          <span className="summary-value">{formatCurrency(stats.total)}</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">Total paid</span>
          <span className="summary-value positive">
            {formatCurrency(stats.paid)}
          </span>
        </div>
        <div className="summary-item">
          <span className="summary-label">Outstanding</span>
          <span className="summary-value negative">
            {formatCurrency(stats.remaining)}
          </span>
        </div>
        <div className="summary-item">
          <span className="summary-label">Monthly EMI</span>
          <span className="summary-value">{formatCurrency(stats.emi)}</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">Remaining duration</span>
          <span className="summary-value">
            {stats.remainingMonthsByEmi > 0
              ? `${stats.remainingMonthsByEmi} month${
                  stats.remainingMonthsByEmi > 1 ? "s" : ""
                }`
              : stats.isCompleted
              ? "Completed"
              : "—"}
          </span>
        </div>
      </div>
      <div className="summary-progress">
        <div className="progress-bar large">
          <div
            className="progress-fill"
            style={{
              width: `${
                stats.total === 0
                  ? 0
                  : Math.min((stats.paid / stats.total) * 100, 100)
              }%`,
            }}
          />
        </div>
        <p className="muted">
          {formatCurrency(stats.paid)} paid · {formatCurrency(stats.remaining)}{" "}
          remaining
        </p>
      </div>
    </div>
  );
}

function PaymentHistory({ loan }) {
  const payments = (loan.payments || [])
    .slice()
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  if (payments.length === 0) {
    return (
      <div className="empty-state small">
        <p>No payments recorded yet for this loan.</p>
      </div>
    );
  }

  return (
    <div className="history-card">
      <h3>Payment history</h3>
      <div className="history-list">
        {payments.map((p) => (
          <div key={p.id} className="history-row">
            <div className="history-main">
              <span className="history-amount">
                {formatCurrency(Number(p.amount) || 0)}
              </span>
              <span className="history-date">{formatMonthLabel(p.date)}</span>
            </div>
            {p.note && <p className="history-note">{p.note}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

function PortfolioCharts({ loans, dashboardStats }) {
  const totalBorrowed = dashboardStats.totalBorrowed || 0;
  const totalPaid = dashboardStats.totalPaid || 0;
  const totalRemaining = Math.max(totalBorrowed - totalPaid, 0);

  const emiSlices = useMemo(() => {
    const palette = [
      "#6366f1",
      "#22c55e",
      "#f97316",
      "#eab308",
      "#06b6d4",
      "#f472b6",
    ];
    const activeLoans = loans.filter((l) => Number(l.monthlyEmi) > 0);
    const totalEmi = activeLoans.reduce(
      (sum, l) => sum + (Number(l.monthlyEmi) || 0),
      0
    );
    if (!activeLoans.length || !totalEmi) return { slices: [], gradient: "" };

    let currentAngle = 0;
    const slices = activeLoans.map((loan, idx) => {
      const value = Number(loan.monthlyEmi) || 0;
      const ratio = value / totalEmi;
      const angle = ratio * 360;
      const start = currentAngle;
      const end = currentAngle + angle;
      currentAngle = end;
      return {
        id: loan.id,
        name: loan.name,
        value,
        ratio,
        color: palette[idx % palette.length],
        start,
        end,
      };
    });

    const gradient = slices
      .map((s) => `${s.color} ${s.start.toFixed(2)}deg ${s.end.toFixed(2)}deg`)
      .join(", ");

    return { slices, gradient: `conic-gradient(${gradient})` };
  }, [loans]);

  return (
    <div className="chart-card">
      <div className="chart-header">
        <h3>Portfolio charts</h3>
        <span className="muted">Overall progress &amp; EMI split</span>
      </div>

      <div className="chart-body chart-body--split">
        <div className="chart-progress-block">
          <p className="muted chart-label-heading">Overall loan progress</p>
          <div className="chart-progress-bar">
            <div
              className="chart-progress-paid"
              style={{
                width: `${
                  totalBorrowed === 0
                    ? 0
                    : Math.min((totalPaid / totalBorrowed) * 100, 100)
                }%`,
              }}
            />
          </div>
          <div className="chart-progress-summary">
            <span>{formatCurrency(totalPaid)} paid</span>
            <span>{formatCurrency(totalRemaining)} remaining</span>
          </div>
        </div>

        <div className="chart-pie-block">
          <p className="muted chart-label-heading">Monthly EMI share by loan</p>
          {emiSlices.slices.length === 0 ? (
            <div className="chart-empty small">
              <p className="muted">
                Add loans with monthly EMI to see the split.
              </p>
            </div>
          ) : (
            <div className="chart-pie-layout">
              <div
                className="chart-pie"
                style={{
                  backgroundImage: emiSlices.gradient,
                }}
              >
                <div className="chart-pie-hole" />
              </div>
              <div className="chart-legend">
                {emiSlices.slices.map((s) => (
                  <div key={s.id} className="chart-legend-row">
                    <span
                      className="chart-legend-color"
                      style={{ backgroundColor: s.color }}
                    />
                    <div className="chart-legend-text">
                      <span className="chart-legend-name">{s.name}</span>
                      <span className="chart-legend-meta">
                        {formatCurrency(s.value)} · {(s.ratio * 100).toFixed(0)}
                        %
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
