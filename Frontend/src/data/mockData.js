// Mock data for DSA Feedback Tool demo
// This simulates a student's journey debugging an AVL tree implementation

export const mockStudents = [
  { id: 'S001', name: 'Student Alpha', submissionCount: 8 },
  { id: 'S002', name: 'Student Beta', submissionCount: 5 },
  { id: 'S003', name: 'Student Gamma', submissionCount: 12 },
];

export const mockAssignments = [
  { id: 'avl', name: 'AVL Tree Implementation', dueDate: '2024-01-20' },
  { id: 'heap', name: 'Binary Heap Operations', dueDate: '2024-01-27' },
  { id: 'graph', name: 'Graph Traversal', dueDate: '2024-02-03' },
];

// Simulated progression of a student fixing an AVL tree implementation
export const mockSubmissions = [
  {
    id: 'sub_001',
    studentId: 'S001',
    assignmentId: 'avl',
    timestamp: '2024-01-15T14:30:00Z',
    files: [
      {
        name: 'AVLTree.java',
        language: 'java',
        content: `public class AVLTree<T extends Comparable<T>> {
    private Node root;

    private class Node {
        T data;
        Node left, right;
        int height;

        Node(T data) {
            this.data = data;
            this.height = 1;
        }
    }

    public void insert(T value) {
        root = insertRec(root, value);
    }

    private Node insertRec(Node node, T value) {
        if (node == null) {
            return new Node(value);
        }

        int cmp = value.compareTo(node.data);
        if (cmp < 0) {
            node.left = insertRec(node.left, value);
        } else if (cmp > 0) {
            node.right = insertRec(node.right, value);
        }

        return node;  // Missing height update and balancing!
    }

    public int height() {
        return height(root);
    }

    private int height(Node node) {
        return node == null ? 0 : node.height;
    }
}`
      },
      {
        name: 'TreeNode.java',
        language: 'java',
        content: `public class TreeNode<T> {
    T data;
    TreeNode<T> left;
    TreeNode<T> right;
    int height;

    public TreeNode(T data) {
        this.data = data;
        this.height = 1;
        this.left = null;
        this.right = null;
    }

    public T getData() {
        return data;
    }

    public void setData(T data) {
        this.data = data;
    }
}`
      },
      {
        name: 'AVLTreeTest.java',
        language: 'java',
        content: `import org.junit.Test;
import static org.junit.Assert.*;

public class AVLTreeTest {

    @Test
    public void testInsert() {
        AVLTree<Integer> tree = new AVLTree<>();
        tree.insert(10);
        tree.insert(20);
        tree.insert(5);
        assertEquals(2, tree.height());
    }

    @Test
    public void testBalanceAfterRightInsertions() {
        AVLTree<Integer> tree = new AVLTree<>();
        tree.insert(1);
        tree.insert(2);
        tree.insert(3);
        assertTrue("Tree height <= 2 for 3 elements", tree.height() <= 2);
    }
}`
      }
    ],
    testResults: {
      passed: 3,
      failed: 5,
      total: 8,
      failures: [
        {
          testName: 'testBalanceAfterRightInsertions',
          expected: 'Tree height <= 2 for 3 elements',
          actual: 'Tree height = 3',
          stackTrace: `java.lang.AssertionError: Tree should be balanced
  expected: height <= 2
  actual: height = 3
    at AVLTreeTest.testBalanceAfterRightInsertions(AVLTreeTest.java:45)
    at java.base/jdk.internal.reflect.NativeMethodAccessorImpl.invoke0(Native)
    at org.junit.runners.model.FrameworkMethod$1.runReflectiveCall(FrameworkMethod.java:59)`
        },
        {
          testName: 'testBalanceAfterLeftInsertions',
          expected: 'Tree height <= 2 for 3 elements',
          actual: 'Tree height = 3',
          stackTrace: `java.lang.AssertionError: Tree should be balanced
  expected: height <= 2
  actual: height = 3
    at AVLTreeTest.testBalanceAfterLeftInsertions(AVLTreeTest.java:52)`
        },
        {
          testName: 'testHeightUpdate',
          expected: 'Node height = 2',
          actual: 'Node height = 1',
          stackTrace: `java.lang.AssertionError: Height not updated after insertion
    at AVLTreeTest.testHeightUpdate(AVLTreeTest.java:60)`
        },
        {
          testName: 'testLeftRotation',
          expected: 'Root changes after right-heavy insertion',
          actual: 'Root unchanged',
          stackTrace: `java.lang.AssertionError: Expected rotation did not occur
    at AVLTreeTest.testLeftRotation(AVLTreeTest.java:75)`
        },
        {
          testName: 'testRightRotation',
          expected: 'Root changes after left-heavy insertion',
          actual: 'Root unchanged',
          stackTrace: `java.lang.AssertionError: Expected rotation did not occur
    at AVLTreeTest.testRightRotation(AVLTreeTest.java:82)`
        }
      ]
    },
    status: 'fail'
  },
  {
    id: 'sub_002',
    studentId: 'S001',
    assignmentId: 'avl',
    timestamp: '2024-01-15T15:45:00Z',
    files: [
      {
        name: 'AVLTree.java',
        language: 'java',
        content: `public class AVLTree<T extends Comparable<T>> {
    private Node root;

    private class Node {
        T data;
        Node left, right;
        int height;

        Node(T data) {
            this.data = data;
            this.height = 1;
        }
    }

    public void insert(T value) {
        root = insertRec(root, value);
    }

    private Node insertRec(Node node, T value) {
        if (node == null) {
            return new Node(value);
        }

        int cmp = value.compareTo(node.data);
        if (cmp < 0) {
            node.left = insertRec(node.left, value);
        } else if (cmp > 0) {
            node.right = insertRec(node.right, value);
        }

        // Added height update
        node.height = 1 + Math.max(height(node.left), height(node.right));

        return node;  // Still missing balancing
    }

    public int height() {
        return height(root);
    }

    private int height(Node node) {
        return node == null ? 0 : node.height;
    }
}`
      },
      {
        name: 'TreeNode.java',
        language: 'java',
        content: `public class TreeNode<T> {
    T data;
    TreeNode<T> left;
    TreeNode<T> right;
    int height;

    public TreeNode(T data) {
        this.data = data;
        this.height = 1;
        this.left = null;
        this.right = null;
    }

    public T getData() {
        return data;
    }

    public void setData(T data) {
        this.data = data;
    }
}`
      },
      {
        name: 'AVLTreeTest.java',
        language: 'java',
        content: `import org.junit.Test;
import static org.junit.Assert.*;

public class AVLTreeTest {

    @Test
    public void testInsert() {
        AVLTree<Integer> tree = new AVLTree<>();
        tree.insert(10);
        tree.insert(20);
        tree.insert(5);
        assertEquals(2, tree.height());
    }

    @Test
    public void testBalanceAfterRightInsertions() {
        AVLTree<Integer> tree = new AVLTree<>();
        tree.insert(1);
        tree.insert(2);
        tree.insert(3);
        assertTrue("Tree height <= 2 for 3 elements", tree.height() <= 2);
    }

    @Test
    public void testHeightUpdate() {
        AVLTree<Integer> tree = new AVLTree<>();
        tree.insert(10);
        tree.insert(20);
        assertEquals(2, tree.height());
    }
}`
      }
    ],
    testResults: {
      passed: 4,
      failed: 4,
      total: 8,
      failures: [
        {
          testName: 'testBalanceAfterRightInsertions',
          expected: 'Tree height <= 2 for 3 elements',
          actual: 'Tree height = 3',
          stackTrace: `java.lang.AssertionError: Tree should be balanced
    at AVLTreeTest.testBalanceAfterRightInsertions(AVLTreeTest.java:45)`
        },
        {
          testName: 'testBalanceAfterLeftInsertions',
          expected: 'Tree height <= 2 for 3 elements',
          actual: 'Tree height = 3',
          stackTrace: `java.lang.AssertionError: Tree should be balanced
    at AVLTreeTest.testBalanceAfterLeftInsertions(AVLTreeTest.java:52)`
        },
        {
          testName: 'testLeftRotation',
          expected: 'Root changes after right-heavy insertion',
          actual: 'Root unchanged',
          stackTrace: `java.lang.AssertionError: Expected rotation did not occur
    at AVLTreeTest.testLeftRotation(AVLTreeTest.java:75)`
        },
        {
          testName: 'testRightRotation',
          expected: 'Root changes after left-heavy insertion',
          actual: 'Root unchanged',
          stackTrace: `java.lang.AssertionError: Expected rotation did not occur
    at AVLTreeTest.testRightRotation(AVLTreeTest.java:82)`
        }
      ]
    },
    status: 'fail'
  },
  {
    id: 'sub_003',
    studentId: 'S001',
    assignmentId: 'avl',
    timestamp: '2024-01-15T16:20:00Z',
    files: [
      {
        name: 'AVLTree.java',
        language: 'java',
        content: `public class AVLTree<T extends Comparable<T>> {
    private Node root;

    private class Node {
        T data;
        Node left, right;
        int height;

        Node(T data) {
            this.data = data;
            this.height = 1;
        }
    }

    public void insert(T value) {
        root = insertRec(root, value);
    }

    private Node insertRec(Node node, T value) {
        if (node == null) {
            return new Node(value);
        }

        int cmp = value.compareTo(node.data);
        if (cmp < 0) {
            node.left = insertRec(node.left, value);
        } else if (cmp > 0) {
            node.right = insertRec(node.right, value);
        }

        node.height = 1 + Math.max(height(node.left), height(node.right));

        // Added balance check and rotation
        int balance = getBalance(node);

        // Left heavy
        if (balance > 1) {
            return rotateRight(node);
        }
        // Right heavy
        if (balance < -1) {
            return rotateLeft(node);
        }

        return node;
    }

    private int getBalance(Node node) {
        return node == null ? 0 : height(node.left) - height(node.right);
    }

    private Node rotateRight(Node y) {
        Node x = y.left;
        Node T2 = x.right;

        x.right = y;
        y.left = T2;

        y.height = 1 + Math.max(height(y.left), height(y.right));
        x.height = 1 + Math.max(height(x.left), height(x.right));

        return x;
    }

    private Node rotateLeft(Node x) {
        Node y = x.right;
        Node T2 = y.left;

        y.left = x;
        x.right = T2;

        x.height = 1 + Math.max(height(x.left), height(x.right));
        y.height = 1 + Math.max(height(y.left), height(y.right));

        return y;
    }

    public int height() {
        return height(root);
    }

    private int height(Node node) {
        return node == null ? 0 : node.height;
    }
}`
      },
      {
        name: 'TreeNode.java',
        language: 'java',
        content: `public class TreeNode<T> {
    T data;
    TreeNode<T> left;
    TreeNode<T> right;
    int height;

    public TreeNode(T data) {
        this.data = data;
        this.height = 1;
        this.left = null;
        this.right = null;
    }

    public T getData() {
        return data;
    }

    public void setData(T data) {
        this.data = data;
    }
}`
      },
      {
        name: 'AVLTreeTest.java',
        language: 'java',
        content: `import org.junit.Test;
import static org.junit.Assert.*;

public class AVLTreeTest {

    @Test
    public void testInsert() {
        AVLTree<Integer> tree = new AVLTree<>();
        tree.insert(10);
        tree.insert(20);
        tree.insert(5);
        assertEquals(2, tree.height());
    }

    @Test
    public void testBalanceAfterRightInsertions() {
        AVLTree<Integer> tree = new AVLTree<>();
        tree.insert(1);
        tree.insert(2);
        tree.insert(3);
        assertTrue("Tree height <= 2 for 3 elements", tree.height() <= 2);
    }

    @Test
    public void testLeftRotation() {
        AVLTree<Integer> tree = new AVLTree<>();
        tree.insert(1);
        tree.insert(2);
        tree.insert(3);
        // Root should now be 2
    }

    @Test
    public void testRightRotation() {
        AVLTree<Integer> tree = new AVLTree<>();
        tree.insert(3);
        tree.insert(2);
        tree.insert(1);
        // Root should now be 2
    }
}`
      }
    ],
    testResults: {
      passed: 6,
      failed: 2,
      total: 8,
      failures: [
        {
          testName: 'testLeftRightCase',
          expected: 'Correct structure after LR rotation',
          actual: 'Incorrect structure',
          stackTrace: `java.lang.AssertionError: Double rotation case not handled
    at AVLTreeTest.testLeftRightCase(AVLTreeTest.java:90)`
        },
        {
          testName: 'testRightLeftCase',
          expected: 'Correct structure after RL rotation',
          actual: 'Incorrect structure',
          stackTrace: `java.lang.AssertionError: Double rotation case not handled
    at AVLTreeTest.testRightLeftCase(AVLTreeTest.java:98)`
        }
      ]
    },
    status: 'fail'
  },
  {
    id: 'sub_004',
    studentId: 'S001',
    assignmentId: 'avl',
    timestamp: '2024-01-15T17:00:00Z',
    files: [
      {
        name: 'AVLTree.java',
        language: 'java',
        content: `public class AVLTree<T extends Comparable<T>> {
    private Node root;

    private class Node {
        T data;
        Node left, right;
        int height;

        Node(T data) {
            this.data = data;
            this.height = 1;
        }
    }

    public void insert(T value) {
        root = insertRec(root, value);
    }

    private Node insertRec(Node node, T value) {
        if (node == null) {
            return new Node(value);
        }

        int cmp = value.compareTo(node.data);
        if (cmp < 0) {
            node.left = insertRec(node.left, value);
        } else if (cmp > 0) {
            node.right = insertRec(node.right, value);
        }

        node.height = 1 + Math.max(height(node.left), height(node.right));

        int balance = getBalance(node);

        // Left Left Case
        if (balance > 1 && value.compareTo(node.left.data) < 0) {
            return rotateRight(node);
        }

        // Right Right Case
        if (balance < -1 && value.compareTo(node.right.data) > 0) {
            return rotateLeft(node);
        }

        // Left Right Case
        if (balance > 1 && value.compareTo(node.left.data) > 0) {
            node.left = rotateLeft(node.left);
            return rotateRight(node);
        }

        // Right Left Case
        if (balance < -1 && value.compareTo(node.right.data) < 0) {
            node.right = rotateRight(node.right);
            return rotateLeft(node);
        }

        return node;
    }

    private int getBalance(Node node) {
        return node == null ? 0 : height(node.left) - height(node.right);
    }

    private Node rotateRight(Node y) {
        Node x = y.left;
        Node T2 = x.right;

        x.right = y;
        y.left = T2;

        y.height = 1 + Math.max(height(y.left), height(y.right));
        x.height = 1 + Math.max(height(x.left), height(x.right));

        return x;
    }

    private Node rotateLeft(Node x) {
        Node y = x.right;
        Node T2 = y.left;

        y.left = x;
        x.right = T2;

        x.height = 1 + Math.max(height(x.left), height(x.right));
        y.height = 1 + Math.max(height(y.left), height(y.right));

        return y;
    }

    public int height() {
        return height(root);
    }

    private int height(Node node) {
        return node == null ? 0 : node.height;
    }
}`
      },
      {
        name: 'TreeNode.java',
        language: 'java',
        content: `public class TreeNode<T> {
    T data;
    TreeNode<T> left;
    TreeNode<T> right;
    int height;

    public TreeNode(T data) {
        this.data = data;
        this.height = 1;
        this.left = null;
        this.right = null;
    }

    public T getData() {
        return data;
    }

    public void setData(T data) {
        this.data = data;
    }
}`
      },
      {
        name: 'AVLTreeTest.java',
        language: 'java',
        content: `import org.junit.Test;
import static org.junit.Assert.*;

public class AVLTreeTest {

    @Test
    public void testInsert() {
        AVLTree<Integer> tree = new AVLTree<>();
        tree.insert(10);
        tree.insert(20);
        tree.insert(5);
        assertEquals(2, tree.height());
    }

    @Test
    public void testAllRotationCases() {
        AVLTree<Integer> tree = new AVLTree<>();
        // LL case
        tree.insert(30);
        tree.insert(20);
        tree.insert(10);
        // RR case
        tree.insert(40);
        tree.insert(50);
        // LR case
        tree.insert(25);
        // RL case
        tree.insert(35);
        assertTrue(tree.height() <= 4);
    }
}`
      }
    ],
    testResults: {
      passed: 8,
      failed: 0,
      total: 8,
      failures: []
    },
    status: 'pass'
  },
  {
    id: 'sub_005',
    studentId: 'S001',
    assignmentId: 'avl',
    timestamp: '2024-01-15T18:30:00Z',
    files: [
      {
        name: 'AVLTree.java',
        language: 'java',
        content: `public class AVLTree<T extends Comparable<T>> {
    private Node root;
    private int size;

    private class Node {
        T data;
        Node left, right;
        int height;

        Node(T data) {
            this.data = data;
            this.height = 1;
        }
    }

    public void insert(T value) {
        root = insertRec(root, value);
        size++;
    }

    private Node insertRec(Node node, T value) {
        if (node == null) {
            return new Node(value);
        }

        int cmp = value.compareTo(node.data);
        if (cmp < 0) {
            node.left = insertRec(node.left, value);
        } else if (cmp > 0) {
            node.right = insertRec(node.right, value);
        } else {
            return node; // Duplicate - don't insert
        }

        node.height = 1 + Math.max(height(node.left), height(node.right));

        int balance = getBalance(node);

        // Left Left Case
        if (balance > 1 && value.compareTo(node.left.data) < 0) {
            return rotateRight(node);
        }

        // Right Right Case
        if (balance < -1 && value.compareTo(node.right.data) > 0) {
            return rotateLeft(node);
        }

        // Left Right Case
        if (balance > 1 && value.compareTo(node.left.data) > 0) {
            node.left = rotateLeft(node.left);
            return rotateRight(node);
        }

        // Right Left Case
        if (balance < -1 && value.compareTo(node.right.data) < 0) {
            node.right = rotateRight(node.right);
            return rotateLeft(node);
        }

        return node;
    }

    public boolean contains(T value) {
        return containsRec(root, value);
    }

    private boolean containsRec(Node node, T value) {
        if (node == null) return false;
        int cmp = value.compareTo(node.data);
        if (cmp < 0) return containsRec(node.left, value);
        if (cmp > 0) return containsRec(node.right, value);
        return true;
    }

    public int size() {
        return size;
    }

    private int getBalance(Node node) {
        return node == null ? 0 : height(node.left) - height(node.right);
    }

    private Node rotateRight(Node y) {
        Node x = y.left;
        Node T2 = x.right;

        x.right = y;
        y.left = T2;

        y.height = 1 + Math.max(height(y.left), height(y.right));
        x.height = 1 + Math.max(height(x.left), height(x.right));

        return x;
    }

    private Node rotateLeft(Node x) {
        Node y = x.right;
        Node T2 = y.left;

        y.left = x;
        x.right = T2;

        x.height = 1 + Math.max(height(x.left), height(x.right));
        y.height = 1 + Math.max(height(y.left), height(y.right));

        return y;
    }

    public int height() {
        return height(root);
    }

    private int height(Node node) {
        return node == null ? 0 : node.height;
    }
}`
      },
      {
        name: 'TreeNode.java',
        language: 'java',
        content: `public class TreeNode<T> {
    T data;
    TreeNode<T> left;
    TreeNode<T> right;
    int height;

    public TreeNode(T data) {
        this.data = data;
        this.height = 1;
        this.left = null;
        this.right = null;
    }

    public T getData() {
        return data;
    }

    public void setData(T data) {
        this.data = data;
    }

    public int getHeight() {
        return height;
    }

    public void setHeight(int height) {
        this.height = height;
    }
}`
      },
      {
        name: 'AVLTreeTest.java',
        language: 'java',
        content: `import org.junit.Test;
import static org.junit.Assert.*;

public class AVLTreeTest {

    @Test
    public void testInsert() {
        AVLTree<Integer> tree = new AVLTree<>();
        tree.insert(10);
        tree.insert(20);
        tree.insert(5);
        assertEquals(2, tree.height());
    }

    @Test
    public void testContains() {
        AVLTree<Integer> tree = new AVLTree<>();
        tree.insert(10);
        tree.insert(20);
        assertTrue(tree.contains(10));
        assertTrue(tree.contains(20));
        assertFalse(tree.contains(30));
    }

    @Test
    public void testSize() {
        AVLTree<Integer> tree = new AVLTree<>();
        assertEquals(0, tree.size());
        tree.insert(10);
        assertEquals(1, tree.size());
        tree.insert(20);
        assertEquals(2, tree.size());
    }

    @Test
    public void testAllRotationCases() {
        AVLTree<Integer> tree = new AVLTree<>();
        tree.insert(30);
        tree.insert(20);
        tree.insert(10);
        tree.insert(40);
        tree.insert(50);
        tree.insert(25);
        tree.insert(35);
        assertTrue(tree.height() <= 4);
    }
}`
      }
    ],
    testResults: {
      passed: 8,
      failed: 0,
      total: 8,
      failures: []
    },
    status: 'pass'
  }
];

