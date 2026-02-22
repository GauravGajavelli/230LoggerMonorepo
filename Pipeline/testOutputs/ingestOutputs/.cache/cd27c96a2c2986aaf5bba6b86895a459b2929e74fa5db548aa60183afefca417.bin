



import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.fail;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Iterator;
import java.util.NoSuchElementException;

import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;

import testSupport.LoggingExtension;


@ExtendWith(LoggingExtension.class)
public class BSTTesting {

	private static int points = 0;

// Uncomment when you are ready to test.
	@Test
	public void testInsertInts() {
		BinarySearchTree<Integer> b = new BinarySearchTree<Integer>();
		assertEquals("[]", b.toString());
		points += 1;
		b.insert(7);
		assertEquals("[7]", b.toString());
		points += 2;
		b.insert(4);
		assertEquals("[4, 7]", b.toString());
		b.insert(10);
		assertEquals("[4, 7, 10]", b.toString());
		b.insert(2);
		assertEquals("[2, 4, 7, 10]", b.toString());
		b.insert(5);
		assertEquals("[2, 4, 5, 7, 10]", b.toString());
		points += 3;
	}

	@Test
	public void testInsertStrings() {
		BinarySearchTree<String> b = new BinarySearchTree<String>();
		assertEquals("[]", b.toString());
		b.insert("green");
		assertEquals("[green]", b.toString());
		b.insert("blue");
		assertEquals("[blue, green]", b.toString());
		b.insert("red");
		assertEquals("[blue, green, red]", b.toString());
		b.insert("orange");
		assertEquals("[blue, green, orange, red]", b.toString());
		b.insert("yellow");
		assertEquals("[blue, green, orange, red, yellow]", b.toString());
		points += 3;
	}

	
	@Test
	public void testInsertReturnValueInt() {
		BinarySearchTree<Integer> b = new BinarySearchTree<Integer>();
		b.insert(7);
		b.insert(4);
		b.insert(10);
		b.insert(2);
		b.insert(5);
		assertFalse(b.insert(5));
		assertTrue(b.insert(1));
		points += 2;
	}
	
	@Test
	public void testInsertReturnValueString() {
		BinarySearchTree<String> b = new BinarySearchTree<String>();
		b.insert("mercury");
		b.insert("venus");
		b.insert("earth");
		b.insert("mars");
		b.insert("jupiter");
		assertFalse(b.insert("earth"));
		assertTrue(b.insert("pluto"));
		points += 2;
	}

	@Test
	public void testInsertExceptions() {
		BinarySearchTree<Integer> b = new BinarySearchTree<Integer>();
		b.insert(7);
		b.insert(4);
		b.insert(10);
		b.insert(2);
		b.insert(5);

		try {
			b.insert(null);
			fail("Did not throw IllegalArgumentException");
		} catch (Exception e) {
			if (!(e instanceof IllegalArgumentException)) {
				fail("Did not throw IllegalArgumentException");
			}
		}
		points += 2;
	}

	@Test
	public void testHeight() {
		BinarySearchTree<Integer> b = new BinarySearchTree<Integer>();
		assertEquals(-1, b.height());
		points += 1;

		b.insert(3);
		assertEquals(0, b.height());
		points += 2;

		b.insert(4);
		b.insert(5);
		assertEquals(2, b.height());
		points += 2;
	}

	@Test
	public void testSize() {
		BinarySearchTree<Integer> b = new BinarySearchTree<Integer>();
		assertEquals(0, b.size());
		points += 1;

		b.insert(3);
		assertEquals(1, b.size());
		points += 1;

		b.insert(4);
		b.insert(5);
		assertEquals(3, b.size());
		points += 1;
		b.insert(5);
		assertEquals(3, b.size());
		points += 2;
	}

	@Test
	public void testIsEmpty() {
		BinarySearchTree<Integer> b = new BinarySearchTree<Integer>();
		assertTrue(b.isEmpty());
		points += 1;

		b.insert(3);
		assertFalse(b.isEmpty());
		points += 1;
	}

	@Test
	public void testContainsInts() {
		BinarySearchTree<Integer> b = new BinarySearchTree<Integer>();
		b.insert(7);
		b.insert(4);
		b.insert(10);
		b.insert(2);
		b.insert(5);
		// assertEquals("[2, 4, 5, 7, 10]", b.toString());
		assertFalse(b.contains(1));
		assertTrue(b.contains(2));
		points += 1;
		assertFalse(b.contains(3));
		assertTrue(b.contains(4));
		points += 1;
		assertTrue(b.contains(5));
		assertTrue(b.contains(7));
		points += 1;
		assertTrue(b.contains(10));
		assertFalse(b.contains(11));
		points += 1;
	}

