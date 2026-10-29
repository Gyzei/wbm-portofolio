<?php
require_once __DIR__ . '/../dashboard/project-store.php';
$database = $argv[1] ?? '';
if (PHP_SAPI !== 'cli' || !str_starts_with($database, 'portofolio_review_')) {
    throw new RuntimeException('Use a disposable portofolio_review_* database.');
}
$conn = new mysqli('localhost', 'root', '', $database);
$conn->query('CREATE TEMPORARY TABLE projects (id INT PRIMARY KEY) ENGINE=InnoDB');
$conn->query('CREATE TEMPORARY TABLE slides (id INT PRIMARY KEY, project_id INT NULL, slide_order INT NOT NULL) ENGINE=InnoDB');
$conn->query('INSERT INTO projects VALUES (1),(2)');
$conn->query('INSERT INTO slides VALUES (1,1,1),(2,1,2),(3,2,3),(4,NULL,4)');
if (!deleteProject($conn, 1)) throw new RuntimeException('Project was not deleted.');
$projects = $conn->query('SELECT id FROM projects ORDER BY id')->fetch_all(MYSQLI_NUM);
$slides = $conn->query('SELECT id,slide_order FROM slides ORDER BY id')->fetch_all(MYSQLI_NUM);
if ($projects !== [['2']] || $slides !== [['3', '1'], ['4', '2']]) throw new RuntimeException('Linked highlights, remaining order, or unrelated content were handled incorrectly.');
if (deleteProject($conn, 999)) throw new RuntimeException('A missing project must not be reported as deleted.');
$conn->query('DROP TEMPORARY TABLE slides');
$conn->query('CREATE TEMPORARY TABLE slides (id INT PRIMARY KEY) ENGINE=InnoDB');
try {
    deleteProject($conn, 2);
    throw new RuntimeException('Deletion should fail when the highlights table is invalid.');
} catch (mysqli_sql_exception $error) {
    if (!$conn->query('SELECT id FROM projects WHERE id=2')->fetch_assoc()) throw new RuntimeException('Failure must leave the project intact.');
}
echo "Project deletion and highlight isolation checks passed.\n";
