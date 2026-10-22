// Static configuration for the DSA tracker.

// localStorage key prefix for per-user progress; the full key is `${TRACKER_KEY}:${username}`.
// Kept identical to the original standalone tracker so existing progress carries over.
export const TRACKER_KEY = "leetcode_tracker_data_v1";

export const BLIND_75 = new Set([
  "Two Sum", "Best Time to Buy and Sell Stock", "Contains Duplicate", "Product of Array Except Self",
  "Maximum Subarray", "Maximum Product Subarray", "Find Minimum in Rotated Sorted Array",
  "Search in Rotated Sorted Array", "3Sum", "Container With Most Water", "Sum of Two Integers",
  "Number of 1 Bits", "Counting Bits", "Missing Number", "Reverse Bits", "Climbing Stairs",
  "Coin Change", "Longest Increasing Subsequence", "Longest Common Subsequence", "Word Break",
  "Combination Sum", "House Robber", "House Robber II", "Decode Ways", "Unique Paths",
  "Jump Game", "Clone Graph", "Course Schedule", "Pacific Atlantic Water Flow", "Number of Islands",
  "Longest Consecutive Sequence", "Alien Dictionary", "Graph Valid Tree", "Number of Connected Components in an Undirected Graph",
  "Insert Interval", "Merge Intervals", "Non-overlapping Intervals", "Meeting Rooms", "Meeting Rooms II",
  "Reverse Linked List", "Linked List Cycle", "Merge Two Sorted Lists", "Merge k Sorted Lists",
  "Remove Nth Node From End of List", "Reorder List", "Set Matrix Zeroes", "Spiral Matrix",
  "Rotate Image", "Word Search", "Longest Substring Without Repeating Characters",
  "Longest Repeating Character Replacement", "Minimum Window Substring", "Valid Anagram",
  "Group Anagrams", "Valid Parentheses", "Valid Palindrome", "Longest Palindromic Substring",
  "Palindromic Substrings", "Invert Binary Tree", "Maximum Depth of Binary Tree", "Same Tree",
  "Subtree of Another Tree", "Lowest Common Ancestor of a Binary Search Tree",
  "Binary Tree Level Order Traversal", "Validate Binary Search Tree", "Kth Smallest Element in a BST",
  "Construct Binary Tree from Preorder and Inorder Traversal", "Binary Tree Maximum Path Sum",
  "Serialize and Deserialize Binary Tree", "Implement Trie (Prefix Tree)",
  "Design Add and Search Words Data Structure", "Word Search II", "Top K Frequent Elements",
  "Find Median from Data Stream"
]);

export const PRESETS = [
  ["all", "All problems"], ["top50", "Top 50"], ["top100", "Top 100"], ["blind75", "Core 75"],
  ["dp", "Dynamic Programming"], ["graphs", "Trees & Graphs"], ["window", "Two Pointers & Window"],
  ["starred", "Starred"], ["notes", "With notes"]
];

export const GRAPH_TOPICS = ["Tree", "Binary Tree", "Graph Theory", "Depth-First Search", "Breadth-First Search"];

export const STATUS_LABEL = { todo: "To do", in_progress: "Attempting", completed: "Solved" };
export const CONFIDENCE_LABEL = ["Needs practice", "Shaky", "Confident", "Mastered"];
