import { useState } from "react";
import { Text, View, Alert, Share } from "react-native";
import { useRouter } from "expo-router";
import { useSession } from "../../src/session";
import { useResource } from "../../src/hooks";
import {
  post,
  patch,
  changePassword,
  type Room,
  type User,
  type Member,
  type Category,
  type Announcement,
  type Page,
} from "../../src/api";
import {
  Screen,
  Card,
  Input,
  Button,
  ErrorMessage,
  colors,
  styles,
} from "../../src/ui";
import { RoomSwitch } from "../../src/room-switch";
export default function Profile() {
  const session = useSession(),
    { user, room } = session,
    router = useRouter();
  const [display, setDisplay] = useState(user?.display_name || ""),
    [roomName, setRoomName] = useState(""),
    [invite, setInvite] = useState(""),
    [token, setToken] = useState(""),
    [invitation, setInvitation] = useState("");
  const [category, setCategory] = useState(""),
    [personalCategory, setPersonalCategory] = useState(""),
    [title, setTitle] = useState(""),
    [body, setBody] = useState("");
  const [current, setCurrent] = useState(""),
    [next, setNext] = useState(""),
    [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const members = useResource<{ items: Member[] }>(
    room ? `/rooms/${room.id}/members` : null,
  );
  const announcements = useResource<Page<Announcement>>(
    room ? `/rooms/${room.id}/announcements` : null,
  );
  const admin =
    room?.members.find((m) => m.user_id === user?.id)?.role === "room_admin";
  async function act(action: () => Promise<unknown>, success: string) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
      await session.refresh();
      members.refresh();
      announcements.refresh();
      setMessage(success);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen
      title="Your space"
      subtitle={`@${user?.username} · ${user?.platform_role === "super_admin" ? "Platform administrator" : "RoomMate member"}`}
      refresh={() => {
        session.refresh().catch((e) => setError(e.message));
        members.refresh();
        announcements.refresh();
      }}
    >
      <ErrorMessage error={error || session.error || members.error || announcements.error} />
      {!!message && (
        <Text
          accessibilityRole="alert"
          style={[styles.subtitle, { color: colors.success }]}
        >
          {message}
        </Text>
      )}
      <Button
        title="My personal expenses"
        onPress={() => router.push("/personal")}
      />
      <RoomSwitch />
      <Card>
        <Text style={styles.heading}>Your profile</Text>
        <Input label="Display name" value={display} onChangeText={setDisplay} />
        <Button
          title="Save profile"
          disabled={busy}
          onPress={() =>
            act(
              async () =>
                session.setUser(
                  await patch<User>("/users/me", { display_name: display }),
                ),
              "Profile saved.",
            )
          }
        />
      </Card>
      <Card>
        <Text style={styles.heading}>Create a household</Text>
        <Input label="Room name" value={roomName} onChangeText={setRoomName} />
        <Button
          title="Create room"
          disabled={busy}
          onPress={() =>
            act(async () => {
              const r = await post<Room>("/rooms", { name: roomName });
              session.setRoomId(r.id);
              setRoomName("");
            }, "Room created.")
          }
        />
        <Input
          label="One-time invitation token"
          value={token}
          onChangeText={setToken}
          autoCapitalize="none"
        />
        <Button
          secondary
          title="Join invited room"
          disabled={busy}
          onPress={() =>
            act(async () => {
              const r = await post<Room>("/invitations/accept", {
                token: token.trim(),
              });
              session.setRoomId(r.id);
              setToken("");
            }, "Room joined.")
          }
        />
      </Card>
      {room && (
        <Card>
          <Text style={styles.heading}>People in {room.name}</Text>
          {members.data?.items.map((m) => (
            <View key={m.user_id} style={styles.line}>
              <Text style={styles.heading}>
                {m.display_name}
                {m.user_id === user?.id ? " (you)" : ""}
              </Text>
              <Text style={styles.subtitle}>
                {m.role === "room_admin" ? "Administrator" : "Member"} ·{" "}
                {m.status}
              </Text>
              {admin && room.status === "active" && (
                <View style={{ gap: 8 }}>
                  <Button
                    secondary
                    title={
                      m.role === "room_admin"
                        ? "Make member"
                        : "Make administrator"
                    }
                    disabled={busy}
                    onPress={() =>
                      Alert.alert("Change room role?", m.display_name, [
                        { text: "Cancel", style: "cancel" },
                        {
                          text: "Confirm",
                          onPress: () =>
                            act(
                              () =>
                                patch(
                                  `/rooms/${room.id}/members/${m.user_id}`,
                                  {
                                    role:
                                      m.role === "room_admin"
                                        ? "room_member"
                                        : "room_admin",
                                  },
                                ),
                              "Role updated.",
                            ),
                        },
                      ])
                    }
                  />
                  <Button
                    secondary
                    title={
                      m.status === "active"
                        ? "Remove member"
                        : "Reactivate member"
                    }
                    disabled={busy}
                    onPress={() =>
                      Alert.alert(
                        "Change membership?",
                        "Financial history remains in the ledger.",
                        [
                          { text: "Cancel", style: "cancel" },
                          {
                            text: "Confirm",
                            onPress: () =>
                              act(
                                () =>
                                  patch(
                                    `/rooms/${room.id}/members/${m.user_id}`,
                                    {
                                      status:
                                        m.status === "active"
                                          ? "removed"
                                          : "active",
                                    },
                                  ),
                                "Membership updated.",
                              ),
                          },
                        ],
                      )
                    }
                  />
                </View>
              )}
            </View>
          ))}
        </Card>
      )}
      {room && admin && (
        <>
          <Card>
            <Text style={styles.heading}>Invite a roommate</Text>
            <Input
              label="Their username or email"
              value={invite}
              onChangeText={setInvite}
              autoCapitalize="none"
            />
            <Button
              title="Create invitation"
              disabled={busy || room.status !== "active"}
              onPress={() =>
                act(async () => {
                  const result = await post<{ token: string }>(
                    `/rooms/${room.id}/invitations`,
                    { email_or_username: invite },
                  );
                  setInvitation(result.token);
                }, "Invitation created. Share it privately.")
              }
            />
            {!!invitation && (
              <>
                <Text selectable style={styles.subtitle}>
                  {invitation}
                </Text>
                <Button
                  secondary
                  title="Share invitation privately"
                  onPress={() => {
                    Share.share({
                      message: `Join ${room.name} in RoomMate Ledger. Create an account with the invited username/email and use this token: ${invitation}`,
                    });
                  }}
                />
              </>
            )}
          </Card>
          <Card>
            <Text style={styles.heading}>Room settings</Text>
            <Input
              label="New room name"
              value={roomName}
              onChangeText={setRoomName}
            />
            <Button
              title="Rename room"
              disabled={busy}
              onPress={() =>
                act(
                  () => patch(`/rooms/${room.id}`, { name: roomName }),
                  "Room updated.",
                )
              }
            />
            <Button
              secondary
              title={
                room.settings.allow_member_expenses
                  ? "Restrict expense entry to admins"
                  : "Allow member expense entry"
              }
              disabled={busy}
              onPress={() =>
                act(
                  () =>
                    patch(`/rooms/${room.id}`, {
                      allow_member_expenses:
                        !room.settings.allow_member_expenses,
                    }),
                  "Preference saved.",
                )
              }
            />
            <Input
              label="New shared category"
              value={category}
              onChangeText={setCategory}
            />
            <Button
              secondary
              title="Add shared category"
              disabled={busy || room.status !== "active"}
              onPress={() =>
                act(async () => {
                  await post(`/rooms/${room.id}/categories`, {
                    name: category,
                  });
                  setCategory("");
                }, "Category created.")
              }
            />
            <Button
              secondary
              title={room.status === "active" ? "Archive room" : "Restore room"}
              disabled={busy}
              onPress={() =>
                Alert.alert(
                  "Change room status?",
                  "Archived rooms retain history and block new financial activity.",
                  [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Confirm",
                      onPress: () =>
                        act(
                          () =>
                            patch(`/rooms/${room.id}`, {
                              status:
                                room.status === "active"
                                  ? "archived"
                                  : "active",
                            }),
                          "Room status updated.",
                        ),
                    },
                  ],
                )
              }
            />
          </Card>
        </>
      )}
      {room && (
        <Card>
          <Text style={styles.heading}>Noticeboard</Text>
          <Input
            label="Announcement title"
            value={title}
            onChangeText={setTitle}
          />
          <Input
            label="Announcement message"
            value={body}
            onChangeText={setBody}
            multiline
          />
          <Button
            title="Publish announcement"
            disabled={busy || room.status !== "active"}
            onPress={() =>
              act(async () => {
                await post(`/rooms/${room.id}/announcements`, {
                  title,
                  body,
                });
                setTitle("");
                setBody("");
              }, "Announcement published.")
            }
          />
          {announcements.data?.items.map((a) => (
            <View style={styles.line} key={a.id}>
              <Text style={styles.heading}>{a.title}</Text>
              <Text style={styles.subtitle}>{a.body}</Text>
              {session.unreadAnnouncementIds.includes(a.id) && (
                <Button
                  secondary
                  title="Mark as read"
                  disabled={busy}
                  onPress={() =>
                    act(() => session.markAnnouncementRead(a.id), "Announcement marked as read.")
                  }
                />
              )}
              {admin && (
                <Button
                  secondary
                  title="Archive announcement"
                  disabled={busy || room.status !== "active"}
                  onPress={() =>
                    act(
                      () =>
                        patch(`/rooms/${room.id}/announcements/${a.id}`, {
                          status: "archived",
                        }),
                      "Announcement archived.",
                    )
                  }
                />
              )}
            </View>
          ))}
        </Card>
      )}
      <Card>
        <Text style={styles.heading}>Personal categories</Text>
        <Input
          label="New personal category"
          value={personalCategory}
          onChangeText={setPersonalCategory}
        />
        <Button
          secondary
          title="Add personal category"
          disabled={busy}
          onPress={() =>
            act(async () => {
              await post("/personal/categories", { name: personalCategory });
              setPersonalCategory("");
            }, "Personal category created.")
          }
        />
      </Card>
      <Card>
        <Text style={styles.heading}>Change password</Text>
        <Input
          label="Current password"
          secureTextEntry
          value={current}
          onChangeText={setCurrent}
        />
        <Input
          label="New password (at least 12 characters)"
          secureTextEntry
          value={next}
          onChangeText={setNext}
        />
        <Input
          label="Confirm new password"
          secureTextEntry
          value={confirmation}
          onChangeText={setConfirmation}
        />
        <Button
          title="Change password"
          disabled={busy}
          onPress={() =>
            act(async () => {
              if (next !== confirmation)
                throw new Error("New passwords do not match.");
              session.setUser(await changePassword(current, next));
              setCurrent("");
              setNext("");
              setConfirmation("");
            }, "Password changed. Other sessions have been signed out.")
          }
        />
      </Card>
      <Button
        secondary
        title="Sign out"
        disabled={busy}
        onPress={() =>
          act(async () => {
            await session.logout();
            router.replace("/");
          }, "Signed out.")
        }
      />
    </Screen>
  );
}
