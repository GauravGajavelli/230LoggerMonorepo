JAR := Pipeline/target/csse230-feedback.jar

.PHONY: build demo demo-cached

build:
	mvn -f Pipeline/pom.xml package -q -DskipTests

demo: build
	java -jar $(JAR) prepare \
	  -i Pipeline/output/run-demo \
	  -o Frontend/public/data/frontend.json \
	  --assignment-name "Binary Search Tree" \
	  --student-id "demo-student" \
	  --cache-dir Pipeline/cache/llm \
	  --allow-basic-fallback \
	  --clear-cache

demo-cached: build
	java -jar $(JAR) prepare \
	  -i Pipeline/output/run-demo \
	  -o Frontend/public/data/frontend.json \
	  --assignment-name "Binary Search Tree" \
	  --student-id "demo-student" \
	  --cache-dir Pipeline/cache/llm \
	  --allow-basic-fallback
