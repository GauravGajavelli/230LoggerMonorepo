# 2223W CSSE230-01: GraphSurfing | RHIT

## Milestones

|     |           |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
|-----|-----------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| 1   | (100 pts) | Create classes `AdjacencyListGraph<T>` and `AdjacencyMatrixGraph<T>` that extend the given abstract class `Graph<T>`. For each, implement and test the following methods: constructor taking a `Set<T>` of keys, `addEdge(T from, T to)`, `size()`, `numEdges()`, `hasVertex(T key)`, `keySet()`, `hasEdge(T from, T to)`, `removeEdge(T from, T to)`, `outDegree(T key)`, `inDegree(T key)`, `successorSet(T key)`, `predecessorSet(T key)`. Also implement `successorIterator(T key)` and `predecessorIterator(T key)`, which return appropriate lazy iterators that traverse the corresponding neighbors of `key`. |
| 2   | (60 pts)  | Implement `shortestPath(T from, T to)` and `stronglyConnectedComponent(T key)`. Also, see challenge for possible bonus points: find a challenge pair for the Wikisurfing game.                                                                                                                                                                                                                                                                                                                                                                                                                                        |

## Overview

This is a mostly individual programming assignment. In the second week, individuals are allowed to specify one teammate (another student in your section) with whom to discuss ideas. You each will still commit individually, but it's fine if you and your teammate have similar solutions for Milestone 2 methods. On the other hand, you are not to discuss solution ideas with any other CSSE230 student besides your designated teammate until after the project due date.

For this problem, you’ll implement the Graph ADT in two ways: as an adjacency list representation and as an adjacency matrix representation. In the second milestone, you will write methods to (1) find the shortest path between any pair of elements in the graph and (2) find the strongly connected component of any element in the graph, and the tests will apply both of these methods to a subgraph of the Wikipedia links graph. Manually [finding shortest paths in the Wikipedia links graph](https://en.wikipedia.org/wiki/Wikipedia:Link_surfing) is known as Wiki Racing, the Wiki Game, or [Wikisurfing](https://www.urbandictionary.com/define.php?term=wikisurfing). Try it for yourself [here](https://thewikigame.com/speed-race)!  

If you missed the intro in class or are taking this online, check out the [GraphSurfing Intro Video](https://moodle.rose-hulman.edu/mod/page/view.php?id=3624859 "GraphSurfing Intro Video").  

### Incremental Development Path

Get the starting code by accepting the github classroom invitation: [GraphSurfing Invite Link](https://moodle.rose-hulman.edu/mod/url/view.php?id=3625300 "GraphSurfing Invite Link").

Then download and unzip the [GraphSurfingData](https://moodle.rose-hulman.edu/mod/resource/view.php?id=3624856 "GraphSurfingData") file into your Eclipse workspace (probably at `c:/EclipseWorkspaces/csse230/`) so that the `GraphSurfing` project and the unzipped [`GraphSurfingData`](https://moodle.rose-hulman.edu/mod/resource/view.php?id=3624856 "GraphSurfingData") folder are siblings. Note that you can simply move it to this directory from your desktop; no need to actually import it into Eclipse. In any case, please **do not commit the data files**! They take up lots of room and bandwidth on the Git server.

## Detailed specifications

An abstract class `Graph<T>` is given to you. In **Milestone 1**, you will implement this class in two ways, using (1) an adjacency list representation and (2) an adjacency matrix representation. Each implementation requires several methods that are specified in the abstract class. **Read the Javadocs in the `Graph<T>` class for details!** Use the Milestone 1 test to guide you. Many of the tests use the following two example graphs: note that the first is a `Graph<String>` and the second is a `Graph<Integer>`.

![Example graph \#1](https://moodle.rose-hulman.edu/pluginfile.php/4358656/mod_page/content/9/examplegraph.png)                  ![Example graph \#2](https://moodle.rose-hulman.edu/pluginfile.php/4358656/mod_page/content/9/example2graph.png)

![GraphSurfing UML for starter code](https://moodle.rose-hulman.edu/pluginfile.php/4358656/mod_page/content/9/GraphSurfingUML.png?time=1675694306290)  

To make sure your implementations are truly adjacency-list and adjacency-matrix-based, the Milestone 1 tests include two speed tests:

- `testRelativeSpeedforOutDegree`: Calculating out-degree of a vertex should be faster for an adjacency list representation than an adjacency matrix representation. (Why?)
- `testRelativeSpeedforRemoveEdge`: Removing edges should be faster for an adjacency matrix representation than an adjacency list representation. (Why?)

Beyond awarding unit test points, the results of these speed tests will act as a flag for the grader. If, on inspection, your code seems to be unfaithful to the desired representations (adjacency list and adjacency matrix), it is possible that you may lose unit test points even for working code.

The Milestone 1 tests also include speed tests for the iterators, to make sure they are lazy.

For **Milestone 2**, implement two new methods that relate to the link-surfing game. The `shortestPath(T from, T to)` method allows the computer to optimally solve the link-surfing game on the graph. The `stronglyConnectedComponent(T key)` method is not as directly relevant to the link-surfing game, but it could be used to establish a "universe" of keys for which any pair forms a solveable challenge in the link-surfing game. It also identifies "cliques" within the graph, providing insight into the structure of the graph's communities.

Tip: it is legal (and encouraged) to implement methods in the abstract `Graph<T>` class if they are implementation-independent (i.e., utilize only other abstract `Graph<T>` methods.) In this case, remove the `abstract` modifier from the method declaration and implement in `Graph<T>`. This can save you some copy-pasting, and increase the elegance of your code! (This is mainly helpful in Milestone 2. In Milestone 1, most of your methods will likely be implementation-dependent.)  

If you aren't sure where to start, you can watch the optional [Graph Traversals](https://moodle.rose-hulman.edu/mod/page/view.php?id=3624847 "Graph Traversals") videos.  

## WikiSurfing

Once you have implemented `shortestPath(T from, T to)` and `stronglyConnectedComponent(T key)`, it's time to **WikiSurf**! Follow the instructions in the "Incremental Development Path" section above. The data files you download contain a subset of the Wikipedia links graph: vertices consist of all page names in the [Living people category](https://en.wikipedia.org/wiki/Category:Living_people), further reduced by removing all vertices that have no edges in this subgraph. That is, you're working only with Wikipedia pages of living people. The resulting graph has over 460,000 vertices and over 2.1 million edges. \[The data originates from the [Wikicrush project](https://github.com/trishume/wikicrush) and has been condensed for our project. This dataset was collected in February 2015.\]

The Milestone 2 tests will call methods from the `WikiSurfing` class, that construct the graph using your code from Milestone 1, and then run your Milestone 2 methods to see how they work on the large graph.

Optional challenge problem for bonus points: Find a **challenge pair**: pair of keys in the Living People graph whose shortest path is as long as possible. To receive any bonus points, the shortest path of your challenge pair must be at least length 16. You receive 1 bonus point for each step you go beyond 16.

If you have a pair, copy the *from* and *to* keys into the first two lines of the challenge-pair.txt file in your project folder. Also, provide some documentation as to how you found your pair: explain briefly in words what you did in the challenge-pair.txt file starting on the third line. Of course, commit any code that you used to find your pair. (Milestone 2 teammates can report the same challenge pair, but I don't expect to see common pairs between teams, unless people are finding an optimal pair.)

## Grading

Based mainly on unit tests, with some manual inspection to make sure tests are behaving as intended.

## Submission

Submit your code by committing it to your github repository.

Last modified: Monday, 6 February 2023, 9:39 AM
