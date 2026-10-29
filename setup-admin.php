<?php
// Provision only from a trusted local CLI; web requests must never create an administrator.
if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

$username = trim(getenv('PORTFOLIO_ADMIN_USERNAME') ?: '');
$password = getenv('PORTFOLIO_ADMIN_PASSWORD') ?: '';
if (!preg_match('/^[A-Za-z0-9._-]{1,50}$/D', $username) || strlen($password) < 12 || strlen($password) > 72) {
    fwrite(STDERR, "Set PORTFOLIO_ADMIN_USERNAME (1–50 letters, numbers, dot, underscore or dash) and PORTFOLIO_ADMIN_PASSWORD (12–72 bytes).\n");
    exit(1);
}

try {
    require_once __DIR__ . '/auth.php';
    // Serialize first-run setup so concurrent invocations cannot create competing primary accounts.
    $conn->query('LOCK TABLES users WRITE');
    try {
        if ((int)$conn->query('SELECT COUNT(*) AS total FROM users')->fetch_assoc()['total'] !== 0) {
            throw new RuntimeException('An account already exists; setup will not modify it.');
        }
        $hash = password_hash($password, PASSWORD_DEFAULT);
        $stmt = $conn->prepare('INSERT INTO users (username,password_hash) VALUES (?,?)');
        $stmt->bind_param('ss', $username, $hash);
        $stmt->execute();
        $stmt->close();
    } finally {
        $conn->query('UNLOCK TABLES');
    }
    fwrite(STDOUT, "Administrator created. Remove the setup environment variables.\n");
} catch (Throwable $error) {
    fwrite(STDERR, "Setup failed; existing accounts were not changed. Check database availability, permissions, and whether an account already exists.\n");
    exit(1);
}
