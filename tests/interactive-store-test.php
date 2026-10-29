<?php
// Run: php tests/interactive-store-test.php (no database required).
require_once __DIR__ . '/../dashboard/interactive-store.php';
$checks = 0;
function check(bool $condition, string $message): void {
    global $checks;
    if (!$condition) throw new RuntimeException($message);
    $checks++;
}
function rejects(array $graph, string $message): void {
    try { validateInteractiveGraph($graph, [7]); }
    catch (InvalidArgumentException $error) { check(true, $message); return; }
    throw new RuntimeException($message);
}
$graph = ['title' => 'Cerita', 'startId' => 's1', 'scenes' => [
    ['id' => 's1', 'title' => 'Pembuka', 'mediaId' => 7, 'x' => 20, 'y' => 40, 'choices' => [['label' => 'Ke hutan', 'target' => 's2', 'timeSec' => null]]],
    ['id' => 's2', 'title' => 'Hutan', 'mediaId' => null, 'x' => 400, 'y' => 40, 'choices' => []],
]];
check(validateInteractiveGraph($graph, [7]) === $graph, 'Valid graph should remain intact.');
$timed = $graph;
$timed['scenes'][0]['choices'][0]['timeSec'] = 12.5;
check(validateInteractiveGraph($timed, [7])['scenes'][0]['choices'][0]['timeSec'] === 12.5, 'Branch timer seconds must be preserved.');
$timed['scenes'][0]['choices'][0]['timeSec'] = 86401;
rejects($timed, 'Timers beyond 24 hours must fail validation.');
$timed['scenes'][0]['choices'][0]['timeSec'] = 'invalid';
rejects($timed, 'Non-numeric timers must fail validation.');
$empty = ['title' => 'Kosong', 'startId' => null, 'scenes' => []];
check(validateInteractiveGraph($empty, []) === $empty, 'Empty draft should be saveable.');
$reordered = $graph;
$reordered['scenes'] = array_reverse($reordered['scenes']);
check(validateInteractiveGraph($reordered, [7])['startId'] === 's1', 'Validation must preserve the start ID in reordered input.');
check(validateInteractiveGraph($reordered, [7])['scenes'][1]['choices'][0]['target'] === 's2', 'Validation must preserve branch IDs in reordered input.');
$loop = $graph;
$loop['scenes'][1]['choices'][] = ['label' => 'Kembali', 'target' => 's1', 'timeSec' => 5.2];
check(count(validateInteractiveGraph($loop, [7])['scenes'][1]['choices']) === 1, 'Loops between distinct scenes are supported.');
$bad = $graph; $bad['scenes'][1]['id'] = 's1'; rejects($bad, 'Duplicate IDs must fail.');
$bad = $graph; $bad['startId'] = 'missing'; rejects($bad, 'Missing start must fail.');
$bad = $graph; $bad['scenes'][0]['mediaId'] = 99; rejects($bad, 'Unknown media must fail.');
$bad = $graph; $bad['scenes'][0]['mediaId'] = '7'; rejects($bad, 'Media IDs must be integers.');
$bad = $graph; $bad['scenes'][0]['choices'][0]['target'] = 'missing'; rejects($bad, 'Dangling branches must fail.');
$bad = $graph; $bad['scenes'][0]['choices'][0]['target'] = 's1'; rejects($bad, 'Self-connections must fail.');
$bad = $graph; $bad['scenes'][0]['choices'][0]['label'] = ' '; rejects($bad, 'Blank choice labels must fail.');
$bad = $graph; $bad['scenes'][0]['choices'] = array_fill(0, 9, $graph['scenes'][0]['choices'][0]); rejects($bad, 'More than eight choices must fail.');
$bad = $graph; $bad['scenes'][0]['x'] = -1; rejects($bad, 'Negative coordinates must fail.');
$bad = $graph; $bad['scenes'][0]['x'] = INF; rejects($bad, 'Nonfinite coordinates must fail.');
$bad = $graph; $bad['scenes'][0]['y'] = 20001; rejects($bad, 'Out-of-range coordinates must fail.');
$bad = $graph; $bad['scenes'][0]['title'] = ''; rejects($bad, 'Empty scene titles must fail.');
$bad = $graph; $bad['scenes'][0]['id'] = '<script>'; rejects($bad, 'Unsafe scene IDs must fail.');
$bad = $empty; $bad['scenes'] = array_fill(0, 101, $graph['scenes'][0]); rejects($bad, 'More than 100 scenes must fail.');
echo "$checks checks passed.\n";
