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

export async function generateChallenges(): Promise<{ message: string; challenges: Challenge[] }> {
  const response = await fetch(`${API_BASE}/challenges/generate`, {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error("Failed to generate challenges");
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

export async function startResearch(): Promise<{ status: string; message: string }> {
  const response = await fetch(`${API_BASE}/research/start`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error("Failed to start research");
  }

  return response.json();
}

export async function deleteLead(id: string): Promise<{ success: boolean }> {
  const response = await fetch(`${API_BASE}/leads/${id}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error("Failed to delete lead");
  }

  return response.json();
}

export async function deleteAllLeads(): Promise<{ success: boolean; count: number }> {
  const response = await fetch(`${API_BASE}/leads`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error("Failed to delete all leads");
  }

  return response.json();
}

export async function createLead(lead: {
  title: string;
  source: string;
  url: string;
  summary: string;
  relevanceScore?: number;
  note?: string;
  isManual?: boolean;
}): Promise<Lead> {
  const response = await fetch(`${API_BASE}/leads`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ...lead,
      relevanceScore: lead.relevanceScore ?? 100,
      isManual: lead.isManual ?? true,
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to create lead");
  }

  return response.json();
}

export async function updateLeadNote(id: string, note: string): Promise<Lead> {
  const response = await fetch(`${API_BASE}/leads/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ note }),
  });

  if (!response.ok) {
    throw new Error("Failed to update lead note");
  }

  return response.json();
}
