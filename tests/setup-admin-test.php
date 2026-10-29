<?php
// Invalid setup input must fail before touching the database or printing credentials.
$checks = 0;
foreach ([['', ''], ['bad/name', str_repeat('x', 16)], ['admin', 'short'], ['admin', str_repeat('x', 73)]] as [$username, $password]) {
    $pipes = [];
    $process = proc_open([PHP_BINARY, __DIR__ . '/../setup-admin.php'], [1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes, null,
        ['PORTFOLIO_ADMIN_USERNAME' => $username, 'PORTFOLIO_ADMIN_PASSWORD' => $password]);
    if (!is_resource($process)) throw new RuntimeException('Cannot launch setup check.');
    $output = stream_get_contents($pipes[1]) . stream_get_contents($pipes[2]);
    fclose($pipes[1]); fclose($pipes[2]);
    $status = proc_close($process);
    if ($status !== 1 || !str_contains($output, 'Set PORTFOLIO_ADMIN_USERNAME') || ($password !== '' && str_contains($output, $password))) {
        throw new RuntimeException('Invalid setup input must be rejected without leaking the password.');
    }
    $checks++;
}
echo "$checks setup validation checks passed; no database accessed.\n";
