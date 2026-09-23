import { cn } from "@/lib/utils";

export default function UrgencyIndicator({ scoreStr }: { scoreStr?: string }) {
  if (!scoreStr || scoreStr === "N/A") return <span className="text-muted-foreground text-xs">-</span>;
  
  const parts = scoreStr.split("/");
  const score = parseInt(parts[0], 10);
  const max = parts[1] ? parseInt(parts[1], 10) : 10;
  if (isNaN(score)) return <span className="text-muted-foreground text-xs">{scoreStr}</span>;
  
  // Map any scale (e.g., x/5 or y/10) dynamically to exactly 5 circles
  const activeCircles = Math.ceil((score / max) * 5); 
  
  // Colors for the 5 circles (gradient from green to red)
  const colors = [
    "bg-emerald-500", // 1
    "bg-lime-500",    // 2
    "bg-yellow-500",  // 3
    "bg-orange-500",  // 4
    "bg-red-500"      // 5
  ];

  return (
    <div className="flex items-center gap-1" title={`Urgency: ${scoreStr}`}>
      {[0, 1, 2, 3, 4].map((index) => {
        const isActive = index < activeCircles;
        return (
          <div
            key={index}
            className={cn(
              "w-2.5 h-2.5 rounded-full transition-colors",
              isActive ? colors[index] : "bg-muted"
            )}
          />
        );
      })}
    </div>
  );
}
