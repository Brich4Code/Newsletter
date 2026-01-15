import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type AgentStatus = 'idle' | 'working' | 'error' | 'offline';

export interface Agent {
  id: string;
  name: string;
  role: string;
  status: AgentStatus;
  currentTask?: string;
  efficiency: number; // 0-100
}

export type StoryStatus = 'backlog' | 'researching' | 'drafting' | 'review' | 'published';

export interface Story {
  id: string;
  title: string;
  summary: string;
  status: StoryStatus;
  priority: 'low' | 'medium' | 'high';
  assignedAgent?: string;
  lastUpdated: string;
  content?: string;
  sources?: string[];
}

export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'success';
  source: string;
  message: string;
}

export interface Lead {
  id: string;
  title: string;
  source: string;
  url: string;
  summary: string;
  relevanceScore: number;
}

export interface Challenge {
  id: string;
  title: string;
  description: string;
  type: 'coding' | 'trivia' | 'debugging';
}

export const MOCK_LEADS: Lead[] = [
  { id: 'lead-1', title: 'OpenAI Releases GPT-5 Developer Preview', source: 'The Verge', url: 'https://theverge.com', summary: 'New model features enhanced reasoning capabilities and larger context window.', relevanceScore: 98 },
  { id: 'lead-2', title: 'Python 3.14 Removes GIL', source: 'Python.org', url: 'https://python.org', summary: 'Experimental build shows 40% performance improvement in multi-threaded workloads.', relevanceScore: 95 },
  { id: 'lead-3', title: 'React 20 Introduces "Server Components by Default"', source: 'React Blog', url: 'https://react.dev', summary: 'Controversial shift in the ecosystem aiming for better performance.', relevanceScore: 92 },
  { id: 'lead-4', title: 'SpaceX Starship Successful Landing', source: 'SpaceNews', url: 'https://spacenews.com', summary: 'First successful recovery of both booster and ship.', relevanceScore: 85 },
  { id: 'lead-5', title: 'New CSS Features Landing in Chrome 140', source: 'Chrome Developers', url: 'https://developer.chrome.com', summary: 'CSS Grid masonry layout and scroll-driven animations.', relevanceScore: 88 },
  { id: 'lead-6', title: 'GitHub Copilot Workspace Now Generally Available', source: 'GitHub Blog', url: 'https://github.blog', summary: 'Full dev environment automation is here.', relevanceScore: 94 },
  { id: 'lead-7', title: 'Rust Foundation Annual Report', source: 'Rust Lang', url: 'https://rust-lang.org', summary: 'Community growth metrics and future roadmap.', relevanceScore: 75 },
  { id: 'lead-8', title: 'Apple Vision Pro 2 Leaks', source: 'MacRumors', url: 'https://macrumors.com', summary: 'Lighter weight and lower price point expected in 2026.', relevanceScore: 82 },
  { id: 'lead-9', title: 'Google DeepMind Solves Another Math Problem', source: 'Nature', url: 'https://nature.com', summary: 'AlphaGeometry 2 outperforms human gold medalists.', relevanceScore: 90 },
  { id: 'lead-10', title: 'Linux Kernel 6.14 Released', source: 'LWN.net', url: 'https://lwn.net', summary: 'Better support for ARM architecture and new file systems.', relevanceScore: 78 },
  { id: 'lead-11', title: 'The State of JS 2025 Survey Results', source: 'StateOfJS', url: 'https://stateofjs.com', summary: 'Svelte and SolidJS continue to gain traction.', relevanceScore: 89 },
  { id: 'lead-12', title: 'TypeScript 6.0 Beta', source: 'Microsoft DevBlogs', url: 'https://devblogs.microsoft.com', summary: 'breaking changes to generic inference.', relevanceScore: 91 },
  { id: 'lead-13', title: 'Amazon AWS Outage Affects East Coast', source: 'TechCrunch', url: 'https://techcrunch.com', summary: 'Major services down for 4 hours.', relevanceScore: 84 },
  { id: 'lead-14', title: 'NVIDIA Announces RTX 6090', source: 'AnandTech', url: 'https://anandtech.com', summary: 'Power consumption concerns raised by reviewers.', relevanceScore: 80 },
  { id: 'lead-15', title: 'Bun 2.0 Released', source: 'Bun.sh', url: 'https://bun.sh', summary: 'Full Node.js compatibility achieved.', relevanceScore: 87 },
];

