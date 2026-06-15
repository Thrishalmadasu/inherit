// Reviewed archive dataset — genuine interview experiences collected from the
// SST_Intrv_Exp folder (13 PDFs + a Google-Form CSV), normalized to the shape
// db/import-archive.ts ingests. All attributed to the anonymous archive user
// (isAnonymous + importedFromArchive). Candidate names were stripped.
//
// Provenance is kept in each experience's `source`. A few source docs were
// themselves AI-formatted "experience & solutions" writeups — their approach
// notes come from the source, not invented here.

export type ArchiveBlock = {
  type: "coding" | "system_design" | "behavioral" | "open";
  prompt: string;
  detail?: string | null;
  topics?: string[];
};
export type ArchiveRound = {
  name: string;
  status: "Passed" | "Failed" | "Awaiting";
  platform?: string | null;
  blocks: ArchiveBlock[];
};
export type ArchiveTip = { category: "resource" | "strategy" | "mindset"; text: string };
export type ArchiveExperience = {
  company: string;
  role: string;
  year: number;
  outcome: "Offer" | "Shortlisted" | "Awaiting" | "Rejected" | "Withdrew";
  source: string;
  rounds: ArchiveRound[];
  tips?: ArchiveTip[];
};

// Canonical companies referenced by the archive (name + industry + aliases for
// the messy variants found in the CSV). Slugs are derived in the importer.
export const ARCHIVE_COMPANIES: { name: string; industry: string; aliases?: string[] }[] = [
  { name: "Amazon", industry: "E-commerce / Tech" },
  { name: "Rippling", industry: "HR & Fintech SaaS" },
  { name: "Media.net", industry: "Ad Tech", aliases: ["Media Net", "MediaNet"] },
  { name: "Trilogy Innovations", industry: "Software", aliases: ["Trilogy", "Triology Innovations", "Trilogy Innovation"] },
  { name: "Tasket", industry: "Software" },
  { name: "MGO", industry: "Software" },
  { name: "Wealthy", industry: "Fintech / Wealth Management" },
  { name: "Slice", industry: "Fintech" },
  { name: "Manifest AI", industry: "AI / E-commerce" },
  { name: "Emergent", industry: "AI / Developer Tools" },
  { name: "Honasa", industry: "Consumer / D2C", aliases: ["Honasa Consumer", "Mamaearth"] },
  { name: "HCL", industry: "IT Services", aliases: ["HCLTech"] },
  { name: "1Pharmacy", industry: "HealthTech", aliases: ["1pharmacy", "1pharma", "1 Pharmacy"] },
  { name: "Mastercam", industry: "Software / CAD-CAM" },
  { name: "Meant To Be", industry: "AI / ML", aliases: ["MEANT TO BE"] },
  { name: "VideoVerse", industry: "AI / Video Tech" },
  { name: "Grootin", industry: "AI / ML" },
  { name: "Umrit", industry: "AI / ML" },
  { name: "Consuma AI", industry: "AI / ML" },
  { name: "Syook", industry: "AI / Computer Vision · IoT" },
];

// AI/ML/LLD-heavy data needs topics the DSA-centric seed taxonomy lacks.
// Categories must be valid tag_category enum values (dsa|system_design|
// behavioral|tooling|domain|other).
export const ARCHIVE_TOPICS_TO_ADD: { label: string; category: string }[] = [
  { label: "Machine Learning", category: "domain" },
  { label: "LLM & RAG", category: "domain" },
  { label: "NLP", category: "domain" },
  { label: "Low-Level Design", category: "system_design" },
];

