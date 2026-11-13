"use client";
import { useState, type FormEvent } from "react";
import { Check, LockKeyhole } from "lucide-react";
import {
  api,
  post,
  patch,
  toPaise,
  money,
  today,
  previewSplit,
  setToken,
} from "@/lib/api";
import type {
  User,
  Room,
  Category,
  Member,
  Expense,
  Announcement,
} from "@/lib/types";
import { Field, FormError } from "./ui";

type Done = () => Promise<void>;
export function ExpenseForm({
  room,
  members,
  categories,
  user,
  done,
  personal = false,
  existing,
}: {
  room?: Room;
  members: Member[];
  categories: Category[];
  user: User;
  done: Done;
  personal?: boolean;
  existing?: Expense;
}) {
  const active = members.filter((m) => m.status === "active");
  const [description, setDescription] = useState(existing?.description || "");
  const [amount, setAmount] = useState(
    existing?.amount_paise ? (existing.amount_paise / 100).toFixed(2) : "",
  );
  const [date, setDate] = useState(
    existing?.expense_date || today(room?.timezone),
  );
  const [category, setCategory] = useState(existing?.category_id || "");
  const [payer, setPayer] = useState(user.id);
  const [participantSelection, setParticipants] = useState<string[] | null>(
    null,
  );
  const participants = participantSelection ?? active.map((m) => m.user_id);
  const [split, setSplit] = useState("equal");
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState(existing?.notes || "");
  const [key] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  let shares: { user_id: string; share_paise: number }[] = [],
    previewError = "";
  try {
    if (!personal && amount)
      shares = previewSplit(toPaise(amount), participants, split, inputs);
  } catch (e) {
    previewError = (e as Error).message;
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const paise = toPaise(amount);
      if (personal) {
        const body = {
          description,
          expense_date: date,
          category_id: category || null,
          amount_paise: paise,
          notes,
        };
        if (existing) await patch(`/personal/expenses/${existing.id}`, body);
        else await post("/personal/expenses", body);
      } else {
        if (!participants.length)
          throw new Error("Select at least one participant.");
        const preview = previewSplit(paise, participants, split, inputs);
        const body = {
          description,
          expense_date: date,
          category_id: category || null,
          total_paise: paise,
          paid_by: payer,
          participants,
          split_type: split,
          ...(split === "exact" ? { shares: preview } : {}),
          ...(split === "percentage"
            ? {
                percentages: participants.map((id) => ({
                  user_id: id,
                  basis_points: Math.round(Number(inputs[id] || 0) * 100),
                })),
              }
            : {}),
        };
        await post(`/rooms/${room!.id}/expenses`, body, key);
      }
      await done();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="form-stack">
      <FormError error={error} />
      {personal && (
        <div className="privacy-note">
          <LockKeyhole size={16} /> Only you can see this expense.
        </div>
      )}
      <Field label="Description">
        <input
          required
          maxLength={200}
          placeholder={
            personal ? "What did you spend on?" : "e.g. Weekly groceries"
          }
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </Field>
      <div className="form-row">
        <Field label="Amount (₹)">
          <input
            required
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </Field>
        <Field label="Date">
          <input
            required
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </Field>
      </div>
      <Field label="Category">
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">Uncategorized</option>
          {categories
            .filter((x) => x.is_active || x.id === category)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
        </select>
      </Field>
      {!personal && (
        <>
          <Field label="Paid by">
            <select value={payer} onChange={(e) => setPayer(e.target.value)}>
              {active.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.display_name}
                  {m.user_id === user.id ? " (you)" : ""}
                </option>
              ))}
            </select>
          </Field>
          <fieldset className="participant-fieldset">
            <legend>Split between</legend>
            <div className="participant-list">
              {active.map((m) => (
                <label
                  className={`participant ${participants.includes(m.user_id) ? "selected" : ""}`}
                  key={m.user_id}
                >
                  <input
                    type="checkbox"
                    checked={participants.includes(m.user_id)}
                    onChange={(e) =>
                      setParticipants(
                        e.target.checked
                          ? [...participants, m.user_id]
                          : participants.filter((x) => x !== m.user_id),
                      )
                    }
                  />
                  <span className="avatar tiny">{m.display_name?.[0]}</span>
                  {m.display_name}
                </label>
              ))}
            </div>
          </fieldset>
          <Field label="Split method">
            <select
              value={split}
              onChange={(e) => {
                setSplit(e.target.value);
                setInputs({});
              }}
            >
              <option value="equal">Split equally</option>
              <option value="exact">Exact amounts</option>
              <option value="percentage">Percentages</option>
            </select>
          </Field>
          {split !== "equal" && (
            <div className="split-inputs">
              {active
                .filter((m) => participants.includes(m.user_id))
                .map((m) => (
                  <Field
                    key={m.user_id}
                    label={`${m.display_name} (${split === "exact" ? "₹" : "%"})`}
                  >
                    <input
                      inputMode="decimal"
                      required
                      value={inputs[m.user_id] || ""}
                      onChange={(e) =>
                        setInputs({ ...inputs, [m.user_id]: e.target.value })
                      }
                    />
                  </Field>
                ))}
            </div>
          )}
          <div className="split-preview">
            <strong>Split preview</strong>
            {previewError ? (
              <p className="muted">{previewError}</p>
            ) : (
              shares.map((s) => (
                <div key={s.user_id}>
                  <span>
                    {members.find((m) => m.user_id === s.user_id)?.display_name}
                  </span>
                  <b>{money(s.share_paise)}</b>
                </div>
              ))
            )}
            {!amount && (
              <p className="muted">
                Enter an amount to see each person’s share.
              </p>
            )}
          </div>
        </>
      )}
      {personal && (
        <Field label="Notes (optional)">
          <textarea
            maxLength={2000}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </Field>
      )}
      <button
        className="button primary full"
        disabled={busy || (!personal && (!!previewError || !active.length || !participants.length))}
      >
        {busy
          ? "Saving…"
          : existing
            ? "Save changes"
            : personal
              ? "Save personal expense"
              : "Post shared expense"}
      </button>
    </form>
  );
}

