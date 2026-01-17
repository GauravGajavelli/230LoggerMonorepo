package edu.rosehulman.csse230feedback.domain;

import edu.rosehulman.csse230feedback.data.DiffArchiveIndexer;
import edu.rosehulman.csse230feedback.data.RunTarExtractor;
import edu.rosehulman.csse230feedback.data.TestRunInfoParser;
import edu.rosehulman.csse230feedback.model.DiffArchiveInfo;
import edu.rosehulman.csse230feedback.model.IngestionManifest;
import edu.rosehulman.csse230feedback.model.RunRecord;
import edu.rosehulman.csse230feedback.util.Hashing;
import edu.rosehulman.csse230feedback.util.Json;

import java.io.IOException;
import java.nio.file.*;
import java.util.ArrayList;
import java.util.List;

public class IngestService {

    public IngestResult ingest(IngestOptions opts) throws IOException {
        List<String> warnings = new ArrayList<>();

        Path runTar = opts.repoRoot().resolve("run.tar");
        if (!Files.exists(runTar)) {
            throw new IOException("Could not find run.tar at: " + runTar);
        }

        // Working directory layout
        Path extractedDir = opts.workDir().resolve("run_tar_extracted");
        Files.createDirectories(extractedDir);

        // 1) Extract run.tar (but keep diff archives compressed: we only copy them out)
        RunTarExtractor extractor = new RunTarExtractor(opts.maxExtractedFiles(), opts.maxExtractedBytes());
        RunTarExtractor.ExtractResult extractResult = extractor.extract(runTar, extractedDir, warnings);

        // 2) Parse testRunInfo.json into runs.jsonl
        Path testRunInfo = extractedDir.resolve("testRunInfo.json");
        if (!Files.exists(testRunInfo)) {
            throw new IOException("run.tar did not contain testRunInfo.json (expected at " + testRunInfo + ")");
        }

        TestRunInfoParser parser = new TestRunInfoParser();
        List<RunRecord> runs = parser.parse(testRunInfo, warnings);

        // 3) Copy diff archives out (still compressed) + index them
        Path archivesOut = opts.outDir().resolve("archives");
        Files.createDirectories(archivesOut);

        List<Path> diffArchives = new ArrayList<>();
        for (Path p : extractResult.diffArchivePaths()) {
            Path dest = archivesOut.resolve(p.getFileName().toString());
            Files.copy(p, dest, StandardCopyOption.REPLACE_EXISTING);
            diffArchives.add(dest);
        }

        DiffArchiveIndexer indexer = new DiffArchiveIndexer();
        List<DiffArchiveInfo> diffInfos = indexer.indexAll(diffArchives, opts.outDir().resolve("diff_index.json"), warnings);

        // 4) Write artifacts
        Path runsJsonl = opts.outDir().resolve("runs.jsonl");
        Json.writeJsonl(runsJsonl, runs);

        IngestionManifest manifest = IngestionManifest.build(
                opts.repoRoot().toAbsolutePath().toString(),
                runTar.toAbsolutePath().toString(),
                Hashing.sha256(runTar),
                extractResult.extractedFiles(),
                diffInfos,
                warnings
        );
        Json.writeJson(opts.outDir().resolve("manifest.json"), manifest);

        // 5) Cleanup
        if (!opts.keepWorkDir()) {
            deleteRecursively(opts.workDir());
        }

        return new IngestResult(runs.size(), diffInfos.size(), warnings);
    }

    private static void deleteRecursively(Path dir) {
        try {
            if (Files.notExists(dir)) return;
            Files.walk(dir)
                    .sorted((a, b) -> b.compareTo(a))
                    .forEach(p -> {
                        try { Files.deleteIfExists(p); } catch (IOException ignored) {}
                    });
        } catch (IOException ignored) {
        }
    }
}
