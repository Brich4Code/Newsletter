import type { Lead, Challenge, Issue, InsertIssue } from "@shared/schema";

const API_BASE = "/api";

export async function fetchLeads(): Promise<Lead[]> {
  const response = await fetch(`${API_BASE}/leads`);
  if (!response.ok) {
    throw new Error("Failed to fetch leads");
  }
  return response.json();
}

export async function fetchChallenges(): Promise<Challenge[]> {
  const response = await fetch(`${API_BASE}/challenges`);
  if (!response.ok) {
    throw new Error("Failed to fetch challenges");
  }
  return response.json();
}

export async function publishIssue(issue: InsertIssue): Promise<Issue> {
  const response = await fetch(`${API_BASE}/issues/publish`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(issue),
  });
  
  if (!response.ok) {
    throw new Error("Failed to publish issue");
  }
  
  return response.json();
}
