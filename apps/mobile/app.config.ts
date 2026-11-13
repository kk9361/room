import type { ExpoConfig, ConfigContext } from "expo/config";
export default ({ config }: ConfigContext): ExpoConfig => {
  const apiUrl =
    process.env.EXPO_PUBLIC_API_URL || "http://10.0.2.2:8000/api/v1";
  const production = process.env.EAS_BUILD_PROFILE === "production";
  if (
    production &&
    (!apiUrl.startsWith("https://") || apiUrl.includes("YOUR_BACKEND_HOST"))
  )
    throw new Error(
      "Set EXPO_PUBLIC_API_URL to your real HTTPS backend before creating a production build.",
    );
  return {
    ...config,
    name: "RoomMate Ledger",
    slug: "roommate-ledger",
    version: "1.0.0",
    scheme: "roommate-ledger",
    orientation: "portrait",
    userInterfaceStyle: "light",
    android: {
      package: "com.roommate.ledger",
      versionCode: 1,
      allowBackup: false,
    },
    plugins: [
      "expo-router",
      "expo-secure-store",
      "expo-status-bar",
      [
        "./plugins/with-local-network",
        { allowHttp: !production && apiUrl.startsWith("http://") },
      ],
    ],
    extra: { apiUrl },
  };
};
