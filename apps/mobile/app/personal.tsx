import { useState } from "react";
import { Text, View, Alert } from "react-native";
import { useRouter, Redirect } from "expo-router";
import { useSession } from "../src/session";
import { useResource } from "../src/hooks";
import { api, money, type Page, type Expense } from "../src/api";
import { Plus } from "lucide-react-native";
import {
  Screen,
  Card,
  Button,
  Input,
  ErrorMessage,
  Empty,
  colors,
  styles,
} from "../src/ui";
export default function Personal() {
  const { user } = useSession(),
    router = useRouter();
  const [page, setPage] = useState(1),
    [search, setSearch] = useState(""),
    [error, setError] = useState("");
  const result = useResource<Page<Expense>>(
    user
      ? `/personal/expenses?page=${page}&search=${encodeURIComponent(search)}`
      : null,
  );
  if (!user) return <Redirect href="/" />;
  return (
    <Screen
      title="My personal expenses"
      subtitle="Private to you. Never included in shared balances."
      loading={result.loading}
      refresh={result.refresh}
    >
      <ErrorMessage error={error || result.error} />
      <Button
        title="Add personal expense"
        icon={<Plus size={18} color={colors.surface} strokeWidth={2.5} />}
        onPress={() =>
          router.push({ pathname: "/expense", params: { personal: "1" } })
        }
      />
      <Input
        label="Search personal expenses"
        value={search}
        onChangeText={(v) => {
          setSearch(v);
          setPage(1);
        }}
      />
      {result.data?.items.map((x) => (
        <Card key={x.id}>
          <View style={styles.row}>
            <Text numberOfLines={2} style={[styles.heading, { flex: 1 }]}>
              {x.description}
            </Text>
            <Text
              adjustsFontSizeToFit
              numberOfLines={1}
              style={styles.listAmount}
            >
              {money(x.amount_paise!)}
            </Text>
          </View>
          <Text style={styles.subtitle}>
            {x.expense_date}
            {x.notes ? ` · ${x.notes}` : ""}
          </Text>
          <View style={styles.row}>
            <Button
              secondary
              title="Edit"
              onPress={() =>
                router.push({
                  pathname: "/expense",
                  params: { personal: "1", edit: x.id },
                })
              }
            />
            <Button
              secondary
              title="Delete"
              onPress={() =>
                Alert.alert("Delete personal expense?", x.description, [
                  { text: "Keep", style: "cancel" },
                  {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                      try {
                        await api(`/personal/expenses/${x.id}`, {
                          method: "DELETE",
                        });
                        result.refresh();
                      } catch (e) {
                        setError((e as Error).message);
                      }
                    },
                  },
                ])
              }
            />
          </View>
        </Card>
      ))}
      {!result.loading && !result.data?.items.length && (
        <Empty message="Your personal spending will appear here." />
      )}
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
          disabled={page * 20 >= (result.data?.total || 0)}
          onPress={() => setPage((p) => p + 1)}
        />
      </View>
      <Button
        secondary
        title="Back to household"
        onPress={() => router.back()}
      />
    </Screen>
  );
}
