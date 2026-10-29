<?php
require_once __DIR__ . '/../dashboard/media-store.php';
$database = $argv[1] ?? '';
if (PHP_SAPI !== 'cli' || !str_starts_with($database, 'portofolio_review_')) {
    throw new RuntimeException('Use a disposable portofolio_review_* database.');
}
$conn = new mysqli('localhost', 'root', '', $database);
$conn->query('CREATE TEMPORARY TABLE fileBrowser (fileName VARCHAR(255), fileAddress VARCHAR(255), created_at TIMESTAMP) ENGINE=InnoDB');
$files = [];
try {
    $directory = __DIR__ . '/../uploads';
    if (!is_dir($directory)) throw new RuntimeException('The uploads directory must exist for this test.');
    foreach (['success', 'failure', 'failure-nonstrict', 'unrelated'] as $key) {
        $files[$key] = tempnam($directory, 'upload-test-');
        if ($files[$key] === false) throw new RuntimeException('Cannot create an isolated fixture.');
    }
    recordUploadedMedia($conn, 'success.webm', $files['success']);
    if (!is_file($files['success']) || (int)$conn->query('SELECT COUNT(*) AS total FROM fileBrowser')->fetch_assoc()['total'] !== 1) {
        throw new RuntimeException('Successful upload must retain its file and database entry.');
    }
    $conn->query('DROP TEMPORARY TABLE fileBrowser');
    $conn->query('CREATE TEMPORARY TABLE fileBrowser (id INT) ENGINE=InnoDB');
    foreach (['failure' => MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT, 'failure-nonstrict' => MYSQLI_REPORT_OFF] as $key => $mode) {
        mysqli_report($mode);
        $failed = false;
        try { recordUploadedMedia($conn, 'failure.webm', $files[$key]); }
        catch (Throwable $error) { $failed = true; }
        if (!$failed || is_file($files[$key]) || !is_file($files['success']) || !is_file($files['unrelated'])) {
            throw new RuntimeException('Only the newly failed upload should be removed.');
        }
    }
    echo "Upload success and database-failure cleanup checks passed.\n";
} finally {
    foreach ($files as $file) if (is_string($file) && is_file($file)) unlink($file);
}
