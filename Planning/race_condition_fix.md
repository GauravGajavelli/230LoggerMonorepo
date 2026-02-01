⏺ Changes from Baseline LoggingExtension.java                        
                                                                     
  1. Add Import                                                      
                                                                     
  import java.util.HashMap;                                          
                                                                     
  2. Add Field                                                       
                                                                     
  static private Map<Path, List<String>> inMemoryBaselines;  //      
  Source files captured at test start time                           
                                                                     
  3. Add Call in beforeAll() (after initDirectories())               
                                                                     
  // Capture source files into memory before tests run               
  // This ensures code snapshots match the actual tested code        
  captureSourceFilesInMemory();                                      
                                                                     
  4. Add New Method                                                  
                                                                     
  /**                                                                
   * Captures source files into memory at test start time.           
   * This ensures diffs are computed against the code that was       
  actually tested,                                                   
   * not code that may have been modified during test execution.     
   */                                                                
  private void captureSourceFilesInMemory() throws IOException {     
      inMemoryBaselines = new HashMap<>();                           
      Path sourceFolder = baseDir().resolve(sourceFolderName);       
      Files.walkFileTree(sourceFolder, new SimpleFileVisitor<Path>() 
  {                                                                  
          @Override                                                  
          public FileVisitResult preVisitDirectory(Path dir,         
  BasicFileAttributes attrs) {                                       
              if                                                     
  (dir.getFileName().toString().equals(testSupportPackageName)) {    
                  return FileVisitResult.SKIP_SUBTREE;               
              }                                                      
              return FileVisitResult.CONTINUE;                       
          }                                                          
          @Override                                                  
          public FileVisitResult visitFile(Path file,                
  BasicFileAttributes attrs) throws IOException {                    
              if (file.toString().endsWith(".java")) {               
                  inMemoryBaselines.put(file,                        
  Files.readAllLines(file, StandardCharsets.UTF_8));                 
              }                                                      
              return FileVisitResult.CONTINUE;                       
          }                                                          
      });                                                            
  }                                                                  
                                                                     
  5. Replace writeDiffs() Body                                       
                                                                     
  Old: Uses Files.walkFileTree() to iterate live filesystem and reads
   files at close() time                                             
                                                                     
  New: Iterates over inMemoryBaselines.entrySet() and uses captured  
  lines:                                                             
  private void writeDiffs(int testRunNumber, int seed, boolean       
  redactDiffs) throws IOException {                                  
      Path sourceFolder = baseDir().resolve(sourceFolderName);       
      Path tempDiffsFolder =                                         
  filepathResolve(tempDirectory).resolve(diffsFolderName);           
                                                                     
      for (Map.Entry<Path, List<String>> entry :                     
  inMemoryBaselines.entrySet()) {                                    
          Path file = entry.getKey();                                
          List<String> capturedLines = entry.getValue();             
          // ... rest uses capturedLines instead of reading from disk
      }                                                              
      // ... rebaselining logic unchanged                            
  }                                                                  
                                                                     
  Key changes inside the loop:                                       
  - String sourceContents = String.join("\n", capturedLines); instead
   of Files.readAllBytes(file)                                       
  - Pass capturedLines to addDiffedFile()                            
                                                                     
  6. Update addDiffedFile() Signature                                
                                                                     
  Old:                                                               
  private long addDiffedFile(String fileName, String packageName,    
  Path revisedPath, Path sourcePath, ...)                            
                                                                     
  New:                                                               
  private long addDiffedFile(String fileName, String packageName,    
  List<String> capturedLines, Path originalFilePath, Path sourcePath,
   ...)                                                              
                                                                     
  And inside, change:                                                
  // Old                                                             
  List<String> revised = Files.readAllLines(revisedPath);            
                                                                     
  // New                                                             
  List<String> revised = capturedLines;      