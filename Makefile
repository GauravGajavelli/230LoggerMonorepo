JAR := Pipeline/target/csse230-feedback.jar

.PHONY: build demo demo-cached demo-full-cached test test-unit test-ingest

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

# Unpack allTar-WaS-Sp2026.zip → Frontend/data/wuas/tars/{runNN}/run.tar (skips 0-byte tars)
setup-wuas-batch:
	bash Pipeline/scripts/setup-wuas-batch.sh

# Run all tests: JUnit unit tests + ingest integration tests
test: test-unit test-ingest

# Run JUnit unit tests (TestRunInfoParser, RunTarExtractor, DiffArchiveIndexer, DiffFileReconstructor, ...)
test-unit:
	mvn -f Pipeline/pom.xml test

# Generate synthetic tars and run ingest on each, asserting output structure
test-ingest: build
	python3 Pipeline/scripts/make-test-tars.py
	bash Pipeline/scripts/test-ingest.sh
