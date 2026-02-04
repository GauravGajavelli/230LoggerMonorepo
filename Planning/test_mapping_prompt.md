# Test Category Mapping Prompt

Use this prompt to generate test categorizations for a student submission. Run it manually, review the output, then save as `test_categories.json`.

---

## Prompt

```
You are a teaching assistant for CSSE 230 (Data Structures & Algorithms) at Rose-Hulman Institute of Technology. Your task is to categorize JUnit tests into meaningful groups that help students understand what aspect of the assignment each test is checking.

## Assignment Context
[REPLACE: Describe the assignment - e.g., "Students are implementing a Binary Search Tree with insert, delete, contains, and traversal operations"]

## Test List
Here are the tests from this submission:

[REPLACE: Paste test names, one per line, e.g.:
- BinarySearchTreeTest#testInsertSingle
- BinarySearchTreeTest#testInsertDuplicate
- BinarySearchTreeTest#testContainsAfterInsert
- BinarySearchTreeTest#testContainsEmpty
- BinarySearchTreeTest#testDeleteLeaf
- BinarySearchTreeTest#testDeleteNodeWithOneChild
- BinarySearchTreeTest#testDeleteNodeWithTwoChildren
- BinarySearchTreeTest#testInorderTraversal
- BinarySearchTreeTest#testPreorderTraversal
- BinarySearchTreeTest#testTreeHeight
- BinarySearchTreeTest#testBalancedTree
]

## Instructions

1. Create 3-6 meaningful categories based on what the tests are checking
2. Assign each test to exactly one category
3. Categories should help students understand the structure of the assignment
4. Use clear, descriptive category names
5. Include both active AND commented-out tests (students may uncomment scaffolding tests during development)

## Output Format

Return a JSON object with this structure:
{
  "categories": {
    "category_name": {
      "description": "What this category tests",
      "tests": ["testId1", "testId2"]
    }
  },
  "testToCategories": {
    "BinarySearchTreeTest#testInsertSingle": ["category_name"],
    "BinarySearchTreeTest#testInsertDuplicate": ["category_name", "secondary_category"]
  }
}

Note: `testToCategories` uses arrays - a test can belong to multiple categories.
Most tests have one category, but some (like efficiency tests) may span multiple.
Use arrays for all entries.

## Example Output

{
  "categories": {
    "basic_insert": {
      "description": "Core insert functionality - adding elements to the tree",
      "tests": ["BinarySearchTreeTest#testInsertSingle", "BinarySearchTreeTest#testInsertDuplicate"]
    },
    "search_contains": {
      "description": "Finding elements in the tree",
      "tests": ["BinarySearchTreeTest#testContainsAfterInsert", "BinarySearchTreeTest#testContainsEmpty"]
    },
    "deletion": {
      "description": "Removing elements while maintaining BST property",
      "tests": ["BinarySearchTreeTest#testDeleteLeaf", "BinarySearchTreeTest#testDeleteNodeWithOneChild", "BinarySearchTreeTest#testDeleteNodeWithTwoChildren"]
    },
    "traversal": {
      "description": "Walking the tree in different orders",
      "tests": ["BinarySearchTreeTest#testInorderTraversal", "BinarySearchTreeTest#testPreorderTraversal"]
    },
    "structure": {
      "description": "Tree shape and balance properties",
      "tests": ["BinarySearchTreeTest#testTreeHeight", "BinarySearchTreeTest#testBalancedTree"]
    }
  },
  "testToCategories": {
    "BinarySearchTreeTest#testInsertSingle": ["basic_insert"],
    "BinarySearchTreeTest#testInsertDuplicate": ["basic_insert"],
    "BinarySearchTreeTest#testContainsAfterInsert": ["search_contains"],
    "BinarySearchTreeTest#testContainsEmpty": ["search_contains"],
    "BinarySearchTreeTest#testDeleteLeaf": ["deletion"],
    "BinarySearchTreeTest#testDeleteNodeWithOneChild": ["deletion"],
    "BinarySearchTreeTest#testDeleteNodeWithTwoChildren": ["deletion"],
    "BinarySearchTreeTest#testInorderTraversal": ["traversal"],
    "BinarySearchTreeTest#testPreorderTraversal": ["traversal"],
    "BinarySearchTreeTest#testTreeHeight": ["structure"],
    "BinarySearchTreeTest#testBalancedTree": ["structure"]
  }
}
```

---

## How to Use

1. **Extract test names** from the assignment's test files:
   ```bash
   # Find all @Test methods (both active and commented)
   grep -rn "@Test" src/ --include="*Testing.java" -A 2
   ```

2. **Include commented tests** - Students may uncomment scaffolding tests during development. Include these to ensure coverage if they appear in logs:
   - Look for `// @Test` or `//	@Test` patterns
   - These are often in "ManualTesting" files meant for early development
   - Categorize them the same as their corresponding main tests

3. **Fill in the prompt** with assignment context and test list

4. **Run the prompt** through Claude (claude.ai, API, or Claude Code)

5. **Review and edit** the categorization - adjust categories to match your pedagogical goals

6. **Save output** as `test_categories.json`

7. **Run prepare** - the pipeline will read `test_categories.json` and use it

---

## Category Naming Guidelines

Good category names are:
- **Short** (1-3 words): "basic_insert", "edge_cases", "deletion"
- **Descriptive**: Tells student what aspect is being tested
- **Consistent**: Use snake_case, lowercase

Suggested category patterns for common assignments:
- **BST**: basic_insert, search_contains, deletion, traversal, edge_cases
- **AVL Tree**: basic_operations, rotations, balance_verification, edge_cases
- **Hash Table**: insertion, lookup, collision_handling, resizing, edge_cases
- **Graph**: construction, traversal_bfs, traversal_dfs, shortest_path, edge_cases
