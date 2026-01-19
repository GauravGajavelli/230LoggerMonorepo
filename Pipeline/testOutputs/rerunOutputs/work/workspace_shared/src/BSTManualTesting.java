import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.fail;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.NoSuchElementException;

import org.junit.jupiter.api.Test;


// TODO: Uncomment tests as you go. 
// Once it passes all of them, you'll start using the other test file instead of this one, since it
// uses the BST insert method.
@SuppressWarnings({ "rawtypes", "unchecked" })
public class BSTManualTesting {

//	@Test
//	public void testIsEmpty(){
//		BinarySearchTree<Integer> b = new BinarySearchTree<Integer>();
//		assertTrue(b.isEmpty());
//		
//		BinarySearchTree.Node n1 = b.new Node(1);
//		b.setRoot(n1);
//		assertFalse(b.isEmpty());
//	}

	@Test
	public void testSize(){
		BinarySearchTree<Integer> b = new BinarySearchTree<Integer>();
		assertEquals(0, b.size());
		
		BinarySearchTree.Node n1 = b.new Node(1);
		b.setRoot(n1);
		assertEquals(1, b.size());
		
		BinarySearchTree.Node n2 = b.new Node(2);
		BinarySearchTree.Node n3 = b.new Node(3);
		n1.setRight(n2);
		assertEquals(2, b.size());
		
		n2.setRight(n3);
		assertEquals(3, b.size());

		BinarySearchTree.Node n4 = b.new Node(4);
		n1.setLeft(n4);
		assertEquals(4, b.size());

		BinarySearchTree.Node n5 = b.new Node(5);
		n4.setLeft(n5);
		assertEquals(5, b.size());

		BinarySearchTree.Node n6 = b.new Node(6);
		n5.setRight(n6);
		assertEquals(6, b.size());
	}
	