export const ARCHIVE_EXPERIENCES: ArchiveExperience[] = [
  // ─────────────────────────── Amazon (narrative writeups) ───────────────────────────
  {
    company: "Amazon",
    role: "SDE Intern",
    year: 2026,
    outcome: "Awaiting",
    source: "Amazon Interview Experience - Manan.pdf",
    rounds: [
      {
        name: "Tech + Behavioural",
        status: "Awaiting",
        blocks: [
          {
            type: "coding",
            prompt:
              "Design a data structure supporting insert(int val), remove(int val), and getRandom(). All operations should work in average O(1) time complexity.",
            topics: ["Arrays & Strings", "Hash Maps", "OOP Design"],
          },
          {
            type: "coding",
            prompt:
              "You are given a 2D array representing meeting time intervals in 24-hour format, where each interval is [start, end]. Example: [[1,2],[4,6],[3,4]]. Determine the minimum number of meeting rooms required so that all meetings can be scheduled without any overlap conflicts.",
            topics: ["Sorting", "Heap", "Two Pointers"],
          },
          {
            type: "behavioral",
            prompt:
              "Describe a time when you solved a problem that was not directly assigned to you. What was the situation, and why did you decide to take ownership? Follow-up: How did you ensure the issue would not happen again, and how did you make sure others would avoid facing the same issue?",
            topics: ["Ownership", "Leadership Principles"],
          },
          {
            type: "behavioral",
            prompt:
              "Describe a situation where you were working under a strict project deadline. Were you able to complete it on time? What trade-offs did you make, and what challenges did you face during execution?",
            topics: ["Leadership Principles", "Bias for Action"],
          },
        ],
      },
      {
        name: "Tech + Gen AI",
        status: "Awaiting",
        blocks: [
          {
            type: "coding",
            prompt: "Given two arrays, find the longest common contiguous sequence/subarray present in both arrays.",
            topics: ["Arrays & Strings", "Dynamic Programming"],
          },
          {
            type: "coding",
            prompt:
              "You are given a string s and an array of index pairs representing connections between characters. You may swap characters at the connected indices any number of times. Return the lexicographically smallest string that can be formed after performing the allowed swaps.",
            topics: ["Graphs (BFS/DFS)", "Arrays & Strings", "Sorting"],
          },
          {
            type: "behavioral",
            prompt: "Describe a time when you faced a problem and had to deep dive into a topic/technology to solve it.",
            topics: ["Leadership Principles", "Ownership"],
          },
          {
            type: "behavioral",
            prompt: "How do you use Generative AI (GenAI) in your daily life apart from coding?",
            topics: ["Work Style", "LLM & RAG"],
          },
        ],
      },
    ],
  },
  {
    company: "Amazon",
    role: "SDE Intern",
    year: 2026,
    outcome: "Awaiting",
    source: "Copy of Amazon Interview Doc - Suraj Guduru.pdf",
    rounds: [
      {
        name: "Tech + Gen AI",
        status: "Awaiting",
        blocks: [
          {
            type: "behavioral",
            prompt:
              "Walk through your project and the choices you made. Follow-up: Do you have a project where you used GenAI? (The interviewer specifically wanted a project where an LLM was used to build something, not a model trained in an AI/ML course.)",
            detail:
              "The GenAI discussion took the first ~30 mins; the interviewer was not convinced by an AI/ML-course model-building project and wanted an LLM-based build.",
            topics: ["LLM & RAG", "Work Style"],
          },
          {
            type: "coding",
            prompt:
              "Given the root of a binary tree and a target node, a fire starts spreading from the target node at time 0. At each step the fire spreads to all neighbours, until all nodes are burnt. Return the order in which nodes are burnt.",
            detail:
              "BFS from the target node, returning level-order. The trick is reaching the parent from a child since it's a binary tree, not a graph — build a child-to-parent map first.",
            topics: ["Trees", "Graphs (BFS/DFS)"],
          },
        ],
      },
      {
        name: "Tech + Behavioural",
        status: "Awaiting",
        blocks: [
          {
            type: "coding",
            prompt:
              'Given a string s and an integer k, find the length of the largest substring such that every character in that substring has a frequency >= k within it. Example: s="aaabb", k=3 -> 3 ("aaa"); s="ababbc", k=2 -> 5 ("ababb").',
            topics: ["Arrays & Strings", "Sliding Window", "Hash Maps"],
          },
          {
            type: "coding",
            prompt:
              "Given n tasks, m workers, and an array of task workloads, allocate exactly one worker per task such that each worker gets only contiguous tasks. Minimize the load of the worker with the maximum load. Example: n=4, m=2, a=[14,32,54,90] -> first 3 tasks to worker 1, last to worker 2.",
            detail: "Binary search on the answer (max allowed load), greedily partitioning into contiguous groups.",
            topics: ["Binary Search", "Arrays & Strings"],
          },
          {
            type: "behavioral",
            prompt: "Have you faced a conflict of opinions with a teammate while working? If yes, how did you resolve it?",
            topics: ["Conflict Resolution", "Leadership Principles"],
          },
          {
            type: "behavioral",
            prompt:
              "Have you ever struggled solving something for a long time and later not only did the job but exceeded expectations?",
            topics: ["Leadership Principles", "Ownership"],
          },
        ],
      },
    ],
    tips: [
      {
        category: "strategy",
        text: "For Amazon's GenAI questions, prepare a project where you used an LLM to build something (not just trained an ML model in a course) — interviewers may specifically probe for hands-on LLM application work.",
      },
      {
        category: "mindset",
        text: "Interviewers vary widely in engagement — one may be disengaged (camera off, on mute). Stay composed, drive the conversation, and explicitly prompt them when you need interaction.",
      },
    ],
  },
  {
    company: "Amazon",
    role: "SDE Intern",
    year: 2026,
    outcome: "Awaiting",
    source: "Harshit Goel 10149.pdf",
    rounds: [
      {
        name: "Tech + Gen AI",
        status: "Awaiting",
        blocks: [
          {
            type: "coding",
            prompt:
              "A variation of Longest Substring Without Repeating Characters — the classic sliding-window problem with an additional constraint on the longest valid subarray.",
            topics: ["Sliding Window", "Arrays & Strings", "Hash Maps"],
          },
          {
            type: "coding",
            prompt:
              "A variation of the Maximal Rectangle problem: instead of the maximal rectangle in a binary matrix, determine the largest square consisting entirely of 1s.",
            topics: ["Dynamic Programming"],
          },
          {
            type: "behavioral",
            prompt:
              "Describe a situation where you solved an ambiguous problem, with in-depth follow-ups on decision-making under uncertainty, prioritization, communication with mentors, and trade-offs.",
            topics: ["Leadership Principles", "Bias for Action", "Ownership"],
          },
          {
            type: "behavioral",
            prompt:
              "How do you handle sensitive data while using Generative AI tools? Explored with follow-ups on preventing data leakage, secure prompting, privacy, and safe enterprise GenAI usage.",
            topics: ["LLM & RAG", "Work Style"],
          },
        ],
      },
      {
        name: "Tech + Behavioural",
        status: "Awaiting",
        blocks: [
          {
            type: "coding",
            prompt:
              "Reverse Nodes in K-Group: reverse every group of K nodes in a linked list. If fewer than K nodes remain, leave them unchanged.",
            topics: ["Recursion"],
          },
          {
            type: "coding",
            prompt:
              "Minimum Size Subarray Sum: find the minimum length subarray whose sum is >= a given target.",
            topics: ["Sliding Window", "Two Pointers", "Arrays & Strings"],
          },
          {
            type: "behavioral",
            prompt: "Describe a time when you had to deliver something under a tight deadline.",
            topics: ["Leadership Principles", "Bias for Action"],
          },
          {
            type: "behavioral",
            prompt: "Describe a situation where you received critical feedback but disagreed with it.",
            topics: ["Leadership Principles", "Conflict Resolution"],
          },
        ],
      },
    ],
  },

  // ─────────────────────────── OA question dumps ───────────────────────────
  {
    company: "Amazon",
    role: "SDE Intern",
    year: 2026,
    outcome: "Awaiting",
    source: "Amazon OA.pdf",
    rounds: [
      {
        name: "OA",
        status: "Awaiting",
        blocks: [
          {
            type: "coding",
            prompt:
              "You process bug reports from automated testing logs. Each log has an integer bug code (duplicates allowed). Sort bug codes by decreasing importance: less frequent = higher priority; ties broken by lower code number. Preserve duplicates. Example: [8,4,6,5,4,8] -> [5,6,4,4,8,8]. Constraints: 1<=n<=2*10^5, 1<=bugs[i]<=10^9.",
            detail: "Frequency counting plus a custom comparator (frequency asc, then value asc).",
            topics: ["Hash Maps", "Sorting"],
          },
          {
            type: "coding",
            prompt:
              'Find which pairs of SKUs are most often bought together for "Frequently Bought Together" bundles. Each order is a space-separated list of SKU strings; within an order a repeated SKU counts once. Find the pair of distinct SKUs appearing together in the most orders; on ties return the lexicographically smallest pair. Example: ["B07 B08 B09","B07 B08","B08 B09"] -> ["B07","B08"].',
            detail: "Generate distinct-SKU pairs per order, count across orders in a hash map, pick max with lexicographic tie-break.",
            topics: ["Hash Maps", "Arrays & Strings"],
          },
        ],
      },
    ],
  },
  {
    company: "Rippling",
    role: "SDE Intern",
    year: 2026,
    outcome: "Awaiting",
    source: "Rippling OA.pdf",
    rounds: [
      {
        name: "OA",
        status: "Awaiting",
        blocks: [
          {
            type: "coding",
            prompt:
              "You have three groups A, B, C containing N unique integers from 1..N. Rearrange elements between groups so each group is individually sorted and, concatenated in some order, the sequence is 1,2,...,N. Moving an element costs 1. Minimize moves. Insight: each group must hold a contiguous value range; try all 6 concatenation orders.",
            detail: "Try the 6 group-order permutations; use prefix/suffix sums over [1..N] to maximize already-correct elements; answer = N - max correctly placed.",
            topics: ["Arrays & Strings", "Sorting"],
          },
          {
            type: "coding",
            prompt:
              "Given n regions with machineCount[i] servers and a target finalMachineCount of size 3, make exactly 3 regions match finalMachineCount. Ops: (1) add/remove a machine, cost 1, region must stay non-empty; (2) move all machines from one region to another, cost = shiftingCost, source removed. Minimize total cost. Example: [2,4,5,3], target [4,4,4], shiftingCost 5 -> 2.",
            detail: "Choose 3 target regions (O(n^3)), try 6 target-value permutations; per-region cost = min(direct add/remove, bulk shift).",
            topics: ["Arrays & Strings"],
          },
        ],
      },
    ],
  },
  {
    company: "Rippling",
    role: "SDE Intern",
    year: 2026,
    outcome: "Awaiting",
    source: "Rippling ReTest.pdf",
    rounds: [
      {
        name: "OA",
        status: "Awaiting",
        blocks: [
          {
            type: "coding",
            prompt:
              "Given an integer array arr of size n and integers k and x, count pairs (i,j) with i<j, arr[i]<=arr[j], and exactly k integers divisible by x in the range [arr[i], arr[j]]. Constraints: 1<=n<=10^5, 1<=arr[i]<=10^9, 1<=x<=10^9, 0<=k<=10^9.",
            detail: "Count of multiples of x in [1,v] is floor(v/x); pairs need floor(arr[j]/x) - floor((arr[i]-1)/x) == k. Count via hashing on transformed values.",
            topics: ["Arrays & Strings", "Hash Maps"],
          },
          {
            type: "coding",
            prompt:
              "Given a string s of length n, an integer x (cost per equal-character pair), and partitionCost: partition s into substrings. For each substring, for every pair (i,j) with s[i]==s[j] add x; for each partition add partitionCost. Minimize total cost. Constraints: 1<=n<=2500.",
            detail: "Interval DP over partition boundaries; precompute equal-pair cost per substring from per-character counts.",
            topics: ["Dynamic Programming", "Arrays & Strings"],
          },
        ],
      },
    ],
  },
  {
    company: "Tasket",
    role: "SDE Intern",
    year: 2026,
    outcome: "Awaiting",
    source: "Tasket OA.pdf",
    rounds: [
      {
        name: "OA",
        status: "Awaiting",
        blocks: [
          {
            type: "coding",
            prompt:
              "Integer-Based Slot Allocation Simulator: a linear array of N slots (all free initially). Process Q commands: '1 S' (allocate) finds the first free contiguous block of length >= S, allocates it and returns the start index, else -1; '2 P' (free) frees a block starting at index P returning 1, else -1. Return all command outputs in order.",
            detail: "Simulation with free-list / contiguous-block tracking.",
            topics: ["Arrays & Strings"],
          },
          {
            type: "coding",
            prompt:
              "Optimal Task Scheduling with Deadlines and Cooling Period: N tasks each take 1 unit; task i has deadline[i] and after running ID x you cannot run x again until cooldown units pass. Maximize tasks completed before their deadlines. Example: tasks=[1,2,1,2,1,3], deadline=[3,2,5,6,7,10], cooldown=2 -> 5.",
            detail: "Greedy scheduling with deadlines plus a cooldown constraint.",
            topics: ["Sorting", "Heap", "Hash Maps"],
          },
        ],
      },
    ],
  },
  {
    company: "MGO",
    role: "SDE Intern",
    year: 2026,
    outcome: "Awaiting",
    source: "MGO OA.pdf",
    rounds: [
      {
        name: "OA",
        status: "Awaiting",
        blocks: [
          {
            type: "coding",
            prompt: "Reverse the String: given a string s, reverse it and return it.",
            topics: ["Arrays & Strings", "Two Pointers"],
          },
          {
            type: "coding",
            prompt:
              'Letter Combinations of a Phone Number: given a string of digits 2-9, return all letter combinations the number could represent (keypad mapping 2->"abc" ... 9->"wxyz"), in any order.',
            topics: ["Recursion", "Arrays & Strings"],
          },
          {
            type: "coding",
            prompt:
              "Basic Calculator II: evaluate a valid expression string with non-negative integers and + - * / and spaces. Integer division truncates toward zero. No built-in eval allowed.",
            topics: ["Stacks & Queues", "Arrays & Strings"],
          },
          {
            type: "coding",
            prompt:
              "4 Keys Keyboard: keys are A, Ctrl-A (select all), Ctrl-C (copy), Ctrl-V (paste). Given n total key presses, return the maximum number of 'A' you can print.",
            topics: ["Dynamic Programming"],
          },
        ],
      },
    ],
  },
  {
    company: "Trilogy Innovations",
    role: "SDE Intern",
    year: 2026,
    outcome: "Awaiting",
    source: "Triology Innovations OA Questions.pdf",
    rounds: [
      {
        name: "OA",
        status: "Awaiting",
        blocks: [
          {
            type: "coding",
            prompt:
              "Valid Arrays Count: an array is valid if no subarray longer than B has all-identical elements; elements are in [1,C]. Count valid arrays of length A, modulo 1e9+7. Constraints: 1<=A<=1e9, 1<=B<=min(50,A), 1<=C<=1e5. Example: A=3,B=1,C=3 -> 12; A=3,B=3,C=2 -> 8.",
            detail: "Counting DP with matrix exponentiation since A can be up to 1e9.",
            topics: ["Dynamic Programming", "Recursion"],
          },
          {
            type: "coding",
            prompt:
              "Subarray Bit + XOR Updates: given arr of N integers and q queries (x,y,z): find the largest contiguous subarray starting at index x whose y-th bit is set, then XOR each of those elements with z. Print total updates after all queries. Constraints: N,q<=1e5, 1<=y<=30.",
            detail: "Bit manipulation with subarray updates.",
            topics: ["Arrays & Strings"],
          },
          {
            type: "coding",
            prompt:
              'Binary Search Failure Probability: given the flawed binary search "while(l<r){mid=(l+r)/2; if(i<mid) r=mid-1; else if(i>mid) l=mid+1; else {found; break;}}", for each query (l,r) find the probability it fails to find i chosen uniformly in [l,r]. Return P*Q^-1 mod 1e9+7.',
            detail: "Simulate the flawed search; modular arithmetic with modular inverse.",
            topics: ["Binary Search"],
          },
          {
            type: "coding",
            prompt:
              "Minimum Protective Covers (Books): A books in a line with unique thicknesses B. Cover at least one book; if you cover book i you must cover all thicker books; there must exist a subarray of size >= C where covered > uncovered. Return the minimum number of books to cover. Example: A=5, B=[2,3,5,1,4], C=3 -> 2.",
            detail: "Binary search on the thickness threshold with a sliding-window majority check.",
            topics: ["Binary Search", "Sliding Window"],
          },
        ],
      },
    ],
  },
  {
    company: "Media.net",
    role: "SDE Intern",
    year: 2026,
    outcome: "Awaiting",
    source: "Media Net SDE Questions.pdf",
    rounds: [
      {
        name: "OA",
        status: "Awaiting",
        blocks: [
          {
            type: "coding",
            prompt:
              "Root It: a tree with A vertices, vertex i has B[i] candies, edges given in C. Choose a root; move only along edges without revisiting; you may stop anywhere. For each root, record (max candies obtainable - min candies obtainable). Return the maximum over all roots. Constraints: 1<=A<=1e5.",
            detail: "Tree DP / rerooting.",
            topics: ["Trees", "Graphs (BFS/DFS)", "Dynamic Programming"],
          },
          {
            type: "coding",
            prompt:
              "Non-overlapping Subtrees: rooted tree of N vertices (root 1), values A. Subtree sum of v = sum of values in v's subtree. Find two vertex-disjoint subtrees maximizing the XOR of their subtree sums; return that max XOR (0 if none). Constraints: 2<=N<=50000.",
            detail: "Compute subtree sums, maximize XOR (typically a binary trie of candidates) with a non-overlap constraint.",
            topics: ["Trees", "Dynamic Programming", "Recursion"],
          },
          {
            type: "coding",
            prompt:
              "Orange Tax: markets connected by roads, each market sells oranges at a price; each road has an empty-cart cost; carrying oranges multiplies a road's cost by tax factor D. For each starting market find the cheapest way to buy oranges and return to start (buy locally, or travel out empty, buy, travel back loaded/taxed). Return the min cost per starting market.",
            detail: "Shortest-path / Dijkstra style: cost = price at destination + travel out + D * travel back.",
            topics: ["Graphs (BFS/DFS)", "Heap"],
          },
        ],
      },
    ],
  },
  {
    company: "Slice",
    role: "SDE Intern",
    year: 2026,
    outcome: "Awaiting",
    source: "Slice R1.pdf",
    rounds: [
      {
        name: "Technical Interview",
        status: "Awaiting",
        blocks: [
          {
            type: "coding",
            prompt:
              "Majority Party Survival: a string of 'A'/'B' (Party A / Party B). Each turn a person may eliminate one opponent or declare victory if none remain. Determine which party eventually wins. Example: \"ABABB\".",
            detail: "Two-queue simulation of indices; the smaller front index acts and eliminates the opponent, then re-queues at index+n. (Mirrors LeetCode 'Dota2 Senate'.) O(n).",
            topics: ["Stacks & Queues", "Arrays & Strings"],
          },
        ],
      },
    ],
  },
  {
    company: "Wealthy",
    role: "SDE Intern",
    year: 2026,
    outcome: "Awaiting",
    source: "Wealthy questions.pdf",
    rounds: [
      {
        name: "Technical Interview",
        status: "Awaiting",
        blocks: [
          {
            type: "open",
            prompt:
              "OOP discussion: explain Encapsulation, Inheritance, Polymorphism, Abstraction, Overloading vs Overriding, and constructor behavior. Also discussed personal projects.",
            topics: ["OOP Design"],
          },
          {
            type: "coding",
            prompt: "Find the minimum element in a rotated sorted array.",
            detail: "Binary search comparing mid with the right pointer to pick the half with the pivot. O(log n).",
            topics: ["Binary Search", "Arrays & Strings"],
          },
          {
            type: "coding",
            prompt: "Given an array with duplicate values, return all unique values.",
            detail: "Use a hash set. O(n).",
            topics: ["Hash Maps", "Arrays & Strings"],
          },
        ],
      },
      {
        name: "Product Intern",
        status: "Awaiting",
        blocks: [
          {
            type: "behavioral",
            prompt:
              "Why do you want to become a Product Manager despite a strong technical background? What does a PM do, and how would your technical background help?",
            topics: ["Role Fit", "Work Style"],
          },
          {
            type: "open",
            prompt:
              "Case study: design an expense-tracking system specifically for wealthy individuals. Why should this product exist (or not)? Who are the users, what features, and what's the business reasoning?",
            detail: "Direction: net-worth dashboard, cross-bank integration, family-office management, tax/portfolio analytics, fraud detection.",
            topics: ["Case Study"],
          },
          {
            type: "open",
            prompt:
              "Case study: design an alarm system for people who repeatedly snooze. Understand why people snooze and what interventions help.",
            detail: "Root cause is behavior change: require physical movement, QR scan in another room, adaptive timing, gamification/streaks, social accountability.",
            topics: ["Case Study"],
          },
          {
            type: "coding",
            prompt:
              "Python: add a feature that finds elements by multiple keys, sums the values of matching keys, and returns the result as a dictionary.",
            topics: ["Hash Maps"],
          },
          {
            type: "open",
            prompt: "Python viva: explain the GIL, async programming, OOP concepts, and the rotated-sorted-array binary-search logic.",
            detail: "The GIL allows only one thread to run Python bytecode at a time; async suits I/O-bound concurrency via event loops.",
            topics: ["Concurrency"],
          },
        ],
      },
      {
        name: "Frontend Round",
        status: "Awaiting",
        blocks: [
          {
            type: "open",
            prompt:
              "Build a Holy Grail layout (Header, Left Sidebar, Main, Right Sidebar, Footer) with HTML/CSS, fetch data from an API, and answer related JS/CSS questions.",
            detail: "Concepts: Flexbox/Grid, responsive design, fetch()/axios, DOM manipulation, async/await.",
            topics: ["API Design"],
          },
        ],
      },
    ],
    tips: [
      {
        category: "strategy",
        text: "Wealthy's style is practical and engineering-oriented — be ready to discuss projects, DSA fundamentals, and both frontend and backend understanding.",
      },
      {
        category: "strategy",
        text: "For the PM case studies, focus on the underlying user problem (behavior change for snoozers, premium financial management for wealthy users) rather than surface features.",
      },
    ],
  },
  {
    company: "Manifest AI",
    role: "SDE Intern",
    year: 2026,
    outcome: "Awaiting",
    source: "Manifest AI.pdf",
    rounds: [
      {
        name: "Gen AI",
        status: "Awaiting",
        blocks: [
          {
            type: "system_design",
            prompt:
              "Implement a chatbot that accepts user queries, calls external tools/APIs based on intent, returns contextual responses, and maintains conversation state. Example: weather query -> weather API; calculation -> calculator tool.",
            detail:
              "Expected components: LLM layer for intent/tool-call detection, tool registry with metadata, execution engine, memory layer, response formatter. Architecture: Frontend -> API Gateway -> Chat Orchestrator -> Tool Layer -> Response Generator. Evaluated: function/tool calling, prompt engineering, API design, error handling, conversation memory, latency.",
            topics: ["LLM & RAG", "API Design", "Machine Learning"],
          },
        ],
      },
      {
        name: "System Design",
        status: "Awaiting",
        blocks: [
          {
            type: "system_design",
            prompt:
              "Implement APIs that fetch from an in-memory cache, fall back to a persistent DB on a miss, and update the cache after retrieval. Discuss consistency, cache invalidation, performance, and scalability.",
            detail:
              "Classic cache-aside: check Redis first, on hit return, on miss query DB then populate cache. Discuss TTL/write-through invalidation, eventual consistency, Redis cluster/sharding, graceful degradation on cache failure.",
            topics: ["Caching", "API Design", "Scalability", "Database Choice", "Distributed Systems"],
          },
        ],
      },
      {
        name: "HR Round",
        status: "Awaiting",
        blocks: [
          {
            type: "behavioral",
            prompt:
              "Typical HR questions: Tell me about yourself. Why Manifest AI? What projects are you most proud of? How do you handle tight deadlines? Describe a challenging technical problem you solved. Where do you see yourself in a few years?",
            detail: "Be concise and structured; highlight ownership and impact; connect projects to the company's AI/backend domain.",
            topics: ["Ownership", "Role Fit", "Work Style"],
          },
        ],
      },
    ],
    tips: [
      {
        category: "strategy",
        text: "Manifest AI values engineers who build practical AI systems (agent/tool-calling, caching, API design) over pure theoretical ML. Prepare backend fundamentals and system design alongside AI-agent concepts.",
      },
    ],
  },

  // ─────────────────────────── CSV (Google Form responses, curated) ───────────────────────────
  {
    company: "Emergent",
    role: "Software Engineer Intern",
    year: 2026,
    outcome: "Awaiting",
    source: "Placement Repository CSV — Emergent",
    rounds: [
      {
        name: "Technical Interview",
        status: "Awaiting",
        blocks: [
          {
            type: "system_design",
            prompt:
              "Design an AI chatbot messaging thread that maintains versioned conversations: editing an earlier message should fork a new branch from that point, while older versions of each conversation remain viewable (DSA + LLD + schema design).",
            topics: ["Low-Level Design", "Database Choice", "LLM & RAG"],
          },
        ],
      },
    ],
  },
  {
    company: "Media.net",
    role: "Product Analyst",
    year: 2026,
    outcome: "Awaiting",
    source: "Placement Repository CSV — Media.net",
    rounds: [
      {
        name: "OA",
        status: "Awaiting",
        blocks: [
          {
            type: "open",
            prompt: "Probability: balls of different colours in a bag — compute the probability for the described draw.",
            topics: ["Statistics"],
          },
          {
            type: "coding",
            prompt: "SQL: write a query using CONCAT and GROUP_CONCAT to produce the required aggregated output.",
            topics: ["SQL"],
          },
        ],
      },
    ],
  },
  {
    company: "Honasa",
    role: "AI Intern",
    year: 2026,
    outcome: "Shortlisted",
    source: "Placement Repository CSV — Honasa",
    rounds: [
      {
        name: "DSA Round",
        status: "Passed",
        blocks: [
          {
            type: "coding",
            prompt: "Given two strings, check whether they consist of all the same characters.",
            topics: ["Arrays & Strings", "Hash Maps"],
          },
        ],
      },
    ],
  },
  {
    company: "Honasa",
    role: "AI Engineer",
    year: 2026,
    outcome: "Awaiting",
    source: "Placement Repository CSV — Honasa",
    rounds: [
      {
        name: "ML Round",
        status: "Awaiting",
        blocks: [
          {
            type: "open",
            prompt: "What is tokenisation? Explain the working of transformers. How can AI be used at Honasa?",
            topics: ["NLP", "Machine Learning", "LLM & RAG"],
          },
        ],
      },
    ],
  },
  {
    company: "Honasa",
    role: "AI Intern",
    year: 2026,
    outcome: "Awaiting",
    source: "Placement Repository CSV — Honasa",
    rounds: [
      {
        name: "ML Round",
        status: "Awaiting",
        blocks: [
          {
            type: "open",
            prompt:
              "What is MCP (Model Context Protocol)? What are tokens in AI — would the same word in another language produce the same token? Plus questions on your projects.",
            topics: ["LLM & RAG", "NLP", "Machine Learning"],
          },
        ],
      },
    ],
  },
  {
    company: "HCL",
    role: "AI Engineering Intern",
    year: 2026,
    outcome: "Awaiting",
    source: "Placement Repository CSV — HCL",
    rounds: [
      {
        name: "OA",
        status: "Awaiting",
        blocks: [
          {
            type: "coding",
            prompt: "Given two strings, determine whether they are anagrams of each other.",
            topics: ["Arrays & Strings", "Hash Maps", "Sorting"],
          },
        ],
      },
    ],
  },
  {
    company: "1Pharmacy",
    role: "ML Engineer",
    year: 2026,
    outcome: "Shortlisted",
    source: "Placement Repository CSV — 1Pharmacy",
    rounds: [
      {
        name: "Technical Interview",
        status: "Passed",
        blocks: [
          {
            type: "coding",
            prompt: "Find the maximum even sum possible from an array.",
            topics: ["Arrays & Strings", "Dynamic Programming"],
          },
        ],
      },
    ],
  },
  {
    company: "1Pharmacy",
    role: "AI Coding Engineer",
    year: 2026,
    outcome: "Awaiting",
    source: "Placement Repository CSV — 1Pharmacy",
    rounds: [
      {
        name: "Technical Interview",
        status: "Awaiting",
        blocks: [
          {
            type: "coding",
            prompt:
              "Debugging: given an existing text-to-embedding conversion program, find and fix the bug(s); follow-up questions on the same codebase.",
            topics: ["Machine Learning", "NLP"],
          },
        ],
      },
    ],
  },
  {
    company: "1Pharmacy",
    role: "AI Engineer",
    year: 2026,
    outcome: "Awaiting",
    source: "Placement Repository CSV — 1Pharmacy",
    rounds: [
      {
        name: "Technical Interview",
        status: "Awaiting",
        blocks: [
          {
            type: "open",
            prompt:
              "Brief your projects and prior-company experience, then fix bugs in a provided code folder (mostly dependency issues) and answer questions about that codebase.",
            topics: ["Machine Learning"],
          },
        ],
      },
    ],
  },
  {
    company: "Meant To Be",
    role: "AI/ML Engineer",
    year: 2026,
    outcome: "Awaiting",
    source: "Placement Repository CSV — Meant To Be",
    rounds: [
      {
        name: "ML Round",
        status: "Awaiting",
        blocks: [
          {
            type: "open",
            prompt:
              "ML/DL concepts: softmax, logistic regression, transformers, RNN, LSTM (and why LSTM came after RNN), positional encoding, voice/speech evaluation, and how to measure voice quality.",
            topics: ["Machine Learning", "NLP"],
          },
        ],
      },
    ],
  },
  {
    company: "Mastercam",
    role: "AI/ML Intern",
    year: 2026,
    outcome: "Awaiting",
    source: "Placement Repository CSV — Mastercam",
    rounds: [
      {
        name: "ML Round",
        status: "Awaiting",
        blocks: [
          {
            type: "open",
            prompt:
              "Explain LLM/GPT architecture and RAG architecture, give a concrete RAG use case, and walk through your resume/internship projects in detail.",
            topics: ["LLM & RAG", "Machine Learning", "NLP"],
          },
        ],
      },
    ],
  },
  {
    company: "Mastercam",
    role: "Software Engineer",
    year: 2026,
    outcome: "Awaiting",
    source: "Placement Repository CSV — Mastercam",
    rounds: [
      {
        name: "ML Round",
        status: "Awaiting",
        blocks: [
          {
            type: "system_design",
            prompt:
              "You have a large Python source codebase and want to retrieve the relevant part of the code for a given user query — design the retrieval approach (code RAG over a vector DB).",
            topics: ["LLM & RAG", "Machine Learning", "Database Choice"],
          },
        ],
      },
    ],
  },

  // ─────────────────────── AI/ML Interview Questions.pdf (by company) ───────────────────────
  {
    company: "VideoVerse",
    role: "AI/ML Intern",
    year: 2026,
    outcome: "Awaiting",
    source: "AI_ML Interview Questions.pdf — VideoVerse",
    rounds: [
      {
        name: "ML Round",
        status: "Awaiting",
        blocks: [
          {
            type: "open",
            prompt:
              "ML fundamentals: What is data augmentation? Difference between supervised and unsupervised learning. What is reinforcement learning? Difference between overfitting and underfitting. What logic do movie recommenders use?",
            topics: ["Machine Learning"],
          },
          {
            type: "open",
            prompt:
              "Assignment deep-dive: Why YOLOv8? What was your approach to the solution? Which metrics did you use to judge the model's performance?",
            topics: ["Machine Learning"],
          },
          {
            type: "open",
            prompt:
              "What is the convolution function? Which metrics can be used to judge a model? What are precision and recall — explain with real-world implications.",
            topics: ["Machine Learning", "Statistics"],
          },
        ],
      },
    ],
  },
  {
    company: "Grootin",
    role: "AI/ML Intern",
    year: 2026,
    outcome: "Awaiting",
    source: "AI_ML Interview Questions.pdf — Grootin",
    rounds: [
      {
        name: "ML Round",
        status: "Awaiting",
        blocks: [
          {
            type: "open",
            prompt:
              "What is RAG? What is semi-supervised learning? What are neural networks? Describe the whole architecture of a CNN. Something on early stopping. Confusion matrix and a metric to measure accuracy. Plus case-study-style questions.",
            topics: ["Machine Learning", "LLM & RAG"],
          },
        ],
      },
    ],
  },
  {
    company: "Umrit",
    role: "AI/ML Intern",
    year: 2026,
    outcome: "Awaiting",
    source: "AI_ML Interview Questions.pdf — Umrit",
    rounds: [
      {
        name: "Technical Interview",
        status: "Awaiting",
        blocks: [
          {
            type: "open",
            prompt:
              "What is the KNN algorithm and how does it work? The rest of the questions were based on the assignment and the approach taken for it.",
            topics: ["Machine Learning"],
          },
        ],
      },
    ],
  },
  {
    company: "Consuma AI",
    role: "AI/ML Intern",
    year: 2026,
    outcome: "Awaiting",
    source: "AI_ML Interview Questions.pdf — Consuma AI",
    rounds: [
      {
        name: "Technical Interview",
        status: "Awaiting",
        blocks: [
          {
            type: "open",
            prompt:
              "The interview focused on a web scraper and its implementation — no ML questions were asked.",
            topics: [],
          },
        ],
      },
    ],
  },
  {
    company: "Syook",
    role: "AI/ML Intern",
    year: 2026,
    outcome: "Awaiting",
    source: "AI_ML Interview Questions.pdf — Syook",
    rounds: [
      {
        name: "Technical Interview",
        status: "Awaiting",
        blocks: [
          {
            type: "open",
            prompt:
              "Computer-vision assignment deep-dive (PPE detection): Why YOLOv8? What is PascalVOC? What is XML? What is the YOLOv8 label format and how does it work? Why was conversion to YOLOv8 necessary? How was the dataset separation done and what was the cropping logic? What is Intersection over Union — is it the correct way to check person/PPE overlap here? Why train for only that many epochs? Any hyperparameter tuning? Which metrics were used to evaluate?",
            topics: ["Machine Learning"],
          },
          {
            type: "open",
            prompt:
              "ML theory: What is a CNN and how does it work? What are activation functions — explain in detail, name some and give their mathematical form. Loss functions — name some and give their math. Binary crossentropy vs sparse categorical crossentropy. Confusion matrix — what does each cell mean? When is TN more important than FP and vice versa? Precision and recall. What is the F1-score, why use it, and why the harmonic mean (with mathematical significance)?",
            topics: ["Machine Learning", "Statistics"],
          },
        ],
      },
    ],
  },
];
