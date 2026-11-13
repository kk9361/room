import { useState } from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { Redirect } from "expo-router";
import { post, changePassword } from "../src/api";
import { useSession } from "../src/session";
import { Screen, Card, Input, Button, ErrorMessage, styles } from "../src/ui";
export default function Login() {
  const session = useSession();
  const [register, setRegister] = useState(false),
    [identifier, setIdentifier] = useState(""),
    [password, setPassword] = useState(""),
    [display, setDisplay] = useState(""),
    [email, setEmail] = useState("");
  const [next, setNext] = useState(""),
    [confirm, setConfirm] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  if (session.loading)
    return (
      <Screen title="RoomMate Ledger">
        <ActivityIndicator />
      </Screen>
    );
  if (session.user && !session.user.must_change_password)
    return <Redirect href="/(tabs)" />;
  const forced = session.user?.must_change_password;
  return (
    <Screen title="RoomMate Ledger" subtitle="Shared fairly. Settled simply.">
      <View style={{ height: 18 }} />
      <Card>
        <Text style={styles.title}>
          {forced
            ? "Secure your account."
            : register
              ? "Make yourself at home."
              : "Welcome back."}
        </Text>
        <Text style={styles.subtitle}>
          {forced
            ? "Change your temporary password before continuing."
            : "Your household expenses, all in one place."}
        </Text>
        <ErrorMessage error={error || session.error} />
        {!forced && (
          <>
            {register && (
              <Input
                label="Your name"
                value={display}
                onChangeText={setDisplay}
                autoComplete="name"
              />
            )}
            <Input
              label={register ? "Username" : "Username or email"}
              value={identifier}
              onChangeText={setIdentifier}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </>
        )}
        <Input
          label={forced ? "Current password" : "Password"}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
        {register && !forced && <Input label="Email (optional)" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />}
        {forced && (
          <>
            <Input
              label="New password (at least 12 characters)"
              secureTextEntry
              value={next}
              onChangeText={setNext}
            />
            <Input
              label="Confirm new password"
              secureTextEntry
              value={confirm}
              onChangeText={setConfirm}
            />
          </>
        )}
        <Button
          disabled={busy}
          title={
            busy
              ? "Please wait…"
              : forced
                ? "Change password"
                : register
                  ? "Create account"
                  : "Sign in"
          }
          onPress={async () => {
            setError("");
            setBusy(true);
            try {
              if (forced) {
                if (next !== confirm)
                  throw new Error("Passwords do not match.");
                session.setUser(await changePassword(password, next));
              } else {
                if (register)
                  await post("/auth/register", {
                    username: identifier,
                    display_name: display,
                    password,
                    email: email.trim() || null,
                  });
                await session.login(identifier, password);
              }
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        />
        {!forced && (
          <Button
            secondary
            title={
              register
                ? "Already registered? Sign in"
                : "New here? Create an account"
            }
            onPress={() => {
              setRegister(!register);
              setError("");
            }}
          />
        )}
        <Text style={styles.subtitle}>
          Personal expenses stay private. For password recovery, contact your
          platform administrator.
        </Text>
      </Card>
    </Screen>
  );
}
