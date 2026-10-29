<?php
require_once __DIR__ . '/../dashboard/interactive-store.php';
$uploads = __DIR__ . '/../uploads';
$created = !is_dir($uploads);
if ($created && !mkdir($uploads, 0775)) throw new RuntimeException('Cannot create test directory.');
$file = $uploads . '/path-test-' . bin2hex(random_bytes(8)) . '.webm';
$legacy = __DIR__ . '/../assets/path-test-' . bin2hex(random_bytes(8)) . '.webm';
try {
    if (file_put_contents($file, 'fixture') === false) throw new RuntimeException('Cannot create fixture.');
    if (file_put_contents($legacy, 'fixture') === false) throw new RuntimeException('Cannot create legacy fixture.');
    $relative = 'uploads/' . basename($file);
    if (interactiveMediaPath($relative) === false || interactiveMediaPath('uploads/./' . basename($file)) !== interactiveMediaPath($relative)) throw new RuntimeException('Upload path or alias rejected.');
    if (interactiveMediaPath('uploads/../auth.php') !== false || interactiveMediaPath('uploads') !== false) throw new RuntimeException('Path outside media roots or directory accepted.');
    if (interactiveMediaPath('assets/../auth.php') !== false) throw new RuntimeException('Legacy traversal accepted.');
    if (interactiveMediaPath('assets/' . basename($legacy)) === false) throw new RuntimeException('Legacy media rejected.');
    echo "Upload and legacy path boundary checks passed.\n";
} finally {
    if (is_file($file)) unlink($file);
    if (is_file($legacy)) unlink($legacy);
    if ($created) rmdir($uploads);
}
