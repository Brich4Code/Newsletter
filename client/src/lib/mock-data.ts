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
