# Homework 5

**CSSE 230 — Winter 2022–23**

**37 points**

## To Be Turned In

Submit to the dropbox, except the programming problems at the end which go to the repo. You may earn or use a late day for this assignment. Like all written assignments, this is an individual assignment. You may discuss it with others, but you should write (and code) your answers yourself.

### 1. Tree Height Table (12 points)

Fill in the following table. Be **very** careful to get the exact values. Most of the credit will be for the last column. Don't use the AVL approximation formula (H < 1.44log(...)). Instead, draw trees and look for the patterns, like we did on day 13 in class.

Feel free to include explanations of your answers.
correct\_answer → full\_credit.  wrong\_answer + no\_explanation → no\_credit.

> ½ point for each entry in the first two columns, and 2 points each for each entry in the last column.

| *n* | Height of shortest binary tree with *n* nodes | Height of tallest binary tree with *n* nodes | Height of tallest AVL tree with *n* nodes |
|---|---|---|---|
| 7 | 2 | 6 | 3 |
| 8 |   |   |   |
| 370 |   |   |   |
| 17000 |   |   |   |
| 50000 |   |   |   |

### 2. More Tree Practice! (25 points)

Get the starting code by accepting the GitHub Classroom invitation: [TreePracticeHW5 Invite Link](https://moodle.rose-hulman.edu/mod/url/view.php?id=3625288).

You will write three methods for Binary Trees. Like the last homework, the trick to these is to add parameters or multiple return values (through your own custom class) to your recursive helper method. Commit your work to Git as you make progress and when you finish.

#### a. Watch the Help Video

Start by watching the **HW 5 Help: Making recursion more efficient** video. It's a bit on the longer side for HW help (it's 34 minutes), but it's worth it: you'll need to use the patterns that you learn here to solve programming problems in the term project AND exam 3 AND usually again on the final exam! We'll solve `getSumOfHeights()` in two ways — then you can practice on `isHeightBalanced()`.

#### b. `getSumOfHeights`

Find the sum of the heights of every node in the tree. This is an interesting problem if you want to do it efficiently, meaning in O(n) time. Just calling `height()` on each node will give the correct answer, but it duplicates a lot of work and leads to an O(n log n) algorithm. Could you somehow combine finding the height with finding the sum of the heights in your method?

*Hint:* Don't use a field — that has a side effect of modifying each node. Instead, use either multiple return values (which I think is clean) or mutable parameters to do the trick.

*Hint:* We solved this problem step-by-step in a couple Session 12 videos back in week 4.

#### c. `isHeightBalanced`

Determine if the given tree is *height-balanced*, using the definition given in class. **For full credit**, do it efficiently, meaning in O(n) time. Like the previous problem, just calling `height()` on each node will give the correct answer, but it duplicates a lot of work and leads to an O(n log n) algorithm. Could you somehow combine finding the height with finding if the node is height-balanced in your method? See the hint on the previous problem.

#### d. Full Tree Constructor

Create a full tree of Integers whose leaves have the given depth, and where every node is labeled with its own depth. (Reminder: Full trees are those in which all the leaves have the same depth.) It is good experience to know how to build a whole tree by calling a single method. Note that due to the way it is constructed, it will not have the search property and thus not be a BST.

---

## FAQ

**Q:** I think this is the first time we have created a Tree constructor. Should I still use recursion? How can I do recursion in the Node class since there aren't nodes to recurse into?

**A:** The main pattern for any tree constructor is indeed to call a recursive helper that creates and returns a single node each time it is called! However, since there aren't nodes to recurse into, there is no good reason to do the recursion in the Node class (unlike the methods you have written previously). If you are stuck, here's a pattern that you can re-use for several constructors you'll write in the HW and project:

```java
// In constructor body:
{
    root = pickAGoodNameForYourRecursiveConstructorHelper(pass any parameters you need);
}

// A new helper:
private Node pickAGoodNameForYourRecursiveConstructorHelper(any params you need) {
    if (some stopping condition) {
        return NULL_NODE;
    }
    Node node = new Node(some data probably based on the params);
    // then set node.left and/or node.right to results of calling
    // this helper recursively, maybe changing the parameter.
    return node;
}
```

---

*Last modified: Thursday, 7 April 2022, 9:42 AM*