	@Test
	public void testContainsStrings() {
		BinarySearchTree<String> b = new BinarySearchTree<String>();
		b.insert("green");
		b.insert("blue");
		b.insert("red");
		b.insert("orange");
		b.insert("yellow");
		assertEquals("[blue, green, orange, red, yellow]", b.toString());
		assertFalse(b.contains("purple"));
		assertTrue(b.contains("green"));
		points += 1;
		assertFalse(b.contains("fucsia"));
		assertTrue(b.contains("blue"));
		points += 1;
		assertTrue(b.contains("red"));
		assertTrue(b.contains("yellow"));
		points += 1;
		assertTrue(b.contains("orange"));
		assertFalse(b.contains("turquoise"));
		points += 1;
	}

	@Test
	public void testToArrayList() {
		BinarySearchTree<Integer> b = new BinarySearchTree<Integer>();
		assertEquals(new ArrayList<Integer>(), b.toArrayList());
		points += 1;

		b.insert(6);
		b.insert(8);
		b.insert(10);

		ArrayList<Integer> temp = new ArrayList<Integer>();
		temp.add(6);
		temp.add(8);
		temp.add(10);
		assertEquals(temp, b.toArrayList());
		points += 2;

		b.insert(2);
		b.insert(4);
		b.insert(1);
		temp = new ArrayList<Integer>();
		temp.add(1);
		temp.add(2);
		temp.add(4);
		temp.add(6);
		temp.add(8);
		temp.add(10);
		assertEquals(temp, b.toArrayList());
		points += 2;
	}

	@Test
	public void testToArrayInts() {
		BinarySearchTree<Integer> b = new BinarySearchTree<Integer>();
		assertEquals(0, b.toArray().length);
		points += 1;

		b.insert(3);
		b.insert(4);
		b.insert(5);
		Object[] temp = { 3, 4, 5 };
		Object[] foo = b.toArray();
		for (int j = 0; j < temp.length; j++) {
			assertEquals(temp[j], foo[j]);
		}
		points += 1;
	}
	
	@Test
	public void testToArrayStrings() {
		BinarySearchTree<String> b = new BinarySearchTree<String>();
		b.insert("aaa");
		b.insert("bbb");
		b.insert("ccc");
		Object[] temp = { "aaa", "bbb", "ccc" };
		Object[] foo = b.toArray();
		for (int j = 0; j < temp.length; j++) {
			assertEquals(temp[j], foo[j]);
		}
		points += 1;
	}

	@Test
	public void testToString() {
		BinarySearchTree<Integer> b = new BinarySearchTree<Integer>();
		assertEquals("[]", b.toString());
		points += 1;

		b.insert(3);
		b.insert(4);
		b.insert(5);
		assertEquals("[3, 4, 5]", b.toString());
		points += 1;
	}

	@Test
	public void testInefficientIterator() {
		BinarySearchTree<Integer> b = new BinarySearchTree<Integer>();
		Iterator<Integer> iter = b.inefficientIterator();
		assertFalse(iter.hasNext(), "Expected: false");
		points += 1;

		b.insert(6);
		b.insert(5);
		b.insert(7);
		b.insert(2);
		b.insert(9);
		b.insert(1);
		b.insert(4);
		b.insert(8);
		b.insert(3);

		iter = b.inefficientIterator();
		Object[] temp = { 1, 2, 3, 4, 5, 6, 7, 8, 9 };
		boolean[] tempValues = { true, true, true, true, true, true, true, true, false };
		for (int k = 0; k < temp.length; k++) {
			assertEquals(temp[k], iter.next());
			assertEquals(tempValues[k], iter.hasNext());
		}
		points += 3;
		try {
			iter.next();
			fail("Did not throw NoSuchElementException");
		} catch (Exception e) {
			if (!(e instanceof NoSuchElementException)) {
				fail("Did not throw NoSuchElementException");
			}
		}
		points += 1;
	}

