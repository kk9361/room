import { Tabs, Redirect } from "expo-router";
import {
  ChartNoAxesCombined,
  House,
  Plus,
  ReceiptText,
  UserRound,
  type LucideIcon,
} from "lucide-react-native";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSession } from "../../src/session";
import { colors } from "../../src/ui";

function NavigationIcon({
  icon: Icon,
  color,
  focused,
}: {
  icon: LucideIcon;
  color: string;
  focused: boolean;
}) {
  return (
    <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
      <Icon color={color} size={19} strokeWidth={2.1} />
    </View>
  );
}

export default function TabLayout() {
  const { user, unreadAnnouncementCount } = useSession();
  const insets = useSafeAreaInsets();
  if (!user || user.must_change_password) return <Redirect href="/" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.tealDark,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: [
          styles.tabBar,
          {
            height: 66 + insets.bottom,
            paddingBottom: Math.max(insets.bottom, 7),
          },
        ],
        tabBarItemStyle: styles.tabItem,
        tabBarLabelStyle: styles.tabLabel,
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, focused }) => (
            <NavigationIcon icon={House} color={String(color ?? colors.muted)} focused={focused} />
          ),
          tabBarBadge: unreadAnnouncementCount || undefined,
          tabBarBadgeStyle: styles.badge,
        }}
      />
      <Tabs.Screen
        name="expenses"
        options={{
          title: "Expenses",
          tabBarIcon: ({ color, focused }) => (
            <NavigationIcon
              icon={ReceiptText}
              color={String(color ?? colors.muted)}
              focused={focused}
            />
          ),
        }}
      />
      <Tabs.Screen name="settle" options={{ href: null }} />
      <Tabs.Screen
        name="add"
        options={{
          title: "Add",
          tabBarIcon: () => (
            <View style={styles.addIcon}>
              <Plus color={colors.surface} size={23} strokeWidth={2.5} />
            </View>
          ),
          tabBarLabelStyle: styles.addLabel,
          tabBarItemStyle: styles.addTabItem,
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          title: "Reports",
          tabBarIcon: ({ color, focused }) => (
            <NavigationIcon
              icon={ChartNoAxesCombined}
              color={String(color ?? colors.muted)}
              focused={focused}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, focused }) => (
            <NavigationIcon
              icon={UserRound}
              color={String(color ?? colors.muted)}
              focused={focused}
            />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.surface,
    borderTopColor: "transparent",
    borderTopWidth: 0,
    paddingTop: 5,
    elevation: 14,
    shadowColor: colors.navy,
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: -4 },
  },
  tabItem: { paddingTop: 1 },
  tabLabel: {
    fontSize: 10,
    lineHeight: 13,
    fontWeight: "600",
    marginTop: 1,
  },
  iconWrap: {
    width: 56,
    height: 29,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrapActive: { backgroundColor: colors.tealSoft },
  addTabItem: { paddingTop: 0 },
  addIcon: {
    width: 46,
    height: 46,
    marginTop: -16,
    borderRadius: 24,
    borderWidth: 4,
    borderColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.teal,
    shadowColor: colors.navy,
    shadowOpacity: 0.2,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  addLabel: {
    color: colors.tealDark,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: "700",
    marginTop: 1,
  },
  badge: {
    color: colors.surface,
    backgroundColor: colors.danger,
    fontSize: 10,
    minWidth: 17,
    height: 17,
    lineHeight: 16,
  },
});
