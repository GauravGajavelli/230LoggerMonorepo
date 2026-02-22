/**
 * 
 * Implementation of most of the Set interface operations using a Binary Search Tree
 *
 * @author Matt Boutell and <<< YOUR NAME HERE >>>.
 * @param <T>
 */

public class BinarySearchTree<T> {
	private Node root;

	// You will like NULL NODEs (a common software design pattern) once you get used to them.
	private final Node NULL_NODE = new Node();

	public BinarySearchTree() {
		root = NULL_NODE;
	}

	public int size() {
		return root.size();
	}

	public int height() {
		return root.height();
	}

	// For manual tests only
	void setRoot(Node n) {
		this.root = n;
	}
	
	public void printPreOrder() {
		root.printPreOrder();
	}
	
	public void printInOrder() {
		root.printInOrder();
	}
	
	public void printPostOrder() {
		root.printPostOrder();
	}
	
	// Not private, since we need access for manual testing.
	class Node {
		private T data;
		private Node left;
		private Node right;

		public Node() {
			this.data = null;
			this.left = null;
			this.right = null;
		}

		public void printPreOrder() {
			if (this == NULL_NODE) return;
			System.out.println(this.data.toString());
			left.printPreOrder();
			right.printPreOrder();
		}

		public void printInOrder() {
			if (this == NULL_NODE) return;
			left.printInOrder();
			System.out.println(this.data.toString());
			right.printInOrder();
		}

		public void printPostOrder() {
			if (this == NULL_NODE) return;
			left.printPostOrder();
			right.printPostOrder();
			System.out.println(this.data.toString());
		}

		public int size() {
			if (this == NULL_NODE) {
				return 0;
			}
			return (1 + left.size() + right.size());
		}

		public int height() {
			if (this == NULL_NODE) {
				return -1;
			}
			return (1 + Math.max(left.height(), right.height()));
		}

		public Node(T element) {
			this.data = element;
			this.left = NULL_NODE;
			this.right = NULL_NODE;
		}

		public T getData() {
			return this.data;
		}

		public Node getLeft() {
			return this.left;
		}


		public Node getRight() {
			return this.right;
		}

		// For manual testing
		public void setLeft(Node left) {
			this.left = left;
		}
		
		public void setRight(Node right) {
			this.right = right;
		}
		
	}

	// TODO: Implement your 3 iterator classes here, plus any other inner helper classes you'd like. 
	 

}
