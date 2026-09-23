import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import UrgencyIndicator from "./UrgencyIndicator";
import { Email } from "./EmailDetailPane";
import { Card } from "@/components/ui/card";

interface EmailTableProps {
  filteredEmails: Email[];
  totalEmailsCount: number;
  loadingEmails: boolean;
  selectedEmail: Email | null;
  onSelectEmail: (email: Email) => void;
}

export default function EmailTable({
  filteredEmails,
  totalEmailsCount,
  loadingEmails,
  selectedEmail,
  onSelectEmail,
}: EmailTableProps) {
  return (
    <Card className="flex-1 overflow-hidden flex flex-col shadow-sm">
      {loadingEmails && totalEmailsCount === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <div className="flex items-center gap-2">
            <div className="size-4 rounded-full bg-primary/20 animate-pulse" />
            <div className="size-4 rounded-full bg-primary/40 animate-pulse delay-75" />
            <div className="size-4 rounded-full bg-primary/60 animate-pulse delay-150" />
          </div>
          <p className="text-muted-foreground font-medium">
            Fetching emails from Gmail...
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <Table>
            <TableHeader className="bg-muted/50 sticky top-0 backdrop-blur-sm z-10">
              <TableRow>
                <TableHead>Subject</TableHead>
                <TableHead>From</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Urgency</TableHead>
                <TableHead>Needs Reply</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEmails.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-64">
                    <div className="flex flex-col items-center justify-center text-center gap-2">
                      <p className="text-lg font-medium text-foreground">
                        {totalEmailsCount === 0
                          ? "Your inbox is empty"
                          : "No emails match your filters"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {totalEmailsCount === 0
                          ? "We couldn't find any recent emails to classify."
                          : "Try adjusting your search term or dropdown settings."}
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredEmails.map((email) => {
                  const isSelected = selectedEmail?.id === email.id;
                  return (
                    <TableRow
                      key={email.id}
                      onClick={() => onSelectEmail(email)}
                      className={cn(
                        "cursor-pointer transition-colors",
                        isSelected && "bg-muted/50 hover:bg-muted/80"
                      )}
                    >
                      <TableCell className="font-medium max-w-[300px] truncate">
                        {email.subject || "(No Subject)"}
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-[200px] truncate">
                        {email.from}
                      </TableCell>
                      <TableCell>
                        {email.classification ? (
                          <Badge variant="secondary" className="capitalize">
                            {email.classification.category?.value || "N/A"}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">
                            -
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {email.classification ? (
                          <UrgencyIndicator
                            scoreStr={email.classification.urgency?.value}
                          />
                        ) : (
                          <span className="text-muted-foreground text-xs">
                            -
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {email.classification ? (
                          <Badge
                            variant={
                              email.classification.isUrgentReply?.value
                                ? "destructive"
                                : "secondary"
                            }
                          >
                            {email.classification.isUrgentReply?.value
                              ? "Yes"
                              : "No"}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">
                            -
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </Card>
  );
}
