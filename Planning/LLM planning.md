⏺ Based on phase_1_planning.md, LLMs fit into 4 specific places in Phase 1:                                     
                                                                                                                
  ---                                                                                                           
  1. Root-Cause Labeling (Hybrid Approach)                                                                      
                                                                                                                
  What it does: Labels failures with bug patterns like "Off-by-one", "Null pointer", "Missing base case"        
                                                                                                                
  How it works:                                                                                                 
  Rules first (deterministic):                                                                                  
    - AssertionError → "assertion failure"                                                                      
    - NullPointerException → "null reference"                                                                   
    - TimeoutException → "infinite loop / timeout"                                                              
    - StackOverflowError → "infinite recursion"                                                                 
                                                                                                                
  LLM refinement (contextual):                                                                                  
    - Takes "evidence pack": stack trace + diff + test name                                                     
    - Refines generic label into specific bug pattern                                                           
    - Example: "assertion failure" + diff showing loop → "Off-by-one in loop bounds"                            
                                                                                                                
  Output: pattern + confidence + explanation in the Feedback object                                             
                                                                                                                
  ---                                                                                                           
  2. Fix-Pattern Mapping                                                                                        
                                                                                                                
  What it does: Generates the "Next steps to try" checklist                                                     
                                                                                                                
  Input: (bug type × test category × diff category)                                                             
                                                                                                                
  LLM generates:                                                                                                
  - Ordered debugging steps anchored to actual code                                                             
  - Example: "1. Check the loop bound on line 42 - should be < n not <= n"                                      
                                                                                                                
  Why LLM: The wording needs to be specific to the student's code, not generic advice                           
                                                                                                                
  ---                                                                                                           
  3. Test Category Mapping                                                                                      
                                                                                                                
  What it does: Classifies tests into categories                                                                
                                                                                                                
  Examples:                                                                                                     
  - testInsertDuplicate → "edge cases"                                                                          
  - testBasicInsert → "basic functionality"                                                                     
  - testBalanceAfterRotation → "AVL-specific / rotations"                                                       
                                                                                                                
  Approach: "LLM-first then manually adjusted" - LLM proposes categories, instructor can override               
                                                                                                                
  Used for: Grouping related failures, determining "core-ness" weight                                           
                                                                                                                
  ---                                                                                                           
  4. Diff Category Labeling                                                                                     
                                                                                                                
  What it does: Classifies what changed between runs                                                            
                                                                                                                
  Examples:                                                                                                     
  - "added new method"                                                                                          
  - "changed loop bounds"                                                                                       
  - "modified conditional logic"                                                                                
  - "refactored variable names"                                                                                 
                                                                                                                
  Used for: Fix-pattern lookup, understanding student's debugging approach                                      
                                                                                                                
  ---                                                                                                           
  Where This Fits in the UI                                                                                     
                                                                                                                
  ┌─────────────────────────────────────────────────────────┐                                                   
  │ FeedbackPanel (when you click a failing test)           │                                                   
  ├─────────────────────────────────────────────────────────┤                                                   
  │                                                         │                                                   
  │  Stack Trace          │  AI Feedback ← LLM GOES HERE    │                                                   
  │  ─────────────        │  ─────────────────────────────  │                                                   
  │  NullPointerException │  Pattern: Null reference (High) │                                                   
  │  at BST.insert:42     │                                 │                                                   
  │  ...                  │  What's happening:              │                                                   
  │                       │  "The node variable is null..." │ ← LLM explains                                    
  │                       │                                 │                                                   
  │                       │  Next steps:                    │                                                   
  │                       │  1. Add null check at line 42   │ ← LLM generates                                   
  │                       │  2. Verify parent pointer...    │                                                   
  │                       │                                 │                                                   
  │                       │  Practice: [Null safety drill]  │ ← LLM suggests                                    
  └─────────────────────────────────────────────────────────┘                                                   
                                                                                                                
  ---                                                                                                           
  What's NOT LLM                                                                                                
                                                                                                                
  Everything else is deterministic:                                                                             
  - Failure interval detection (linear scan)                                                                    
  - Origin finding (first run of interval)                                                                      
  - Meaningfulness scoring (formula-based)                                                                      
  - Highlight classification (rule-based)                                                                       
  - Pass/fail history (data lookup)                                                                             
  - Diff computation (algorithm)                                                                                
  - Stack trace parsing (regex)                                                                                 
                                                                                                                
  The LLM adds interpretation and explanation on top of the computed artifacts - it doesn't replace the core    
  detection logic.                                                                                              
                  