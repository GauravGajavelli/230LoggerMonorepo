package edu.rosehulman.csse230feedback.data;

import edu.rosehulman.csse230feedback.util.Hashing;
import org.apache.commons.compress.archivers.tar.TarArchiveEntry;
import org.apache.commons.compress.archivers.tar.TarArchiveInputStream;
import org.apache.commons.compress.utils.IOUtils;

import java.io.BufferedInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.List;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

/**
 * Extracts a specific TAR entry (within the single-entry ZIP) to a cached file.
 * This preserves the compressed diff archives on disk; entries are materialized on demand.
 */
public class DiffArchiveEntryExtractor {

    public Path materializeEntry(Path archiveZip, String tarEntryName, Path cacheDir, List<String> warnings) throws IOException {
        Files.createDirectories(cacheDir);

        String archiveSha = Hashing.sha256(archiveZip);
        String cacheKey = archiveSha + ":" + tarEntryName;
        String cacheName = sha256String(cacheKey) + ".bin";
        Path cached = cacheDir.resolve(cacheName);
        if (Files.exists(cached)) {
            return cached;
        }

        boolean found = false;
        try (InputStream fin = Files.newInputStream(archiveZip);
             ZipInputStream zis = new ZipInputStream(new BufferedInputStream(fin))) {

            ZipEntry ze = zis.getNextEntry();
            if (ze == null) {
                throw new IOException("Empty ZIP: " + archiveZip.getFileName());
            }

            try (TarArchiveInputStream tis = new TarArchiveInputStream(new BufferedInputStream(zis))) {
                TarArchiveEntry te;
                while ((te = tis.getNextTarEntry()) != null) {
                    if (te.isDirectory()) continue;
                    if (!te.getName().equals(tarEntryName)) continue;

                    try (OutputStream out = Files.newOutputStream(cached,
                            StandardOpenOption.CREATE,
                            StandardOpenOption.TRUNCATE_EXISTING)) {
                        IOUtils.copy(tis, out);
                    }
                    found = true;
                    break;
                }
            }
        }

        if (!found) {
            warnings.add("Missing TAR entry '" + tarEntryName + "' in " + archiveZip.getFileName());
            throw new IOException("TAR entry not found: " + tarEntryName);
        }

        return cached;
    }

    private static String sha256String(String s) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] bytes = md.digest(s.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder(bytes.length * 2);
            for (byte b : bytes) {
                sb.append(Character.forDigit((b >> 4) & 0xF, 16));
                sb.append(Character.forDigit(b & 0xF, 16));
            }
            return sb.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException(e);
        }
    }
}
