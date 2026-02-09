package edu.rosehulman.csse230feedback.domain;

import java.util.List;

/**
 * Generates hardcoded BST Java source templates for each ProgressionModel phase.
 * Each template represents a snapshot of a student's BinarySearchTree implementation
 * at a particular stage of development.
 */
public class BstTemplateGenerator {

    /**
     * Returns the BinarySearchTree.java source code for the given phase (0-6).
     */
    public String getTemplate(int phase) {
        return switch (phase) {
            case 0 -> PHASE_0_COMPILATION;
            case 1 -> PHASE_1_BASIC_INSERT;
            case 2 -> PHASE_2_SEARCH_CONVERSION;
            case 3 -> PHASE_3_DELETION;
            case 4 -> PHASE_4_ITERATORS;
            case 5 -> PHASE_5_EDGE_CASES;
            case 6 -> PHASE_6_CONCURRENCY;
            default -> phase < 0 ? PHASE_0_COMPILATION : PHASE_6_CONCURRENCY;
        };
    }

    /**
     * Returns the diff category labels for a phase transition.
     */
    public List<String> getDiffCategories(int fromPhase, int toPhase) {
        if (fromPhase == toPhase) return List.of();

        return switch (fromPhase + "->" + toPhase) {
            case "0->1" -> List.of("compilation_fix", "method_implementation");
            case "1->2" -> List.of("method_implementation", "comparison_operator_added");
            case "2->3" -> List.of("method_implementation", "recursion_added");
            case "3->4" -> List.of("method_implementation", "iterator_added");
            case "4->5" -> List.of("null_check_added", "efficiency_fix");
            case "5->6" -> List.of("concurrency_handling", "synchronization_added");
            default -> List.of("method_implementation");
        };
    }

    // Phase 0: Skeleton with syntax errors — won't compile
    private static final String PHASE_0_COMPILATION = """
            import java.util.ArrayList;
            import java.util.Iterator;

            public class BinarySearchTree<T extends Comparable<? super T>> {

                private BinaryNode root;
                private int size

                public BinarySearchTree() {
                    this.root = null;
                    // TODO: initialize size
                }

                public boolean insert(T element) {
                    // TODO: implement
                }

                public int size() {
                    // TODO
                }

                public int height() {
                    // TODO
                }

                // Missing closing brace and other syntax issues
            """;

    // Phase 1: insert + size/height work but null-check bug causes NPE
    private static final String PHASE_1_BASIC_INSERT = """
            import java.util.ArrayList;
            import java.util.Iterator;
            import java.util.NoSuchElementException;

            public class BinarySearchTree<T extends Comparable<? super T>> {

                private BinaryNode root;
                private int size;

                private class BinaryNode {
                    T data;
                    BinaryNode left;
                    BinaryNode right;

                    BinaryNode(T data) {
                        this.data = data;
                        this.left = null;
                        this.right = null;
                    }
                }

                public BinarySearchTree() {
                    this.root = null;
                    this.size = 0;
                }

                public boolean insert(T element) {
                    if (element == null) {
                        throw new IllegalArgumentException("Cannot insert null");
                    }
                    if (root == null) {
                        root = new BinaryNode(element);
                        size++;
                        return true;
                    }
                    return insertHelper(root, element);
                }

                private boolean insertHelper(BinaryNode node, T element) {
                    int cmp = element.compareTo(node.data);
                    if (cmp < 0) {
                        // Bug: doesn't check if left is null before comparing
                        if (node.left.data.compareTo(element) == 0) {
                            return false;
                        }
                        if (node.left == null) {
                            node.left = new BinaryNode(element);
                            size++;
                            return true;
                        }
                        return insertHelper(node.left, element);
                    } else if (cmp > 0) {
                        if (node.right == null) {
                            node.right = new BinaryNode(element);
                            size++;
                            return true;
                        }
                        return insertHelper(node.right, element);
                    }
                    return false; // duplicate
                }

                public int size() {
                    return this.size;
                }

                public boolean isEmpty() {
                    return size == 0;
                }

                public int height() {
                    return heightHelper(root);
                }

                private int heightHelper(BinaryNode node) {
                    if (node == null) return -1;
                    return 1 + Math.max(heightHelper(node.left), heightHelper(node.right));
                }
            }
            """;

