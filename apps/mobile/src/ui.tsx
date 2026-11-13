import { useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import { SafeAreaView } from "react-native-safe-area-context";

export const colors = {
  navy: "#4d287f",
  teal: "#7040b5",
  tealDark: "#5b328d",
  tealSoft: "#f2ebfa",
  ink: "#241f2c",
  muted: "#716879",
  bg: "#f7f5fa",
  surface: "#ffffff",
  border: "#ece7f1",
  inputBorder: "#e4ddea",
  success: "#14765f",
  warning: "#a56716",
  warningOnDark: "#ffcf99",
  danger: "#a84043",
  dangerSoft: "#fff0ef",
};

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: {
    alignSelf: "center",
    width: "100%",
    maxWidth: 720,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 32,
    gap: 14,
  },
  pageHeader: { gap: 4, marginBottom: 2 },
  eyebrow: {
    color: colors.teal,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  title: {
    fontSize: 27,
    lineHeight: 33,
    fontWeight: "800",
    color: colors.navy,
    letterSpacing: -0.65,
  },
  subtitle: { fontSize: 13, color: colors.muted, lineHeight: 19 },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 16,
    gap: 12,
    shadowColor: colors.navy,
    shadowOpacity: 0.035,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  heading: { fontSize: 15, lineHeight: 21, fontWeight: "700", color: colors.ink },
  text: { fontSize: 14, lineHeight: 20, color: colors.ink },
  amount: {
    fontSize: 25,
    lineHeight: 31,
    fontWeight: "800",
    color: colors.tealDark,
    fontVariant: ["tabular-nums"],
  },
  line: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    paddingVertical: 11,
    gap: 5,
  },
  button: {
    alignSelf: "stretch",
    minHeight: 48,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.teal,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  buttonPressed: { opacity: 0.88, transform: [{ scale: 0.99 }] },
  buttonText: { color: colors.surface, fontWeight: "700", fontSize: 14 },
  secondary: {
    alignSelf: "flex-start",
    minHeight: 48,
    paddingHorizontal: 14,
    backgroundColor: colors.tealSoft,
  },
  secondaryText: { color: colors.tealDark },
  dangerButton: { backgroundColor: colors.dangerSoft },
  dangerText: { color: colors.danger },
  field: { gap: 6 },
  input: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: 13,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 11,
    color: colors.ink,
    fontSize: 15,
  },
  inputFocused: {
    borderColor: colors.teal,
    shadowColor: colors.teal,
    shadowOpacity: 0.08,
    shadowRadius: 5,
    elevation: 1,
  },
  label: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
    color: colors.ink,
  },
  select: {
    minHeight: 50,
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: 13,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  picker: { height: 50, color: colors.ink, marginHorizontal: 4 },
  error: {
    backgroundColor: colors.dangerSoft,
    borderColor: "#f1ceca",
    borderWidth: 1,
    padding: 13,
    borderRadius: 13,
    color: colors.danger,
    lineHeight: 19,
    fontSize: 13,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingHorizontal: 13,
    paddingVertical: 9,
    minHeight: 48,
    backgroundColor: colors.surface,
    justifyContent: "center",
  },
  selected: { backgroundColor: colors.tealSoft, borderColor: "#c8b4df" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  stat: {
    width: "48%",
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 14,
    gap: 7,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statLabel: { fontSize: 11, lineHeight: 15, color: colors.muted },
  statAmount: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "800",
    color: colors.ink,
    fontVariant: ["tabular-nums"],
  },
  listAmount: {
    maxWidth: 136,
    color: colors.navy,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
    textAlign: "right",
  },
  balanceCard: {
    backgroundColor: colors.navy,
    borderRadius: 20,
    padding: 18,
    gap: 8,
  },
  balanceLabel: { color: "#cad7e3", fontSize: 12, fontWeight: "600" },
  balanceAmount: {
    color: colors.surface,
    fontSize: 29,
    lineHeight: 36,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  balanceMeta: { color: "#dbe5ed", fontSize: 12, lineHeight: 18 },
  balanceMetaStrong: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  balanceDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.2)",
    marginVertical: 3,
  },
  balanceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  actionRow: { flexDirection: "row", alignItems: "stretch", gap: 10 },
  actionButton: { flex: 1, paddingHorizontal: 10 },
  sectionHeadingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  sectionMeta: { color: colors.muted, fontSize: 11, fontWeight: "600" },
  categoryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  categoryCard: {
    width: "48%",
    minWidth: 0,
    gap: 7,
    padding: 12,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#fcfbfd",
  },
  categoryAmount: {
    color: colors.ink,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  categoryTrack: {
    height: 5,
    overflow: "hidden",
    borderRadius: 8,
    backgroundColor: "#eee9f3",
  },
  categoryFill: {
    height: "100%",
    borderRadius: 8,
    backgroundColor: colors.teal,
  },
  categoryFillAlt: { backgroundColor: "#a56bb8" },
  activityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  activityIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.tealSoft,
  },
  activityCopy: { flex: 1, minWidth: 0, gap: 3 },
  activityMeta: { color: colors.muted, fontSize: 10 },
  activityAmount: {
    maxWidth: 94,
    color: colors.navy,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
    textAlign: "right",
  },
  badge: {
    alignSelf: "flex-start",
    borderRadius: 99,
    paddingHorizontal: 9,
    minHeight: 25,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#edf1f5",
  },
  badgeText: { color: colors.muted, fontSize: 10, fontWeight: "700" },
  badgeSuccess: { backgroundColor: "#e7f5ef" },
  badgeSuccessText: { color: colors.success },
  badgeWarning: { backgroundColor: "#fff4e4" },
  badgeWarningText: { color: colors.warning },
  badgeDanger: { backgroundColor: colors.dangerSoft },
  badgeDangerText: { color: colors.danger },
  empty: {
    minHeight: 88,
    paddingHorizontal: 18,
    paddingVertical: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f8fafb",
    borderRadius: 14,
  },
  emptyText: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
  },
});

