<?php
require_once 'auth.php';

if (!empty($_SESSION['user_id']) && (int)$_SESSION['user_id'] === primaryAccountId()) {
    header('Location: admin.php?page=projects');
    exit();
}

$error = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $username = trim($_POST['username'] ?? '');
    $password = $_POST['password'] ?? '';

    $stmt = $conn->prepare("SELECT id, username, password_hash FROM users WHERE username = ? LIMIT 1");
    $stmt->bind_param("s", $username);
    $stmt->execute();
    $user = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if ($user && (int)$user['id'] === primaryAccountId() && password_verify($password, $user['password_hash'])) {
        session_regenerate_id(true);
        $_SESSION['user_id'] = $user['id'];
        $_SESSION['username'] = $user['username'];
        header('Location: admin.php?page=projects');
        exit();
    }

    $error = 'Username atau kata sandi tidak sesuai.';
}
?>
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Login — Portfolio CMS</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Playfair+Display:wght@600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="dashboard/styles/tokens.css">
    <link rel="stylesheet" href="dashboard/login.css?v=20261007-3">
</head>
<body class="login-page">
    <main class="login-card">
        <div class="login-brand">Portfolio CMS</div>
        <h1>Masuk ke Dashboard</h1>
        <p>Gunakan akun Anda untuk mengelola konten portofolio.</p>
        <?php if ($error): ?>
            <div class="login-error" role="alert"><?= htmlspecialchars($error) ?></div>
        <?php endif; ?>
        <form method="POST" class="login-form">
            <label for="username">Username</label>
            <input id="username" name="username" type="text" autocomplete="username" placeholder="Masukkan username" value="<?= htmlspecialchars($username ?? '', ENT_QUOTES, 'UTF-8') ?>" required autofocus>
            <label for="password">Kata Sandi</label>
            <div class="login-password-field">
                <input id="password" name="password" type="password" autocomplete="current-password" placeholder="Masukkan kata sandi" required>
                <button id="toggle-password" class="password-toggle" type="button" aria-label="Tampilkan kata sandi" aria-controls="password" aria-pressed="false"><svg class="password-eye" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg><svg class="password-eye-off" viewBox="0 0 24 24" aria-hidden="true" hidden><path d="m3 3 18 18M10 5.2c.6-.1 1.3-.2 2-.2 6.5 0 10 7 10 7a20 20 0 0 1-3.1 4.1M6.2 6.2A21 21 0 0 0 2 12s3.5 7 10 7c1.9 0 3.6-.6 5.1-1.5M10 10a3 3 0 0 0 4 4"/></svg></button>
            </div>
            <button type="submit" class="btn-login">Masuk <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14m-5-5 5 5-5 5"/></svg></button>
        </form>
        <a class="login-back" href="index.php">← Kembali ke website</a>
    </main>
    <script>
      const passwordField = document.getElementById('password');
      const passwordToggle = document.getElementById('toggle-password');
      passwordToggle.addEventListener('click', () => {
        const visible = passwordField.type === 'password';
        passwordField.type = visible ? 'text' : 'password';
        passwordToggle.setAttribute('aria-pressed', String(visible));
        passwordToggle.setAttribute('aria-label', visible ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi');
        passwordToggle.querySelector('.password-eye').toggleAttribute('hidden', visible);
        passwordToggle.querySelector('.password-eye-off').toggleAttribute('hidden', !visible);
      });
    </script>
</body>
</html>
