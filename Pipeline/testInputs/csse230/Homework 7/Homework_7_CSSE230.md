# 2223W CSSE230-01: Homework 7

**62 points**

(If doing [EditorTrees](https://moodle.rose-hulman.edu/mod/page/view.php?id=3624724) with a partner) **Don't forget**: You should be keeping an individual log about your team project work so that you can write a performance evaluation for each of your teammates. You do not need to turn in this log, but I wanted to remind you while I had your attention.

---

### To Be Turned In

Submit #1 to the drop box.

1. **(15 points)** In this problem you will check your understanding of collision resolution techniques in hash tables.

   Given the input `{4371, 1323, 6173, 4199, 4344, 9679, 1989}`, a fixed table size of 10, and a hash function H(X) = X mod 10, insert the values in order and show the resulting final...

   a. Linear probing hash table
   b. Quadratic probing hash table
   c. Separate chaining hash table

2. **(47 points + up to 5 BONUS points)** StringHashSet implementation. Get the starting code by accepting the github classroom invitation: [StringHashSet Invite Link](https://moodle.rose-hulman.edu/mod/url/view.php?id=3625294). You will be implementing a HashSet using separate chaining. It implements several of the key methods from Java's Set interface. Additionally:

   - You will use an array for internal storage, and will grow the array when lambda gets too big. (Don't use an ArrayList since it won't grow at the right time.)
   - It only needs to work for Strings.
   - You will implement a method to compute the String hash code. (You will probably implement the 31x+y pattern either how we did in lecture. If you instead choose to use `Math.pow(31, ...)`, it returns a double, so you'd need to typecast for it to overflow correctly: **(int)** `Math.pow(31, ...)`.)
   - You will also implement a `toRawString` function that dumps out the array of LinkedLists without formatting — this is to make sure it is putting everything in the right place.
   - You will implement other methods. We did them in the order they appeared in the file, and the tests for later ones assume you passed the tests for the earlier ones. For example, to test `remove()`, we need to be able to add values first.
   - One cannot insert null.
   - The test cases enforce adding it to the beginning of the LinkedList. It's faster than rolling through the list again to add at the end.
   - Java's HashSet has an initial capacity of 16 and rehashes when lambda reaches .75. To force more collisions earlier, we will use an initial capacity of 5, and rehash when lambda reaches 2.
   - The most challenging (fun) part of this was writing an iterator, since it needed to traverse a bunch of possibly empty linked lists. Once you have an iterator, it made some other things (`toString` and rehashing) easier. But I recognize you are busy with your project, so am making the iterator optional, and worth a few bonus points as a reward if you get it working on your own.

3. During class, make progress on the [HeapsAndHeapsort](https://moodle.rose-hulman.edu/mod/page/view.php?id=3624811) assignment. If you choose to use class time differently, you should plan to spend some out-of-class time on it. This will be part of a later assignment. Your 10th week self will thank you for working on it now while it's fresh in your mind.

---

### Optional practice problem — not to be turned in

This problem has been assigned in the past. Since you are actually *implementing* height-balanced trees, it seems redundant. But it could still be a very good practice problem for the next exam, so we did not remove it.

**(0 points)** Start with the following Binary Search Tree:

![Starting BST](https://moodle.rose-hulman.edu/pluginfile.php/4358611/mod_page/content/13/WA7.png)

a. Is this an AVL tree? \_\_\_\_ If not, rearrange it so that it is height-balanced.

b. Draw the tree after insertion of a node containing 11, using the usual BST insertion algorithm.

c. Is the new tree AVL? \_\_\_\_\_\_ If not, name the node where the rotation should be done, according to the algorithm from class. \_\_\_\_\_\_ Single or double rotation? \_\_\_\_\_\_\_\_\_\_\_\_ If you need to do a rotation, draw the resulting tree.

d. Delete the element 5 from the **original** tree (not the one from part c), using the BST deletion algorithm **described in class, using the inorder successor**. Draw the new tree.

e. Is the new tree AVL? \_\_\_\_\_\_ If not, name the node where the rotation should be done, according to the algorithm from class. \_\_\_\_\_\_ Single or double rotation? \_\_\_\_\_\_\_\_\_\_\_\_ If you need to do a rotation, draw the resulting tree.

f. Is your new tree (if any) AVL? \_\_\_\_\_\_ If not, name the node where the rotation should be done, according to the algorithm from class. \_\_\_\_\_\_ Single or double rotation? \_\_\_\_\_\_\_\_\_\_\_\_ If you need to do a rotation, draw the resulting tree.

g. Add the element 5 to the tree from part (f) using the BST algorithm. Draw the new tree.

h. Is the new tree AVL? \_\_\_\_\_\_ If not, name the node where the rotation should be done, according to the algorithm from class. \_\_\_\_\_\_ Single or double rotation? \_\_\_\_\_\_\_\_\_\_\_\_ If you need to do a rotation, draw the resulting tree.

i. Add the element 12 to the tree from part (h). Draw the new tree.

j. Is the new tree AVL? \_\_\_\_\_\_ If not, name the node where the rotation should be done, according to the algorithm from class. \_\_\_\_\_\_ Single or double rotation? \_\_\_\_\_\_\_\_\_\_\_\_ If you need to do a rotation, draw the resulting tree.

k. Add the element 7 to the tree from part (j). Draw the new tree.

l. Is the new tree AVL? \_\_\_\_\_\_ If not, name the node where the rotation should be done, according to the algorithm from class. \_\_\_\_\_\_ Single or double rotation? \_\_\_\_\_\_\_\_\_\_\_\_ If you need to do a rotation, draw the resulting tree.

**Hint**: In my solution, for all the sub-parts together, I did three single rotations and no double rotations. The first four leaf nodes in my final tree were 3, 5, 7, and 9. *(In my first attempt, I misread part d) and deleted from the tree in part c) rather than the original tree. With that mistake, for all the sub-parts together, I did two single rotations and one double rotation and the first four leaf nodes in my final tree were also 3, 5, 7, and 9.)*

---

*Last modified: Wednesday, 27 April 2022, 12:36 PM*