	@Test
	public void testPreOrderIterator() {
		BinarySearchTree<Integer> b = new BinarySearchTree<Integer>();
		Iterator<Integer> iter = b.preOrderIterator();
		assertFalse(iter.hasNext(), "Expected: false");
		points += 1;

		b.insert(6);
		b.insert(5);
		b.insert(7);
		b.insert(2);
		b.insert(9);
		b.insert(1);
		b.insert(4);
		b.insert(8);
		b.insert(3);

		iter = b.preOrderIterator();
		Object[] temp = { 6, 5, 2, 1, 4, 3, 7, 9, 8 };
		boolean[] tempValues = { true, true, true, true, true, true, true, true, false };
		for (int k = 0; k < temp.length; k++) {
			assertEquals(temp[k], iter.next());
			assertEquals(tempValues[k], iter.hasNext());
		}
		points += 4;
		try {
			iter.next();
			fail("Did not throw NoSuchElementException");
		} catch (Exception e) {
			if (!(e instanceof NoSuchElementException)) {
				fail("Did not throw NoSuchElementException");
			}
		}
		points += 2;
	}

	@Test
	public void testIterator() {
		BinarySearchTree<Integer> b = new BinarySearchTree<Integer>();
		Iterator<Integer> iter = b.iterator();
		assertFalse(iter.hasNext(), "Expected: false");
		points += 1;

		b.insert(6);
		b.insert(5);
		b.insert(7);
		b.insert(2);
		b.insert(9);
		b.insert(1);
		b.insert(4);
		b.insert(8);
		b.insert(3);

		iter = b.iterator();
		Object[] temp = { 1, 2, 3, 4, 5, 6, 7, 8, 9 };
		boolean[] tempValues = { true, true, true, true, true, true, true, true, false };
		for (int k = 0; k < temp.length; k++) {
			assertEquals(temp[k], iter.next());
			assertEquals(tempValues[k], iter.hasNext());
		}
		points += 6;
		try {
			iter.next();
			fail("Did not throw NoSuchElementException");
		} catch (Exception e) {
			if (!(e instanceof NoSuchElementException)) {
				fail("Did not throw NoSuchElementException");
			}
		}
		points += 1;
	}

	@Test
	public void testRemove() {
		// Doesn't test return value. Does rely on insert() and preOrderIterator()
		BinarySearchTree<Integer> b = new BinarySearchTree<Integer>();
		assertEquals("[]", b.toString());

		// remove just root
		b.insert(4);
		b.remove(4);
		assertEquals("[]", b.toString());
		points += 1;

		// remove right child in simple tree
		b.insert(10);
		b.insert(4);
		b.insert(14);
		b.remove(14);
		
		Integer[] a = { 10, 4 };
		boolean[] bool = { true, false };
		Iterator<Integer> iter = b.preOrderIterator();
		assertTrue(iter.hasNext(), "Expected: true");
		for (int k = 0; k < a.length; k++) {
			assertEquals(a[k], iter.next());
			assertEquals(bool[k], iter.hasNext());
		}
		points += 2;

		// remove left child in simple tree
		b.insert(14);

		b.remove(4);
		a[0] = 10;
		a[1] = 14;
		iter = b.preOrderIterator();
		assertTrue(iter.hasNext(), "Expected: true");
		for (int k = 0; k < a.length; k++) {
			assertEquals(a[k], iter.next());
			assertEquals(bool[k], iter.hasNext());
		}
		points += 2;

		// remove root in simple tree
		b.insert(4);
		b.remove(10);
		a[0] = 4;
		a[1] = 14;
		iter = b.preOrderIterator();
		assertTrue(iter.hasNext(), "Expected: true");
		for (int k = 0; k < a.length; k++) {
			assertEquals(a[k], iter.next());
		}
		points += 3;
	}

	
	@Test
	public void testRemoveReturnValue() {
		// Same as previous test, but testing return value also.
		BinarySearchTree<Integer> b = new BinarySearchTree<Integer>();
		assertEquals("[]", b.toString());
		
		// removal from empty tree
		assertFalse(b.remove(7));
		points += 1;

		// remove just root
		b.insert(4);
		assertTrue(b.remove(4));
		assertEquals("[]", b.toString());
		points += 2;

		// remove right child in simple tree
		b.insert(10);
		b.insert(4);
		b.insert(14);
		assertTrue(b.remove(14));
		points += 2;
		
		Integer[] a = { 10, 4 };
		boolean[] bool = { true, false };
		Iterator<Integer> iter = b.preOrderIterator();
		assertTrue(iter.hasNext());
		for (int k = 0; k < a.length; k++) {
			assertEquals(a[k], iter.next());
			assertEquals(bool[k], iter.hasNext());
		}
		

		// remove left child in simple tree
		b.insert(14);

		iter = b.preOrderIterator();
		assertTrue(b.remove(4));
		points += 2;

		a[0] = 10;
		a[1] = 14;
		iter = b.preOrderIterator();
		assertTrue(iter.hasNext());
		for (int k = 0; k < a.length; k++) {
			assertEquals(a[k], iter.next());
			assertEquals(bool[k], iter.hasNext());
		}
		

		// remove root in simple tree
		b.insert(4);
		assertTrue(b.remove(10));
		a[0] = 4;
		a[1] = 14;
		iter = b.preOrderIterator();
		assertTrue(iter.hasNext());
		for (int k = 0; k < a.length; k++) {
			assertEquals(a[k], iter.next());
			assertEquals(bool[k], iter.hasNext());
		}
		points += 3;
	}
	
