import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

      <Select value={categoryFilter} onValueChange={(v) => onCategoryChange(v as string)}>
        <SelectTrigger className="w-[180px] bg-background shadow-sm hover:bg-accent hover:text-accent-foreground transition-colors">
          <SelectValue placeholder="Category" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Categories</SelectItem>
          <SelectItem value="spam/phishing">Spam/Phishing</SelectItem>
          <SelectItem value="social">Social</SelectItem>
          <SelectItem value="newsletter">Newsletter</SelectItem>
          <SelectItem value="offers">Offers</SelectItem>
          <SelectItem value="billing/invoices">Billing/Invoices</SelectItem>
          <SelectItem value="work/professional">Work/Professional</SelectItem>
          <SelectItem value="personal">Personal</SelectItem>
          <SelectItem value="calendar/events">Calendar/Events</SelectItem>
          <SelectItem value="e-commerce">E-commerce</SelectItem>
          <SelectItem value="alerts">Alerts</SelectItem>
          <SelectItem value="other">Other</SelectItem>
        </SelectContent>
      </Select>

      <Select value={urgencyFilter} onValueChange={(v) => onUrgencyChange(v as string)}>
        <SelectTrigger className="w-[160px] bg-background shadow-sm hover:bg-accent hover:text-accent-foreground transition-colors">
          <SelectValue placeholder="Urgency" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Any Urgency</SelectItem>
          <SelectItem value="high">High & Critical</SelectItem>
        </SelectContent>
      </Select>

      <label className="flex items-center gap-2 text-sm cursor-pointer select-none text-muted-foreground hover:text-foreground font-medium transition-colors">
        <Checkbox
          checked={urgentReplyOnly}
          onCheckedChange={(checked) => onUrgentReplyChange(checked as boolean)}
        />
        Needs Reply
      </label>

      <div className="flex-1" />

      <Select
        value={sortField}
        onValueChange={(v) => onSortFieldChange(v as "date" | "urgency")}
      >
        <SelectTrigger className="w-[150px] bg-background shadow-sm hover:bg-accent hover:text-accent-foreground transition-colors">
          <SelectValue placeholder="Sort By" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="date">Sort by Date</SelectItem>
          <SelectItem value="urgency">Sort by Urgency</SelectItem>
        </SelectContent>
      </Select>

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
