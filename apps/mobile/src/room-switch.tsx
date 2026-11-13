import { useSession } from "./session";
import { Select } from "./ui";
export function RoomSwitch() {
  const { room, rooms, setRoomId } = useSession();
  return (
    <Select
      label="Current household"
      value={room?.id || ""}
      onChange={setRoomId}
      options={
        rooms.length
          ? rooms.map((r) => ({
              value: r.id,
              label: `${r.name}${r.status === "archived" ? " (archived)" : ""}`,
            }))
          : [{ value: "", label: "Create or join a room in Profile" }]
      }
    />
  );
}