    // Phase 2: contains + toArrayList added but comparison bug (< vs <=)
    private static final String PHASE_2_SEARCH_CONVERSION = """
            import java.util.ArrayList;
            import java.util.Iterator;
            import java.util.NoSuchElementException;

            public class BinarySearchTree<T extends Comparable<? super T>> {

                private BinaryNode root;
                private int size;

                private class BinaryNode {
                    T data;
                    BinaryNode left;
                    BinaryNode right;

                    BinaryNode(T data) {
                        this.data = data;
                        this.left = null;
                        this.right = null;
                    }
                }

                public BinarySearchTree() {
                    this.root = null;
                    this.size = 0;
                }

                public boolean insert(T element) {
                    if (element == null) {
                        throw new IllegalArgumentException("Cannot insert null");
                    }
                    if (root == null) {
                        root = new BinaryNode(element);
                        size++;
                        return true;
                    }
                    return insertHelper(root, element);
                }

                private boolean insertHelper(BinaryNode node, T element) {
                    int cmp = element.compareTo(node.data);
                    if (cmp < 0) {
                        if (node.left == null) {
                            node.left = new BinaryNode(element);
                            size++;
                            return true;
                        }
                        return insertHelper(node.left, element);
                    } else if (cmp > 0) {
                        if (node.right == null) {
                            node.right = new BinaryNode(element);
                            size++;
                            return true;
                        }
                        return insertHelper(node.right, element);
                    }
                    return false;
                }

                public boolean contains(T element) {
                    return containsHelper(root, element);
                }

                private boolean containsHelper(BinaryNode node, T element) {
                    if (node == null) return false;
                    int cmp = element.compareTo(node.data);
                    // Bug: using <= instead of < causes boundary issues
                    if (cmp <= 0) {
                        return containsHelper(node.left, element);
                    } else if (cmp > 0) {
                        return containsHelper(node.right, element);
                    }
                    return true;
                }

                public ArrayList<T> toArrayList() {
                    ArrayList<T> list = new ArrayList<>();
                    inOrderTraversal(root, list);
                    return list;
                }

                private void inOrderTraversal(BinaryNode node, ArrayList<T> list) {
                    if (node == null) return;
                    inOrderTraversal(node.left, list);
                    list.add(node.data);
                    inOrderTraversal(node.right, list);
                }

                public Object[] toArray() {
                    return toArrayList().toArray();
                }

                @Override
                public String toString() {
                    ArrayList<T> list = toArrayList();
                    return list.toString();
                }

                public int size() {
                    return this.size;
                }

                public boolean isEmpty() {
                    return size == 0;
                }

                public int height() {
                    return heightHelper(root);
                }

                private int heightHelper(BinaryNode node) {
                    if (node == null) return -1;
                    return 1 + Math.max(heightHelper(node.left), heightHelper(node.right));
                }
            }
            """;

