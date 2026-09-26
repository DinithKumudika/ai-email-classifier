"use client";

import React, { createContext, useContext, useState, useEffect, useRef, useMemo, ReactNode } from "react";
import { signOut } from "next-auth/react";
import { Email } from "@/components/EmailDetailPane";

interface DashboardContextType {
  emails: Email[];
  loadingEmails: boolean;
  isInitialSyncCompleted: boolean;
  totalInboxEmails: number;
  isRateLimited: boolean;
  
  isClassifying: boolean;
  classifiedCount: number;
  totalTimeMs: number;
  totalCost: number;
  avgTimeMs: number;
  
  selectedEmail: Email | null;
  setSelectedEmail: (email: Email | null) => void;
  
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  categoryFilter: string;
  setCategoryFilter: (filter: string) => void;
  urgencyFilter: string;
  setUrgencyFilter: (filter: string) => void;
  urgentReplyOnly: boolean;
  setUrgentReplyOnly: (urgent: boolean) => void;
  sortField: "date" | "urgency";
  setSortField: (field: "date" | "urgency") => void;
  sortOrder: "asc" | "desc";
  setSortOrder: (order: "asc" | "desc") => void;
  
  filteredAndSortedEmails: Email[];
  
  startClassification: () => void;
  stopClassification: () => void;
}

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

export function DashboardProvider({ children }: { children: ReactNode }) {
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
    
    const BATCH_SIZE = 5;

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
          return { success: true, cost: 0 };
        }

        let retries = 0;
        const maxRetries = 5;
        let delay = 2000;

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

            if (res.status === 429 || res.status === 529) {
              if (retries === maxRetries) break;
              
              console.warn(`Classification rate limited (Status: ${res.status}). Retrying email ${email.id} in ${delay}ms...`);
              await new Promise((resolve) => setTimeout(resolve, delay));
              retries++;
              delay *= 2;
              continue;
            }
            break;
          } catch (e: any) {
            if (e.name === "AbortError") {
               return { success: false, cost: 0 };
            }
            console.error("Failed to classify email", email.id, e);
            break;
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

  const filteredAndSortedEmails = useMemo(() => {
    return emails
      .filter((email) => {
        if (searchTerm) {
          const term = searchTerm.toLowerCase();
          const matchesSubject = email.subject?.toLowerCase().includes(term);
          const matchesSender = email.from?.toLowerCase().includes(term);
          if (!matchesSubject && !matchesSender) return false;
        }
        if (categoryFilter !== "all") {
          if (email.classification?.category?.value !== categoryFilter) return false;
        }
        if (urgencyFilter !== "all") {
          const scoreStr = email.classification?.urgency?.value;
          if (!scoreStr || scoreStr === "N/A") return false;
          const score = parseInt(scoreStr.split("/")[0], 10);
          const max = parseInt(scoreStr.split("/")[1], 10) || 5;
          const ratio = score / max;
          if (urgencyFilter === "high" && ratio < 0.8) return false;
        }
        if (urgentReplyOnly) {
          if (email.classification?.isUrgentReply?.value !== true) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortField === "date") {
          const dateA = new Date(a.date || 0).getTime();
          const dateB = new Date(b.date || 0).getTime();
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
  }, [
    emails,
    searchTerm,
    categoryFilter,
    urgencyFilter,
    urgentReplyOnly,
    sortField,
    sortOrder
  ]);

  return (
    <DashboardContext.Provider value={{
      emails,
      loadingEmails,
      isInitialSyncCompleted,
      totalInboxEmails,
      isRateLimited,
      
      isClassifying,
      classifiedCount,
      totalTimeMs,
      totalCost,
      avgTimeMs,
      
      selectedEmail,
      setSelectedEmail,
      
      searchTerm,
      setSearchTerm,
      categoryFilter,
      setCategoryFilter,
      urgencyFilter,
      setUrgencyFilter,
      urgentReplyOnly,
      setUrgentReplyOnly,
      sortField,
      setSortField,
      sortOrder,
      setSortOrder,
      
      filteredAndSortedEmails,
      
      startClassification,
      stopClassification
    }}>
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard() {
  const context = useContext(DashboardContext);
  if (context === undefined) {
    throw new Error("useDashboard must be used within a DashboardProvider");
  }
  return context;
}
