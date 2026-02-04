  ---                                                                                                                                                                     
  Back-of-Napkin Calculation for Diff Labeling Prompt                                                                                                                     
                                                                                                                                                                          
  Raw Data from run54.tar (35 runs, 1 student)                                                                                                                            
  ┌──────────────────┬────────┬───────────────────────────────────────────┐                                                                                               
  │    Component     │  Size  │                   Notes                   │                                                                                               
  ├──────────────────┼────────┼───────────────────────────────────────────┤                                                                                               
  │ Patches (total)  │ ~30 KB │ 133 files, 69 meaningful (>20 bytes)      │                                                                                               
  ├──────────────────┼────────┼───────────────────────────────────────────┤                                                                                               
  │ Baselines        │ ~52 KB │ Full file snapshots (3 rebaseline events) │                                                                                               
  ├──────────────────┼────────┼───────────────────────────────────────────┤                                                                                               
  │ testRunInfo.json │ ~18 KB │ Test results per run                      │                                                                                               
  ├──────────────────┼────────┼───────────────────────────────────────────┤                                                                                               
  │ Prompt template  │ ~4 KB  │ Instructions, categories, output format   │                                                                                               
  └──────────────────┴────────┴───────────────────────────────────────────┘                                                                                               
  Pessimistic Prompt Size Estimate                                                                                                                                        
                                                                                                                                                                          
  For a single batched prompt including all diffs:                                                                                                                        
                                                                                                                                                                          
  Prompt template:           ~4 KB                                                                                                                                        
  All patches (formatted):  ~30 KB × 1.5 (markdown overhead) = ~45 KB                                                                                                     
  3 baseline snapshots:     ~52 KB × 1.2 = ~62 KB                                                                                                                         
  Context headers per run:  ~35 runs × 100 bytes = ~3.5 KB                                                                                                                
  ─────────────────────────────────────────────────                                                                                                                       
  TOTAL:                    ~115 KB raw text                                                                                                                              
                                                                                                                                                                          
  Token Estimate (pessimistic: 1 token ≈ 3.5 chars)                                                                                                                       
                                                                                                                                                                          
  115,000 bytes ÷ 3.5 = ~33,000 tokens input                                                                                                                              
  Output (JSON response):   ~3,000 tokens                                                                                                                                 
  ─────────────────────────────────────────────────                                                                                                                       
  TOTAL per student:        ~36,000 tokens                                                                                                                                
                                                                                                                                                                          
  ---                                                                                                                                                                     
  Cost Analysis Across Providers                                                                                                                                          
  ┌───────────┬──────────────────┬────────────┬─────────────┬──────────────┬──────────────┐                                                                               
  │ Provider  │      Model       │ Input $/1M │ Output $/1M │ Cost/Student │ 100 Students │                                                                               
  ├───────────┼──────────────────┼────────────┼─────────────┼──────────────┼──────────────┤                                                                               
  │ Anthropic │ Claude Sonnet 4  │ $3.00      │ $15.00      │ $0.14        │ $14          │                                                                               
  ├───────────┼──────────────────┼────────────┼─────────────┼──────────────┼──────────────┤                                                                               
  │ Anthropic │ Claude Haiku 3.5 │ $0.80      │ $4.00       │ $0.04        │ $4           │                                                                               
  ├───────────┼──────────────────┼────────────┼─────────────┼──────────────┼──────────────┤                                                                               
  │ OpenAI    │ GPT-4o           │ $2.50      │ $10.00      │ $0.11        │ $11          │                                                                               
  ├───────────┼──────────────────┼────────────┼─────────────┼──────────────┼──────────────┤                                                                               
  │ OpenAI    │ GPT-4o-mini      │ $0.15      │ $0.60       │ $0.007       │ $0.70        │                                                                               
  ├───────────┼──────────────────┼────────────┼─────────────┼──────────────┼──────────────┤                                                                               
  │ Google    │ Gemini 1.5 Pro   │ $1.25      │ $5.00       │ $0.06        │ $6           │                                                                               
  ├───────────┼──────────────────┼────────────┼─────────────┼──────────────┼──────────────┤                                                                               
  │ Google    │ Gemini 1.5 Flash │ $0.075     │ $0.30       │ $0.004       │ $0.40        │                                                                               
  └───────────┴──────────────────┴────────────┴─────────────┴──────────────┴──────────────┘                                                                               
  ---                                                                                                                                                                     
  Rate Limits & Throughput Analysis                                                                                                                                       
                                                                                                                                                                          
  Anthropic (Tier 1-2 typical)                                                                                                                                            
  ┌────────┬──────┬──────┬──────────────┬──────────────┐                                                                                                                  
  │  Tier  │ RPM  │ TPM  │ Students/min │ Time for 100 │                                                                                                                  
  ├────────┼──────┼──────┼──────────────┼──────────────┤                                                                                                                  
  │ Tier 1 │ 50   │ 40K  │ ~1           │ ~100 min     │                                                                                                                  
  ├────────┼──────┼──────┼──────────────┼──────────────┤                                                                                                                  
  │ Tier 2 │ 1000 │ 80K  │ ~2           │ ~50 min      │                                                                                                                  
  ├────────┼──────┼──────┼──────────────┼──────────────┤                                                                                                                  
  │ Tier 3 │ 2000 │ 160K │ ~4           │ ~25 min      │                                                                                                                  
  └────────┴──────┴──────┴──────────────┴──────────────┘                                                                                                                  
  OpenAI (Tier 1-2)                                                                                                                                                       
  ┌────────┬──────┬──────┬──────────────┬──────────────┐                                                                                                                  
  │  Tier  │ RPM  │ TPM  │ Students/min │ Time for 100 │                                                                                                                  
  ├────────┼──────┼──────┼──────────────┼──────────────┤                                                                                                                  
  │ Tier 1 │ 500  │ 30K  │ ~0.8         │ ~120 min     │                                                                                                                  
  ├────────┼──────┼──────┼──────────────┼──────────────┤                                                                                                                  
  │ Tier 2 │ 5000 │ 450K │ ~12          │ ~8 min       │                                                                                                                  
  └────────┴──────┴──────┴──────────────┴──────────────┘                                                                                                                  
  Google Gemini                                                                                                                                                           
  ┌───────────────┬──────┬─────┬──────────────┬──────────────┐                                                                                                            
  │     Plan      │ RPM  │ TPM │ Students/min │ Time for 100 │                                                                                                            
  ├───────────────┼──────┼─────┼──────────────┼──────────────┤                                                                                                            
  │ Free          │ 15   │ 32K │ ~0.9         │ ~110 min     │                                                                                                            
  ├───────────────┼──────┼─────┼──────────────┼──────────────┤                                                                                                            
  │ Pay-as-you-go │ 1000 │ 4M  │ ~100+        │ ~1 min       │                                                                                                            
  └───────────────┴──────┴─────┴──────────────┴──────────────┘                                                                                                            
  ---                                                                                                                                                                     
  Can AI Handle 33K Tokens Accurately?                                                                                                                                    
                                                                                                                                                                          
  Context window comparison:                                                                                                                                              
  - Claude Sonnet/Haiku: 200K tokens ✅ (~17% utilized)                                                                                                                   
  - GPT-4o: 128K tokens ✅ (~26% utilized)                                                                                                                                
  - Gemini 1.5: 1M tokens ✅ (~3% utilized)                                                                                                                               
                                                                                                                                                                          
  Accuracy concerns at this size:                                                                                                                                         
  ┌─────────────────────────────┬───────────────────────────────────────────────────────────────┐                                                                         
  │           Factor            │                          Assessment                           │                                                                         
  ├─────────────────────────────┼───────────────────────────────────────────────────────────────┤                                                                         
  │ Context length              │ ✅ Well within limits                                         │                                                                         
  ├─────────────────────────────┼───────────────────────────────────────────────────────────────┤                                                                         
  │ "Lost in the middle"        │ ⚠️ Moderate risk - diffs in runs 15-25 may get less attention │                                                                         
  ├─────────────────────────────┼───────────────────────────────────────────────────────────────┤                                                                         
  │ Consistency across 35 runs  │ ⚠️ May drift in categorization style                          │                                                                         
  ├─────────────────────────────┼───────────────────────────────────────────────────────────────┤                                                                         
  │ Redacted code comprehension │ ⚠️ Harder to understand intent with obfuscated names          │                                                                         
  └─────────────────────────────┴───────────────────────────────────────────────────────────────┘                                                                         
  ---                                                                                                                                                                     
  Recommendation: Split into 3 Prompts                                                                                                                                    
                                                                                                                                                                          
  Yes, splitting is worthwhile for these reasons:                                                                                                                         
                                                                                                                                                                          
  1. Better accuracy: Each prompt handles ~12 runs, keeping context focused                                                                                               
  2. Parallelizable: 3 prompts can run simultaneously → same wall-clock time                                                                                              
  3. Retry granularity: If one fails, only re-run 1/3                                                                                                                     
  4. Rate limit friendly: Spreads load, less likely to hit TPM limits                                                                                                     
                                                                                                                                                                          
  Suggested Split Strategy                                                                                                                                                
                                                                                                                                                                          
  Prompt 1: Runs 1-13   (~11K tokens) → early debugging attempts                                                                                                          
  Prompt 2: Runs 14-25  (~11K tokens) → mid-session work                                                                                                                  
  Prompt 3: Runs 26-35  (~11K tokens) → final fixes                                                                                                                       
                                                                                                                                                                          
  Optimized Parallel Execution                                                                                                                                            
                                                                                                                                                                          
  # Pseudocode for parallel execution                                                                                                                                     
  import asyncio                                                                                                                                                          
                                                                                                                                                                          
  async def label_diffs_parallel(student_data):                                                                                                                           
      chunks = split_into_chunks(student_data, n=3)                                                                                                                       
                                                                                                                                                                          
      # Run all 3 in parallel - respects RPM, maximizes TPM usage                                                                                                         
      results = await asyncio.gather(                                                                                                                                     
          call_llm(chunks[0]),  # Runs 1-13                                                                                                                               
          call_llm(chunks[1]),  # Runs 14-25                                                                                                                              
          call_llm(chunks[2])   # Runs 26-35                                                                                                                              
      )                                                                                                                                                                   
                                                                                                                                                                          
      return merge_results(results)                                                                                                                                       
                                                                                                                                                                          
  Throughput with 3-way split:                                                                                                                                            
  - Uses 3 RPM per student instead of 1                                                                                                                                   
  - Same TPM (33K total, just distributed)                                                                                                                                
  - At Tier 2 Anthropic: ~33 students/min (vs ~2/min single)                                                                                                              
  - 100 students in ~3 minutes vs ~50 minutes                                                                                                                             
                                                                                                                                                                          
  ---                                                                                                                                                                     
  Summary                                                                                                                                                                 
  ┌────────────────────────┬───────────────────┬─────────┬────────────┐                                                                                                   
  │        Approach        │ Cost/100 students │  Time   │  Accuracy  │                                                                                                   
  ├────────────────────────┼───────────────────┼─────────┼────────────┤                                                                                                   
  │ Single prompt (Sonnet) │ $14               │ ~50 min │ Good       │                                                                                                   
  ├────────────────────────┼───────────────────┼─────────┼────────────┤                                                                                                   
  │ Single prompt (Haiku)  │ $4                │ ~50 min │ Acceptable │                                                                                                   
  ├────────────────────────┼───────────────────┼─────────┼────────────┤                                                                                                   
  │ 3-way split (Haiku)    │ $4                │ ~3 min  │ Better     │                                                                                                   
  ├────────────────────────┼───────────────────┼─────────┼────────────┤                                                                                                   
  │ 3-way split (Flash)    │ $0.40             │ ~1 min  │ Acceptable │                                                                                                   
  └────────────────────────┴───────────────────┴─────────┴────────────┘                                                                                                   
  Recommended: Use 3-way parallel split with Haiku or GPT-4o-mini for the best balance of cost, speed, and accuracy.                                                      
                                                                                                                                                                          
