


import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.fail;

import java.util.ConcurrentModificationException;
import java.util.Iterator;
import java.util.NoSuchElementException;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;

import testSupport.LoggingExtension;


/*
 * Unit testing for the optional extension to this project:
 * Concurrency safety
 * 
 * This part of the project is not graded! Get these tests working 
 * if you want to learn more about how the data structures in Java's
 * standard library work.
 * 
 * Don't start working on these unit tests until you have the graded
 * sections working.
 */

@ExtendWith(LoggingExtension.class)
public class BSTConcurrencyTesting {


	@Test
	public void testPreOrderIteratorConcurrentModificationException() {
		BinarySearchTree<Integer> b = new BinarySearchTree<Integer>();
		Iterator<Integer> iter;
		Iterator<Integer> iter2;
		b.insert(3);
		b.insert(4);
		b.insert(5);
		b.insert(1);
		b.insert(0);
		b.insert(2);

		try {
			iter = b.preOrderIterator();
			iter.next();
			b.insert(99);
			iter.next();
			fail("Did not throw ConcurrentModificationException");
		} catch (Exception e) {
			if (!(e instanceof ConcurrentModificationException)) {
				fail("Did not throw ConcurrentModificationException");
			}
		}

		try {
			iter = b.preOrderIterator();
			iter.next();
			b.insert(99);
			iter2 = b.preOrderIterator();
			iter2.next();
		} catch (Exception e) {
			fail("Threw ConcurrentModificationException when it should not have: iterators should be independent of each other.");
		}
	}
//
//	@Test
//	public void testIterator() {
//		BinarySearchTree<Integer> b = new BinarySearchTree<Integer>();
//		Iterator<Integer> iter = b.iterator();
//		assertFalse(iter.hasNext());
//
//		b.insert(6);
//		b.insert(5);
//		b.insert(7);
//		b.insert(2);
//		b.insert(9);
//		b.insert(1);
//		b.insert(4);
//		b.insert(8);
//		b.insert(3);
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
//		try {
//			iter = b.iterator();
//			iter.next();
//			b.insert(99);
//			iter.next();
//			fail("Did not throw ConcurrentModificationException");
//		} catch (Exception e) {
//			if (!(e instanceof ConcurrentModificationException)) {
//				fail("Did not throw ConcurrentModificationException");
//			}
//		}
//	}
//	
//	
//
//	@Test
//	public void testRemoveConcurrentModifcationException() {
//		// Same as previous, but checking for concurrent modification exception.
//		BinarySearchTree<Integer> b = new BinarySearchTree<Integer>();
//		assertEquals("[]", b.toString());
//
//		// removal from empty tree
//		assertFalse(b.remove(7));
//
//		// remove just root
//		b.insert(4);
//		assertTrue(b.remove(4));
//		assertEquals("[]", b.toString());
//
//		// remove right child in simple tree
//		b.insert(10);
//		b.insert(4);
//		b.insert(14);
//		assertTrue(b.remove(14));
//		Integer[] a = { 10, 4 };
//		boolean[] bool = { true, false };
//		Iterator<Integer> iter = b.preOrderIterator();
//		assertTrue(iter.hasNext());
//		for (int k = 0; k < a.length; k++) {
//			assertEquals(a[k], iter.next());
//			assertEquals(bool[k], iter.hasNext());
//		}
//
//		// remove left child in simple tree
//		b.insert(14);
//
//		// Create an iterator to verify that a ConcurrentModificationException
//		// is thrown
//		iter = b.preOrderIterator();
//		b.remove(4);
//		try {
//			iter.next();
//			fail("Did not throw ConcurrentModificationException");
//		} catch (Exception e) {
//			if (!(e instanceof ConcurrentModificationException)) {
//				fail("Did not throw ConcurrentModificationException");
//			}
//		}
//	}
//	
//	@Test
//	public void testRemoveInPreOrderIterator() {
//		BinarySearchTree<Integer> b = new BinarySearchTree<Integer>();
//
//		// Testing exception throwing on empty tree.
//		Iterator<Integer> iter = b.preOrderIterator();
//		try {
//			iter.remove();
//			fail("Did not throw IllegalStateException");
//		} catch (Exception e) {
//			if (!(e instanceof IllegalStateException)) {
//				fail("Did not throw IllegalStateException");
//			}
//		}
//
//		b.insert(5);
//		b.insert(3);
//		b.insert(7);
//		iter = b.preOrderIterator();
//
//		// Testing exception throwing when next() has not been
//		// called yet.
//		assertTrue(iter.hasNext());
//		try {
//			iter.remove();
//			fail("Did not throw IllegalStateException");
//		} catch (Exception e) {
//			if (!(e instanceof IllegalStateException)) {
//				fail("Did not throw IllegalStateException");
//			}
//		}
//
//		iter.next();
//		assertTrue(iter.hasNext());
//		iter.next();
//		iter.remove();
//		assertEquals("[5, 7]", b.toString());
//
//		try {
//			iter.remove();
//			fail("Did not throw IllegalStateException");
//		} catch (Exception e) {
//			if (!(e instanceof IllegalStateException)) {
//				fail("Did not throw IllegalStateException");
//			}
//		}
//		try {
//			b.remove(7);
//			iter.next();
//			fail("Did not throw ConcurrentModificationException");
//		} catch (Exception e) {
//			if (!(e instanceof ConcurrentModificationException)) {
//				fail("Did not throw ConcurrentModificationException");
//			}
//		}
//	}
//
//	@Test
//	public void testRemoveInInOrderIterator() {
//		BinarySearchTree<Integer> b = new BinarySearchTree<Integer>();
//
//		// Testing exception throwing on empty tree.
//		Iterator<Integer> iter = b.iterator();
//		try {
//			iter.remove();
//			fail("Did not throw IllegalStateException");
//		} catch (Exception e) {
//			if (!(e instanceof IllegalStateException)) {
//				fail("Did not throw IllegalStateException");
//			}
//		}
//
//		b.insert(5);
//		b.insert(3);
//		b.insert(7);
//		iter = b.iterator();
//
//		// Testing exception throwing when next() has not been
//		// called yet.
//		assertTrue(iter.hasNext());
//		try {
//			iter.remove();
//			fail("Did not throw IllegalStateException");
//		} catch (Exception e) {
//			if (!(e instanceof IllegalStateException)) {
//				fail("Did not throw IllegalStateException");
//			}
//		}
//
//		iter.next();
//		assertTrue(iter.hasNext());
//		iter.next();
//		iter.remove();
//		assertEquals("[3, 7]", b.toString());
//
//		try {
//			iter.remove();
//			fail("Did not throw IllegalStateException");
//		} catch (Exception e) {
//			if (!(e instanceof IllegalStateException)) {
//				fail("Did not throw IllegalStateException");
//			}
//		}
//		try {
//			b.remove(7);
//			iter.next();
//			fail("Did not throw ConcurrentModificationException");
//		} catch (Exception e) {
//			if (!(e instanceof ConcurrentModificationException)) {
//				fail("Did not throw ConcurrentModificationException");
//			}
//		}
//	}

}
