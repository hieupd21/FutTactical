import { useGameVersion } from "@/stores/gameStore";
import { InboxCard } from "./InboxCard";

export function NotificationsPage() {
  useGameVersion();
  return (
    <div className="mx-auto w-full max-w-3xl">
      <InboxCard />
    </div>
  );
}
