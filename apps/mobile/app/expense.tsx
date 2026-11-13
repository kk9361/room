import { useState, useEffect } from "react";
import { View, Text, Pressable } from "react-native";
import { useRouter, useLocalSearchParams, Redirect } from "expo-router";
import * as Crypto from "expo-crypto";
import { useSession } from "../src/session";
import { useResource } from "../src/hooks";
import {
  post,
  patch,
  toPaise,
  previewSplit,
  money,
  today,
  type Member,
  type Category,
  type Page,
  type Expense,
} from "../src/api";
import {
  Screen,
  Card,
  Input,
  Select,
  Button,
  ErrorMessage,
  styles,
} from "../src/ui";
export default function ExpenseEditor() {
  const { user, room } = useSession(),
    router = useRouter();
  const params = useLocalSearchParams<{
      personal?: string;
      edit?: string;
      reverse?: string;
    }>(),
    personal = params.personal === "1";
  const members = useResource<{ items: Member[] }>(
    room ? `/rooms/${room.id}/members` : null,
  );
  const categories = useResource<Page<Category>>(
    personal
      ? "/personal/categories"
      : room
        ? `/rooms/${room.id}/categories`
        : null,
  );
  const existing = useResource<Expense>(
    params.edit ? `/personal/expenses/${params.edit}` : null,
  );
  const [description, setDescription] = useState(""),
    [amount, setAmount] = useState(""),
    [date, setDate] = useState(today(room?.timezone)),
    [category, setCategory] = useState(""),
    [notes, setNotes] = useState("");
  const [payer, setPayer] = useState(user?.id || ""),
    [participants, setParticipants] = useState<string[] | null>(null),
    [split, setSplit] = useState("equal"),
    [values, setValues] = useState<Record<string, string>>({});
  const [reason, setReason] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [key] = useState(() => Crypto.randomUUID());
  const active = members.data?.items.filter((m) => m.status === "active") || [],
    selected = participants || active.map((m) => m.user_id);
  useEffect(() => {
    if (existing.data) {
      setDescription(existing.data.description);
      setAmount((existing.data.amount_paise! / 100).toFixed(2));
      setDate(existing.data.expense_date);
      setCategory(existing.data.category_id || "");
      setNotes(existing.data.notes || "");
    }
  }, [existing.data?.id]);
  const desc = description,
    amt = amount;
  let shares: { user_id: string; share_paise: number }[] = [],
    previewError = "";
  try {
    if (amt && !personal)
      shares = previewSplit(toPaise(amt), selected, split, values);
  } catch (e) {
    previewError = (e as Error).message;
  }
  if (!user) return <Redirect href="/" />;
  async function submit() {
    setError("");
    setBusy(true);
    try {
      if (params.reverse)
        await post(`/rooms/${room!.id}/expenses/${params.reverse}/reverse`, {
          reason,
        });
      else if (personal) {
        const data = {
          description: desc,
          expense_date: date,
          amount_paise: toPaise(amt),
          category_id: category || null,
          notes,
        };
        if (params.edit) await patch(`/personal/expenses/${params.edit}`, data);
        else await post("/personal/expenses", data);
      } else {
        const total = toPaise(amount),
          preview = previewSplit(total, selected, split, values);
        await post(
          `/rooms/${room!.id}/expenses`,
          {
            description,
            expense_date: date,
            category_id: category || null,
            paid_by: payer,
            total_paise: total,
            participants: selected,
            split_type: split,
            ...(split === "exact" ? { shares: preview } : {}),
            ...(split === "percentage"
              ? {
                  percentages: selected.map((id) => ({
                    user_id: id,
                    basis_points: Math.round(Number(values[id] || 0) * 100),
                  })),
                }
              : {}),
          },
          key,
        );
      }
      router.back();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen
      title={
        params.reverse
          ? "Reverse shared expense"
          : params.edit
            ? "Edit personal expense"
            : personal
              ? "Add personal expense"
              : "Add shared expense"
      }
      subtitle={
        personal
          ? "Private. Only you can see this."
          : "Split fairly, down to the last paisa."
      }
    >
      <ErrorMessage
        error={error || members.error || categories.error || existing.error}
      />
      {personal && <Input label="Notes (optional)" value={notes} onChangeText={setNotes} multiline maxLength={2000} />}
      {params.reverse ? (
        <Card>
          <Text style={styles.subtitle}>
            This keeps the original in history and excludes it from balances. A
            reason is required.
          </Text>
          <Input
            label="Reversal reason"
            value={reason}
            onChangeText={setReason}
          />
        </Card>
      ) : (
        <>
          <Input
            label="Description"
            value={desc}
            onChangeText={setDescription}
          />
          <Input
            label="Amount (₹)"
            value={amt}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
          />
          <Input
            label="Date (YYYY-MM-DD)"
            value={date}
            onChangeText={setDate}
          />
          <Select
            label="Category"
            value={category}
            onChange={setCategory}
            options={[
              { label: "Uncategorized", value: "" },
              ...(categories.data?.items
                .filter((c) => c.is_active)
                .map((c) => ({ label: c.name, value: c.id })) || []),
            ]}
          />
          {!personal && (
            <>
              <Select
                label="Paid by"
                value={payer}
                onChange={setPayer}
                options={active.map((m) => ({
                  label: m.display_name || m.user_id,
                  value: m.user_id,
                }))}
              />
              <Text style={styles.label}>Split between</Text>
              <View style={styles.chips}>
                {active.map((m) => (
                  <Pressable
                    key={m.user_id}
                    accessibilityRole="checkbox"
                    accessibilityState={{
                      checked: selected.includes(m.user_id),
                    }}
                    style={[
                      styles.chip,
                      selected.includes(m.user_id) && styles.selected,
                    ]}
                    onPress={() =>
                      setParticipants(
                        selected.includes(m.user_id)
                          ? selected.filter((x) => x !== m.user_id)
                          : [...selected, m.user_id],
                      )
                    }
                  >
                    <Text style={styles.text}>
                      {selected.includes(m.user_id) ? "✓ " : ""}
                      {m.display_name}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Select
                label="Split method"
                value={split}
                onChange={(v) => {
                  setSplit(v);
                  setValues({});
                }}
                options={[
                  { label: "Equal", value: "equal" },
                  { label: "Exact amounts", value: "exact" },
                  { label: "Percentages", value: "percentage" },
                ]}
              />
              {split !== "equal" &&
                active
                  .filter((m) => selected.includes(m.user_id))
                  .map((m) => (
                    <Input
                      key={m.user_id}
                      label={`${m.display_name} (${split === "exact" ? "₹" : "%"})`}
                      value={values[m.user_id] || ""}
                      onChangeText={(v) =>
                        setValues({ ...values, [m.user_id]: v })
                      }
                      keyboardType="decimal-pad"
                    />
                  ))}
              <Card>
                <Text style={styles.heading}>Split preview</Text>
                {previewError ? (
                  <Text style={styles.subtitle}>{previewError}</Text>
                ) : (
                  shares.map((s) => (
                    <View key={s.user_id} style={styles.row}>
                      <Text style={styles.text}>
                        {
                          active.find((m) => m.user_id === s.user_id)
                            ?.display_name
                        }
                      </Text>
                      <Text style={styles.text}>{money(s.share_paise)}</Text>
                    </View>
                  ))
                )}
              </Card>
            </>
          )}
        </>
      )}
      <Button
        title={
          busy
            ? "Saving…"
            : params.reverse
              ? "Confirm reversal"
              : "Save expense"
        }
        disabled={busy || !!previewError || (!personal && !room) || (!personal && !params.reverse && !selected.length)}
        onPress={submit}
      />
      <Button
        secondary
        title="Cancel"
        disabled={busy}
        onPress={() => router.back()}
      />
    </Screen>
  );
}
