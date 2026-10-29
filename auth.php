<?php
// Session dan skema akun; administrator awal dibuat melalui setup-admin.php (CLI).
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

require_once __DIR__ . '/koneksi.php';

$conn->query("CREATE TABLE IF NOT EXISTS users (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

$displayNameColumn = $conn->query("SHOW COLUMNS FROM users LIKE 'display_name'");
if ($displayNameColumn && $displayNameColumn->num_rows === 0) {
    $conn->query("ALTER TABLE users ADD COLUMN display_name VARCHAR(150) NOT NULL DEFAULT '' AFTER username");
}

function primaryAccountId(): int {
    global $conn;
    return (int)$conn->query('SELECT MIN(id) AS id FROM users')->fetch_assoc()['id'];
}

function requireLogin(): void {
    if (empty($_SESSION['user_id']) || (int)$_SESSION['user_id'] !== primaryAccountId()) {
        unset($_SESSION['user_id'], $_SESSION['username']);
        header('Location: login.php');
        exit();
    }
}
?>