export function SimpleForm({
  fields,
  submitLabel,
  action,
  done,
  note,
}: {
  fields: {
    key: string;
    label: string;
    type?: string;
    value?: string;
    required?: boolean;
    maxLength?: number;
  }[];
  submitLabel: string;
  action: (values: Record<string, string>) => Promise<unknown>;
  done: Done;
  note?: string;
}) {
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(fields.map((f) => [f.key, f.value || ""])),
  );
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <form
      className="form-stack"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
          await action(values);
          await done();
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <FormError error={error} />
      {note && <p className="muted">{note}</p>}
      {fields.map((f) => (
        <Field label={f.label} key={f.key}>
          {f.type === "textarea" ? (
            <textarea
              required={f.required !== false}
              maxLength={f.maxLength || 5000}
              value={values[f.key]}
              onChange={(e) =>
                setValues({ ...values, [f.key]: e.target.value })
              }
            />
          ) : (
            <input
              required={f.required !== false}
              type={f.type || "text"}
              maxLength={f.maxLength || 200}
              value={values[f.key]}
              onChange={(e) =>
                setValues({ ...values, [f.key]: e.target.value })
              }
            />
          )}
        </Field>
      ))}
      <button className="button primary" disabled={busy}>
        {busy ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}

export function PasswordForm({ done }: { done: (user: User) => void }) {
  return (
    <SimpleForm
      fields={[
        { key: "current", label: "Current password", type: "password" },
        {
          key: "next",
          label: "New password (at least 12 characters)",
          type: "password",
        },
        { key: "confirm", label: "Confirm new password", type: "password" },
      ]}
      submitLabel="Change password"
      action={async (v) => {
        if (v.next !== v.confirm)
          throw new Error("New passwords do not match.");
        const result = await post<{ access_token: string; user: User }>(
          "/auth/change-password",
          { current_password: v.current, new_password: v.next },
        );
        setToken(result.access_token);
        done(result.user);
      }}
      done={async () => {}}
    />
  );
}

export function SettlementForm({
  room,
  members,
  user,
  initial,
  done,
}: {
  room: Room;
  members: Member[];
  user: User;
  initial?: { from_user_id: string; to_user_id: string; amount_paise: number };
  done: Done;
}) {
  const [from, setFrom] = useState(initial?.from_user_id || user.id);
  const [selectedRecipient, setTo] = useState<string | null>(initial?.to_user_id || null);
  const to = selectedRecipient ?? members.find((m) => m.user_id !== user.id && m.status === "active")?.user_id ?? "";
  const [amount, setAmount] = useState(
    initial ? (initial.amount_paise / 100).toFixed(2) : "",
  );
  const [method, setMethod] = useState("upi"),
    [note, setNote] = useState("");
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [key] = useState(() => crypto.randomUUID());
  return (
    <form
      className="form-stack"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
          await post(
            `/rooms/${room.id}/settlements`,
            {
              from_user_id: from,
              to_user_id: to,
              amount_paise: toPaise(amount),
              payment_method: method,
              note,
            },
            key,
          );
          await done();
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <FormError error={error} />
      <p className="muted">
        Record a payment made outside this app. The recipient must confirm
        receipt before balances change.
      </p>
      <div className="form-row">
        {[
          ["From", from, setFrom],
          ["To", to, setTo],
        ].map(([label, value, setter]) => (
          <Field key={label as string} label={label as string}>
            <select
              value={value as string}
              onChange={(e) => (setter as (v: string) => void)(e.target.value)}
            >
              {members
                .filter((m) => m.status === "active")
                .map((m) => (
                  <option key={m.user_id} value={m.user_id}>
                    {m.display_name}
                  </option>
                ))}
            </select>
          </Field>
        ))}
      </div>
      <Field label="Amount (₹)">
        <input
          required
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </Field>
      <Field label="Payment method">
        <select value={method} onChange={(e) => setMethod(e.target.value)}>
          <option value="upi">UPI</option>
          <option value="cash">Cash</option>
          <option value="bank">Bank transfer</option>
          <option value="other">Other</option>
        </select>
      </Field>
      <Field label="Note (optional)">
        <input
          maxLength={500}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </Field>
      <button
        className="button primary"
        disabled={busy || !from || !to || from === to || ![from, to].includes(user.id)}
      >
        {busy ? "Recording…" : "Record payment"}
      </button>
    </form>
  );
}
