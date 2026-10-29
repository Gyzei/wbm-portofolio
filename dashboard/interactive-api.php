<?php
require_once __DIR__ . '/../auth.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
function interactiveReply(int $status, array $data): never {
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
    exit;
}
if (empty($_SESSION['user_id']) || (int)$_SESSION['user_id'] !== primaryAccountId()) interactiveReply(401, ['error' => 'Sesi berakhir. Login kembali di tab baru sebelum menyimpan.']);
if ($_SERVER['REQUEST_METHOD'] !== 'POST') interactiveReply(405, ['error' => 'Gunakan POST.']);
if ((int)($_SERVER['CONTENT_LENGTH'] ?? 0) > 1048576) interactiveReply(413, ['error' => 'Draft terlalu besar (maksimal 1 MB).']);
require_once __DIR__ . '/interactive-store.php';
try {
    $input = json_decode(file_get_contents('php://input', false, null, 0, 1048577), true, 512, JSON_THROW_ON_ERROR);
    if (!is_array($input) || !is_string($input['token'] ?? null) || empty($_SESSION['settings_token']) || !hash_equals($_SESSION['settings_token'], $input['token'])) {
        interactiveReply(403, ['error' => 'Token sesi tidak valid. Simpan salinan draft lalu muat ulang halaman.']);
    }
    if (!is_int($input['revision'] ?? null) || $input['revision'] < 0) throw new InvalidArgumentException('Versi draft tidak valid.');
    if (!is_int($input['scenarioId'] ?? null) || $input['scenarioId'] < 1) throw new InvalidArgumentException('Skenario tidak valid.');
    initializeInteractiveDraft($conn);
    if (!saveInteractiveDraft($conn, $input['graph'] ?? null, $input['revision'], $input['scenarioId'])) interactiveReply(409, ['error' => 'Draft telah berubah di tab lain. Unduh salinan draft ini sebelum memuat ulang; perubahan tidak ditimpa.']);
    interactiveReply(200, ['revision' => $input['revision'] + 1]);
} catch (JsonException | InvalidArgumentException $error) {
    interactiveReply(422, ['error' => $error instanceof JsonException ? 'Format draft tidak valid.' : $error->getMessage()]);
} catch (Throwable $error) {
    error_log('Interactive video save: ' . $error->getMessage());
    interactiveReply(500, ['error' => 'Draft belum tersimpan. Periksa koneksi database lalu coba lagi.']);
}
