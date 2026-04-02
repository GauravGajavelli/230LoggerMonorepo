# CSSE230 Winter 2022-2023 (a.k.a. 202320) — Syllabus

## What is this course about?

### What will I learn?

**Your goal:** After successfully completing this course, you will be able to *independently* analyze, develop and debug software that uses correct, clear, and efficient algorithms and data structures. You will start to *think like* a Computer Scientist.

### What will I do?

**Your work required:**

- To learn to analyze algorithms (exact and big O runtime of code that uses loops, nested loops, and recursion) and write efficient algorithms, you will **complete 1 homework set each week**. Mostly these will be written problems, but occasionally there will also be a small program to write.
- To independently develop and debug correct, clear, and efficient software, you will **complete 1 major programming assignment each week**. You will learn to plan your design on paper and to use the debugger to trace your code.

### Do I have what it takes to do this?

The formal prerequisites are MA 112 and a grade of C or better in CSSE 220, so we expect that you are comfortable with basic summations, know how to program and debug object-oriented Java code well, and that you have experience coding linked lists, recursive methods and simple sorting algorithms. Needed attitudes are (1) a willingness to work hard, (2) patience to plan your code before writing it, (3) the tenacity to code and debug until it works, (4) willingness to work cooperatively and responsibly with partner(s) on pair and team assignments, and (5) attention to detail while doing analysis.

Here is a more detailed **list of prerequisite attributes**, for those who like lists.

### What kind of stuff will I learn?

- Why ArrayLists **double** in internal capacity when they fill up and we add another element.
- How fast looping and recursive code runs.
- Why balanced Binary Search Trees allow you to lookup AND insert items, both in O(log n) time!
- What are the two underlying techniques to store ANY collection of data?
- How to choose data structures:
  - Is a **linked list** better than an array list? It depends!
  - Is a **balanced binary search tree** better than a sorted array? It depends (for the same reason!)
  - When is a **binary heap** better than a balanced BST? For a common, but very specific use case!
  - Why not use **hash sets** for everything?
- How to implement all of the above data structures.
- And much, much more.

### What habits of the mind will I learn?

If we are successful in teaching you, ten years from now, you will know:

- ...that you often need to wrack your brain planning your code before you ever type a line of it. So **you'll code with paper and pencil at hand**!
- ...that you have no *idea* if your code does what you think it does unless you step through it. So **you'll use the debugger**!
- ...that it often pays to write and **rewrite** code so it is **elegant**.

---

## Who, when, and where? Help!

### Class Meeting Times and Places

| Section | Instructor | Time | Location |
|---|---|---|---|
| Section 01 | Hollingsworth | 8:00–9:50 | M O269; WF O267 |
| Section 02 | Hollingsworth | 10:00–11:50 | M O269; WF O267 |
| Section 03 | Jelen | 1:00–2:50 | M O269; WF O267 |
| Section 04 | Jelen | 3:00–4:50 | M O269; WF O267 |

### Instructor Information

**Joe Hollingsworth**
- Email: hollings@rose-hulman.edu
- Office: Moench F203
- Office hours: See the resources Moodle page.

**Ben Jelen**
- Email: jelen@rose-hulman.edu
- Office: Moench E207
- Office hours: See the resources Moodle page.

### Course Assistants

- **Graders for written assignments:** Evan Slater, Hanshuo Geng, Tony Martin, Byunghoon Ryu, and Tristan Scheiner.
- **Grading programming assignments:** Brock Buczkowski
- **In-class TAs:** James Li (Section 1), Grant Wyness (Section 2), Dominic Csomos (Section 3), and Yuxuan Jiang (Section 4).
- **Lab Assistant:** Ben Joens. See the CSSE230-only TA Schedules for when they are available.

### Many Other Sources of Help

- Learning center tutors include many willing to help with CSSE230. See the LC Tutor Schedules.
- Besides the instructors and tutors, **other students** in the course can often be a great source of help. And they will also learn more if they explain things to you.
- Don't try to be the Lone Ranger in this course, especially if you do not find the course easy. If you find that you have worked on something for 30 minutes without making any progress, it's probably time to seek help! Software development is a team sport. The best programmers know that a fresh set of eyes can often spot a problem right away.
- But you **aren't ready for an exam until you can write the code yourself**. If you got lots of help, write the code again from scratch before the exam. It may take you more time, but it will help internalize what you've learned.

### Textbook? No.

There is no required textbook for this offering of CSSE230. For most students, our course materials, along with easy-to-find online resources such as Wikipedia, provide enough reference material. If you're looking for more supplemental resources, please ask your instructor for suggestions.

### Where is the course online?

We will use Moodle to post grades and materials that require restricted access, like lecture videos, quizzes, surveys, and homework solutions. Moodle is the hub of the course.