    // Phase 3: remove() added but missing base case causes StackOverflow
    private static final String PHASE_3_DELETION = """
            import java.util.ArrayList;
            import java.util.Iterator;
            import java.util.NoSuchElementException;

            public class BinarySearchTree<T extends Comparable<? super T>> {

                private BinaryNode root;
                private int size;

                private class BinaryNode {
                    T data;
                    BinaryNode left;
                    BinaryNode right;

                    BinaryNode(T data) {
                        this.data = data;
                        this.left = null;
                        this.right = null;
                    }
                }

                public BinarySearchTree() {
                    this.root = null;
                    this.size = 0;
                }

                public boolean insert(T element) {
                    if (element == null) {
                        throw new IllegalArgumentException("Cannot insert null");
                    }
                    if (root == null) {
                        root = new BinaryNode(element);
                        size++;
                        return true;
                    }
                    return insertHelper(root, element);
                }

                private boolean insertHelper(BinaryNode node, T element) {
                    int cmp = element.compareTo(node.data);
                    if (cmp < 0) {
                        if (node.left == null) {
                            node.left = new BinaryNode(element);
                            size++;
                            return true;
                        }
                        return insertHelper(node.left, element);
                    } else if (cmp > 0) {
                        if (node.right == null) {
                            node.right = new BinaryNode(element);
                            size++;
                            return true;
                        }
                        return insertHelper(node.right, element);
                    }
                    return false;
                }

                public boolean contains(T element) {
                    return containsHelper(root, element);
                }

                private boolean containsHelper(BinaryNode node, T element) {
                    if (node == null) return false;
                    int cmp = element.compareTo(node.data);
                    if (cmp < 0) {
                        return containsHelper(node.left, element);
                    } else if (cmp > 0) {
                        return containsHelper(node.right, element);
                    }
                    return true;
                }

                public boolean remove(T element) {
                    if (element == null) {
                        throw new IllegalArgumentException("Cannot remove null");
                    }
                    int oldSize = size;
                    root = removeHelper(root, element);
                    return size < oldSize;
                }

                private BinaryNode removeHelper(BinaryNode node, T element) {
                    // Bug: missing null check causes StackOverflowError
                    int cmp = element.compareTo(node.data);
                    if (cmp < 0) {
                        node.left = removeHelper(node.left, element);
                    } else if (cmp > 0) {
                        node.right = removeHelper(node.right, element);
                    } else {
                        if (node.left == null) {
                            size--;
                            return node.right;
                        }
                        if (node.right == null) {
                            size--;
                            return node.left;
                        }
                        BinaryNode successor = findMin(node.right);
                        node.data = successor.data;
                        node.right = removeHelper(node.right, successor.data);
                    }
                    return node;
                }

                private BinaryNode findMin(BinaryNode node) {
                    while (node.left != null) {
                        node = node.left;
                    }
                    return node;
                }

                public ArrayList<T> toArrayList() {
                    ArrayList<T> list = new ArrayList<>();
                    inOrderTraversal(root, list);
                    return list;
                }

                private void inOrderTraversal(BinaryNode node, ArrayList<T> list) {
                    if (node == null) return;
                    inOrderTraversal(node.left, list);
                    list.add(node.data);
                    inOrderTraversal(node.right, list);
                }

                public Object[] toArray() {
                    return toArrayList().toArray();
                }

                @Override
                public String toString() {
                    return toArrayList().toString();
                }

                public int size() {
                    return this.size;
                }

                public boolean isEmpty() {
                    return size == 0;
                }

                public int height() {
                    return heightHelper(root);
                }

                private int heightHelper(BinaryNode node) {
                    if (node == null) return -1;
                    return 1 + Math.max(heightHelper(node.left), heightHelper(node.right));
                }
            }
            """;