export const MOCK_CHALLENGES: Challenge[] = [
  { id: 'ch-1', title: 'The One-Liner', description: 'Write a Python one-liner to reverse a string.', type: 'coding' },
  { id: 'ch-2', title: 'Bug Hunt', description: 'Find the memory leak in this C++ snippet.', type: 'debugging' },
  { id: 'ch-3', title: 'History Buff', description: 'Who was the first programmer?', type: 'trivia' },
  { id: 'ch-4', title: 'CSS Art', description: 'Draw a circle using only one div.', type: 'coding' },
];

export const MOCK_AGENTS: Agent[] = [
  { id: 'sc-1', name: 'ScoopHunter', role: 'Discovery', status: 'working', currentTask: 'Scanning Hacker News for AI breakthroughs', efficiency: 92 },
  { id: 'inv-1', name: 'Investigator', role: 'Research', status: 'idle', efficiency: 88 },
  { id: 'wrt-1', name: 'Writer', role: 'Content Gen', status: 'idle', efficiency: 95 },
  { id: 'ed-1', name: 'EditorialBoard', role: 'Review', status: 'working', currentTask: 'Reviewing "Quantum Computing" draft', efficiency: 99 },
  { id: 'cmp-1', name: 'Compliance', role: 'Safety', status: 'idle', efficiency: 100 },
  { id: 'ill-1', name: 'Illustrator', role: 'Assets', status: 'offline', efficiency: 0 },
];

export const MOCK_STORIES: Story[] = [
  { 
    id: 'sty-1', 
    title: 'The Rise of Agentic AI in 2026', 
    summary: 'Analysis of how autonomous agents are reshaping enterprise workflows.',
    status: 'drafting',
    priority: 'high',
    assignedAgent: 'Writer',
    lastUpdated: '2 mins ago',
    sources: ['TechCrunch', 'ArXiv', 'Replit Blog']
  },
  { 
    id: 'sty-2', 
    title: 'Python 4.0 Release Notes Leaked?', 
    summary: 'Investigating rumors about the next major Python version features.',
    status: 'researching',
    priority: 'medium',
    assignedAgent: 'Investigator',
    lastUpdated: '15 mins ago',
    sources: ['Reddit/r/python']
  },
  { 
    id: 'sty-3', 
    title: 'Top 10 VS Code Extensions for 2026', 
    summary: 'A curated list of productivity tools for developers.',
    status: 'backlog',
    priority: 'low',
    lastUpdated: '1 hour ago'
  },
  { 
    id: 'sty-4', 
    title: 'Global Chip Shortage Ends', 
    summary: 'Market analysis showing supply chain recovery.',
    status: 'published',
    priority: 'high',
    lastUpdated: '2 days ago'
  },
  {
    id: 'sty-5',
    title: 'Quantum Supremacy Achieved by startup',
    summary: 'Fact checking the claims made by Q-Start Inc.',
    status: 'review',
    priority: 'high',
    assignedAgent: 'EditorialBoard',
    lastUpdated: '5 mins ago'
  }
];

export const MOCK_LOGS: LogEntry[] = [
  { id: 'log-1', timestamp: '10:42:05', level: 'info', source: 'Orchestrator', message: 'Pipeline started for cycle #442' },
  { id: 'log-2', timestamp: '10:42:08', level: 'info', source: 'ScoopHunter', message: 'Found 12 potential leads in RSS feeds' },
  { id: 'log-3', timestamp: '10:42:15', level: 'success', source: 'LinkValidator', message: 'Verified 5/5 sources for "Quantum Computing"' },
  { id: 'log-4', timestamp: '10:43:01', level: 'warn', source: 'Investigator', message: 'Paywall encountered at nytimes.com, skipping source' },
  { id: 'log-5', timestamp: '10:43:22', level: 'info', source: 'Writer', message: 'Drafting section: "Implications for Security"' },
];