// AI Feedback that would be generated for submission 1 (initial buggy code)
export const mockAIFeedbackBySubmission = {
  'sub_001': {
    bugPattern: {
      type: 'missing_rebalance',
      confidence: 0.95,
      description: 'The AVL tree insert method does not update node heights or perform rotations after insertion. This causes the tree to become unbalanced, behaving like a regular BST.',
      affectedLines: [29, 30]
    },
    nextSteps: [
      { 
        step: 1, 
        action: 'Add height update after recursive insertions: node.height = 1 + Math.max(height(node.left), height(node.right))', 
        priority: 'high' 
      },
      { 
        step: 2, 
        action: 'Compute the balance factor: int balance = height(node.left) - height(node.right)', 
        priority: 'high' 
      },
      { 
        step: 3, 
        action: 'Add rotation logic when |balance| > 1 to restore AVL property', 
        priority: 'high' 
      },
      { 
        step: 4, 
        action: 'Implement rotateLeft() and rotateRight() helper methods', 
        priority: 'medium' 
      }
    ],
    conceptLinks: [
      { concept: 'AVL Balance Factor', relevance: 'Must be -1, 0, or 1 for all nodes in a valid AVL tree' },
      { concept: 'Tree Rotations', relevance: 'Single rotations fix LL and RR cases; double rotations fix LR and RL cases' },
      { concept: 'Height Property', relevance: 'AVL trees guarantee O(log n) height by maintaining balance' }
    ]
  },
  'sub_002': {
    bugPattern: {
      type: 'incomplete_implementation',
      confidence: 0.90,
      description: 'Height is now being updated correctly, but the tree still lacks rotation logic. The balance factor is being computed implicitly through height differences, but no corrective action is taken.',
      affectedLines: [32, 33]
    },
    nextSteps: [
      { 
        step: 1, 
        action: 'Add getBalance() method to compute balance factor', 
        priority: 'high' 
      },
      { 
        step: 2, 
        action: 'Check if balance > 1 (left-heavy) or balance < -1 (right-heavy)', 
        priority: 'high' 
      },
      { 
        step: 3, 
        action: 'Implement rotateRight() for left-heavy cases', 
        priority: 'high' 
      },
      { 
        step: 4, 
        action: 'Implement rotateLeft() for right-heavy cases', 
        priority: 'high' 
      }
    ],
    conceptLinks: [
      { concept: 'Balance Factor', relevance: 'balance = height(left) - height(right)' },
      { concept: 'Right Rotation', relevance: 'Fixes left-left imbalance' },
      { concept: 'Left Rotation', relevance: 'Fixes right-right imbalance' }
    ]
  },
  'sub_003': {
    bugPattern: {
      type: 'missing_double_rotation',
      confidence: 0.92,
      description: 'Single rotations are implemented, but double rotation cases (Left-Right and Right-Left) are not handled. These cases require two rotations to fix.',
      affectedLines: [36, 40]
    },
    nextSteps: [
      { 
        step: 1, 
        action: 'Identify the 4 cases: LL, RR (single rotation) vs LR, RL (double rotation)', 
        priority: 'high' 
      },
      { 
        step: 2, 
        action: 'For LR case: first rotateLeft on left child, then rotateRight on node', 
        priority: 'high' 
      },
      { 
        step: 3, 
        action: 'For RL case: first rotateRight on right child, then rotateLeft on node', 
        priority: 'high' 
      },
      { 
        step: 4, 
        action: 'Use the inserted value to determine which case applies', 
        priority: 'medium' 
      }
    ],
    conceptLinks: [
      { concept: 'Double Rotations', relevance: 'LR and RL cases need two rotations because the imbalance is in a "zigzag" pattern' },
      { concept: 'Case Detection', relevance: 'Compare inserted value with child node to detect zigzag vs straight pattern' }
    ]
  },
  'sub_004': {
    bugPattern: {
      type: 'none',
      confidence: 1.0,
      description: 'All tests passing! The AVL tree implementation correctly handles all four rotation cases.',
      affectedLines: []
    },
    nextSteps: [
      { 
        step: 1, 
        action: '✓ Great work! Consider adding delete() operation next', 
        priority: 'low' 
      },
      { 
        step: 2, 
        action: 'Consider adding contains() and size() methods for a complete implementation', 
        priority: 'low' 
      }
    ],
    conceptLinks: [
      { concept: 'AVL Delete', relevance: 'Deletion also requires rebalancing - similar logic to insert' }
    ]
  },
  'sub_005': {
    bugPattern: {
      type: 'none',
      confidence: 1.0,
      description: 'Excellent! Complete AVL tree with insert, contains, and size operations.',
      affectedLines: []
    },
    nextSteps: [
      { 
        step: 1, 
        action: '✓ Implementation complete! Consider edge case testing', 
        priority: 'low' 
      }
    ],
    conceptLinks: []
  }
};

// Helper to get AI feedback for a submission
export function getAIFeedback(submissionId) {
  return mockAIFeedbackBySubmission[submissionId] || {
    bugPattern: {
      type: 'unknown',
      confidence: 0,
      description: 'Unable to analyze this submission.',
      affectedLines: []
    },
    nextSteps: [],
    conceptLinks: []
  };
}

// Get submissions for a student/assignment combination
export function getSubmissions(studentId, assignmentId) {
  return mockSubmissions.filter(
    s => s.studentId === studentId && s.assignmentId === assignmentId
  );
}

// Helper to get code for a file (or first file as default)
// Provides backward compatibility with old single-code submissions
export function getFileContent(submission, fileName) {
  if (!submission) return '';

  // Support old format with single code string
  if (!submission.files) {
    return submission.code || '';
  }

  // New format with files array
  const file = fileName
    ? submission.files.find(f => f.name === fileName)
    : submission.files[0];
  return file?.content || '';
}
