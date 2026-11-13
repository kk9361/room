import { useState } from "react";
import { Text, View, Share } from "react-native";
import { useSession } from "../../src/session";
import { useResource } from "../../src/hooks";
import {
  api,
  money,
  today,
  type Report,
  type Category,
  type Page,
} from "../../src/api";
import {
  Screen,
  Card,
  Input,
  Select,
  Button,
  ErrorMessage,
  Empty,
  styles,
} from "../../src/ui";
import { RoomSwitch } from "../../src/room-switch";
export default function Reports() {
  const { room } = useSession(),
    [scope, setScope] = useState("room"),
    [period, setPeriod] = useState(today(room?.timezone).slice(0, 7)),
    [annual, setAnnual] = useState("monthly"),
    [error, setError] = useState("");
  const valid = /^20\d{2}-(0[1-9]|1[0-2])$/.test(period),
    [year, month] = period.split("-");
  const path =
    scope === "personal"
      ? "/personal/reports/monthly"
      : room
        ? `/rooms/${room.id}/reports/${annual}`
        : null;
  const result = useResource<Report>(
    valid && path ? `${path}?year=${year}&month=${month}` : null,
  );
  const categories = useResource<Page<Category>>(
    scope === "personal"
      ? "/personal/categories"
      : room
        ? `/rooms/${room.id}/categories`
        : null,
  );
  return (
    <Screen
      title="Reports"
      subtitle="See where your money goes."
      loading={result.loading}
      refresh={result.refresh}
    >
      <RoomSwitch />
      <Select
        label="Report scope"
        value={scope}
        onChange={(v) => {
          setScope(v);
          setAnnual("monthly");
        }}
        options={[
          { value: "room", label: "Shared room expenses" },
          { value: "personal", label: "My private personal expenses" },
        ]}
      />
      <Input label="Period (YYYY-MM)" value={period} onChangeText={setPeriod} />
      {scope === "room" && (
        <Select
          label="Report type"
          value={annual}
          onChange={setAnnual}
          options={[
            { label: "Monthly", value: "monthly" },
            { label: "Annual", value: "annual" },
          ]}
        />
      )}
      <ErrorMessage
        error={
          error ||
          result.error ||
          categories.error ||
          (!valid ? "Use YYYY-MM, for example 2026-11." : "")
        }
      />
      {result.data && (
        <>
          <Card>
            <Text style={styles.subtitle}>
              {scope === "personal"
                ? "YOUR PRIVATE SPENDING"
                : "SHARED SPENDING"}
            </Text>
            <Text style={styles.amount}>{money(result.data.total_paise)}</Text>
            <Text style={styles.subtitle}>
              {result.data.count} expenses in this period
            </Text>
          </Card>
          <Card>
            <Text style={styles.heading}>By category</Text>
            {result.data.by_category.length ? (
              result.data.by_category.map((c) => (
                <View key={c.category_id} style={styles.line}>
                  <Text style={styles.text}>
                    {categories.data?.items.find((x) => x.id === c.category_id)
                      ?.name || "Uncategorized"}
                  </Text>
                  <Text style={styles.heading}>{money(c.amount_paise)}</Text>
                </View>
              ))
            ) : (
              <Empty message="No spending in this period." />
            )}
          </Card>
        </>
      )}
      {scope === "room" && room && (
        <Button
          secondary
          title="Share CSV report"
          onPress={async () => {
            try {
              const from =
                  annual === "annual" ? `${year}-01-01` : `${period}-01`,
                to =
                  annual === "annual"
                    ? `${year}-12-31`
                    : `${period}-${new Date(Number(year), Number(month), 0).getDate()}`;
              const csv = await api<string>(
                `/rooms/${room.id}/reports/export?from=${from}&to=${to}`,
              );
              await Share.share({
                title: `RoomMate Ledger ${period}.csv`,
                message: csv,
              });
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        />
      )}
    </Screen>
  );
}
