package subtree;

import static org.junit.Assert.assertEquals;

import org.junit.AfterClass;
import org.junit.Test;

public class SubtreeTest {

	private static int maxSubtreePoints = 0;

	@Test
	public void testMaxSubtreeEmpty() {
		BinaryTree b1 = new BinaryTree();
		assertEquals("$0", b1.maxSubtree());
		maxSubtreePoints += 1;
	}

	@Test
	public void testMaxSubtreeSingleNode() {
		BinaryTree b1 = new BinaryTree("E", "0", new int[] { 17 });
		assertEquals("E17", b1.maxSubtree());
		maxSubtreePoints += 1;
	}

	@Test
	public void testMaxSubtreeSingleNodeNegative() {
		BinaryTree b1 = new BinaryTree("E", "0", new int[] { -3 });
		assertEquals("$0", b1.maxSubtree());
		maxSubtreePoints += 1;
	}

	@Test
	public void testMaxSubtreeTinyNegative() {
		BinaryTree b2 = new BinaryTree("EA", "L0", new int[] { 5, -7 });
		assertEquals("$0", b2.maxSubtree());
		maxSubtreePoints += 1;
	}

	@Test
	public void testMaxSubtreeTinyRootMax() {
		BinaryTree b2 = new BinaryTree("EA", "L0", new int[] { 8, -3 });
		assertEquals("E5", b2.maxSubtree());
		maxSubtreePoints += 1;
	}

	@Test
	public void testMaxSubtreeTinyLeafMax() {
		BinaryTree b2 = new BinaryTree("EA", "L0", new int[] { -10, 3 });
		assertEquals("A3", b2.maxSubtree());
		maxSubtreePoints += 1;
	}

	@Test
	public void testMaxSubtreeSmallRightMax() {
		BinaryTree b1 = new BinaryTree("ABC", "200", new int[] { -10, 2, 6 });
		assertEquals("C6", b1.maxSubtree());
		maxSubtreePoints += 1;
	}

	@Test
	public void testMaxSubtreeHeightOfTwo() {
		BinaryTree b1 = new BinaryTree("ABCDE", "20200", new int[] { 5, -10, 6,
				7, -4 });
		assertEquals("C9", b1.maxSubtree());
		maxSubtreePoints += 1;
	}

	@Test
	public void testMaxSubtreeClearWinner() {
		BinaryTree b1 = new BinaryTree("ABCDEFGH", "L2200200", new int[] { -2,
				3, -1, -2, -5, 10, -1, 5 });
		assertEquals("F14", b1.maxSubtree());

		BinaryTree b2 = new BinaryTree("ABCDEFGH", "L2200200", new int[] { 40,
				3, -1, -2, -5, 10, -1, 5 });
		assertEquals("A49", b2.maxSubtree());

		maxSubtreePoints += 3;
	}

	@Test
	public void testMaxSubtreeFewerChildren() {
		BinaryTree b1 = new BinaryTree("ABCDEF", "LRLLR0", new int[] { -10, 9,
				-8, 7, -6, 5 });
		assertEquals("B7", b1.maxSubtree());

		BinaryTree b2 = new BinaryTree("ABCEFGHD", "R2LR2000", new int[] { 1,
				4, -20, 10, -3, 5, 4, -2 });
		assertEquals("E16", b2.maxSubtree());

		maxSubtreePoints += 2;
	}

	@Test
	public void testMaxSubtreeOnTestPaper() {
		// This is the one that is printed on the test page.
		BinaryTree b1 = new BinaryTree("MAXSUBTREes", "22200022000", new int[] {
				-30, 2, 6, 10, 3, 1, 10, 2, 50, -5, -15 });
		assertEquals("E50", b1.maxSubtree());

		// This is almost identical to the one that is printed on the test page,
		// but the E is changed to 21, giving a new max.
		BinaryTree b2 = new BinaryTree("MAXSUBTREes", "22200022000", new int[] {
				-30, 2, 6, 10, 3, 1, 10, 2, 21, -5, -15 });
		assertEquals("A22", b2.maxSubtree());

		// This is almost identical to the one that is printed on the test page,
		// but I changed the root to -14, so the whole tree also has a value of
		// 50, and is further left, so wins.
		BinaryTree b3 = new BinaryTree("MAXSUBTREes", "22200022000", new int[] {
				-14, 2, 6, 10, 3, 1, 10, 2, 50, -5, -15 });
		assertEquals("M50", b3.maxSubtree());
		maxSubtreePoints += 3;
	}

	@Test
	public void testMaxSubtreeLeftWinsTie() {
		BinaryTree b1 = new BinaryTree("ABCDE", "22000", new int[] { 5, 3, 2,
				1, -5 });
		assertEquals("B6", b1.maxSubtree());
		maxSubtreePoints += 1;
	}

	@Test
	public void testMaxSubtreeRootWinsTie() {
		BinaryTree b1 = new BinaryTree("ABCDE", "20200", new int[] { 5, -5, 3,
				-1, 1 });
		assertEquals("A3", b1.maxSubtree());
		maxSubtreePoints += 1;
	}

	@Test
	public void testMaxSubtreeHeightOfFour() {
		BinaryTree b1 = new BinaryTree("ABCDEFGHIJKLMNOPQRSTUVWXYZa",
				"222002200200222002002200200", new int[] { 10, -5, -7, 2, -4,
						3, -5, 2, 7, -6, 4, 1, 3, -2, -4, 7, 3, -5, 10, -13, 4,
						-5, 2, -2, 1, 2, -3 });
		assertEquals("S10", b1.maxSubtree());

		maxSubtreePoints += 2;
	}

	@AfterClass
	public static void displayPoints() {
		System.out.printf("%d/20 maxSubtree correctness points\n",
				maxSubtreePoints);
		System.out
				.println("     ---maxSubtree efficiency points will be checked by instructor\n");
	}
}