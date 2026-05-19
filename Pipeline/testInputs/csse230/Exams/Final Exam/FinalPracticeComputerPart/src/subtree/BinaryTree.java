package subtree;

import java.util.Stack;

/*
 * TODO: 0 Directions: (1) Be sure to read the directions at the top of the test
 * paper. (2) Implement the given methods. See the paper for details.
 */
public class BinaryTree {
	private BinaryNode root;

	private final BinaryNode NULL_NODE = new BinaryNode('$', 0);

	public BinaryTree() {
		root = NULL_NODE;
	}

	/** See the paper for details */
	public String maxSubtree() {
		// TODO: Write this.
		return null;
	}

	// /////////////// BinaryNode
	public class BinaryNode {

		// Note there are two "data" fields: a label and a value:
		public Character label; 
		public int value;
		public BinaryNode left;
		public BinaryNode right;

		public BinaryNode(Character label, int value) {
			this.label = label;
			this.value = value;
			this.left = NULL_NODE;
			this.right = NULL_NODE;
		}

	
		// The next methods are used by the unit tests
		@Override
		public String toString() {
			if (this == NULL_NODE) {
				return "";
			}
			return left.toString() + this.label.toString() + right.toString();
		}
	}

	// The next methods are used by the unit tests
	@Override
	public String toString() {
		return root.toString();
	}

	/**
	 * This constructs a tree according to the preorder method introduced in
	 * displayable binary tree.
	 *
	 * @param charElements
	 * @param childCodes
	 */
	public BinaryTree(CharSequence charElements, CharSequence childCodes, int[] values) {
		root = preOrderBuild(charElements, childCodes, values);
	}

	/**
	 * Generates a binary tree whose node contents and pre-order traversal order
	 * come from charElements. For each of those nodes, the corresponding
	 * element in childCodes indicates the number of children, where L means one
	 * left child, R means one right child, and 0 and 2 mean zero and two
	 * children respectively.
	 *
	 * @param charElements
	 * @param childCodes
	 * @return the binary tree constructed from charElements and childCodes
	 */
	public BinaryNode preOrderBuild(CharSequence charElements,
			CharSequence childCodes, int[] values) {
		Stack<BinaryNode> stack = new Stack<BinaryNode>();
		for (int i = charElements.length() - 1; i >= 0; i--) {
			char label = charElements.charAt(i);
			char code = childCodes.charAt(i);
			int value = values[i];
			BinaryNode left = NULL_NODE, right = NULL_NODE;
			if (code == 'L' || code == '2') {
				left = stack.pop();
			}
			if (code == 'R' || code == '2') {
				right = stack.pop();
			}
			BinaryNode node = new BinaryNode(label, value);
			node.left = left;
			node.right = right;
			stack.push(node);
		}
		return stack.pop();
	}
}