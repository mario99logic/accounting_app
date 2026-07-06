"use client";

import { useState } from "react";

type Task = {
  id: string;
  name: string;
  type: string;
  deadline: string;
  status: string;
};
type ClientResult = {
  client: { id: string; name: string; companyId: string; status: string };
  openTasks: Task[];
};
type ConfirmState = "idle" | "loading" | "done" | "error";

export default function Home() {
  const [hp, setHp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ClientResult | null>(null);
  const [confirmState, setConfirmState] = useState<ConfirmState>("idle");
  const [confirmError, setConfirmError] = useState("");

  async function lookup() {
    const value = hp.trim();
    if (!value) {
      setError("יש להזין ח.פ / ע.מ.");
      return;
    }
    setLoading(true);
    setError("");
    setResult(null);
    setConfirmState("idle");
    setConfirmError("");
    try {
      const res = await fetch(`/api/client?hp=${encodeURIComponent(value)}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? "אירעה שגיאה.");
      } else {
        setResult(data);
      }
    } catch {
      setError("אירעה שגיאה בחיבור לשרת.");
    } finally {
      setLoading(false);
    }
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "Enter") lookup();
  }

  async function confirmDocs() {
    if (!result) return;
    setConfirmState("loading");
    setConfirmError("");
    try {
      const res = await fetch("/api/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: result.client.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setConfirmError(data.message ?? "אירעה שגיאה בעדכון הסטטוס.");
        setConfirmState("error");
      } else {
        setResult((prev) =>
          prev ? { ...prev, client: { ...prev.client, status: data.status } } : prev
        );
        setConfirmState("done");
      }
    } catch {
      setConfirmError("אירעה שגיאה בחיבור לשרת.");
      setConfirmState("error");
    }
  }

  return (
    <main className="wrap">
      <header className="masthead">
        <div className="eyebrow">פורטל לקוחות</div>
        <h1>מעקב תיק ומשימות</h1>
        <p>הזינו את מספר ח.פ / ע.מ כדי לראות את סטטוס התיק והמשימות הפתוחות מולכם.</p>
      </header>

      <section className="lookup">
        <label htmlFor="hp">ח.פ / ע.מ</label>
        <div className="row">
          <input
            id="hp"
            type="text"
            value={hp}
            onChange={(e) => setHp(e.target.value)}
            onKeyDown={onKey}
            placeholder="לדוגמה: 512345678"
            inputMode="numeric"
          />
          <button onClick={lookup} disabled={loading}>
            {loading ? "בודק…" : "בדיקת סטטוס"}
          </button>
        </div>
      </section>

      {error && <div className="msg error">{error}</div>}

      {result && (
        <>
          <section className="client-card">
            <div className="name">{result.client.name}</div>
            <div className="hp">ח.פ / ע.מ: {result.client.companyId}</div>
            <span className="status-pill">{result.client.status}</span>

            <div className="confirm-area">
              {confirmState === "done" ? (
                <div className="confirm-success">✓ עודכן — התקבלו מסמכים</div>
              ) : (
                <button
                  className="btn-confirm"
                  onClick={confirmDocs}
                  disabled={confirmState === "loading"}
                >
                  {confirmState === "loading" ? "מעדכן…" : "אישרתי קבלת מסמכים"}
                </button>
              )}
              {confirmState === "error" && (
                <div className="msg error confirm-error">{confirmError}</div>
              )}
            </div>
          </section>

          <div className="section-label">משימות פתוחות</div>
          {result.openTasks.length === 0 ? (
            <div className="empty">אין משימות פתוחות — הכול מעודכן ✓</div>
          ) : (
            result.openTasks.map((t) => {
              const overdue = t.status === "באיחור";
              return (
                <div key={t.id} className={`task${overdue ? " overdue" : ""}`}>
                  <div>
                    <div className="t-main">{t.name}</div>
                    <div className="t-sub">
                      {[t.type, t.deadline && `דדליין: ${t.deadline}`]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                  </div>
                  <span className="t-status">{t.status || "—"}</span>
                </div>
              );
            })
          )}
        </>
      )}
    </main>
  );
}
