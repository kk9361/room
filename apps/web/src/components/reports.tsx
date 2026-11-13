"use client";
import { useState, useEffect } from "react";
import { Download, BarChart3, LockKeyhole } from "lucide-react";
import { api, money, today } from "@/lib/api";
import type { Room, Report, Category, Member } from "@/lib/types";
import { Empty, FormError, Spinner } from "./ui";
export function Reports({
  room,
  categories,
  members,
  notify,
}: {
  room?: Room;
  categories: Category[];
  members: Member[];
  notify: (message: string) => void;
}) {
  const [period, setPeriod] = useState(today(room?.timezone).slice(0, 7)),
    [scope, setScope] = useState("room"),
    [annual, setAnnual] = useState(false);
  const [report, setReport] = useState<Report | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let live = true;
    setLoading(true);
    setError("");
    const [year, month] = period.split("-");
    if (scope === "room" && !room) {
      setLoading(false);
      setReport(null);
      return;
    }
    const path =
      scope === "personal"
        ? "/personal/reports/monthly"
        : `/rooms/${room!.id}/reports/${annual ? "annual" : "monthly"}`;
    api<Report>(`${path}?year=${year}&month=${month}`)
      .then((data) => {
        if (live) setReport(data);
      })
      .catch((e) => {
        if (live) setError(e.message);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [room?.id, period, scope, annual, version]);
  async function download() {
    try {
      const [year, month] = period.split("-").map(Number);
      const from = annual ? `${year}-01-01` : `${period}-01`;
      const to = annual
        ? `${year}-12-31`
        : `${period}-${new Date(year, month, 0).getDate()}`;
      const blob = await api<Blob>(
        `/rooms/${room!.id}/reports/export?from=${from}&to=${to}`,
      );
      const url = URL.createObjectURL(blob),
        a = document.createElement("a");
      a.href = url;
      a.download = `roommate-${annual ? year : period}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      notify("CSV export downloaded.");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const max = Math.max(
    ...(report?.by_category.map((x) => x.amount_paise) || []),
    1,
  );
  return (
    <>
      <div className="toolbar">
        <div className="segmented">
          <button
            className={scope === "room" ? "active" : ""}
            onClick={() => setScope("room")}
          >
            Room report
          </button>
          <button
            className={scope === "personal" ? "active" : ""}
            onClick={() => {
              setScope("personal");
              setAnnual(false);
            }}
          >
            My personal report
          </button>
        </div>
        <div className="toolbar-right">
          <label className="sr-only" htmlFor="report-period">
            Report month
          </label>
          <input
            id="report-period"
            type="month"
            value={period}
            min="2000-01"
            max="2100-12"
            onChange={(e) => e.target.value && setPeriod(e.target.value)}
          />
          {scope === "room" && (
            <>
              <label className="inline-check">
                <input
                  type="checkbox"
                  checked={annual}
                  onChange={(e) => setAnnual(e.target.checked)}
                />{" "}
                Full year
              </label>
              <button
                className="button secondary"
                disabled={!room}
                onClick={download}
              >
                <Download size={16} />
                Export CSV
              </button>
            </>
          )}
        </div>
      </div>
      <FormError error={error} />
      {error && (
        <button
          className="button secondary"
          onClick={() => setVersion((x) => x + 1)}
        >
          Retry report
        </button>
      )}
      {loading ? (
        <Spinner />
      ) : !report ? (
        <Empty
          title="Choose a room to get started"
          detail="Your reports will appear once you create or join a room."
        />
      ) : (
        <>
          <div className="report-summary">
            <div>
              <span className="eyebrow">
                {scope === "personal"
                  ? "YOUR PRIVATE SPENDING"
                  : `${annual ? "ANNUAL" : "MONTHLY"} SHARED SPENDING`}
              </span>
              <h2>{money(report.total_paise)}</h2>
              <p>
                {report.count} expense{report.count === 1 ? "" : "s"} in this
                period
              </p>
            </div>
            {scope === "personal" ? (
              <LockKeyhole size={50} />
            ) : (
              <BarChart3 size={55} />
            )}
          </div>
          <div className="two-columns">
            <section className="panel">
              <div className="panel-head">
                <h3>Spending by category</h3>
              </div>
              {report.by_category.length ? (
                <div className="bar-list">
                  {report.by_category
                    .sort((a, b) => b.amount_paise - a.amount_paise)
                    .map((x) => (
                      <div key={x.category_id}>
                        <div className="bar-label">
                          <span>
                            {categories.find((c) => c.id === x.category_id)
                              ?.name ||
                              (x.category_id === "uncategorized"
                                ? "Uncategorized"
                                : "Personal category")}
                          </span>
                          <b>{money(x.amount_paise)}</b>
                        </div>
                        <div className="bar-track">
                          <i
                            style={{
                              width: `${(x.amount_paise / max) * 100}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <Empty
                  title="No expenses in this period"
                  detail="Try another month or add your first expense."
                />
              )}
            </section>
            <section className="panel">
              <div className="panel-head">
                <h3>
                  {scope === "personal"
                    ? "Spending over time"
                    : "Paid by members"}
                </h3>
              </div>
              <div className="stack-list">
                {scope === "personal"
                  ? report.by_month.map((x) => (
                      <div className="list-line" key={x.month}>
                        <span>{x.month}</span>
                        <b>{money(x.amount_paise)}</b>
                      </div>
                    ))
                  : report.by_payer.map((x) => (
                      <div className="list-line" key={x.user_id}>
                        <span>
                          {members.find((m) => m.user_id === x.user_id)
                            ?.display_name || "Former member"}
                        </span>
                        <b>{money(x.amount_paise)}</b>
                      </div>
                    ))}
              </div>
            </section>
          </div>
          {scope === "room" && !!report.member_totals?.length && (
            <section className="panel">
              <div className="panel-head">
                <h3>Member breakdown for this period</h3>
                <span className="muted">
                  Period activity; see Balances for all-time amounts.
                </span>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Member</th>
                      <th>Paid</th>
                      <th>Assigned share</th>
                      <th>Settlements paid</th>
                      <th>Settlements received</th>
                      <th>Net activity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.member_totals.map((x) => (
                      <tr key={x.user_id}>
                        <td>
                          {
                            members.find((m) => m.user_id === x.user_id)
                              ?.display_name
                          }
                        </td>
                        <td>{money(x.paid_paise)}</td>
                        <td>{money(x.share_paise)}</td>
                        <td>{money(x.settlements_paid_paise)}</td>
                        <td>{money(x.settlements_received_paise)}</td>
                        <td>{money(x.net_paise)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}
    </>
  );
}
