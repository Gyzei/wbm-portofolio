<?php
// Konfigurasi Database
$host = "localhost";
$user = "root";
$pass = "";
$db   = "portofolio";

// Membuat koneksi ke database
$conn = new mysqli($host, $user, $pass, $db);

// Memeriksa koneksi
if ($conn->connect_error) {
    die("Koneksi database gagal: " . $conn->connect_error);
}

// Tabel karya/proyek untuk halaman portofolio.
$conn->query("CREATE TABLE IF NOT EXISTS projects (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(150) NOT NULL,
    category VARCHAR(100) NOT NULL,
    description TEXT NULL,
    image VARCHAR(255) NULL,
    project_link VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

// Tabel pendukung dashboard portofolio MySQL.
$conn->query("CREATE TABLE IF NOT EXISTS slides (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    project_id INT UNSIGNED NULL,
    title VARCHAR(150) NOT NULL,
    description TEXT NULL,
    image VARCHAR(255) NULL,
    link VARCHAR(255) NULL,
    slide_order INT UNSIGNED NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
$conn->query("CREATE TABLE IF NOT EXISTS fileBrowser (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    fileName VARCHAR(255) NOT NULL,
    fileAddress VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
$conn->query("CREATE TABLE IF NOT EXISTS profile (
    id TINYINT UNSIGNED PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    username VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL,
    phone VARCHAR(50) NULL,
    photo VARCHAR(255) NULL,
    description TEXT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
$conn->query("INSERT IGNORE INTO profile (id, name, username, email) VALUES (1, 'Administrator', 'admin', 'admin@wbm.local')");

// Relasi slide dengan project yang dipilih sebagai highlight.
$slideProjectColumn = $conn->query("SHOW COLUMNS FROM slides LIKE 'project_id'");
if ($slideProjectColumn && $slideProjectColumn->num_rows === 0) {
    $conn->query("ALTER TABLE slides ADD COLUMN project_id INT UNSIGNED NULL AFTER id");
}
$mediaCreatedColumn = $conn->query("SHOW COLUMNS FROM fileBrowser LIKE 'created_at'");
if ($mediaCreatedColumn && $mediaCreatedColumn->num_rows === 0) {
    $conn->query("ALTER TABLE fileBrowser ADD COLUMN created_at TIMESTAMP NULL DEFAULT NULL");
    $conn->query("ALTER TABLE fileBrowser MODIFY COLUMN created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP");
} elseif ($mediaCreatedColumn) {
    $mediaCreatedDefinition = $mediaCreatedColumn->fetch_assoc();
    if ($mediaCreatedDefinition['Default'] === null) {
        $conn->query("ALTER TABLE fileBrowser MODIFY COLUMN created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP");
    }
}
?>

