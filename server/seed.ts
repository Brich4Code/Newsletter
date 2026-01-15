import { db } from './db';
import { leads, challenges } from '@shared/schema';

const seedLeads = [
  { title: 'OpenAI Releases GPT-5 Developer Preview', source: 'The Verge', url: 'https://theverge.com', summary: 'New model features enhanced reasoning capabilities and larger context window.', relevanceScore: 98 },
  { title: 'Python 3.14 Removes GIL', source: 'Python.org', url: 'https://python.org', summary: 'Experimental build shows 40% performance improvement in multi-threaded workloads.', relevanceScore: 95 },
  { title: 'React 20 Introduces "Server Components by Default"', source: 'React Blog', url: 'https://react.dev', summary: 'Controversial shift in the ecosystem aiming for better performance.', relevanceScore: 92 },
  { title: 'SpaceX Starship Successful Landing', source: 'SpaceNews', url: 'https://spacenews.com', summary: 'First successful recovery of both booster and ship.', relevanceScore: 85 },
  { title: 'New CSS Features Landing in Chrome 140', source: 'Chrome Developers', url: 'https://developer.chrome.com', summary: 'CSS Grid masonry layout and scroll-driven animations.', relevanceScore: 88 },
  { title: 'GitHub Copilot Workspace Now Generally Available', source: 'GitHub Blog', url: 'https://github.blog', summary: 'Full dev environment automation is here.', relevanceScore: 94 },
  { title: 'Rust Foundation Annual Report', source: 'Rust Lang', url: 'https://rust-lang.org', summary: 'Community growth metrics and future roadmap.', relevanceScore: 75 },
  { title: 'Apple Vision Pro 2 Leaks', source: 'MacRumors', url: 'https://macrumors.com', summary: 'Lighter weight and lower price point expected in 2026.', relevanceScore: 82 },
  { title: 'Google DeepMind Solves Another Math Problem', source: 'Nature', url: 'https://nature.com', summary: 'AlphaGeometry 2 outperforms human gold medalists.', relevanceScore: 90 },
  { title: 'Linux Kernel 6.14 Released', source: 'LWN.net', url: 'https://lwn.net', summary: 'Better support for ARM architecture and new file systems.', relevanceScore: 78 },
  { title: 'The State of JS 2025 Survey Results', source: 'StateOfJS', url: 'https://stateofjs.com', summary: 'Svelte and SolidJS continue to gain traction.', relevanceScore: 89 },
  { title: 'TypeScript 6.0 Beta', source: 'Microsoft DevBlogs', url: 'https://devblogs.microsoft.com', summary: 'breaking changes to generic inference.', relevanceScore: 91 },
  { title: 'Amazon AWS Outage Affects East Coast', source: 'TechCrunch', url: 'https://techcrunch.com', summary: 'Major services down for 4 hours.', relevanceScore: 84 },
  { title: 'NVIDIA Announces RTX 6090', source: 'AnandTech', url: 'https://anandtech.com', summary: 'Power consumption concerns raised by reviewers.', relevanceScore: 80 },
  { title: 'Bun 2.0 Released', source: 'Bun.sh', url: 'https://bun.sh', summary: 'Full Node.js compatibility achieved.', relevanceScore: 87 },
];

const seedChallenges = [
  { title: 'The One-Liner', description: 'Write a Python one-liner to reverse a string.', type: 'coding' },
  { title: 'Bug Hunt', description: 'Find the memory leak in this C++ snippet.', type: 'debugging' },
  { title: 'History Buff', description: 'Who was the first programmer?', type: 'trivia' },
  { title: 'CSS Art', description: 'Draw a circle using only one div.', type: 'coding' },
];

async function seed() {
  console.log('Seeding database...');
  
  // Clear existing data
  await db.delete(leads);
  await db.delete(challenges);
  
  // Insert seed data
  await db.insert(leads).values(seedLeads);
  await db.insert(challenges).values(seedChallenges);
  
  console.log('Database seeded successfully!');
  process.exit(0);
}

seed().catch((error) => {
  console.error('Error seeding database:', error);
  process.exit(1);
});
