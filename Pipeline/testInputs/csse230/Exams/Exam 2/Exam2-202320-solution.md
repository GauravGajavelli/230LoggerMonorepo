# Exam 2 - Solution

## Methods in BinarySearchTree Class

```java
/**
 *
 * See the written document for more details.
 *
 */
public int countLeftNodesAtDepth(int depth) {
    // TODO: Write this.
    return root.countLeftNodesAtDepth(depth, false, -1);
}

/**
 *
 * See the written document for more details.
 *
 */
String shortestWordAlongPath(String target)
{
    // TODO: Write this.
    return this.root.shortestWordAlongPath(target, this.root.data);
}

/**
 *
 * See the written document for more details.
 *
 */
public void pruneFullSubtreesSize3() {
    // TODO: Write this.
    root = root.pruneFullSubtreesSize3();
}
```

---

## Methods in BinaryNode Class

### `shortestWordAlongPath`

```java
public String shortestWordAlongPath(String target, String shortestSoFar) {
    if (this == NULL_NODE) {
        return shortestSoFar;
    }

    if (target.compareTo(this.data) == 0) {
        // base case
        if (this.data.length() < shortestSoFar.length()) {
            shortestSoFar = this.data;
        }
        return shortestSoFar;
    } else {
        // non base case
        if (this.data.length() < shortestSoFar.length()) {
            shortestSoFar = this.data;
        }
        // navigate
        if (target.compareTo(this.data) < 0) {
            return this.left.shortestWordAlongPath(target, shortestSoFar);
        } else {
            return this.right.shortestWordAlongPath(target, shortestSoFar);
        }
    }
}
```

### `countLeftNodesAtDepth`

```java
public int countLeftNodesAtDepth(int targetDepth, boolean isLeftChild, int curDepth) {
    curDepth++;
    if (this == NULL_NODE) {
        return 0;
    } else {
        int leftCount = left.countLeftNodesAtDepth(targetDepth, true, curDepth);
        int rightCount = right.countLeftNodesAtDepth(targetDepth, false, curDepth);

        int currentNodeCount = leftCount + rightCount + ((curDepth == targetDepth && isLeftChild) ? 1 : 0);
        return currentNodeCount;
    }
}
```

### `pruneFullSubtreesSize3`

```java
public Node pruneFullSubtreesSize3() {
    if (this == NULL_NODE) {
        return this;
    } else {
        this.left = this.left.pruneFullSubtreesSize3();
        this.right = this.right.pruneFullSubtreesSize3();
        // Below is one common way to solve this, but it's inefficient.
        // An efficient O(1) method would be to look down the tree and check if the grandchildren all exist and are NNs.
        if ((this.size() == 3) && this.left != NULL_NODE && this.right != NULL_NODE) {
            return NULL_NODE;
        } else {
            return this;
        }
    }
}
```

### `size`

```java
public int size() {
    if (this == NULL_NODE) {
        return 0;
    }
    return (1 + left.size() + right.size());
}
```