✻ Crunched for 1m 15s                                                                                                                                                     
                                                                                                                                                                          
❯ So that's for this specific use-case. Now let's say there are 100 runs each for each of the 45 students working on BinarySearchTree. What does the total cost come      
  out to then? How many chats are required, and what does that mean for the total processing time?                                                                        
                                                                                                                                                                          
⏺ Let me scale the calculations for the BinarySearchTree assignment scenario.                                                                                             
                                                                                                                                                                          
  Scaled Analysis: 45 Students × 100 Runs Each                                                                                                                            
                                                                                                                                                                          
  Scaling from Sample Data                                                                                                                                                
  ┌─────────────────────────┬────────────────────┬────────────────────┬─────────────────┐                                                                                 
  │         Metric          │ run54.tar (sample) │ Scaled to 100 runs │      Notes      │                                                                                 
  ├─────────────────────────┼────────────────────┼────────────────────┼─────────────────┤                                                                                 
  │ Runs                    │ 35                 │ 100                │ ~3× more        │                                                                                 
  ├─────────────────────────┼────────────────────┼────────────────────┼─────────────────┤                                                                                 
  │ Meaningful patches      │ 69                 │ ~200               │ Scales linearly │                                                                                 
  ├─────────────────────────┼────────────────────┼────────────────────┼─────────────────┤                                                                                 
  │ Patch content           │ 30 KB              │ ~85 KB             │                 │                                                                                 
  ├─────────────────────────┼────────────────────┼────────────────────┼─────────────────┤                                                                                 
  │ Baselines (rebaselines) │ 3 events, 52 KB    │ ~8 events, ~140 KB │ Every ~12 runs  │                                                                                 
  ├─────────────────────────┼────────────────────┼────────────────────┼─────────────────┤                                                                                 
  │ Prompt overhead         │ 4 KB               │ 4 KB               │ Fixed           │                                                                                 
  ├─────────────────────────┼────────────────────┼────────────────────┼─────────────────┤                                                                                 
  │ Total per student       │ ~115 KB            │ ~330 KB            │                 │                                                                                 
  ├─────────────────────────┼────────────────────┼────────────────────┼─────────────────┤                                                                                 
  │ Tokens per student      │ ~33K               │ ~95K tokens        │                 │                                                                                 
  └─────────────────────────┴────────────────────┴────────────────────┴─────────────────┘                                                                                 
  ---                                                                                                                                                                     
  Cost Analysis (45 Students × 100 Runs)                                                                                                                                  
                                                                                                                                                                          
  Single prompt approach (if context allows):                                                                                                                             
  ┌──────────────────┬────────────┬─────────────┬─────────────┬─────────────┐                                                                                             
  │  Provider/Model  │ Input Cost │ Output Cost │ Per Student │ 45 Students │                                                                                             
  ├──────────────────┼────────────┼─────────────┼─────────────┼─────────────┤                                                                                             
  │ Claude Sonnet 4  │ $3/1M      │ $15/1M      │ $0.41       │ $18.50      │                                                                                             
  ├──────────────────┼────────────┼─────────────┼─────────────┼─────────────┤                                                                                             
  │ Claude Haiku 3.5 │ $0.80/1M   │ $4/1M       │ $0.11       │ $4.95       │                                                                                             
  ├──────────────────┼────────────┼─────────────┼─────────────┼─────────────┤                                                                                             
  │ GPT-4o           │ $2.50/1M   │ $10/1M      │ $0.34       │ $15.30      │                                                                                             
  ├──────────────────┼────────────┼─────────────┼─────────────┼─────────────┤                                                                                             
  │ GPT-4o-mini      │ $0.15/1M   │ $0.60/1M    │ $0.02       │ $0.90       │                                                                                             
  ├──────────────────┼────────────┼─────────────┼─────────────┼─────────────┤                                                                                             
  │ Gemini 1.5 Flash │ $0.075/1M  │ $0.30/1M    │ $0.01       │ $0.45       │                                                                                             
  └──────────────────┴────────────┴─────────────┴─────────────┴─────────────┘                                                                                             
  ---                                                                                                                                                                     
  Chat/Request Requirements                                                                                                                                               
                                                                                                                                                                          
  Problem: 95K tokens is large but within context limits. However, splitting improves accuracy and parallelism.                                                           
  ┌───────────────┬─────────────────┬─────────────────────────────┬───────────────┐                                                                                       
  │   Strategy    │ Prompts/Student │ Total Prompts (45 students) │ Tokens/Prompt │                                                                                       
  ├───────────────┼─────────────────┼─────────────────────────────┼───────────────┤                                                                                       
  │ Single prompt │ 1               │ 45                          │ ~95K          │                                                                                       
  ├───────────────┼─────────────────┼─────────────────────────────┼───────────────┤                                                                                       
  │ 3-way split   │ 3               │ 135                         │ ~32K          │                                                                                       
  ├───────────────┼─────────────────┼─────────────────────────────┼───────────────┤                                                                                       
  │ 5-way split   │ 5               │ 225                         │ ~19K          │                                                                                       
  ├───────────────┼─────────────────┼─────────────────────────────┼───────────────┤                                                                                       
  │ 10-way split  │ 10              │ 450                         │ ~9.5K         │                                                                                       
  └───────────────┴─────────────────┴─────────────────────────────┴───────────────┘                                                                                       
  Recommendation: 5-way split (20 runs each) balances accuracy and overhead.                                                                                              
                                                                                                                                                                          
  ---                                                                                                                                                                     
  Processing Time Analysis                                                                                                                                                
                                                                                                                                                                          
  Anthropic Claude (Haiku 3.5)                                                                                                                                            
  ┌────────┬──────┬──────┬──────────────────┬───────────────────────────────────────────────┐                                                                             
  │  Tier  │ RPM  │ TPM  │     Strategy     │             Time for 45 Students              │                                                                             
  ├────────┼──────┼──────┼──────────────────┼───────────────────────────────────────────────┤                                                                             
  │ Tier 1 │ 50   │ 40K  │ Single           │ TPM-limited: 45 × 95K ÷ 40K = 107 min         │                                                                             
  ├────────┼──────┼──────┼──────────────────┼───────────────────────────────────────────────┤                                                                             
  │ Tier 1 │ 50   │ 40K  │ 5-split parallel │ 225 requests ÷ 50 RPM = 4.5 min (RPM-limited) │                                                                             
  ├────────┼──────┼──────┼──────────────────┼───────────────────────────────────────────────┤                                                                             
  │ Tier 2 │ 1000 │ 80K  │ Single           │ 45 × 95K ÷ 80K = 53 min                       │                                                                             
  ├────────┼──────┼──────┼──────────────────┼───────────────────────────────────────────────┤                                                                             
  │ Tier 2 │ 1000 │ 80K  │ 5-split parallel │ TPM: 225 × 19K ÷ 80K = 53 min                 │                                                                             
  ├────────┼──────┼──────┼──────────────────┼───────────────────────────────────────────────┤                                                                             
  │ Tier 3 │ 2000 │ 160K │ 5-split parallel │ ~27 min                                       │                                                                             
  └────────┴──────┴──────┴──────────────────┴───────────────────────────────────────────────┘                                                                             
  OpenAI GPT-4o-mini                                                                                                                                                      
  ┌────────┬───────┬──────┬──────────┬──────────────────────────────────┐                                                                                                 
  │  Tier  │  RPM  │ TPM  │ Strategy │       Time for 45 Students       │                                                                                                 
  ├────────┼───────┼──────┼──────────┼──────────────────────────────────┤                                                                                                 
  │ Tier 1 │ 500   │ 200K │ 5-split  │ Max(225÷500, 4.3M÷200K) = 22 min │                                                                                                 
  ├────────┼───────┼──────┼──────────┼──────────────────────────────────┤                                                                                                 
  │ Tier 2 │ 5000  │ 2M   │ 5-split  │ ~2 min                           │                                                                                                 
  ├────────┼───────┼──────┼──────────┼──────────────────────────────────┤                                                                                                 
  │ Tier 3 │ 10000 │ 10M  │ 5-split  │ <1 min                           │                                                                                                 
  └────────┴───────┴──────┴──────────┴──────────────────────────────────┘                                                                                                 
  Google Gemini Flash                                                                                                                                                     
  ┌───────────────┬──────┬─────┬──────────┬──────────────────────┐                                                                                                        
  │     Plan      │ RPM  │ TPM │ Strategy │ Time for 45 Students │                                                                                                        
  ├───────────────┼──────┼─────┼──────────┼──────────────────────┤                                                                                                        
  │ Free          │ 15   │ 1M  │ 5-split  │ 225÷15 = 15 min      │                                                                                                        
  ├───────────────┼──────┼─────┼──────────┼──────────────────────┤                                                                                                        
  │ Pay-as-you-go │ 2000 │ 4M  │ 5-split  │ ~1 min               │                                                                                                        
  └───────────────┴──────┴─────┴──────────┴──────────────────────┘                                                                                                        
  ---                                                                                                                                                                     
  Summary Table                                                                                                                                                           
  ┌───────────┬──────────────────────┬────────────┬────────────────┬─────────────────┐                                                                                    
  │ Provider  │        Model         │ Total Cost │ Total Requests │ Processing Time │                                                                                    
  ├───────────┼──────────────────────┼────────────┼────────────────┼─────────────────┤                                                                                    
  │ Anthropic │ Haiku 3.5 (Tier 2)   │ $5         │ 225            │ ~53 min         │                                                                                    
  ├───────────┼──────────────────────┼────────────┼────────────────┼─────────────────┤                                                                                    
  │ Anthropic │ Haiku 3.5 (Tier 3)   │ $5         │ 225            │ ~27 min         │                                                                                    
  ├───────────┼──────────────────────┼────────────┼────────────────┼─────────────────┤                                                                                    
  │ OpenAI    │ GPT-4o-mini (Tier 2) │ $0.90      │ 225            │ ~2 min          │                                                                                    
  ├───────────┼──────────────────────┼────────────┼────────────────┼─────────────────┤                                                                                    
  │ Google    │ Gemini Flash         │ $0.45      │ 225            │ ~1-15 min       │                                                                                    
  ├───────────┼──────────────────────┼────────────┼────────────────┼─────────────────┤                                                                                    
  │ Anthropic │ Sonnet 4 (Tier 2)    │ $19        │ 225            │ ~53 min         │                                                                                    
  └───────────┴──────────────────────┴────────────┴────────────────┴─────────────────┘                                                                                    
  ---                                                                                                                                                                     
  Optimal Configuration                                                                                                                                                   
                                                                                                                                                                          
  ┌─────────────────────────────────────────────────────────────┐                                                                                                         
  │  RECOMMENDED: GPT-4o-mini with 5-way split                  │                                                                                                         
  ├─────────────────────────────────────────────────────────────┤                                                                                                         
  │  Students:        45                                        │                                                                                                         
  │  Runs/student:    100                                       │                                                                                                         
  │  Split:           5 chunks × 20 runs each                   │                                                                                                         
  │  Total requests:  225                                       │                                                                                                         
  │  Tokens/request:  ~19K input + ~2K output                   │                                                                                                         
  │  ───────────────────────────────────────────────────────────│                                                                                                         
  │  Total cost:      $0.90                                     │                                                                                                         
  │  Processing time: ~2-5 minutes (Tier 2)                     │                                                                                                         
  │  Accuracy:        Good (focused context per chunk)          │                                                                                                         
  └─────────────────────────────────────────────────────────────┘                                                                                                         
                                                                                                                                                                          
  If budget allows for better accuracy:                                                                                                                                   
  ┌─────────────────────────────────────────────────────────────┐                                                                                                         
  │  ALTERNATIVE: Claude Haiku 3.5 with 5-way split             │                                                                                                         
  ├─────────────────────────────────────────────────────────────┤                                                                                                         
  │  Total cost:      $5                                        │                                                                                                         
  │  Processing time: ~27-53 minutes                            │                                                                                                         
  │  Accuracy:        Better (Claude excels at code analysis)   │                                                                                                         
  └─────────────────────────────────────────────────────────────┘                                                                                                         
                                                                                                                                                                          
  ---                                                                                                                                                                     
  Parallelization Architecture                                                                                                                                            
                                                                                                                                                                          
                      ┌─────────────────┐                                                                                                                                 
                      │  45 Students    │                                                                                                                                 
                      └────────┬────────┘                                                                                                                                 
                               │                                                                                                                                          
                ┌──────────────┼──────────────┐                                                                                                                           
                ▼              ▼              ▼                                                                                                                           
           Student 1      Student 2  ...  Student 45                                                                                                                      
                │              │              │                                                                                                                           
          ┌─────┼─────┐  ┌─────┼─────┐  ┌─────┼─────┐                                                                                                                     
          ▼     ▼     ▼  ▼     ▼     ▼  ▼     ▼     ▼                                                                                                                     
        R1-20 R21-40 ... (5 chunks each)                                                                                                                                  
          │     │     │                                                                                                                                                   
          └──┬──┘     │   ← Run in parallel (up to RPM limit)                                                                                                             
             │        │                                                                                                                                                   
             ▼        ▼                                                                                                                                                   
        Merge results per student                                                                                                                                         
                                                                                                                                                                          
  Total: 225 API calls                                                                                                                                                    
  Concurrency: min(225, RPM_limit)                                                                                                                                        
                                                                                                                                                                          
  With 5 concurrent requests per student:                                                                                                                                 
  - Process ~9 students simultaneously at Tier 2 (1000 RPM ÷ 5 ÷ ~25 students/batch)                                                                                      
  - Wall-clock time dominated by TPM, not RPM                                                                                                                             
                                                                                                                                                                          
✻ Crunched for 36s                                                                                                                                                        
                                