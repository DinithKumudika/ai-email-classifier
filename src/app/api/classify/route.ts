import { NextResponse } from "next/server";
import { convert } from "html-to-text";
import fs from "fs/promises";
import path from "path";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

export async function POST(req: Request) {
  if (!OPENROUTER_API_KEY) {
    return NextResponse.json({ error: "Missing OpenRouter API Key" }, { status: 500 });
  }

  try {
    const { email, runId } = await req.json();

    if (!email || !email.body) {
      return NextResponse.json({ error: "Missing email body" }, { status: 400 });
    }

    // Strip HTML from the body to save context and improve accuracy
    const plainTextBody = convert(email.body, {
      wordwrap: 130,
      selectors: [
        { selector: 'a', options: { ignoreHref: true } },
        { selector: 'img', format: 'skip' }
      ]
    });

    const state = `
From: ${email.from}
To: ${email.to}
Subject: ${email.subject}
Date: ${email.date}

${plainTextBody.substring(0, 5000)}
    `.trim(); // Limit to 5000 chars to avoid huge inputs just in case

    const response = await fetch("https://openrouter.ai/api/v1/systemone", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "~typesafe/jev-latest",
        state: state,
        questions: {
          category: {
            type: "choice",
            instructions: "Classify the email based on its content into one of the following categories.",
            criteria: {
              "spam/phishing": "Malicious spam, phishing attempts, or unwanted promotional junk.",
              social: "Social media notifications, friend requests, or networking updates (e.g. LinkedIn, X).",
              newsletter: "Informational newsletters, blog digests, or regular subscription updates.",
              offers: "Promotional offers, marketing campaigns, and store discounts.",
              "billing/invoices": "Billing statements, invoices, payment confirmations, or subscription renewals.",
              "work/professional": "Internal team communication, project updates, professional outreach, or work-related discussions.",
              "personal": "Direct personal emails from friends, family, or personal acquaintances.",
              "calendar/events": "Calendar invites, meeting updates, event reminders, or scheduling emails.",
              "e-commerce": "E-commerce receipts, order confirmations, and shipping updates.",
              alerts: "System alerts, security warnings, quota limits, account changes, or service notifications.",
              other: "Any other emails that do not fit into the defined categories."
            }
          },
          isUrgentReply: {
            type: "noul",
            instructions: "Does this email require an action or a reply from the user within the next 24 hours?"
          },
          urgency: {
            type: "score",
            instructions: "Score the priority of this email. Use Lowest for junk/newsletters, and Critical for urgent action required today.",
            criteria: ["Lowest", "Low", "Medium", "High", "Critical"]
          }
        }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenRouter API Error:", errorText);
      return NextResponse.json({ error: "Failed to classify email" }, { status: response.status });
    }

    const data = await response.json();
    
    // OpenRouter might return the data wrapped in a choices array or directly
    let classificationData = data;
    if (data.choices && data.choices.length > 0 && data.choices[0].message?.content) {
      try {
        classificationData = JSON.parse(data.choices[0].message.content);
      } catch (e) {
        classificationData = data.choices[0].message.content;
      }
    }

    // Map Jev model output to the format expected by the frontend
    const answers = classificationData.answers || {};
    const formattedData = {
      category: answers.category ? { 
        value: answers.category.choice, 
        probability: answers.category.confidence 
      } : undefined,
      isUrgentReply: answers.isUrgentReply ? { 
        value: answers.isUrgentReply.noul > 0.5, 
        probability: answers.isUrgentReply.noul 
      } : undefined,
      urgency: answers.urgency ? { 
        value: answers.urgency.score != null ? (Math.round(answers.urgency.score) + 1).toString() + "/5" : "N/A", 
        probability: answers.urgency.confidence || 1.0
      } : undefined,
      cost: data.usage?.cost || 0,
    };

    // --- LOGGING ---
    try {
      const logsDir = path.join(process.cwd(), "logs");
      await fs.mkdir(logsDir, { recursive: true });
      
      const logId = runId || new Date().toISOString().replace(/[:.]/g, "-");
      const logFileName = `classify_run_${logId}.log`;
      
      const logLine = `[${new Date().toISOString()}] Subject: "${email.subject || '(No Subject)'}" | Category: ${formattedData.category?.value || 'N/A'} | Urgency: ${formattedData.urgency?.value || 'N/A'} | UrgentReply: ${formattedData.isUrgentReply?.value ? 'Yes' : 'No'}\n`;
      
      await fs.appendFile(path.join(logsDir, logFileName), logLine, "utf-8");
    } catch (logError) {
      console.error("Failed to write log file:", logError);
    }
    // -------------

    return NextResponse.json(formattedData);
  } catch (error: any) {
    console.error("Classification error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
