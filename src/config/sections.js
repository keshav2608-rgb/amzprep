// Sidebar tracks and their curated resources.
// links: [title, url, description]

export const SECTIONS = [
  {
    id: "dsa", name: "DSA", sub: "1,086 frequency-ranked LeetCode problems",
    links: [
      ["Amazon SDE Interview Prep", "https://www.amazon.jobs/en/software-development-interview-prep#/", "Official coding & DSA prep hub"],
      ["Software Development Topics", "https://amazon.jobs/content/en/how-we-hire/interview-prep/software-development-topics", "Data structures, algorithms, coding topics"],
      ["SDE Online Assessment", "https://www.amazon.jobs/content/en/how-we-hire/university/sde-oa", "What the university OA looks like"],
      ["Interview Prep Lessons", "https://d36nnaydmp89fp.cloudfront.net/index.html#/lessons/ColmKI-VxVqlyHMv-n64-IGSDLtDTBn_", "Guided lesson course"]
    ]
  },
  {
    id: "leadership", name: "Leadership", sub: "Behavioral rounds & Amazon's principles",
    links: [
      ["Leadership Principles", "https://www.amazon.jobs/content/en/our-workplace/leadership-principles", "The 16 principles behind behavioral questions"],
      ["The Interview Loop", "https://www.amazon.jobs/content/en/how-we-hire/interview-loop", "How the loop works & STAR answers"],
      ["How Amazon Hires", "https://amazon.jobs/content/en/how-we-hire", "Overview of the full hiring process"]
    ]
  },
  {
    id: "sysdesign", name: "System Design", sub: "Scalability, architecture & design patterns",
    links: [
      ["System Design Primer", "https://github.com/donnemartin/system-design-primer", "Scalability, caching, DBs, load balancing"],
      ["Refactoring.Guru", "https://refactoring.guru/", "Design patterns & low-level design"],
      ["Software Development Topics", "https://amazon.jobs/content/en/how-we-hire/interview-prep/software-development-topics", "Amazon's system design expectations"]
    ]
  },
  { id: "backend", name: "Backend", sub: "Your backend notes, sketches & links", links: [] },
  { id: "internships", name: "Internships", sub: "Applications, contacts & deadlines", links: [] }
];

export const ICONS = {
  dashboard: '<path d="M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z"/>',
  dsa: '<path d="M8 6l-6 6 6 6M16 6l6 6-6 6"/>',
  leadership: '<path d="M12 2l3 6.5 7 .9-5.1 4.8 1.3 7-6.2-3.4-6.2 3.4 1.3-7L2 9.4l7-.9z"/>',
  sysdesign: '<rect x="3" y="3" width="7" height="6" rx="1"/><rect x="14" y="3" width="7" height="6" rx="1"/><rect x="8.5" y="15" width="7" height="6" rx="1"/><path d="M6.5 9v3h11V9M12 12v3"/>',
  backend: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>',
  internships: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18"/>'
};
