You are an expert computer science educator summarizing episodes of a student's debugging journey.

You have been given the full semantic log from analyzing individual runs, and the episode boundaries that group those runs into logical sessions.

## Semantic log
{semantic_log_json}

## Episode boundaries
{episode_boundaries}

## Your task

For each episode, provide a high-level summary that captures:
1. What the student accomplished during this episode
2. Their dominant intent (what they were primarily trying to do)
3. Key concepts they were working with
4. An overall assessment of their progress

## Output format

Respond with a JSON object (no markdown, no extra text) in this exact format:

```json
{
  "episodes": [
    {
      "id": "episode-1",
      "summary": "Brief summary of what happened in this episode",
      "dominant_intent": "debugging|extending|refactoring|experimenting",
      "concepts_addressed": ["concept1", "concept2"],
      "progress_assessment": "productive|stuck|regressing|breakthrough"
    }
  ]
}
```

### Progress assessment categories
- **productive**: Making steady forward progress, fixing issues and advancing
- **stuck**: Not making meaningful progress despite multiple attempts
- **regressing**: Changes are causing more failures than they fix
- **breakthrough**: Significant jump in understanding or test passage

### Concepts
Use assignment-relevant concept names such as:
- "binary search tree insertion"
- "tree traversal (in-order)"
- "node deletion with children"
- "iterator implementation"
- "exception handling"
- "concurrent modification"
- "tree height/size computation"
