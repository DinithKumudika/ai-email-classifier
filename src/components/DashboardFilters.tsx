import { Button } from "@/components/ui/button";

interface DashboardFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  categoryFilter: string;
  onCategoryChange: (value: string) => void;
  urgencyFilter: string;
  onUrgencyChange: (value: string) => void;
  urgentReplyOnly: boolean;
  onUrgentReplyChange: (value: boolean) => void;
  sortField: "date" | "urgency";
  onSortFieldChange: (value: "date" | "urgency") => void;
  sortOrder: "asc" | "desc";
  onSortOrderChange: (value: "asc" | "desc") => void;
}

export default function DashboardFilters({
  searchTerm,
  onSearchChange,
  categoryFilter,
  onCategoryChange,
  urgencyFilter,
  onUrgencyChange,
  urgentReplyOnly,
  onUrgentReplyChange,
  sortField,
  onSortFieldChange,
  sortOrder,
  onSortOrderChange,
}: DashboardFiltersProps) {
  return (
    <div className="flex flex-wrap gap-4 items-center bg-muted/20 border border-border rounded-xl p-3">
      <input
        type="text"
        placeholder="Search subject or sender..."
        value={searchTerm}
        onChange={(e) => onSearchChange(e.target.value)}
        className="flex h-9 w-[250px] rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      />

      <select
        value={categoryFilter}
        onChange={(e) => onCategoryChange(e.target.value)}
        className="flex h-9 w-[150px] rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <option value="all">All Categories</option>
        <option value="spam/phishing">Spam/Phishing</option>
        <option value="social">Social</option>
        <option value="newsletter">Newsletter</option>
        <option value="offers">Offers</option>
        <option value="billing/invoices">Billing/Invoices</option>
        <option value="work/professional">Work/Professional</option>
        <option value="personal">Personal</option>
        <option value="calendar/events">Calendar/Events</option>
        <option value="e-commerce">E-commerce</option>
        <option value="alerts">Alerts</option>
        <option value="other">Other</option>
      </select>

      <select
        value={urgencyFilter}
        onChange={(e) => onUrgencyChange(e.target.value)}
        className="flex h-9 w-[150px] rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <option value="all">Any Urgency</option>
        <option value="high">High & Critical</option>
      </select>

      <label className="flex items-center gap-2 text-sm cursor-pointer select-none text-muted-foreground hover:text-foreground">
        <input
          type="checkbox"
          checked={urgentReplyOnly}
          onChange={(e) => onUrgentReplyChange(e.target.checked)}
          className="rounded border-input text-primary focus:ring-ring cursor-pointer"
        />
        Needs Reply
      </label>

      <div className="flex-1" />

      <select
        value={sortField}
        onChange={(e) => onSortFieldChange(e.target.value as "date" | "urgency")}
        className="flex h-9 w-[140px] rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <option value="date">Sort by Date</option>
        <option value="urgency">Sort by Urgency</option>
      </select>

      <Button
        variant="outline"
        size="sm"
        onClick={() => onSortOrderChange(sortOrder === "desc" ? "asc" : "desc")}
        className="h-9 px-3 text-muted-foreground hover:text-foreground"
      >
        {sortOrder === "desc" ? "↓ Desc" : "↑ Asc"}
      </Button>
    </div>
  );
}
