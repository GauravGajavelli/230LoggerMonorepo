# CSSE 230 — Homework 6

**40 points**

---

1. **(10 points)** Let S(H) denote the minimum number of nodes in a height-balanced tree of height H. Prove that S(H) = Fib(H+3) − 1 for all H ≥ 0 by induction.

   **Hint:** We observed in class that S(H) = S(H−1) + S(H−2) + 1. Use this observation in your proof. (If you missed this observation, you should review it, asking for help if needed, until you convince yourself this is true.)

   Here are a couple of supplementary online resources on induction that I like:
   - [Video demo](https://www.youtube.com/watch?v=ruBnYcLzVlU)
   - [Web page](http://www.purplemath.com/modules/inductn.htm) — this page does a few examples, and explains more about why it works with a couple of cool examples showing what happens if you use math induction incorrectly!

2. **(10 points)** Height-balanced (AVL) trees guarantee that the difference in height between subtrees is limited to at most one. But how different could the relative *sizes* of AVL subtrees be?

   Answer this question by considering an AVL tree of height H, where the root has left subtree T_L of as small a size as possible and right subtree T_R of as large a size as possible. Compute formulas (in terms of H) for the sizes of T_L and T_R, and take the ratio N(T_R) / N(T_L) of their sizes. Then take the limit of this ratio as H increases. Is the ratio of sizes limited to a constant, or can it grow arbitrarily large?

3. **(20 points)** Get the starting code by accepting the GitHub Classroom invitation: [PreOrderBuildTree Invite Link](https://moodle.rose-hulman.edu/mod/url/view.php?id=3625291).

   In this problem, you'll create another Binary Tree constructor, one that constructs a Tree with Character data from two pre-order lists: a string of data and a string of children.

   For example:
   - `t = BinaryTree("abc", "200")` would create a full tree of height 1 with root = `a` and two children `b` and `c`.
   - `t = BinaryTree("cbad", "2L00")` would create the minimum height-balanced tree of height 2, with an in-order traversal of `"abcd"`.

   As a larger example, the following tree was built from the strings `"ARGEDFKJHWS"` and `"R22200LL0L0"`:

   ![Example tree for preorder build](https://moodle.rose-hulman.edu/pluginfile.php/4358569/mod_page/content/9/HW6preorder.png?time=1630293264837)

   This format should sound familiar — **see HW3** and its solution for more details. Note that this can construct any binary tree of characters, not just BSTs. If you're stuck, you may visit [Homework 6 hints](https://moodle.rose-hulman.edu/mod/page/view.php?id=3624769), but I strongly suggest that you try to develop an algorithm independently first.

---

*Last modified: Monday, 17 January 2022, 9:26 AM*
