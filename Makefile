JAR := Pipeline/target/csse230-feedback.jar

.PHONY: build demo demo-cached demo-full-cached

build:
	mvn -f Pipeline/pom.xml package -q -DskipTests

demo: build
	java -jar $(JAR) prepare \
	  -i Pipeline/output/run-demo \
	  -o Frontend/public/data/frontend.json \
	  --assignment-name "Binary Search Tree" \
	  --student-id "demo-student" \
	  --assignment-config Pipeline/assignments/bst.json \
	  --cache-dir Pipeline/cache/llm \
	  --allow-basic-fallback \
	  --clear-cache

demo-cached: build
	java -jar $(JAR) prepare \
	  -i Pipeline/output/run-demo \
	  -o Frontend/public/data/frontend.json \
	  --assignment-name "Binary Search Tree" \
	  --student-id "demo-student" \
	  --assignment-config Pipeline/assignments/bst.json \
	  --cache-dir Pipeline/cache/llm \
	  --allow-basic-fallback

demo-full-cached: build
	java -jar $(JAR) prepare \
	  -i Pipeline/output/run-demo-full \
	  -o Frontend/public/data/frontend.json \
	  --assignment-name "Binary Search Tree" \
	  --student-id "demo-student" \
	  --assignment-config Pipeline/assignments/bst.json \
	  --cache-dir Pipeline/cache/llm