export function Screen({
  title,
  subtitle,
  children,
  loading,
  refresh,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  loading?: boolean;
  refresh?: () => void;
}) {
  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={
          refresh ? (
            <RefreshControl
              refreshing={!!loading}
              onRefresh={refresh}
              tintColor={colors.teal}
              colors={[colors.teal]}
            />
          ) : undefined
        }
      >
        <View style={styles.pageHeader}>
          <Text style={styles.eyebrow}>ROOMMATE LEDGER</Text>
          <Text accessibilityRole="header" style={styles.title}>
            {title}
          </Text>
          {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        </View>
        {loading && <ActivityIndicator size="small" color={colors.teal} />}
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function Card({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Badge({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "neutral" | "success" | "warning" | "danger";
}) {
  const badgeStyle =
    tone === "success"
      ? styles.badgeSuccess
      : tone === "warning"
        ? styles.badgeWarning
        : tone === "danger"
          ? styles.badgeDanger
          : undefined;
  const badgeTextStyle =
    tone === "success"
      ? styles.badgeSuccessText
      : tone === "warning"
        ? styles.badgeWarningText
        : tone === "danger"
          ? styles.badgeDangerText
          : undefined;
  return (
    <View style={[styles.badge, badgeStyle]}>
      <Text style={[styles.badgeText, badgeTextStyle]}>{label}</Text>
    </View>
  );
}

export function Button({
  title,
  onPress,
  secondary,
  disabled,
  loading,
  danger,
  icon,
  fullWidth,
  style,
  textStyle,
}: {
  title: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
  loading?: boolean;
  danger?: boolean;
  icon?: ReactNode;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled, busy: !!loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        secondary && styles.secondary,
        danger && styles.dangerButton,
        fullWidth && { alignSelf: "stretch" },
        disabled && { opacity: 0.48 },
        pressed && !disabled && !loading && styles.buttonPressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={secondary ? colors.tealDark : colors.surface} />
      ) : (
        icon
      )}
      <Text
        style={[
          styles.buttonText,
          secondary && styles.secondaryText,
          danger && styles.dangerText,
          textStyle,
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}

export function Input({ label, ...props }: TextInputProps & { label: string }) {
  const [focused, setFocused] = useState(false);
  const {
    onFocus,
    onBlur,
    style: inputStyle,
    multiline,
    ...inputProps
  } = props;
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.muted}
        selectionColor={colors.teal}
        multiline={multiline}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        style={[
          styles.input,
          focused && styles.inputFocused,
          multiline && { minHeight: 104, textAlignVertical: "top" },
          inputStyle,
        ]}
        {...inputProps}
      />
    </View>
  );
}

export function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { label: string; value: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.select}>
        <Picker
          accessibilityLabel={label}
          selectedValue={value}
          onValueChange={onChange}
          style={styles.picker}
          dropdownIconColor={colors.muted}
        >
          {options.map((option) => (
            <Picker.Item
              key={option.value}
              value={option.value}
              label={option.label}
              color={colors.ink}
            />
          ))}
        </Picker>
      </View>
    </View>
  );
}

export function ErrorMessage({ error }: { error: string }) {
  return error ? (
    <Text accessibilityRole="alert" style={styles.error}>
      {error}
    </Text>
  ) : null;
}

export function Empty({ message }: { message: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyText}>{message}</Text>
    </View>
  );
}
