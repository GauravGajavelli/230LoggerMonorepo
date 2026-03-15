 Protocol: Converting Assignment Materials into courseContext JSON

 What to gather

 Before running a Claude instance to produce the JSON, collect:

 1. BST test file — e.g. BSTTesting.java from the rerun workspace or the original repo.
 This tells the instance what method names exist (testRemove, testIterator, etc.) so it can
 derive testCategories strings.
 2. Future assignment test files or specs — for each assignment where BST concepts recur
 (e.g. AVL tree assignment in CSSE 230), provide the test file or the handout spec.
 3. Final exam questions — paste or upload the PDF pages that contain BST-related questions.
 4. bst.json current content — so the instance knows the exact JSON schema to target.
 5. CourseContext.java schema (from this plan or once written) — or just paste the JSON
 schema inline in the prompt.

 Prompt template for the curating Claude instance

 You are helping curate course context data for a student feedback pipeline. The pipeline analyzes a CSSE 230 student's test run history for a Binary Search Tree assignment and generates targeted feedback. We want to enrich that feedback with references to future course
 materials where the same concepts recur — so students understand why these gaps matter beyond this single assignment.

 Output format: A courseContext JSON fragment to insert into bst.json. Schema:
 {
   "courseContext": {
     "concepts": [
       {
         "concept": "one-line concept name",
         "testCategories": ["label1", "label2"],
         "futureAppearances": [
           { "label": "short context name", "description": "one sentence: how this concept connects" }
         ]
       }
     ]
   }
 }

 testCategories guidance: derive labels from the BST test method names I'm providing (e.g. testRemove → "remove", testContainsNonBST → "contains", testIterator → "iterator"). Use lowercase short labels. Each concept entry should cover 1-3 related test methods.

 futureAppearances guidance: for each concept, scan the future assignment files and exam questions I'm providing and write one entry per distinct future context where it recurs. The description must be one specific sentence explaining how the BST concept connects (not generic advice). If a concept doesn't recur in any provided material, omit it.

 Do not hallucinate future content. Only reference materials I provide below.

 ---[Paste BSTTesting.java content here]

 [Paste future assignment test file(s) or spec excerpts here]

 [Paste relevant final exam questions here]

 What context to share about the course

 - Assignment name: "Binary Search Tree" (CSSE 230, Rose-Hulman)
 - Future courses: CSSE 230 (Graduate-level data structures) if applicable
 - No need to share the full pipeline codebase, the frontend, or any student data
 - The instance only needs the schema + source materials; it doesn't need to understand the pipeline

 Output handling

 Take the returned courseContext JSON, review each description for accuracy, then paste it into Pipeline/assignments/bst.json under the existing excludeTestClasses field. Run make demo-cached afterward to verify appearances flow through to frontend.json.

