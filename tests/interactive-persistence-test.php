<?php
// Run with mysqli enabled: php tests/interactive-persistence-test.php portofolio_review_20261022
require_once __DIR__ . '/../dashboard/interactive-store.php';
$database = $argv[1] ?? '';
if (PHP_SAPI !== 'cli' || !str_starts_with($database, 'portofolio_review_')) {
    throw new RuntimeException('Use a portofolio_review_* database copy, never the live database.');
}
$a = new mysqli('localhost', 'root', '', $database);
$b = new mysqli('localhost', 'root', '', $database);
$a->set_charset('utf8mb4');
$b->set_charset('utf8mb4');
$b->query('SET SESSION innodb_lock_wait_timeout=1');
initializeInteractiveDraft($a);
$original = $a->query('SELECT graph,revision,updated_at FROM interactive_video WHERE id=1')->fetch_assoc();
$checks = 0;
function check(bool $condition, string $message): void {
    global $checks;
    if (!$condition) throw new RuntimeException($message);
    $checks++;
}
function blocked(callable $operation): void {
    try { $operation(); }
    catch (mysqli_sql_exception $error) {
        if ($error->getCode() !== 1205) throw $error;
        check(true, 'Other connection must wait for the draft lock.');
        return;
    }
    throw new RuntimeException('Other connection bypassed the draft lock.');
}
$name = 'persistence_test_' . bin2hex(random_bytes(8)) . '.webm';
$relative = 'assets/video/' . $name;
$absolute = __DIR__ . '/../' . $relative;
$ids = [];
$scenarioId = null;
$handle = fopen($absolute, 'x');
if (!$handle) throw new RuntimeException('Cannot create the isolated media fixture.');
fwrite($handle, 'test fixture');
fclose($handle);
try {
    check(interactiveMediaPath('koneksi.php') === false, 'Files outside assets must not be accepted.');
    check(interactiveMediaPath('assets/video') === false, 'Directories must not be accepted as media files.');
    if (PHP_OS_FAMILY === 'Windows') check(interactiveMediaPath(strtoupper($relative)) === interactiveMediaPath($relative), 'Windows path aliases must share a canonical key.');
    $insert = $a->prepare('INSERT INTO fileBrowser (fileName,fileAddress) VALUES (?,?)');
    foreach ([$relative, 'assets/video/./' . $name] as $address) {
        $insert->bind_param('ss', $name, $address);
        $insert->execute();
        $ids[] = (int)$a->insert_id;
    }
    $revision = (int)$original['revision'];
    $graph = ['title' => 'Test', 'startId' => 'start', 'scenes' => [
        ['id' => 'start', 'title' => 'Start', 'mediaId' => $ids[0], 'x' => 80, 'y' => 80, 'choices' => []],
    ]];
    check(saveInteractiveDraft($a, $graph, $revision++), 'Save must succeed.');
    check(interactiveDraft($b)['graph'] === $graph, 'Other connection must reload the saved graph.');
    check(!saveInteractiveDraft($b, $graph, $revision - 1), 'Stale revision must not overwrite the draft.');
    check(deleteInteractiveMedia($b, $ids[0]) === 'inuse', 'Referenced ID must be protected.');
    check(deleteInteractiveMedia($b, $ids[1]) === 'inuse', 'Canonical file alias must be protected.');
    check(is_file($absolute), 'Protected media file must remain intact.');

    $scenarioId = createInteractiveScenario($a);
    check(saveInteractiveDraft($a, $graph, 0, $scenarioId), 'A new scenario must save independently.');
    check(!saveInteractiveDraft($b, $graph, 0, $scenarioId), 'A stale scenario revision must not overwrite it.');
    check(interactiveDraft($b, false, $scenarioId)['graph'] === $graph, 'A second scenario must reload independently.');

    $a->begin_transaction();
    interactiveDraft($a, true);
    blocked(static fn() => deleteInteractiveMedia($b, $ids[1]));
    check(is_file($absolute), 'Blocked deletion must not touch the file.');
    $a->commit();
    check(deleteInteractiveMedia($b, $ids[1]) === 'inuse', 'Delete must recheck the saved graph after acquiring the lock.');

    $empty = ['title' => 'Test', 'startId' => null, 'scenes' => []];
    check(saveInteractiveDraft($a, $empty, $revision++), 'Unlinking the scene must save.');
    check(deleteInteractiveMedia($b, $ids[1]) === 'inuse', 'Media referenced only by another scenario must remain protected.');
    check(saveInteractiveDraft($a, $empty, 1, $scenarioId), 'The second scenario must unlink independently.');
    check(deleteInteractiveMedia($b, $ids[1]) === 'deleted', 'Unused alias must be deletable.');
    check(is_file($absolute), 'Deleting one alias must retain the file for remaining entries.');

    $a->begin_transaction();
    interactiveDraft($a, true);
    blocked(static fn() => saveInteractiveDraft($b, $graph, $revision));
    $a->query('DELETE FROM fileBrowser WHERE id=' . $ids[0]);
    check(unlink($absolute), 'Concurrent delete fixture must be removed.');
    $a->commit();
    try {
        saveInteractiveDraft($b, $graph, $revision);
        throw new RuntimeException('Save accepted media deleted while waiting for the lock.');
    } catch (InvalidArgumentException $error) {
        check(true, 'Save must revalidate media after acquiring the lock.');
    }
    check(interactiveDraft($b)['graph'] === $empty, 'Failed save must retain the previous draft.');
    check(interactiveDraft($b)['revision'] === $revision, 'Failed save must not advance the revision.');

    $handle = fopen($absolute, 'x');
    fwrite($handle, 'test fixture');
    fclose($handle);
    $insert->bind_param('ss', $name, $relative);
    $insert->execute();
    $ids[] = (int)$a->insert_id;
    check(deleteInteractiveMedia($b, end($ids)) === 'deleted', 'Last unused media entry must be deletable.');
    check(!is_file($absolute), 'Deleting the last entry must remove its file.');
} finally {
    $a->rollback();
    $b->rollback();
    foreach ($ids as $id) $a->query('DELETE FROM fileBrowser WHERE id=' . $id);
    if ($scenarioId !== null) $a->query('DELETE FROM interactive_video WHERE id=' . $scenarioId);
    $restore = $a->prepare('UPDATE interactive_video SET graph=?,revision=?,updated_at=? WHERE id=1');
    $restore->bind_param('sis', $original['graph'], $original['revision'], $original['updated_at']);
    $restore->execute();
    if (is_file($absolute)) unlink($absolute);
}
echo "$checks persistence checks passed.\n";
