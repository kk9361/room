import { useState } from "react";
import { Text, View, Alert } from "react-native";
import { useRouter } from "expo-router";
import { Plus, RotateCcw } from "lucide-react-native";
import { useSession } from "../../src/session";
import { useResource } from "../../src/hooks";
import { post, money, type Expense, type Page } from "../../src/api";
import { RoomSwitch } from "../../src/room-switch";
import {
  Screen,
  Card,
  Input,
  Button,
  Badge,
  ErrorMessage,
  Empty,
  colors,
  styles,
} from "../../src/ui";
export default function Expenses() {
  const { room, user } = useSession(),
    router = useRouter();
  const [page, setPage] = useState(1),
    [search, setSearch] = useState(""),
    [error, setError] = useState("");
  const result = useResource<Page<Expense>>(
    room
      ? `/rooms/${room.id}/expenses?page=${page}&search=${encodeURIComponent(search)}`
      : null,
  );
  const admin =
    room?.members.find((m) => m.user_id === user?.id)?.role === "room_admin";
  return (
    <Screen
      title="Expenses"
      subtitle="Everything you’ve shared, in one place."
      loading={result.loading}
      refresh={result.refresh}
    >
      <RoomSwitch />
      <ErrorMessage error={error || result.error} />
      <Button
        title="Add shared expense"
        icon={<Plus size={18} color={colors.surface} strokeWidth={2.5} />}
        disabled={!room || room.status === "archived"}
        onPress={() => router.push("/expense")}
      />
      <Input
        label="Search expenses"
        value={search}
        onChangeText={(v) => {
          setSearch(v);
          setPage(1);
        }}
      />
      {result.data?.items.map((x) => (
        <Card key={x.id}>
          <View style={styles.row}>
            <View style={{ flex: 1, gap: 3 }}>
              <Text numberOfLines={2} style={styles.heading}>
                {x.description}
              </Text>
              <Text style={styles.statLabel}>
                {x.expense_date} · {x.splits.length} people · {x.split_type}
              </Text>
            </View>
            <Text
              adjustsFontSizeToFit
              numberOfLines={1}
              style={styles.listAmount}
            >
              {money(x.total_paise)}
            </Text>
          </View>
          <View style={styles.row}>
            <Badge
              label={x.status}
              tone={x.status === "posted" ? "success" : "danger"}
            />
          </View>
          {x.status === "posted" &&
            room?.status === "active" &&
            (admin || x.created_by === user?.id) && (
              <Button
                secondary
                icon={<RotateCcw size={15} color={colors.tealDark} />}
                title="Reverse"
                onPress={() =>
                  router.push({
                    pathname: "/expense",
                    params: { reverse: x.id },
                  })
                }
              />
            )}
        </Card>
      ))}
      {!result.loading && !result.data?.items.length && (
        <Empty message="No shared expenses found." />
      )}
      <View style={styles.row}>
        <Button
          secondary
          title="Previous"
          disabled={page === 1}
          onPress={() => setPage((p) => p - 1)}
        />
        <Text style={styles.statLabel}>Page {page}</Text>
        <Button
          secondary
          title="Next"
          disabled={page * 20 >= (result.data?.total || 0)}
          onPress={() => setPage((p) => p + 1)}
        />
      </View>
      <Button
        secondary
        title="Open my personal expenses"
        onPress={() => router.push("/personal")}
      />
    </Screen>
  );
}
