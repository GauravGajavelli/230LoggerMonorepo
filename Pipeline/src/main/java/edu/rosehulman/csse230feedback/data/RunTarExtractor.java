package edu.rosehulman.csse230feedback.data;

import edu.rosehulman.csse230feedback.model.ExtractedFile;

import org.apache.commons.compress.archivers.tar.TarArchiveEntry;
import org.apache.commons.compress.archivers.tar.TarArchiveInputStream;
import org.apache.commons.compress.utils.IOUtils;

import java.io.BufferedInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.nio.file.attribute.FileTime;
import java.util.ArrayList;
import java.util.List;

public class RunTarExtractor {

    public record ExtractResult(
            List<Path> diffArchivePaths,
            List<ExtractedFile> extractedFiles
    ) {}

    private final int maxFiles;
    private final long maxBytes;

    public RunTarExtractor(int maxFiles, long maxBytes) {
        this.maxFiles = maxFiles;
        this.maxBytes = maxBytes;
    }

    public ExtractResult extract(Path tarPath, Path targetDir, List<String> warnings) throws IOException {
        List<Path> diffZips = new ArrayList<>();
        List<ExtractedFile> extracted = new ArrayList<>();

        long totalBytes = 0L;
        int fileCount = 0;

        try (InputStream fin = Files.newInputStream(tarPath);
             BufferedInputStream bin = new BufferedInputStream(fin);
             TarArchiveInputStream tin = new TarArchiveInputStream(bin)) {

            TarArchiveEntry entry;
            while ((entry = tin.getNextTarEntry()) != null) {
                if (entry.isDirectory()) {
                    continue;
                }

                fileCount++;
                if (fileCount > maxFiles) {
                    warnings.add("run.tar extraction halted: exceeded max files (" + maxFiles + ")");
                    break;
                }

                Path outPath = targetDir.resolve(entry.getName()).normalize();
                if (!outPath.startsWith(targetDir)) {
                    throw new IOException("Illegal TAR entry (path traversal): " + entry.getName());
                }

                Files.createDirectories(outPath.getParent());

                long entrySize = entry.getSize();
                if (entrySize > 0) {
                    totalBytes += entrySize;
                    if (totalBytes > maxBytes) {
                        warnings.add("run.tar extraction halted: exceeded max bytes (" + maxBytes + ")");
                        break;
                    }
                }

                try (OutputStream out = Files.newOutputStream(outPath,
                        StandardOpenOption.CREATE,
                        StandardOpenOption.TRUNCATE_EXISTING)) {
                    IOUtils.copy(tin, out);
                }

                // preserve mod time when available
                if (entry.getModTime() != null) {
                    Files.setLastModifiedTime(outPath, FileTime.fromMillis(entry.getModTime().getTime()));
                }

                String fileName = outPath.getFileName().toString();
                extracted.add(ExtractedFile.fromFile(outPath));

                if (DiffArchiveIndexer.isDiffsTarZipFilename(fileName)) {
                    diffZips.add(outPath);
                }
            }
        }

        return new ExtractResult(diffZips, extracted);
    }
}