    // Phase 4: Iterator stubs, some throwing UnsupportedOperationException
    private static final String PHASE_4_ITERATORS = """
            import java.util.ArrayList;
            import java.util.ConcurrentModificationException;
            import java.util.Iterator;
            import java.util.NoSuchElementException;
            import java.util.Stack;

            public class BinarySearchTree<T extends Comparable<? super T>> implements Iterable<T> {

                private BinaryNode root;
                private int size;
                private int modCount;

                private class BinaryNode {
                    T data;
                    BinaryNode left;
                    BinaryNode right;

                    BinaryNode(T data) {
                        this.data = data;
                        this.left = null;
                        this.right = null;
                    }
                }

                public BinarySearchTree() {
                    this.root = null;
                    this.size = 0;
                    this.modCount = 0;
                }

                public boolean insert(T element) {
                    if (element == null) {
                        throw new IllegalArgumentException("Cannot insert null");
                    }
                    if (root == null) {
                        root = new BinaryNode(element);
                        size++;
                        modCount++;
                        return true;
                    }
                    return insertHelper(root, element);
                }

                private boolean insertHelper(BinaryNode node, T element) {
                    int cmp = element.compareTo(node.data);
                    if (cmp < 0) {
                        if (node.left == null) {
                            node.left = new BinaryNode(element);
                            size++;
                            modCount++;
                            return true;
                        }
                        return insertHelper(node.left, element);
                    } else if (cmp > 0) {
                        if (node.right == null) {
                            node.right = new BinaryNode(element);
                            size++;
                            modCount++;
                            return true;
                        }
                        return insertHelper(node.right, element);
                    }
                    return false;
                }

                public boolean contains(T element) {
                    return containsHelper(root, element);
                }

                private boolean containsHelper(BinaryNode node, T element) {
                    if (node == null) return false;
                    int cmp = element.compareTo(node.data);
                    if (cmp < 0) return containsHelper(node.left, element);
                    if (cmp > 0) return containsHelper(node.right, element);
                    return true;
                }

                public boolean remove(T element) {
                    if (element == null) {
                        throw new IllegalArgumentException("Cannot remove null");
                    }
                    int oldSize = size;
                    root = removeHelper(root, element);
                    return size < oldSize;
                }

                private BinaryNode removeHelper(BinaryNode node, T element) {
                    if (node == null) return null;
                    int cmp = element.compareTo(node.data);
                    if (cmp < 0) {
                        node.left = removeHelper(node.left, element);
                    } else if (cmp > 0) {
                        node.right = removeHelper(node.right, element);
                    } else {
                        if (node.left == null) { size--; modCount++; return node.right; }
                        if (node.right == null) { size--; modCount++; return node.left; }
                        BinaryNode successor = findMin(node.right);
                        node.data = successor.data;
                        node.right = removeHelper(node.right, successor.data);
                    }
                    return node;
                }

                private BinaryNode findMin(BinaryNode node) {
                    while (node.left != null) node = node.left;
                    return node;
                }

                public ArrayList<T> toArrayList() {
                    ArrayList<T> list = new ArrayList<>();
                    inOrderTraversal(root, list);
                    return list;
                }

                private void inOrderTraversal(BinaryNode node, ArrayList<T> list) {
                    if (node == null) return;
                    inOrderTraversal(node.left, list);
                    list.add(node.data);
                    inOrderTraversal(node.right, list);
                }

                public Object[] toArray() {
                    return toArrayList().toArray();
                }

                @Override
                public String toString() {
                    return toArrayList().toString();
                }

                public int size() { return size; }
                public boolean isEmpty() { return size == 0; }

                public int height() {
                    return heightHelper(root);
                }

                private int heightHelper(BinaryNode node) {
                    if (node == null) return -1;
                    return 1 + Math.max(heightHelper(node.left), heightHelper(node.right));
                }

                @Override
                public Iterator<T> iterator() {
                    return new InOrderIterator();
                }

                public Iterator<T> inefficientIterator() {
                    // Bug: not implemented yet
                    throw new UnsupportedOperationException("iterator not implemented");
                }

                public Iterator<T> preOrderIterator() {
                    // Bug: not implemented yet
                    throw new UnsupportedOperationException("iterator not implemented");
                }

                private class InOrderIterator implements Iterator<T> {
                    private Stack<BinaryNode> stack = new Stack<>();
                    private int expectedModCount = modCount;

                    InOrderIterator() {
                        pushLeft(root);
                    }

                    private void pushLeft(BinaryNode node) {
                        while (node != null) {
                            stack.push(node);
                            node = node.left;
                        }
                    }

                    @Override
                    public boolean hasNext() {
                        return !stack.isEmpty();
                    }

                    @Override
                    public T next() {
                        if (!hasNext()) throw new NoSuchElementException();
                        // Bug: no ConcurrentModificationException check
                        BinaryNode node = stack.pop();
                        pushLeft(node.right);
                        return node.data;
                    }
                }
            }
            """;

