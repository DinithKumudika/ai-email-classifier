import { ThinkingOrb } from "thinking-orbs";

interface InitialSyncScreenProps {
  emailsCount: number;
  totalInboxEmails: number;
  isRateLimited?: boolean;
}

export default function InitialSyncScreen({
  emailsCount,
  totalInboxEmails,
  isRateLimited,
}: InitialSyncScreenProps) {
  const progress =
    totalInboxEmails > 0
      ? Math.min(100, (emailsCount / totalInboxEmails) * 100)
      : 0;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background text-foreground gap-6">
      <ThinkingOrb state="working" size={64} theme="auto" />
      <div className="flex flex-col items-center gap-2">
        <h2 className="text-2xl font-bold animate-pulse text-primary">
          {isRateLimited
            ? "API Quota Reached. Paused for 60 seconds..."
            : "Hang on, I'm working through your emails..."}
        </h2>
        <p className="text-muted-foreground text-sm">
          Fetched {emailsCount.toLocaleString()} of{" "}
          {totalInboxEmails > 0 ? totalInboxEmails.toLocaleString() : "..."}{" "}
          emails
        </p>
        <div className="w-64 h-2 bg-muted rounded-full overflow-hidden mt-2">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}
