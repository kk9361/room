import { useState } from "react";
import { Text, View, Modal, Alert, Share } from "react-native";
import * as Crypto from "expo-crypto";
import { useSession } from "../../src/session";
import { useResource } from "../../src/hooks";
import {
  post,
  money,
  toPaise,
  type Member,
  type Balance,
  type Transfer,
  type Settlement,
  type Page,
} from "../../src/api";
import {
  Screen,
  Card,
  Button,
  Input,
  Select,
  ErrorMessage,
  Empty,
  Badge,
  colors,
  styles,
} from "../../src/ui";
import { RoomSwitch } from "../../src/room-switch";
export default function Settle() {
  const { user, room } = useSession();
  const [page, setPage] = useState(1),
    [open, setOpen] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [from, setFrom] = useState(user?.id || ""),
    [to, setTo] = useState(""),
    [amount, setAmount] = useState(""),
    [method, setMethod] = useState("upi"),
    [key, setKey] = useState(() => Crypto.randomUUID());
  const root = room ? `/rooms/${room.id}` : "";
  const members = useResource<{ items: Member[] }>(
    root ? root + "/members" : null,
  );
  const balances = useResource<{ items: Balance[] }>(
    root ? root + "/balances" : null,
  );
  const suggestions = useResource<{ items: Transfer[] }>(
    root ? root + "/settlements/suggestions" : null,
  );
  const settlements = useResource<Page<Settlement>>(
    root ? root + `/settlements?page=${page}` : null,
  );
  const person = (id: string) =>
    members.data?.items.find((m) => m.user_id === id)?.display_name ||
    "Former member";
  const refresh = () => {
    balances.refresh();
    suggestions.refresh();
    settlements.refresh();
  };
  function start(s?: Transfer) {
    setFrom(s?.from_user_id || user!.id);
    setTo(
      s?.to_user_id ||
        members.data?.items.find(
          (m) => m.user_id !== user!.id && m.status === "active",
        )?.user_id ||
        "",
    );
    setAmount(s ? (s.amount_paise / 100).toFixed(2) : "");
    setKey(Crypto.randomUUID());
    setError("");
    setOpen(true);
  }
  function transition(s: Settlement, action: string) {
    Alert.alert(
      action === "confirm"
        ? "Confirm you received this payment?"
        : `${action} this payment?`,
      `${money(s.amount_paise)} · ${person(s.from_user_id)} → ${person(s.to_user_id)}`,
      [
        { text: "Go back", style: "cancel" },
        {
          text: "Confirm",
          onPress: async () => {
            try {
              await post(root + `/settlements/${s.id}/${action}`, {});
              refresh();
            } catch (e) {
              setError((e as Error).message);
            }
          },
        },
      ],
    );
  }
  const options =
    members.data?.items
      .filter((m) => m.status === "active")
      .map((m) => ({ label: m.display_name || m.user_id, value: m.user_id })) ||
    [];
  return (
    <Screen
      title="Balances & settle up"
      subtitle="Only confirmed payments change your balance."
      loading={balances.loading}
      refresh={refresh}
    >
      <RoomSwitch />
      <ErrorMessage
        error={
          error ||
          balances.error ||
          settlements.error ||
          suggestions.error ||
          members.error
        }
      />
      {room && (
        <Button
          title="Record a payment"
          disabled={room.status !== "active"}
          onPress={() => start()}
        />
      )}
      <Card>
        <Text style={styles.heading}>Room balances</Text>
        {balances.data?.items.map((b) => (
          <View key={b.user_id} style={styles.line}>
            <View style={styles.row}>
              <Text style={styles.text}>{person(b.user_id)}</Text>
              <Text
                style={[
                  styles.text,
                  { color: b.net_paise < 0 ? colors.warning : colors.success },
                ]}
              >
                {b.net_paise < 0
                  ? "Owes "
                  : b.net_paise > 0
                    ? "Gets back "
                    : "Settled "}
                {money(Math.abs(b.net_paise))}
              </Text>
            </View>
          </View>
        ))}
      </Card>
      <Card>
        <Text style={styles.heading}>Suggested transfers</Text>
        {suggestions.data?.items.length ? (
          suggestions.data.items.map((s, i) => (
            <View key={i} style={styles.line}>
              <Text style={styles.text}>
                {person(s.from_user_id)} → {person(s.to_user_id)}
              </Text>
              <Text style={styles.heading}>{money(s.amount_paise)}</Text>
              {[s.from_user_id, s.to_user_id].includes(user!.id) && (
                <Button
                  secondary
                  title="Record this payment"
                  disabled={room?.status !== "active"}
                  onPress={() => start(s)}
                />
              )}
            </View>
          ))
        ) : (
          <Empty message="Everyone’s square. No transfers needed." />
        )}
      </Card>
      <Card>
        <Text style={styles.heading}>Payment history</Text>
        {settlements.data?.items.length ? (
          settlements.data.items.map((s) => (
            <View key={s.id} style={styles.line}>
              <Text style={styles.text}>
                {person(s.from_user_id)} → {person(s.to_user_id)}
              </Text>
              <View style={styles.row}>
                <Text style={styles.heading}>{money(s.amount_paise)}</Text>
                <Badge
                  label={s.status}
                  tone={s.status === "confirmed" ? "success" : s.status === "pending" ? "warning" : "neutral"}
                />
              </View>
              <Text style={styles.subtitle}>
                {s.payment_method.toUpperCase()} · {s.note}
              </Text>
              {s.status === "pending" && room?.status === "active" && (
                <>
                  {s.to_user_id === user?.id && (
                    <>
                      <Button
                        title="Confirm receipt"
                        onPress={() => transition(s, "confirm")}
                      />
                      <Button
                        secondary
                        title="Reject payment"
                        onPress={() => transition(s, "reject")}
                      />
                    </>
                  )}
                  {s.from_user_id === user?.id && (
                    <Button
                      secondary
                      title="Cancel payment"
                      onPress={() => transition(s, "cancel")}
                    />
                  )}
                </>
              )}
            </View>
          ))
        ) : (
          <Empty message="No payments recorded yet." />
        )}
      </Card>
      <View style={styles.row}>
        <Button
          secondary
          title="Previous"
          disabled={page === 1}
          onPress={() => setPage((p) => p - 1)}
        />
        <Text>Page {page}</Text>
        <Button
          secondary
          title="Next"
          disabled={page * 20 >= (settlements.data?.total || 0)}
          onPress={() => setPage((p) => p + 1)}
        />
      </View>
      <Modal
        visible={open}
        onRequestClose={() => {
          if (!busy) setOpen(false);
        }}
        animationType="slide"
      >
        <Screen
          title="Record payment"
          subtitle="Send the money outside the app, then record it here."
        >
          <ErrorMessage error={error} />
          <Select
            label="From"
            value={from}
            onChange={setFrom}
            options={options}
          />
          <Select label="To" value={to} onChange={setTo} options={options} />
          <Input
            label="Amount (₹)"
            keyboardType="decimal-pad"
            value={amount}
            onChangeText={setAmount}
          />
          <Select
            label="Payment method"
            value={method}
            onChange={setMethod}
            options={["upi", "cash", "bank", "other"].map((v) => ({
              value: v,
              label: v.toUpperCase(),
            }))}
          />
          <Button
            title={busy ? "Recording…" : "Record payment"}
            disabled={busy || from === to || ![from, to].includes(user!.id)}
            onPress={async () => {
              setBusy(true);
              setError("");
              try {
                await post(
                  root + "/settlements",
                  {
                    from_user_id: from,
                    to_user_id: to,
                    amount_paise: toPaise(amount),
                    payment_method: method,
                  },
                  key,
                );
                setOpen(false);
                refresh();
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          />
          <Button
            secondary
            title="Cancel"
            disabled={busy}
            onPress={() => setOpen(false)}
          />
        </Screen>
      </Modal>
    </Screen>
  );
}
