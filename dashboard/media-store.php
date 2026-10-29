<?php
function recordUploadedMedia(mysqli $conn, string $name, string $path): void
{
    try {
        $query = $conn->prepare('INSERT INTO fileBrowser(fileName,fileAddress,created_at) VALUES (?,?,CURRENT_TIMESTAMP)');
        if (!$query || !$query->bind_param('ss', $name, $path) || !$query->execute()) {
            throw new RuntimeException('Media record could not be saved.', $conn->errno);
        }
    } catch (Throwable $error) {
        if (in_array($error->getCode(), [2006, 2013, 2055], true)) {
            error_log('Upload database outcome unknown; retain file for reconciliation: ' . $path);
        } elseif (is_file($path) && !@unlink($path)) {
            error_log('Failed to remove unrecorded upload: ' . $path);
        }
        throw $error;
    }
}