	@Test
	public void testRemoveIllegalArgumentException() {
		BinarySearchTree<Integer> b = new BinarySearchTree<Integer>();
		assertEquals("[]", b.toString());
		b.insert(10);
		b.insert(4);
		b.insert(14);

		// Remove null element
		try {
			b.remove(null);
			fail("Did not throw IllegalArgumentException");
		} catch (Exception e) {
			if (!(e instanceof IllegalArgumentException)) {
				fail("Did not throw IllegalArgumentException");
			}
		}
		points += 1;

	}

	@Test
	public void testRemoveAdvanced() {
		// Remove leaf from complex tree.
		BinarySearchTree<Integer> b = new BinarySearchTree<Integer>();
		b.insert(10);
		b.insert(15);
		b.insert(5);
		b.insert(2);
		b.insert(7);
		b.insert(1);
		b.insert(3);
		b.remove(7);
		assertEquals("[1, 2, 3, 5, 10, 15]", b.toString());
		Integer[] m = { 10, 5, 2, 1, 3, 15 };
		boolean boo[] = { true, true, true, true, true, false };
		Iterator<Integer> iter = b.preOrderIterator();
		assertTrue(iter.hasNext());
		for (int k = 0; k < m.length; k++) {
			assertEquals(m[k], iter.next());
			assertEquals(boo[k], iter.hasNext());
		}
		points += 5;

		// Remove node with 1 child from complex tree.
		b.remove(5);
		assertEquals("[1, 2, 3, 10, 15]", b.toString());
		Integer[] n = { 10, 2, 1, 3, 15 };
		boolean boo2[] = { true, true, true, true, false };
		iter = b.preOrderIterator();
		assertTrue(iter.hasNext());
		for (int k = 0; k < n.length; k++) {
			assertEquals(n[k], iter.next());
			assertEquals(boo2[k], iter.hasNext());
		}
		points += 5;

		// Remove node with 2 children from complex tree.
		b.remove(10);
		assertEquals("[1, 2, 3, 15]", b.toString());
		Integer[] p = { 3, 2, 1, 15 };
		boolean boo3[] = { true, true, true, false };
		iter = b.preOrderIterator();
		assertTrue(iter.hasNext());
		for (int k = 0; k < p.length; k++) {
			assertEquals(p[k], iter.next());
			assertEquals(boo3[k], iter.hasNext());
		}
		points += 3;

		// removal of non-existing element
		assertFalse(b.remove(7));
		points += 3;
	}

	@Test
	public void testEfficiency() {
		int size = 1000000;
		
		// 1. Create elements from 1..size so we know they are unique. 
		// give initial capacity since we know we will fill it. 
		ArrayList<Integer> nums = new ArrayList<Integer>(size); 
		for (int i = 0; i < size; i++) {
			nums.add(i);
		}
		// Randomize the order
		Collections.shuffle(nums);
		
		BinarySearchTree<Integer> b = new BinarySearchTree<Integer>();
		for (int num : nums) {
			b.insert(num);
		}
		int height = b.height();
		
		System.out.printf("When n = %d elements, h(T) = %d\n", size, height);
		System.out.printf("Note: in our solution, n = 1000000 usually has a height of ~50, or ~2.5*log(1000000) after random inserts.\n");
		System.out.printf("If yours is much bigger, you should check your insert.\n");
		System.out.printf("If this method takes longer than a couple seconds to run, you should also check your insert.\n");
		// Quick sanity check: is height < 4* log_2(n) (this is a good buffer)
		assertTrue(height < 4 * Math.log(size) / Math.log(2));
	}
	
	@AfterAll
	public static void displayPoints() {
		System.out.printf("You earned %d/100 correctness points on the unit tests\n",
				points);
		System.out.println("Other points will depend on style/javadoc/efficiency");
	}

}
