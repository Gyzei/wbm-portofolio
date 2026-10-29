<?php
function initializeInteractiveDraft(mysqli $conn): void
{
    // MySQL schema changes commit implicitly, so initialize before save/delete transactions.
    $conn->query("CREATE TABLE IF NOT EXISTS interactive_video (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        graph MEDIUMTEXT NOT NULL,
        revision INT UNSIGNED NOT NULL DEFAULT 0,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $conn->query('INSERT IGNORE INTO interactive_video (id,graph) VALUES (1,\'{"title":"Video interaktif baru","startId":null,"scenes":[]}\')');
}

function interactiveDraft(mysqli $conn, bool $lock = false, int $id = 1): array
{
    $query = $conn->prepare('SELECT graph,revision FROM interactive_video WHERE id=?' . ($lock ? ' FOR UPDATE' : ''));
    $query->bind_param('i', $id);
    $query->execute();
    $row = $query->get_result()->fetch_assoc();
    if (!$row) throw new InvalidArgumentException('Skenario tidak ditemukan.');
    return ['graph' => json_decode($row['graph'], true, 512, JSON_THROW_ON_ERROR), 'revision' => (int)$row['revision']];
}

function createInteractiveScenario(mysqli $conn): int
{
    $column = $conn->query("SHOW COLUMNS FROM interactive_video LIKE 'id'")->fetch_assoc();
    if (!preg_match('/^int(?:\(\d+\))? unsigned$/i', $column['Type']) || !str_contains($column['Extra'], 'auto_increment')) {
        $conn->query('ALTER TABLE interactive_video MODIFY id INT UNSIGNED NOT NULL AUTO_INCREMENT');
    }
    $conn->query('INSERT INTO interactive_video (graph) VALUES (\'{"title":"Video interaktif baru","startId":null,"scenes":[]}\')');
    return (int)$conn->insert_id;
}

function interactiveMediaPath(string $address): string|false
{
    $path = realpath(__DIR__ . '/../' . $address);
    if (!$path || !is_file($path)) return false;
    if (PHP_OS_FAMILY === 'Windows') $path = strtolower($path);
    foreach (['assets', 'uploads'] as $directory) {
        $root = realpath(__DIR__ . '/../' . $directory);
        if ($root && str_starts_with($path, (PHP_OS_FAMILY === 'Windows' ? strtolower($root) : $root) . DIRECTORY_SEPARATOR)) return $path;
    }
    return false;
}

function interactiveMedia(mysqli $conn): array
{
    $files = $conn->query('SELECT id,fileName,fileAddress FROM fileBrowser ORDER BY id DESC')->fetch_all(MYSQLI_ASSOC);
    return array_values(array_filter($files, static function ($file) {
        return preg_match('/\.(mp4|webm|mov)$/i', $file['fileAddress']) && interactiveMediaPath($file['fileAddress']) !== false;
    }));
}

function saveInteractiveDraft(mysqli $conn, $graph, int $revision, int $id = 1): bool
{
    $conn->begin_transaction();
    try {
        interactiveDraft($conn, true);
        if (($id === 1 ? interactiveDraft($conn) : interactiveDraft($conn, true, $id))['revision'] !== $revision) {
            $conn->rollback();
            return false;
        }
        $graph = validateInteractiveGraph($graph, array_map('intval', array_column(interactiveMedia($conn), 'id')));
        $json = json_encode($graph, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
        $query = $conn->prepare('UPDATE interactive_video SET graph=?,revision=revision+1 WHERE id=? AND revision=?');
        $query->bind_param('sii', $json, $id, $revision);
        $query->execute();
        $conn->commit();
        return true;
    } catch (Throwable $error) {
        $conn->rollback();
        throw $error;
    }
}

function deleteInteractiveMedia(mysqli $conn, int $id): string
{
    $conn->begin_transaction();
    try {
        interactiveDraft($conn, true);
        $drafts = $conn->query('SELECT graph FROM interactive_video ORDER BY id FOR UPDATE')->fetch_all(MYSQLI_ASSOC);
        $files = $conn->query('SELECT id,fileAddress FROM fileBrowser')->fetch_all(MYSQLI_ASSOC);
        $path = false;
        foreach ($files as $file) if ((int)$file['id'] === $id) $path = interactiveMediaPath($file['fileAddress']);
        $sharedIds = [$id];
        foreach ($files as $file) {
            if ((int)$file['id'] !== $id && $path !== false && interactiveMediaPath($file['fileAddress']) === $path) $sharedIds[] = (int)$file['id'];
        }
        foreach ($drafts as $draft) {
            foreach (json_decode($draft['graph'], true, 512, JSON_THROW_ON_ERROR)['scenes'] as $scene) {
                if (in_array($scene['mediaId'], $sharedIds, true)) {
                    $conn->rollback();
                    return 'inuse';
                }
            }
        }
        $query = $conn->prepare('DELETE FROM fileBrowser WHERE id=?');
        $query->bind_param('i', $id);
        $query->execute();
        $conn->commit();
    } catch (Throwable $error) {
        $conn->rollback();
        throw $error;
    }
    // Delete only after commit: a database failure must never restore a row pointing to a deleted file.
    if (count($sharedIds) === 1 && $path !== false && !unlink($path)) {
        error_log('Unused media file could not be deleted: ' . $path);
        return 'cleanupfailed';
    }
    return 'deleted';
}

function validateInteractiveGraph($graph, array $mediaIds): array
{
    $fail = static function ($message) { throw new InvalidArgumentException($message); };
    if (!is_array($graph) || !is_string($graph['title'] ?? null) || trim($graph['title']) === '' || strlen($graph['title']) > 150) {
        $fail('Judul wajib diisi, maksimal 150 byte.');
    }
    if (!isset($graph['scenes']) || !is_array($graph['scenes']) || !array_is_list($graph['scenes']) || count($graph['scenes']) > 100) {
        $fail('Draft mendukung maksimal 100 scene.');
    }
    $ids = [];
    foreach ($graph['scenes'] as $scene) {
        if (!is_array($scene) || !is_string($scene['id'] ?? null) || !preg_match('/^[a-zA-Z0-9_-]{1,64}$/D', $scene['id']) || isset($ids[$scene['id']])) {
            $fail('ID scene tidak valid atau duplikat.');
        }
        $ids[$scene['id']] = true;
    }
    $start = $graph['startId'] ?? null;
    if (($ids && (!is_string($start) || !isset($ids[$start]))) || (!$ids && $start !== null)) $fail('Pilih scene awal yang valid.');
    $scenes = [];
    foreach ($graph['scenes'] as $scene) {
        if (!is_string($scene['title'] ?? null) || trim($scene['title']) === '' || strlen($scene['title']) > 150) $fail('Setiap scene harus memiliki judul (maksimal 150 byte).');
        foreach (['x', 'y'] as $axis) {
            if (!isset($scene[$axis]) || !is_numeric($scene[$axis]) || !is_finite((float)$scene[$axis]) || $scene[$axis] < 0 || $scene[$axis] > 20000) $fail('Posisi scene di luar kanvas.');
        }
        $mediaId = $scene['mediaId'] ?? null;
        if ($mediaId !== null && (!is_int($mediaId) || !in_array($mediaId, $mediaIds, true))) $fail('Video scene tidak tersedia. Pilih ulang dari Media Library.');
        if (!isset($scene['choices']) || !is_array($scene['choices']) || !array_is_list($scene['choices']) || count($scene['choices']) > 8) $fail('Maksimal 8 cabang per scene.');
        $choices = [];
        foreach ($scene['choices'] as $choice) {
            if (!is_array($choice) || !is_string($choice['label'] ?? null) || trim($choice['label']) === '' || strlen($choice['label']) > 100
                || !is_string($choice['target'] ?? null) || !isset($ids[$choice['target']]) || $choice['target'] === $scene['id']) $fail('Label atau tujuan cabang tidak valid.');
            $timeSec = $choice['timeSec'] ?? null;
            if ($timeSec !== null && (!is_numeric($timeSec) || !is_finite((float)$timeSec) || $timeSec < 0 || $timeSec > 86400)) $fail('Timer cabang harus antara 0 dan 86400 detik.');
            if ($timeSec !== null) $timeSec = (float)$timeSec;
            $choices[] = ['label' => trim($choice['label']), 'target' => $choice['target'], 'timeSec' => $timeSec];
        }
        $scenes[] = ['id' => $scene['id'], 'title' => trim($scene['title']), 'mediaId' => $mediaId,
            'x' => (int)$scene['x'], 'y' => (int)$scene['y'], 'choices' => $choices];
    }
    return ['title' => trim($graph['title']), 'startId' => $start, 'scenes' => $scenes];
}