    // Phase 5: Null checks + efficiency fixes, some edge cases still failing
    private static final String PHASE_5_EDGE_CASES = """
            import java.util.ArrayList;
            import java.util.ConcurrentModificationException;
            import java.util.Iterator;
            import java.util.NoSuchElementException;
            import java.util.Stack;

            public class BinarySearchTree<T extends Comparable<? super T>> implements Iterable<T> {

                private BinaryNode root;
                private int size;
                private int modCount;

                private class BinaryNode {
                    T data;
                    BinaryNode left;
                    BinaryNode right;

                    BinaryNode(T data) {
                        this.data = data;
                        this.left = null;
                        this.right = null;
                    }
                }

                public BinarySearchTree() {
                    this.root = null;
                    this.size = 0;
                    this.modCount = 0;
                }

                public boolean insert(T element) {
                    if (element == null) {
                        throw new IllegalArgumentException("Cannot insert null");
                    }
                    if (root == null) {
                        root = new BinaryNode(element);
                        size++;
                        modCount++;
                        return true;
                    }
                    return insertHelper(root, element);
                }

                private boolean insertHelper(BinaryNode node, T element) {
                    int cmp = element.compareTo(node.data);
                    if (cmp < 0) {
                        if (node.left == null) {
                            node.left = new BinaryNode(element);
                            size++;
                            modCount++;
                            return true;
                        }
                        return insertHelper(node.left, element);
                    } else if (cmp > 0) {
                        if (node.right == null) {
                            node.right = new BinaryNode(element);
                            size++;
                            modCount++;
                            return true;
                        }
                        return insertHelper(node.right, element);
                    }
                    return false;
                }

                public boolean contains(T element) {
                    if (element == null) return false;
                    return containsHelper(root, element);
                }

                private boolean containsHelper(BinaryNode node, T element) {
                    if (node == null) return false;
                    int cmp = element.compareTo(node.data);
                    if (cmp < 0) return containsHelper(node.left, element);
                    if (cmp > 0) return containsHelper(node.right, element);
                    return true;
                }

                public boolean remove(T element) {
                    if (element == null) {
                        throw new IllegalArgumentException("Cannot remove null");
                    }
                    int oldSize = size;
                    root = removeHelper(root, element);
                    return size < oldSize;
                }

                private BinaryNode removeHelper(BinaryNode node, T element) {
                    if (node == null) return null;
                    int cmp = element.compareTo(node.data);
                    if (cmp < 0) {
                        node.left = removeHelper(node.left, element);
                    } else if (cmp > 0) {
                        node.right = removeHelper(node.right, element);
                    } else {
                        if (node.left == null) { size--; modCount++; return node.right; }
                        if (node.right == null) { size--; modCount++; return node.left; }
                        BinaryNode successor = findMin(node.right);
                        node.data = successor.data;
                        node.right = removeHelper(node.right, successor.data);
                    }
                    return node;
                }

                private BinaryNode findMin(BinaryNode node) {
                    while (node.left != null) node = node.left;
                    return node;
                }

                public ArrayList<T> toArrayList() {
                    ArrayList<T> list = new ArrayList<>();
                    inOrderTraversal(root, list);
                    return list;
                }

                private void inOrderTraversal(BinaryNode node, ArrayList<T> list) {
                    if (node == null) return;
                    inOrderTraversal(node.left, list);
                    list.add(node.data);
                    inOrderTraversal(node.right, list);
                }

                public Object[] toArray() {
                    return toArrayList().toArray();
                }

                @Override
                public String toString() {
                    return toArrayList().toString();
                }

                public int size() { return size; }
                public boolean isEmpty() { return size == 0; }

                public int height() {
                    return heightHelper(root);
                }

                private int heightHelper(BinaryNode node) {
                    if (node == null) return -1;
                    return 1 + Math.max(heightHelper(node.left), heightHelper(node.right));
                }

                @Override
                public Iterator<T> iterator() {
                    return new InOrderIterator();
                }

                public Iterator<T> inefficientIterator() {
                    ArrayList<T> list = toArrayList();
                    return list.iterator();
                }

                public Iterator<T> preOrderIterator() {
                    return new PreOrderIterator();
                }

                private class InOrderIterator implements Iterator<T> {
                    private Stack<BinaryNode> stack = new Stack<>();
                    private int expectedModCount = modCount;

                    InOrderIterator() {
                        pushLeft(root);
                    }

                    private void pushLeft(BinaryNode node) {
                        while (node != null) {
                            stack.push(node);
                            node = node.left;
                        }
                    }

                    @Override
                    public boolean hasNext() {
                        return !stack.isEmpty();
                    }

                    @Override
                    public T next() {
                        if (expectedModCount != modCount) {
                            throw new ConcurrentModificationException();
                        }
                        if (!hasNext()) throw new NoSuchElementException();
                        BinaryNode node = stack.pop();
                        pushLeft(node.right);
                        return node.data;
                    }
                }

                private class PreOrderIterator implements Iterator<T> {
                    private Stack<BinaryNode> stack = new Stack<>();
                    // Bug: no mod count tracking

                    PreOrderIterator() {
                        if (root != null) stack.push(root);
                    }

                    @Override
                    public boolean hasNext() {
                        return !stack.isEmpty();
                    }

                    @Override
                    public T next() {
                        if (!hasNext()) throw new NoSuchElementException();
                        BinaryNode node = stack.pop();
                        if (node.right != null) stack.push(node.right);
                        if (node.left != null) stack.push(node.left);
                        return node.data;
                    }
                }
            }
            """;

