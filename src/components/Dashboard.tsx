"use client";

import { signOut } from "next-auth/react";

import { useEffect, useState, useRef } from "react";
import EmailDetailPane, { Email } from "./EmailDetailPane";
import InitialSyncScreen from "./InitialSyncScreen";
import DashboardMetrics from "./DashboardMetrics";
import DashboardFilters from "./DashboardFilters";
import EmailTable from "./EmailTable";

export default function Dashboard() {
  const [emails, setEmails] = useState<Email[]>([]);
  const [loadingEmails, setLoadingEmails] = useState(false);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [isClassifying, setIsClassifying] = useState(false);
  const [classifiedCount, setClassifiedCount] = useState(0);
  const [totalTimeMs, setTotalTimeMs] = useState(0);
  const [totalCost, setTotalCost] = useState(0);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [urgencyFilter, setUrgencyFilter] = useState("all");
  const [urgentReplyOnly, setUrgentReplyOnly] = useState(false);
  const [sortField, setSortField] = useState<"date" | "urgency">("date");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");

  const [totalInboxEmails, setTotalInboxEmails] = useState(0);
  const [isInitialSyncCompleted, setIsInitialSyncCompleted] = useState(false);
  const [isRateLimited, setIsRateLimited] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);
  const emailsRef = useRef(emails);
  const loadingEmailsRef = useRef(loadingEmails);

  useEffect(() => {
    emailsRef.current = emails;
  }, [emails]);

  useEffect(() => {
    loadingEmailsRef.current = loadingEmails;
  }, [loadingEmails]);

  useEffect(() => {
    let active = true;

    async function autoFetchInbox() {
      // 1. Fetch total count
      try {
        const countRes = await fetch("/api/emails?countOnly=true");
        if (countRes.ok) {
          const { total } = await countRes.json();
          if (active) setTotalInboxEmails(total);
        } else if (countRes.status === 401) {
          signOut();
          return;
        }
      } catch (e) {
        console.error("Failed to get total emails", e);
      }

      // 2. Fetch continuously
      let currentToken: string | null = null;
      let fetchedCount = 0;
      
      if (active) setLoadingEmails(true);

      while (active) {
        try {
          const requestUrl: string = currentToken ? `/api/emails?pageToken=${currentToken}` : "/api/emails";
          const res: Response = await fetch(requestUrl);
          
          if (res.status === 401) {
            signOut();
            break;
          }
          if (res.status === 429 || res.status === 403 || res.status === 500) {
            console.warn("API quota/rate limit reached or server error. Pausing fetch for 60 seconds...");
            if (active) setIsRateLimited(true);
            await new Promise((resolve) => setTimeout(resolve, 60000));
            if (active) setIsRateLimited(false);
            continue;
          }
          if (!res.ok) {
            console.error("API error during auto-fetch", res.status);
            break;
          }
          
          const data: any = await res.json();
          
          if (active) {
            setEmails(prev => {
              const newEmails = [...prev, ...(data.emails || [])];
              fetchedCount = newEmails.length;
              return newEmails;
            });
            
            if (fetchedCount >= 200 || !data.nextPageToken) {
              setIsInitialSyncCompleted(true);
            }
          }
          
          if (!data.nextPageToken) {
            if (active) setNextPageToken(null);
            break;
          }
          currentToken = data.nextPageToken || null;
          if (active) setNextPageToken(currentToken);
        } catch (e) {
          console.error("Fetch loop failed", e);
          break;
        }
      }
      
      if (active) {
        setIsInitialSyncCompleted(true);
        setLoadingEmails(false);
      }
    }

    autoFetchInbox();

    return () => { active = false; };
  }, []);

  const startClassification = async () => {
    if (isClassifying) return;
    setIsClassifying(true);
    setClassifiedCount(0);
    setTotalTimeMs(0);
    setTotalCost(0);

    abortControllerRef.current = new AbortController();
    const startTime = Date.now();
    const runId = new Date().toISOString().replace(/[:.]/g, "-");
    let currentClassifiedCount = 0;
    let currentTotalCost = 0;
    
    const BATCH_SIZE = 5; // Process 5 emails concurrently

    let i = 0;
    while (!abortControllerRef.current?.signal.aborted) {
      const currentEmails = emailsRef.current;

      if (i >= currentEmails.length) {
        if (loadingEmailsRef.current) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          continue;
        } else {
          break;
        }
      }

      const batch = currentEmails.slice(i, i + BATCH_SIZE);
      const batchPromises = batch.map(async (email, batchIndex) => {
        const actualIndex = i + batchIndex;
        
        if (email.classification) {
          return { success: true, cost: 0 }; // Already classified
        }

        let retries = 0;
        const maxRetries = 5;
        let delay = 2000; // 2 seconds initial

        while (retries <= maxRetries) {
          try {
            const res = await fetch("/api/classify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email, runId }),
              signal: abortControllerRef.current?.signal,
            });

            if (res.ok) {
              const classification = await res.json();
              setEmails((prev) => {
                const next = [...prev];
                next[actualIndex] = { ...next[actualIndex], classification };
                return next;
              });
              return { success: true, cost: classification.cost || 0 };
            }

            // Check if it's a rate limit or overloaded error
            if (res.status === 429 || res.status === 529) {
              if (retries === maxRetries) break; // Exhausted retries
              
              console.warn(`Classification rate limited (Status: ${res.status}). Retrying email ${email.id} in ${delay}ms...`);
              
              // Wait before retrying
              await new Promise((resolve) => setTimeout(resolve, delay));
              
              retries++;
              delay *= 2; // Exponential backoff
              continue;
            }
            
            // If it's a different error (e.g. 500, 400), don't retry, just break
            break;

          } catch (e: any) {
            if (e.name === "AbortError") {
               return { success: false, cost: 0 }; // User stopped classification
            }
            
            console.error("Failed to classify email", email.id, e);
            break; // Network error or something else, don't infinitely retry
          }
        }

        return { success: false, cost: 0 };
      });

      const results = await Promise.all(batchPromises);
      
      let batchSuccess = 0;
      let batchCost = 0;
      results.forEach(r => {
        if (r.success) {
          batchSuccess++;
          batchCost += r.cost;
        }
      });
      
      currentClassifiedCount += batchSuccess;
      currentTotalCost += batchCost;
      
      setClassifiedCount(currentClassifiedCount);
      setTotalCost(currentTotalCost);
      setTotalTimeMs(Date.now() - startTime);

      i += BATCH_SIZE;
    }

    setIsClassifying(false);
  };

  const stopClassification = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsClassifying(false);
  };

  const avgTimeMs = classifiedCount > 0 ? totalTimeMs / classifiedCount : 0;

  const filteredAndSortedEmails = emails
    .filter((email) => {
      // 1. Search Term (Subject or Sender)
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchesSubject = email.subject?.toLowerCase().includes(term);
        const matchesSender = email.from?.toLowerCase().includes(term);
        if (!matchesSubject && !matchesSender) return false;
      }
      
      // 2. Category Filter
      if (categoryFilter !== "all") {
        if (email.classification?.category?.value !== categoryFilter) return false;
      }

      // 3. Urgency Filter
      if (urgencyFilter !== "all") {
        const scoreStr = email.classification?.urgency?.value;
        if (!scoreStr || scoreStr === "N/A") return false;
        
        const score = parseInt(scoreStr.split("/")[0], 10);
        const max = parseInt(scoreStr.split("/")[1], 10) || 5;
        const ratio = score / max;
        // High is 4/5 (0.8), Critical is 5/5 (1.0). So >= 0.8
        if (urgencyFilter === "high" && ratio < 0.8) return false;
      }

      // 4. Urgent Reply Only
      if (urgentReplyOnly) {
        if (email.classification?.isUrgentReply?.value !== true) return false;
      }

      return true;
    })
    .sort((a, b) => {
      if (sortField === "date") {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        return sortOrder === "asc" ? dateA - dateB : dateB - dateA;
      } else if (sortField === "urgency") {
        const getScore = (e: Email) => {
          const scoreStr = e.classification?.urgency?.value;
          if (!scoreStr || scoreStr === "N/A") return -1;
          const score = parseInt(scoreStr.split("/")[0], 10);
          const max = parseInt(scoreStr.split("/")[1], 10) || 5;
          return score / max;
        };
        const scoreA = getScore(a);
        const scoreB = getScore(b);
        return sortOrder === "asc" ? scoreA - scoreB : scoreB - scoreA;
      }
      return 0;
    });

  if (!isInitialSyncCompleted) {
    return (
      <InitialSyncScreen
        emailsCount={emails.length}
        totalInboxEmails={totalInboxEmails}
        isRateLimited={isRateLimited}
      />
    );
  }

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col p-6 h-full overflow-hidden gap-6">
        <DashboardMetrics
          emailsCount={emails.length}
          classifiedCount={classifiedCount}
          totalTimeMs={totalTimeMs}
          totalCost={totalCost}
          avgTimeMs={avgTimeMs}
          loadingEmails={loadingEmails}
          isInitialSyncCompleted={isInitialSyncCompleted}
          totalInboxEmails={totalInboxEmails}
          isClassifying={isClassifying}
          isRateLimited={isRateLimited}
          onStartClassification={startClassification}
          onStopClassification={stopClassification}
        />

        <DashboardFilters
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          categoryFilter={categoryFilter}
          onCategoryChange={setCategoryFilter}
          urgencyFilter={urgencyFilter}
          onUrgencyChange={setUrgencyFilter}
          urgentReplyOnly={urgentReplyOnly}
          onUrgentReplyChange={setUrgentReplyOnly}
          sortField={sortField}
          onSortFieldChange={setSortField}
          sortOrder={sortOrder}
          onSortOrderChange={setSortOrder}
        />

        <EmailTable
          filteredEmails={filteredAndSortedEmails}
          totalEmailsCount={emails.length}
          loadingEmails={loadingEmails}
          selectedEmail={selectedEmail}
          onSelectEmail={setSelectedEmail}
        />
      </div>

      {selectedEmail && (
        <EmailDetailPane email={selectedEmail} onClose={() => setSelectedEmail(null)} />
      )}
    </div>
  );
}