Starting code for most programming projects will be provided using Git repositories (details in the first programming assignment document).

---

## What are the homework policies?

Your solutions to **weekly programming problems** should be well-designed and well-documented. Some will be done with a partner, others will be individual. Each submitted program file should include (in comments at the top of your files) your name(s) and a description of the file's contents. You should use reasonable and consistent Javadoc comments, style, and indentation.

**Longer methods should contain internal comments** that explain *why* you wrote the code the way you did. Your programs should not contain lines that are exceedingly long (causing wraparound and general unreadability of printouts). Grades for programming problems will be based on **correctness**, **style**, and **efficiency**. Submit your solution by pushing your code to your git repository.

We will assign weekly **homework problems** (written and short coding exercises) and a few **in-class exercises**. They will usually be short thought problems, mathematical analyses, or algorithm-design exercises. We expect you to think through them carefully and write your answers legibly and clearly (if you can't write it neatly, type it). On some problems, not only the correctness but also the quality of your solution will determine your grade. Some of the problems will be straightforward practice with concepts from the course; others will require creative solutions. Don't put them off until the last minute! Submit your solution by using **Gradescope** within Moodle.

There will often be **daily quizzes**, which differ significantly from traditional quizzes. (Note: the quizzes are named "in-class quizzes", but that's misleading, since in the hybrid course format, you will complete them *before* class as you are watching the videos.) The answers to all of the questions should be contained in the lecture. The quizzes should help you to focus on some of the lecture material that we consider most important, to stay on track during discussion time, and to have some notes that you can use for review later. They will be graded for completion.

---

## Late Assignment Policy

All assignments must be turned in before the due time if you want credit for them†.

However, we all have days when we are extremely busy, or times when a program takes longer to complete than we expect it will. To account for this, we give each student a "**late day bank account**" that starts with **three** late days. Note: this late day policy applies only to written homework and programming projects. It cannot be used for in-class quizzes and activities, which must be turned in on time for credit.

- **Using (withdrawing) a late day** allows you to turn in any assignment up to 24 hours after the time it is due. It is up to you to turn in work within that time frame, if it falls on a non-class day.
- **You may earn (deposit) a late day** by turning in an assignment at least 24 hours early. (We will sometimes refer to this as an "early day".) There is no limit to the number of days you can save up. Extra late days at the end of the term are never redeemable for cash prizes, but sometimes redeemable for a small, small number of extra-credit points. 8-) If you find a mistake on homework submitted early, it's worth it to fix it and re-submit on time.
- If your late day balance ever becomes zero, you must turn assignments in on time until you are able to earn more days by submitting assignments early. If your late day balance gets down to one any time before the break, consider that a sign that you need to "press harder on the accelerator" in this course.
- At most one late day may be used or earned for any given assignment. Talk to your instructor in advance about an extension if you are faced with unusual circumstances requiring more than 1 day.

Here's a handy chart of recent quarters (Spring 2021, Winter 2022) detailing when people earned and used late days. Start earning late days early — you'll thank yourself later!

### Late Day Procedures

- You do not have to notify us when you earn or use a late day. Just track your balance. (We will keep track of your late and early days based on the time of your submission to a Moodle assignment page or your latest commit time of a given project to your git repository.)
- Some particular assignments may be designated as "no late days" assignments. This might happen because:
  - There is an exam the next day or the day after, so we want to post solutions right away; or
  - What we will do during the next class meeting depends on this assignment.

†*Occasionally*, we will allow extra time for everyone to complete a particular assignment without "extending the due date." The difference is subtle. If you are working on an assignment during a grace period, you should do so with the recognition that you are behind, and you need to quickly finish it and move on to the next assignment. If we decide to give a grace period for an assignment, we will explain the reason for it.

---

## Exams

There will be three midterm exams and a final exam, all but Exam 2 having a paper part and a computer part. (The smaller, in-class Exam 2 will be computer part only.) Exams 1 and 3 will be evening exams, taking the place of a day of class.

**Why evening exams?** Evening exams allow all students to take the exam at the same time. Also, because it is not easy to judge the time required for the programming part, it allows us to give you a few additional minutes at the end if they are needed.

---

## How will my grade be figured?

| Weight | Criteria |
|---|---|
| 5% | Daily quizzes |
| 5% | Citizenship |
| 35% | Written assignments and programming projects |
| 13% | Exam 1 |
| 7% | Exam 2 (programming only) |
| 15% | Exam 3 |
| 20% | Final Exam |

Final grades are also contingent on the following:

- You **must** have a passing (60+) average on the exams to pass the course.
- You must demonstrate that you can *individually* write and debug simple Java programs at the level of this course in order to pass. The exams, particularly the programming parts, will be the usual way to do this. The instructor reserves the right to change final grades when the average in a major category (homework, exams, project) differs significantly from the overall average.
- **Attendance is required**, as detailed below in the note on how citizenship affects your grade.

The above is a guideline that we typically follow. Please understand that it is not a promise. We will do our best to conform to the Rose-Hulman definition of the various grades, as described in the Academic Rules and Procedures. As you read it, note in particular that the phrase "thorough competence to do excellent work" appears in the description of the "B" grade (the standard for "A" is even higher), and it further states that "B" and "B+" will not be given for mere compliance with the minimum essential standards of the course.

---

## Citizenship Counts!

Your default citizenship grade is 80% (4 of 5 points) for average engagement in the CSSE 230 learning community. This includes (virtual or in-person) attendance, engagement, adherence to deadlines, voluntary positive participation in class and online discussion forums, constructive partnership in pair and group assignments, timely completion of various surveys, and peer evaluation of other students' code and of your team members for group projects.

If you come to class and sit quietly and cooperatively, this will be your grade. The easiest way to raise this grade is to volunteer regularly in class. The easiest way to lower this grade is to miss class or come late, without an excused absence.

---

## Java Version

You should be using Java 15 to compile your assignments to ensure the test cases are running correctly. We've noticed that compiling in 16+ results in some issues with JUnit tests.

To address this, ensure you check out **Updating Compiler to Use Java 15**.

---

## What is the course format?

We will follow a partially flipped-classroom approach: video lectures before class, and homework help and project work time in class. The general consensus of recent student feedback points to this model as the most efficient usage of students' in- and out-of-class time.

Course content will be delivered in virtual form through videos and daily quizzes, which should be completed before the corresponding in-person session of class. Completion of these activities will be tracked through Panopto logs and submission of quizzes. Further, we will adopt the following policies for the synchronous sessions:

- To foster our course's sense of community, and facilitate efficient and effective work, students are required to attend at least **the first hour** of each in-person session, as directed by your instructor. Many students choose to work in class for the full session, especially when working on a pair assignment.
- You will turn in your lecture quiz at the beginning of the session.
- This synchronous time will be used exclusively for CSSE230 work time: working on written or programming assignments individually or with a partner, and with ready access to the instructor's help. No non-CSSE230 distractions or multi-tasking! In a sense, these sessions can be viewed as fusing work time with office hours.
- In the interest of everyone's health, students feeling unwell or with health concerns should contact their instructor about participating in class virtually.
- We aim to fully leverage the in-class time set aside for this course. Toward this end, two unexcused absences will affect your Citizenship grade. **Three or more unexcused absences may result in failure of the course.** Habitually arriving late will also affect your grade.

---

## Is it OK for my friends to help me with my homework?

It depends how they "help" you...

Recall the Institute policy on academic misconduct:

> "Rose-Hulman expects its students to be responsible adults and to behave at all times with **honor and integrity**."

Exams and homework will be done on an individual basis except where explicitly noted. The simple rule of thumb for individual work is:

> **Never give or use someone else's code or written answers.**

Such exchanges are definitely cheating and not cooperation.

We encourage you to discuss the problems and general approaches to solving them with other students. However, when it comes to writing answers or code, it must be your own work (or the work of your group if it is a group assignment). If you are having trouble understanding how some Java API code works or pinning down a run-time or logic error in your program, by all means talk to someone about it. Get help with debugging when you need it.

If you use someone else's ideas in your solution, you must:

1. Give credit to that person in the comments of your program, and
2. Be sure that you understand it as well as if it were your own.

If you are ever in doubt about whether some specific situation violates the policy, the best approach is to discuss it with your instructor beforehand. This is a very serious matter that we do not take lightly. Nor should you.

- You should never look at another student's code to get ideas of how to write your own code. Beginning the process of producing your own solution with an electronic copy of work done by other students is never appropriate.
- Working on written problems with other students is strongly encouraged. However, once you have solved a problem, each student should write up the solution individually, without referring to the common solution, to make sure that all of you understand it. Again, electronic copying is never appropriate.

**Plagiarism** (where a student solution to an exam or assignment was copied from another student's solution, past or present, or any solution that is posted anywhere) will result in **a score of -100%** for the assignment or exam. Egregious cases will result in a grade of "F" for the course. Furthermore, such cases **will also be reported to the Department Head and Dean of Students**, as required by the Institute policy, to be added to the student's record and so discourage repeat offenses. More importantly, such dishonesty steals your own self-esteem and your opportunity to learn. So don't cheat!

---

## Making our classroom welcoming

We want you and the other students to feel welcomed in our classroom.

If at any point, **you are not comfortable in the classroom, for ANY reason**, or **you observe any behaviors by ANYONE** (classmates, course assistants or your instructors) that **may make the classroom climate feel less welcoming for students**: please tell us.

Ways to do so include:

- Ask to meet with your instructor privately. Or, explain your concern to your professor after class or by email if you feel comfortable with that and the issue does not require a conversation.
- Talk with any instructor in the department with whom you feel comfortable.
- All your professors will do their utmost to ensure your confidentiality, but sometimes you might feel the need to say something anonymously. You can do so via the link on our class' Moodle page labeled **Anonymous Feedback**. All we ask is that you not use it just to vent when you are momentarily frustrated. Take a deep breath, count to 10, and if you still want to express a concern, by all means use this feedback tool.
- Know your campus resources beyond the CSSE department as well. These include your faculty advisor, your RAs and SAs, and the Office of Student Affairs.
- Or, if you want to express concerns in a completely confidential way, the **Student Counseling Center** is an excellent resource. (See below for how to contact them.)

### You can do your part to ensure a welcoming, professional classroom climate:

- Speak to your classmates, course assistants and instructors with courtesy and professionalism. The classroom atmosphere is informal, but avoid off-color jokes, rude language, or just about anything that might offend someone.
- Be supportive of your classmates. Offer help where appropriate. Help your classmates feel confident and welcomed.
- Project respect to classmates, course assistants and instructors. (And tell us, as described above, if you feel anyone is being disrespectful of you or others in the classroom.)
- Avoid words and behaviors that might be perceived as confrontational or aggressive. Strive to avoid negative "you" phrases like "you are wrong" or "you need to...". Instead, use neutral "I/us" phrases like "I think that that approach is not right" or "Perhaps it would be helpful for us to..."
- Whenever possible, arrive to class on time.
- Set your phone to a "silent" mode, turn off notifications on your computer that might distract classmates, and display only appropriately professional images on your computer screen.
- Don't do anything that will detract from your learning or that of people around you. Such things include talking loudly, chewing gum noisily, and not taking adequate care of your personal hygiene.
- Restrict all your conversations in class to things related to the class, except for times when your instructor allows you to do otherwise (as in a between-periods break, for example).
- If you are experiencing issues that may make you less able to be respectful to others in the classroom, consider alerting your instructor to that fact. Additionally, **we strongly encourage any student who is feeling stress or experiencing any sort of difficult issue** to contact the **Student Counseling Center** (see below). They are an excellent resource available to students for free.

---

## Working with special needs

Rose-Hulman, and the instructors of this course in particular, are committed to working with students who have special needs or disabilities.

We understand that "invisible" disabilities (learning and attention deficit disorders, chronic fatigue syndrome, depression, anxiety, etc.) can significantly affect a student's academic performance.

We strongly encourage students to document special academic circumstances with the staff at the Office of Student Affairs and then to contact us as soon as possible so that we can work together to provide recommended academic accommodations while protecting your privacy. Please note that it is the student's responsibility to request any approved, documented academic accommodations (such as extra time) at least one week in advance of exams.

### Additional resources available to students for free:

- The office of **Health Services**.
- The **Student Counseling Center**. From their website: *"The Student Counseling Center provides confidential, culturally sensitive support for a variety of personal concerns for the students of Rose-Hulman. We provide brief individual counseling, group counseling, couples counseling, assessment, and referrals. Our purpose is to enhance the students' ability to fully benefit from academic and social life at Rose-Hulman. This is achieved by assisting students in the development of personal awareness, building life skills, and overcoming personal concerns. When you are feeling stress or experiencing any sort of difficult issue, our services can help you find your balance."*
- To make an appointment, call them at (812) 877-8537, or visit their office in the Union, rooms 245–250.

---

## Official Course Info

### Course Catalog Description

This course reinforces and extends students' understanding of current practices of producing object-oriented software. Students extend their use of a disciplined design process to include formal analysis of space/time efficiency and formal proofs of correctness. Students gain a deeper understanding of concepts from CSSE 220, including implementations of abstract data types by linear and non-linear data structures. This course introduces the use of randomized algorithms. Students design and implement software individually, in small groups, and in a challenging multi-week team project.

### CSSE Department's Official Learning Outcomes

Students who successfully complete this course should be able to:

1. Describe classical data structures (list, stack, queue, tree, priority queue, hash table, graph, set, dictionary) and explain issues involved in implementation choices for each.
2. Explain classical sorting, graph and tree-balancing algorithms.
3. Develop empirical and mathematical analyses of the asymptotic worst, best and average case run times of algorithms appropriate for this course.
4. Justify the choice of an algorithm based on the analysis of several algorithms appropriate for a problem.
5. Design and implement object-oriented programs competently and independently.
6. Implement various data structures, and apply them to medium-sized programming exercises.
7. Work with a team of 2–3 students to implement a complex data structure, using basic software engineering techniques, such as pair programming and unit testing, and demonstrating effective team decision making, division of labor and conflict resolution.

---

*Last modified: Sunday, 27 November 2022, 2:06 PM*