    // Phase 6: ConcurrentModificationException handling, near-complete
    private static final String PHASE_6_CONCURRENCY = """
            import java.util.ArrayList;
            import java.util.ConcurrentModificationException;
            import java.util.Iterator;
            import java.util.NoSuchElementException;
            import java.util.Stack;

            public class BinarySearchTree<T extends Comparable<? super T>> implements Iterable<T> {

                private BinaryNode root;
                private int size;
                private int modCount;

                private class BinaryNode {
                    T data;
                    BinaryNode left;
                    BinaryNode right;

                    BinaryNode(T data) {
                        this.data = data;
                        this.left = null;
                        this.right = null;
                    }
                }

                public BinarySearchTree() {
                    this.root = null;
                    this.size = 0;
                    this.modCount = 0;
                }

                public boolean insert(T element) {
                    if (element == null) {
                        throw new IllegalArgumentException("Cannot insert null");
                    }
                    if (root == null) {
                        root = new BinaryNode(element);
                        size++;
                        modCount++;
                        return true;
                    }
                    return insertHelper(root, element);
                }

                private boolean insertHelper(BinaryNode node, T element) {
                    int cmp = element.compareTo(node.data);
                    if (cmp < 0) {
                        if (node.left == null) {
                            node.left = new BinaryNode(element);
                            size++;
                            modCount++;
                            return true;
                        }
                        return insertHelper(node.left, element);
                    } else if (cmp > 0) {
                        if (node.right == null) {
                            node.right = new BinaryNode(element);
                            size++;
                            modCount++;
                            return true;
                        }
                        return insertHelper(node.right, element);
                    }
                    return false;
                }

                public boolean contains(T element) {
                    if (element == null) return false;
                    return containsHelper(root, element);
                }

                private boolean containsHelper(BinaryNode node, T element) {
                    if (node == null) return false;
                    int cmp = element.compareTo(node.data);
                    if (cmp < 0) return containsHelper(node.left, element);
                    if (cmp > 0) return containsHelper(node.right, element);
                    return true;
                }

                public boolean remove(T element) {
                    if (element == null) {
                        throw new IllegalArgumentException("Cannot remove null");
                    }
                    int oldSize = size;
                    root = removeHelper(root, element);
                    return size < oldSize;
                }

                private BinaryNode removeHelper(BinaryNode node, T element) {
                    if (node == null) return null;
                    int cmp = element.compareTo(node.data);
                    if (cmp < 0) {
                        node.left = removeHelper(node.left, element);
                    } else if (cmp > 0) {
                        node.right = removeHelper(node.right, element);
                    } else {
                        if (node.left == null) { size--; modCount++; return node.right; }
                        if (node.right == null) { size--; modCount++; return node.left; }
                        BinaryNode successor = findMin(node.right);
                        node.data = successor.data;
                        node.right = removeHelper(node.right, successor.data);
                    }
                    return node;
                }

                private BinaryNode findMin(BinaryNode node) {
                    while (node.left != null) node = node.left;
                    return node;
                }

                public ArrayList<T> toArrayList() {
                    ArrayList<T> list = new ArrayList<>();
                    inOrderTraversal(root, list);
                    return list;
                }

                private void inOrderTraversal(BinaryNode node, ArrayList<T> list) {
                    if (node == null) return;
                    inOrderTraversal(node.left, list);
                    list.add(node.data);
                    inOrderTraversal(node.right, list);
                }

                public Object[] toArray() {
                    return toArrayList().toArray();
                }

                @Override
                public String toString() {
                    return toArrayList().toString();
                }

                public int size() { return size; }
                public boolean isEmpty() { return size == 0; }

                public int height() {
                    return heightHelper(root);
                }

                private int heightHelper(BinaryNode node) {
                    if (node == null) return -1;
                    return 1 + Math.max(heightHelper(node.left), heightHelper(node.right));
                }

                @Override
                public Iterator<T> iterator() {
                    return new InOrderIterator();
                }

                public Iterator<T> inefficientIterator() {
                    ArrayList<T> list = toArrayList();
                    return list.iterator();
                }

                public Iterator<T> preOrderIterator() {
                    return new PreOrderIterator();
                }

                private class InOrderIterator implements Iterator<T> {
                    private Stack<BinaryNode> stack = new Stack<>();
                    private int expectedModCount = modCount;

                    InOrderIterator() {
                        pushLeft(root);
                    }

                    private void pushLeft(BinaryNode node) {
                        while (node != null) {
                            stack.push(node);
                            node = node.left;
                        }
                    }

                    @Override
                    public boolean hasNext() {
                        return !stack.isEmpty();
                    }

                    @Override
                    public T next() {
                        if (expectedModCount != modCount) {
                            throw new ConcurrentModificationException();
                        }
                        if (!hasNext()) throw new NoSuchElementException();
                        BinaryNode node = stack.pop();
                        pushLeft(node.right);
                        return node.data;
                    }
                }

                private class PreOrderIterator implements Iterator<T> {
                    private Stack<BinaryNode> stack = new Stack<>();
                    private int expectedModCount = modCount;

                    PreOrderIterator() {
                        if (root != null) stack.push(root);
                    }

                    @Override
                    public boolean hasNext() {
                        return !stack.isEmpty();
                    }

                    @Override
                    public T next() {
                        if (expectedModCount != modCount) {
                            throw new ConcurrentModificationException();
                        }
                        if (!hasNext()) throw new NoSuchElementException();
                        BinaryNode node = stack.pop();
                        if (node.right != null) stack.push(node.right);
                        if (node.left != null) stack.push(node.left);
                        return node.data;
                    }
                }
            }
            """;
}