	@Test
	public void testHeight(){
		BinarySearchTree<Integer> b = new BinarySearchTree<Integer>();
		assertEquals(-1, b.height());
		
		BinarySearchTree.Node n1 = b.new Node(1);
		b.setRoot(n1);
		assertEquals(0, b.height());
		
		BinarySearchTree.Node n2 = b.new Node(2);
		BinarySearchTree.Node n3 = b.new Node(3);
		n1.setRight(n2);
		assertEquals(1, b.height());
		
		n2.setRight(n3);
		assertEquals(2, b.height());

		BinarySearchTree.Node n4 = b.new Node(4);
		n1.setLeft(n4);
		assertEquals(2, b.height());

		BinarySearchTree.Node n5 = b.new Node(5);
		n4.setLeft(n5);
		assertEquals(2, b.height());

		BinarySearchTree.Node n6 = b.new Node(6);
		n5.setRight(n6);
		assertEquals(3, b.height());
	}
	

//	@Test
//	public void testContainsNonBST(){
//		BinarySearchTree<Integer> b = new BinarySearchTree<Integer>();
//		BinarySearchTree.Node n1 = b.new Node(1);
//		b.setRoot(n1);
//		BinarySearchTree.Node n2 = b.new Node(2);
//		BinarySearchTree.Node n3 = b.new Node(3);
//		n1.setRight(n2);
//		n2.setRight(n3);
//		BinarySearchTree.Node n4 = b.new Node(4);
//		n1.setLeft(n4);
//		BinarySearchTree.Node n5 = b.new Node(5);
//		n4.setLeft(n5);
//		BinarySearchTree.Node n6 = b.new Node(6);
//		n5.setRight(n6);
//		assertEquals(6, b.size());
//		assertTrue(b.containsNonBST(1));
//		assertTrue(b.containsNonBST(2));
//		assertTrue(b.containsNonBST(3));
//		assertTrue(b.containsNonBST(4));
//		assertTrue(b.containsNonBST(5));
//		assertTrue(b.containsNonBST(6));
//		assertFalse(b.containsNonBST(7));
//		assertFalse(b.containsNonBST(0));
//	}
//	
//	@Test
//	public void testBasicToString(){
//		BinarySearchTree<Integer> b = new BinarySearchTree<Integer>();
//		System.out.println("Empty tree: " + b.toString());
//		
//		BinarySearchTree.Node n1 = b.new Node(1);
//		BinarySearchTree.Node n2 = b.new Node(2);
//		BinarySearchTree.Node n3 = b.new Node(3);
//		BinarySearchTree.Node n4 = b.new Node(4);
//		BinarySearchTree.Node n5 = b.new Node(5);
//		BinarySearchTree.Node n6 = b.new Node(6);
//		b.setRoot(n1);
//		n1.setRight(n2);
//		n2.setRight(n3);
//		n1.setLeft(n4);
//		n4.setLeft(n5);
//		n5.setRight(n6);
//		System.out.println("Tree: " + b.toString());
//	}
//	
//	@Test
//	public void testToString(){
//		BinarySearchTree<Integer> b = new BinarySearchTree<Integer>();
//		assertEquals("[]", b.toString());
//		
//		BinarySearchTree.Node n1 = b.new Node(1);
//		BinarySearchTree.Node n2 = b.new Node(2);
//		BinarySearchTree.Node n3 = b.new Node(3);
//		BinarySearchTree.Node n4 = b.new Node(4);
//		BinarySearchTree.Node n5 = b.new Node(5);
//		BinarySearchTree.Node n6 = b.new Node(6);
//		b.setRoot(n1);
//		n1.setRight(n2);
//		n2.setRight(n3);
//		n1.setLeft(n4);
//		n4.setLeft(n5);
//		n5.setRight(n6);
//		assertEquals( "[5, 6, 4, 1, 2, 3]", b.toString());			
//	}
//	
//
//	@Test
//	public void testToArrayList(){
//		BinarySearchTree<Integer> b = new BinarySearchTree<Integer>();
//		assertEquals(new ArrayList<Integer>(), b.toArrayList());
//		
//		BinarySearchTree.Node n1 = b.new Node(1);
//		BinarySearchTree.Node n2 = b.new Node(2);
//		BinarySearchTree.Node n3 = b.new Node(3);
//		BinarySearchTree.Node n4 = b.new Node(4);
//		BinarySearchTree.Node n5 = b.new Node(5);
//		BinarySearchTree.Node n6 = b.new Node(6);
//		b.setRoot(n1);
//		n1.setRight(n2);
//		n2.setRight(n3);
//		n1.setLeft(n4);
//		n4.setLeft(n5);
//		n5.setRight(n6);
//
//		ArrayList<Integer> temp = new ArrayList<Integer>();
//		temp.add(5);temp.add(6);temp.add(4);
//		temp.add(1);temp.add(2);temp.add(3);
//		assertEquals(temp, b.toArrayList());
//	}
//	
//	@Test
//	public void testToArray(){
//		BinarySearchTree<Integer> b = new BinarySearchTree<Integer>();
//		assertEquals(0, b.toArray().length);
//		
//		BinarySearchTree.Node n1 = b.new Node(1);
//		BinarySearchTree.Node n2 = b.new Node(2);
//		BinarySearchTree.Node n3 = b.new Node(3);
//		BinarySearchTree.Node n4 = b.new Node(4);
//		BinarySearchTree.Node n5 = b.new Node(5);
//		BinarySearchTree.Node n6 = b.new Node(6);
//		b.setRoot(n1);
//		n1.setRight(n2);
//		n2.setRight(n3);
//		n1.setLeft(n4);
//		n4.setLeft(n5);
//		n5.setRight(n6);
//
//		Object[] temp = {5, 6, 4, 1, 2, 3};
//		Object[] foo = b.toArray();
//		assertArrayEquals(temp, foo);
//	}
//	
//	@Test
//	public void testInefficientIterator() {
//		BinarySearchTree<Integer> b = new BinarySearchTree<Integer>();
//		Iterator iter = b.inefficientIterator();
//		assertFalse(iter.hasNext(), "Expected: false");
//
//		BinarySearchTree.Node n1 = b.new Node(1);
//		BinarySearchTree.Node n2 = b.new Node(2);
//		BinarySearchTree.Node n3 = b.new Node(3);
//		BinarySearchTree.Node n4 = b.new Node(4);
//		BinarySearchTree.Node n5 = b.new Node(5);
//		BinarySearchTree.Node n6 = b.new Node(6);
//		BinarySearchTree.Node n7 = b.new Node(7);
//		BinarySearchTree.Node n8 = b.new Node(8);
//		BinarySearchTree.Node n9 = b.new Node(9);
//		
//		b.setRoot(n6);
//		n6.setLeft(n5);
//		n6.setRight(n7);
//		n5.setLeft(n2);
//		n2.setLeft(n1);
//		n2.setRight(n4);
//		n4.setLeft(n3);
//		n7.setRight(n9);
//		n9.setLeft(n8);
//
//		iter = b.inefficientIterator();
//		Object[] temp = { 1, 2, 3, 4, 5, 6, 7, 8, 9 };
//		boolean[] tempValues = { true, true, true, true, true, true, true, true, false };
//		for (int k = 0; k < temp.length; k++) {
//			assertEquals(temp[k], iter.next());
//			assertEquals(tempValues[k], iter.hasNext());
//		}
//		try {
//			iter.next();
//			fail("Did not throw NoSuchElementException");
//		} catch (Exception e) {
//			if (!(e instanceof NoSuchElementException)) {
//				fail("Did not throw NoSuchElementException");
//			}
//		}
//	}
//
//	@Test
//	public void testPreOrderIterator() {
//		BinarySearchTree<Integer> b = new BinarySearchTree<Integer>();
//		Iterator iter = b.preOrderIterator();
//		assertFalse(iter.hasNext(), "Expected: false");
//
//		BinarySearchTree.Node n1 = b.new Node(1);
//		BinarySearchTree.Node n2 = b.new Node(2);
//		BinarySearchTree.Node n3 = b.new Node(3);
//		BinarySearchTree.Node n4 = b.new Node(4);
//		BinarySearchTree.Node n5 = b.new Node(5);
//		BinarySearchTree.Node n6 = b.new Node(6);
//		BinarySearchTree.Node n7 = b.new Node(7);
//		BinarySearchTree.Node n8 = b.new Node(8);
//		BinarySearchTree.Node n9 = b.new Node(9);
//		
//		b.setRoot(n6);
//		n6.setLeft(n5);
//		n6.setRight(n7);
//		n5.setLeft(n2);
//		n2.setLeft(n1);
//		n2.setRight(n4);
//		n4.setLeft(n3);
//		n7.setRight(n9);
//		n9.setLeft(n8);
//		
//		iter = b.preOrderIterator();
//		Object[] temp = { 6, 5, 2, 1, 4, 3, 7, 9, 8 };
//		boolean[] tempValues = { true, true, true, true, true, true, true, true, false };
//		for (int k = 0; k < temp.length; k++) {
//			assertEquals(temp[k], iter.next());
//			assertEquals(tempValues[k], iter.hasNext());
//		}
//		try {
//			iter.next();
//			fail("Did not throw NoSuchElementException");
//		} catch (Exception e) {
//			if (!(e instanceof NoSuchElementException)) {
//				fail("Did not throw NoSuchElementException");
//			}
//		}
//	}
//
//	@Test
//	public void testIterator() {
//		BinarySearchTree<Integer> b = new BinarySearchTree<Integer>();
//		Iterator iter = b.iterator();
//		assertFalse(iter.hasNext(), "Expected: false");
//
//		BinarySearchTree.Node n1 = b.new Node(1);
//		BinarySearchTree.Node n2 = b.new Node(2);
//		BinarySearchTree.Node n3 = b.new Node(3);
//		BinarySearchTree.Node n4 = b.new Node(4);
//		BinarySearchTree.Node n5 = b.new Node(5);
//		BinarySearchTree.Node n6 = b.new Node(6);
//		BinarySearchTree.Node n7 = b.new Node(7);
//		BinarySearchTree.Node n8 = b.new Node(8);
//		BinarySearchTree.Node n9 = b.new Node(9);
//		
//		b.setRoot(n6);
//		n6.setLeft(n5);
//		n6.setRight(n7);
//		n5.setLeft(n2);
//		n2.setLeft(n1);
//		n2.setRight(n4);
//		n4.setLeft(n3);
//		n7.setRight(n9);
//		n9.setLeft(n8);
//
//		iter = b.iterator();
//		Object[] temp = { 1, 2, 3, 4, 5, 6, 7, 8, 9 };
//		boolean[] tempValues = { true, true, true, true, true, true, true, true, false };
//		for (int k = 0; k < temp.length; k++) {
//			assertEquals(temp[k], iter.next());
//			assertEquals(tempValues[k], iter.hasNext());
//		}
//		try {
//			iter.next();
//			fail("Did not throw NoSuchElementException");
//		} catch (Exception e) {
//			if (!(e instanceof NoSuchElementException)) {
//				fail("Did not throw NoSuchElementException");
//			}
//		}
//	}
	
}
