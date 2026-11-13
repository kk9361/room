import { View, Text } from "react-native";
import { useRouter } from "expo-router";
import { ArrowLeftRight, Plus, ReceiptText } from "lucide-react-native";
import { useSession } from "../../src/session";
import { useResource } from "../../src/hooks";
import {
  type Report,
  type Balance,
  type Announcement,
  type Category,
  type Expense,
  type Page,
  money,
  today,
} from "../../src/api";
import {
  Screen,
  Card,
  Button,
  ErrorMessage,
  Empty,
  colors,
  styles,
} from "../../src/ui";
import { RoomSwitch } from "../../src/room-switch";

export default function Home() {
  const { user, room } = useSession();
  const router = useRouter();
  const [year, month] = today(room?.timezone).split("-");
  const report = useResource<Report>(
    room
      ? `/rooms/${room.id}/reports/monthly?year=${year}&month=${month}`
      : null,
  );
  const balances = useResource<{ items: Balance[] }>(
    room ? `/rooms/${room.id}/balances` : null,
  );
  const announcements = useResource<Page<Announcement>>(
    room ? `/rooms/${room.id}/announcements` : null,
  );
  const categories = useResource<Page<Category>>(
    room ? `/rooms/${room.id}/categories` : null,
  );
  const recentExpenses = useResource<Page<Expense>>(
    room ? `/rooms/${room.id}/expenses?page_size=5` : null,
  );
  const my = balances.data?.items.find((item) => item.user_id === user?.id);
  const net = my?.net_paise || 0;
  const balanceLabel =
    net > 0 ? "You are owed" : net < 0 ? "You owe" : "You are settled up";

  return (
    <Screen
      title={`Hi, ${user?.display_name.split(" ")[0] || "there"}`}
      subtitle="Your household, at a glance."
      loading={report.loading}
      refresh={() => {
        report.refresh();
        balances.refresh();
        announcements.refresh();
        categories.refresh();
        recentExpenses.refresh();
      }}
    >
      <RoomSwitch />
      <ErrorMessage
        error={report.error || balances.error || announcements.error || categories.error || recentExpenses.error}
      />
      {room ? (
        <>
          <View style={styles.balanceCard}>
            <Text style={styles.balanceLabel}>SHARED THIS MONTH</Text>
            <Text adjustsFontSizeToFit numberOfLines={1} style={styles.balanceAmount}>
              {money(report.data?.total_paise || 0)}
            </Text>
            <View style={styles.balanceDivider} />
            <View style={styles.balanceRow}>
              <Text style={styles.balanceLabel}>{balanceLabel}</Text>
              <Text
                adjustsFontSizeToFit
                numberOfLines={1}
                style={[
                  styles.balanceMetaStrong,
                  net < 0 && { color: colors.warningOnDark },
                ]}
              >
                {money(Math.abs(net))}
              </Text>
            </View>
          </View>

          <View style={styles.grid}>
            {[
              ["You paid", my?.paid_paise || 0],
              ["Your share", my?.share_paise || 0],
            ].map(([label, value]) => (
              <View key={label as string} style={styles.stat}>
                <Text style={styles.statLabel}>{label as string}</Text>
                <Text
                  adjustsFontSizeToFit
                  numberOfLines={1}
                  style={styles.statAmount}
                >
                  {money(value as number)}
                </Text>
                <Text style={styles.statLabel}>All time</Text>
              </View>
            ))}
          </View>

          <View style={styles.actionRow}>
            <Button
              fullWidth
              style={styles.actionButton}
              icon={<Plus size={18} color={colors.surface} strokeWidth={2.5} />}
              title="Add expense"
              disabled={room.status === "archived"}
              onPress={() => router.push("/expense")}
            />
            <Button
              fullWidth
              secondary
              style={styles.actionButton}
              icon={<ArrowLeftRight size={17} color={colors.tealDark} />}
              title="Settle up"
              onPress={() => router.push("/(tabs)/settle")}
            />
          </View>

          <Card>
            <View style={styles.sectionHeadingRow}>
              <View>
                <Text style={styles.heading}>Monthly categories</Text>
                <Text style={styles.sectionMeta}>A breakdown of shared spending</Text>
              </View>
              <Text style={styles.sectionMeta}>{report.data?.count || 0} expenses</Text>
            </View>
            {report.data?.by_category.length ? (
              <View style={styles.categoryGrid}>
                {[...report.data.by_category]
                  .sort((a, b) => b.amount_paise - a.amount_paise)
                  .slice(0, 4)
                  .map((item, index) => {
                    const name = categories.data?.items.find((category) => category.id === item.category_id)?.name || "Uncategorized";
                    const maximum = Math.max(...report.data!.by_category.map((category) => category.amount_paise), 1);
                    return (
                      <View key={item.category_id || "uncategorized"} style={styles.categoryCard}>
                        <Text numberOfLines={1} style={styles.statLabel}>{name}</Text>
                        <Text adjustsFontSizeToFit numberOfLines={1} style={styles.categoryAmount}>{money(item.amount_paise)}</Text>
                        <View style={styles.categoryTrack}>
                          <View style={[styles.categoryFill, index === 1 && styles.categoryFillAlt, { width: `${Math.max(6, Math.round((item.amount_paise / maximum) * 100))}%` }]} />
                        </View>
                      </View>
                    );
                  })}
              </View>
            ) : (
              <Empty message="Your category breakdown will appear after shared expenses are recorded." />
            )}
          </Card>

          <Card>
            <View style={styles.sectionHeadingRow}>
              <View>
                <Text style={styles.heading}>Recent activity</Text>
                <Text style={styles.sectionMeta}>The latest shared expenses</Text>
              </View>
              <Button
                title="All expenses"
                secondary
                icon={<ReceiptText size={15} color={colors.tealDark} />}
                onPress={() => router.push("/(tabs)/expenses")}
              />
            </View>
            {recentExpenses.data?.items.length ? (
              recentExpenses.data.items.slice(0, 5).map((expense) => {
                const payer = room.members.find((member) => member.user_id === expense.paid_by)?.display_name || "Roommate";
                const category = categories.data?.items.find((item) => item.id === expense.category_id)?.name || "Uncategorized";
                return (
                  <View key={expense.id} style={styles.activityRow}>
                    <View style={styles.activityIcon}>
                      <ReceiptText size={17} color={colors.tealDark} />
                    </View>
                    <View style={styles.activityCopy}>
                      <Text numberOfLines={1} style={styles.heading}>{expense.description}</Text>
                      <Text numberOfLines={1} style={styles.activityMeta}>{payer} · {category} · {new Date(`${expense.expense_date}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</Text>
                    </View>
                    <Text adjustsFontSizeToFit numberOfLines={1} style={styles.activityAmount}>{money(expense.total_paise)}</Text>
                  </View>
                );
              })
            ) : (
              <Empty message="Shared expenses will appear here once your household adds one." />
            )}
          </Card>

          <Card>
            <View style={styles.sectionHeadingRow}>
              <Text style={styles.heading}>Room updates</Text>
              {!!announcements.data?.total && (
                <Text style={styles.sectionMeta}>
                  {announcements.data.total} total
                </Text>
              )}
            </View>
            {announcements.data?.items.length ? (
              announcements.data.items.slice(0, 4).map((announcement) => (
                <View key={announcement.id} style={styles.line}>
                  <Text style={styles.heading}>{announcement.title}</Text>
                  <Text numberOfLines={3} style={styles.subtitle}>
                    {announcement.body}
                  </Text>
                </View>
              ))
            ) : (
              <Empty message="New announcements from your roommates will appear here." />
            )}
          </Card>
        </>
      ) : (
        <Card>
          <Text style={styles.heading}>Start your household</Text>
          <Empty message="Create a household or join one with an invitation from your profile." />
          <Button
            title="Open profile"
            onPress={() => router.push("/(tabs)/profile")}
          />
        </Card>
      )}
    </Screen>
  );
}
