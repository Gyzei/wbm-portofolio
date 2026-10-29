<?php
require_once 'auth.php';
requireLogin();
function e($v)
{
  return htmlspecialchars((string)$v, ENT_QUOTES, 'UTF-8');
}
function back($p, $s = '')
{
  if ($p === 'slides') $p = 'projects';
  header("Location: admin.php?page=$p" . ($s ? "&status=$s" : ""));
  exit;
}
function mediaFileSizeLabel($address)
{
  $path = realpath(__DIR__ . '/' . ltrim($address, '/\\'));
  $bytes = $path !== false && is_file($path) ? @filesize($path) : false;
  if ($bytes === false) return 'Ukuran tidak tersedia';
  $unit = $bytes > 0 ? min(4, (int)floor(log($bytes, 1024))) : 0;
  return number_format($bytes / (1024 ** $unit), $unit ? 2 : 0) . ' ' . ['B', 'KB', 'MB', 'GB', 'TB'][$unit];
}
$page = $_GET['page'] ?? 'projects';
if ($page === 'slides') {
  header('Location: admin.php?page=projects' . (isset($_GET['edit']) ? '&highlight_edit=' . (int)$_GET['edit'] : ''));
  exit;
}
if (!in_array($page, ['projects', 'slides', 'media', 'profile', 'settings', 'interactive'], true)) $page = 'projects';
$_SESSION['settings_token'] ??= bin2hex(random_bytes(32));
$accountQuery = $conn->prepare('SELECT id,username,display_name,password_hash FROM users WHERE id=?');
$accountQuery->bind_param('i', $_SESSION['user_id']);
$accountQuery->execute();
$account = $accountQuery->get_result()->fetch_assoc();
$accountQuery->close();
if (!$account) { header('Location: logout.php'); exit; }
$settingsError = '';
$settingsValues = $account;
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
  $a = $_POST['action'] ?? '';
  if ($a === 'account_settings') {
    $name = trim($_POST['display_name'] ?? '');
    $username = trim($_POST['username'] ?? '');
    $password = $_POST['new_password'] ?? '';
    $settingsValues = ['display_name' => $name, 'username' => $username];
    if (!hash_equals($_SESSION['settings_token'], (string)($_POST['csrf_token'] ?? ''))) {
      $settingsError = 'Sesi form tidak valid. Muat ulang halaman dan coba lagi.';
    } elseif ($name === '' || strlen($name) > 150 || !preg_match('/^[A-Za-z0-9_.-]{3,50}$/', $username)) {
      $settingsError = 'Isi display name (maksimal 150 karakter) dan username 3–50 karakter berupa huruf, angka, titik, underscore, atau tanda hubung.';
    } elseif ($password !== '' && (strlen($password) < 8 || strlen($password) > 72)) {
      $settingsError = 'Kata sandi baru harus terdiri dari 8–72 karakter.';
    } elseif ($password !== '' && $password !== ($_POST['confirm_password'] ?? '')) {
      $settingsError = 'Konfirmasi kata sandi tidak sama.';
    } else {
      $duplicate = $conn->prepare('SELECT id FROM users WHERE username=? AND id<>?');
      $duplicate->bind_param('si', $username, $account['id']);
      $duplicate->execute();
      if ($duplicate->get_result()->num_rows) {
        $settingsError = 'Username sudah digunakan akun lain.';
      } else {
        $hash = $password !== '' ? password_hash($password, PASSWORD_DEFAULT) : $account['password_hash'];
        try {
          $update = $conn->prepare('UPDATE users SET display_name=?,username=?,password_hash=? WHERE id=?');
          $update->bind_param('sssi', $name, $username, $hash, $account['id']);
          $update->execute();
          $_SESSION['username'] = $username;
          session_regenerate_id(true);
          back('settings', 'saved');
        } catch (mysqli_sql_exception $error) {
          $settingsError = $error->getCode() === 1062 ? 'Username sudah digunakan akun lain.' : 'Pengaturan belum dapat disimpan. Coba kembali.';
        }
      }
    }
    $page = 'settings';
  }
  if ($a === 'project') {
    $id = (int)($_POST['id'] ?? 0);
    $t = trim($_POST['title'] ?? '');
    $c = trim($_POST['category'] ?? '');
    $d = trim($_POST['description'] ?? '');
    $i = trim($_POST['image'] ?? '');
    $l = trim($_POST['link'] ?? '');
    if (!$t || !$c) back('projects', 'invalid');
    if ($id) {
      $q = $conn->prepare('UPDATE projects SET title=?,category=?,description=?,image=?,project_link=? WHERE id=?');
      $q->bind_param('sssssi', $t, $c, $d, $i, $l, $id);
    } else {
      $q = $conn->prepare('INSERT INTO projects(title,category,description,image,project_link) VALUES(?,?,?,?,?)');
      $q->bind_param('sssss', $t, $c, $d, $i, $l);
    }
    $q->execute();
    if ($id) {
      $sync = $conn->prepare('UPDATE slides SET title=?,description=?,image=?,link=? WHERE project_id=?');
      $sync->bind_param('ssssi', $t, $d, $i, $l, $id);
      $sync->execute();
      $sync->close();
    }
    back('projects', 'saved');
  }
  if ($a === 'delproject') {
    $id = (int)$_POST['id'];
    $q = $conn->prepare('DELETE FROM projects WHERE id=?');
    $q->bind_param('i', $id);
    $q->execute();
    back('projects', 'deleted');
  }
  if ($a === 'slide') {
    $id = (int)($_POST['id'] ?? 0);
    if (!$id && (int)$conn->query('SELECT COUNT(*) AS total FROM slides')->fetch_assoc()['total'] >= 5) back('projects', 'invalid');
    $pid = (int)$_POST['project_id'];
    if ($id) {
      $orderResult = $conn->query('SELECT slide_order FROM slides WHERE id=' . $id);
      $orderRow = $orderResult ? $orderResult->fetch_assoc() : null;
      $o = max(1, (int)($orderRow['slide_order'] ?? 1));
    } else {
      $orderResult = $conn->query('SELECT COALESCE(MAX(slide_order),0)+1 AS next_order FROM slides');
      $orderRow = $orderResult ? $orderResult->fetch_assoc() : null;
      $o = max(1, (int)($orderRow['next_order'] ?? 1));
    }
    $q = $conn->prepare('SELECT title,description,image,project_link FROM projects WHERE id=?');
    $q->bind_param('i', $pid);
    $q->execute();
    $p = $q->get_result()->fetch_assoc();
    if (!$p || !$p['image']) back('slides', 'invalid');
    if ($id) {
      $q = $conn->prepare('UPDATE slides SET project_id=?,title=?,description=?,image=?,link=?,slide_order=? WHERE id=?');
      $q->bind_param('issssii', $pid, $p['title'], $p['description'], $p['image'], $p['project_link'], $o, $id);
    } else {
      $q = $conn->prepare('INSERT INTO slides(project_id,title,description,image,link,slide_order)VALUES(?,?,?,?,?,?)');
      $q->bind_param('issssi', $pid, $p['title'], $p['description'], $p['image'], $p['project_link'], $o);
    }
    $q->execute();
    back('slides', 'saved');
  }
  if ($a === 'delslide') {
    $id = (int)$_POST['id'];
    $q = $conn->prepare('DELETE FROM slides WHERE id=?');
    $q->bind_param('i', $id);
    $q->execute();
    $q->close();
    $remaining = $conn->query('SELECT id FROM slides ORDER BY slide_order ASC, id ASC');
    if ($remaining) {
      $conn->begin_transaction();
      $orderUpdate = $conn->prepare('UPDATE slides SET slide_order=? WHERE id=?');
      $position = 1;
      while ($slide = $remaining->fetch_assoc()) {
        $slideId = (int)$slide['id'];
        $orderUpdate->bind_param('ii', $position, $slideId);
        $orderUpdate->execute();
        $position++;
      }
      $orderUpdate->close();
      $conn->commit();
    }
    back('slides', 'deleted');
  }
  if ($a === 'reorderslides') {
    $ids = array_values(array_filter(array_map('intval', explode(',', $_POST['slide_order_ids'] ?? ''))));
    if ($ids) {
      $conn->begin_transaction();
      $q = $conn->prepare('UPDATE slides SET slide_order=? WHERE id=?');
      foreach ($ids as $index => $id) {
        $position = $index + 1;
        $q->bind_param('ii', $position, $id);
        $q->execute();
      }
      $q->close();
      $conn->commit();
    }
    back('slides', 'saved');
  }
  if ($a === 'upload' && isset($_FILES['file'])) {
    $f = $_FILES['file'];
    $n = basename($f['name']);
    $x = strtolower(pathinfo($n, PATHINFO_EXTENSION));
    $ok = ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'mp4', 'webm', 'mov', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt'];
    if ($f['error'] || $f['size'] > 10485760 || !in_array($x, $ok, true)) back('media', 'invalid');
    $type = in_array($x, ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp']) ? 'image' : (in_array($x, ['mp4', 'webm', 'mov']) ? 'video' : (in_array($x, ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt']) ? 'document' : 'others'));
    $dir = "assets/$type/";
    if (!is_dir($dir)) mkdir($dir, 0775, true);
    $safe = preg_replace('/[^A-Za-z0-9._-]/', '_', $n);
    $path = $dir . bin2hex(random_bytes(16)) . '.' . $x;
    if (!move_uploaded_file($f['tmp_name'], $path)) back('media', 'invalid');
    $q = $conn->prepare('INSERT INTO fileBrowser(fileName,fileAddress,created_at)VALUES(?,?,CURRENT_TIMESTAMP)');
    $q->bind_param('ss', $safe, $path);
    $q->execute();
    back('media', 'uploaded');
  }
  if ($a === 'renamemedia') {
    if (!hash_equals($_SESSION['settings_token'], (string)($_POST['csrf_token'] ?? ''))) back('media', 'invalid');
    $id = (int)($_POST['id'] ?? 0);
    $name = trim($_POST['file_name'] ?? '');
    if ($name === '' || strlen($name) > 200 || preg_match('/[\x00-\x1F\x7F\/\\\\]/', $name) || in_array($name, ['.', '..'], true)) back('media', 'invalid');
    $q = $conn->prepare('SELECT fileName FROM fileBrowser WHERE id=?');
    $q->bind_param('i', $id);
    $q->execute();
    $file = $q->get_result()->fetch_assoc();
    if (!$file) back('media', 'invalid');
    $extension = pathinfo($file['fileName'], PATHINFO_EXTENSION);
    $newName = $name . ($extension !== '' ? '.' . $extension : '');
    $q = $conn->prepare('UPDATE fileBrowser SET fileName=? WHERE id=?');
    $q->bind_param('si', $newName, $id);
    $q->execute();
    back('media', 'saved');
  }
  if ($a === 'delmedia') {
    if (!hash_equals($_SESSION['settings_token'], (string)($_POST['csrf_token'] ?? ''))) back('media', 'invalid');
    $id = (int)$_POST['id'];
    require_once __DIR__ . '/dashboard/interactive-store.php';
    try {
      initializeInteractiveDraft($conn);
      back('media', deleteInteractiveMedia($conn, $id));
    } catch (Throwable $error) {
      error_log('Media delete: ' . $error->getMessage());
      back('media', 'deletefailed');
    }
  }
  if ($a === 'profile') {
    $n = trim($_POST['name']);
    $u = trim($_POST['username']);
    $em = trim($_POST['email']);
    $ph = trim($_POST['phone']);
    $im = trim($_POST['photo']);
    $d = trim($_POST['description']);
    $q = $conn->prepare('UPDATE profile SET name=?,username=?,email=?,phone=?,photo=?,description=? WHERE id=1');
    $q->bind_param('ssssss', $n, $u, $em, $ph, $im, $d);
    $q->execute();
    back('profile', 'saved');
  }
}
$profile = ['name' => 'Administrator', 'username' => 'admin', 'email' => 'admin@wbm.local', 'phone' => '', 'photo' => '', 'description' => ''];
$r = $conn->query('SELECT * FROM profile WHERE id=1');
if ($r && $x = $r->fetch_assoc()) $profile = $x;
function rows($c, $sql)
{
  $a = [];
  $r = $c->query($sql);
  if ($r) while ($x = $r->fetch_assoc()) $a[] = $x;
  return $a;
}
$projects = rows($conn, 'SELECT * FROM projects ORDER BY id DESC');
$slides = rows($conn, 'SELECT s.id,s.project_id,COALESCE(p.title,s.title) AS title,COALESCE(p.description,s.description) AS description,COALESCE(p.image,s.image) AS image,COALESCE(p.project_link,s.link) AS link,s.slide_order,s.created_at FROM slides s LEFT JOIN projects p ON p.id=s.project_id ORDER BY s.slide_order,s.id DESC');
$media = rows($conn, 'SELECT * FROM fileBrowser ORDER BY id DESC');
$mediaTotalBytes = 0;
if ($page === 'media') {
  $countedMediaPaths = [];
  foreach ($media as $file) {
    $path = realpath(__DIR__ . '/' . ltrim($file['fileAddress'], '/\\'));
    if ($path === false || !is_file($path) || isset($countedMediaPaths[$path])) continue;
    $countedMediaPaths[$path] = true;
    $size = @filesize($path);
    if ($size !== false) $mediaTotalBytes += $size;
  }
}
$mediaSizeUnit = $mediaTotalBytes > 0 ? min(4, (int)floor(log($mediaTotalBytes, 1024))) : 0;
$mediaTotalSize = number_format($mediaTotalBytes / (1024 ** $mediaSizeUnit), $mediaSizeUnit ? 2 : 0) . ' ' . ['B', 'KB', 'MB', 'GB', 'TB'][$mediaSizeUnit];
$edit = null;
$highlightEdit = null;
if (isset($_GET['highlight_edit'])) foreach ($slides as $slide) if ($slide['id'] == (int)$_GET['highlight_edit']) $highlightEdit = $slide;
if (isset($_GET['edit'])) foreach ($page === 'slides' ? $slides : $projects as $x) if ($x['id'] == (int)$_GET['edit']) $edit = $x;
$msgs = ['saved' => 'Perubahan berhasil disimpan.', 'deleted' => 'Data berhasil dihapus.', 'uploaded' => 'Media berhasil diunggah.', 'invalid' => 'Periksa data wajib atau format file.', 'exists' => 'Username sudah digunakan.', 'inuse' => 'Video masih digunakan oleh scene. Lepaskan video di editor Video Interaktif dan simpan terlebih dahulu.', 'deletefailed' => 'Media belum dapat dihapus. Periksa file atau koneksi database, lalu coba lagi.', 'cleanupfailed' => 'Entri media telah dihapus, tetapi file fisik belum terhapus. Periksa log server untuk membersihkan file tersebut.'];
?>
<!doctype html>
<html lang="id">

<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Portfolio CMS</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Playfair+Display:wght@600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="dashboard/dashboard.css?v=20261007-5">
  <link rel="stylesheet" href="dashboard/consistency.css?v=20261008-1">
  <?php if ($page === 'interactive'): ?><link rel="stylesheet" href="dashboard/interactive.css?v=11"><?php endif ?>
</head>

<body class="<?= $page === 'interactive' ? 'interactive-page' . (($_GET['scenario'] ?? '') === '1' ? ' iv-fullscreen' : '') : '' ?>">
  <div class="shell">
    <button class="mobile-nav-overlay" type="button" aria-label="Close navigation" hidden></button>
    <aside class="sidebar" id="sidebar">
      <button class="mobile-nav-close" type="button" aria-label="Close navigation">&times;</button>
      <div class="brand"><span>Portfolio CMS</span></div>
      <p class="nav-label">DASHBOARD</p>
      <nav class="nav"><?php foreach (['projects' => 'Projects', 'interactive' => 'Video Interaktif', 'profile' => 'Profile', 'media' => 'Media Library'] as $k => $v): ?><a class="<?= $page === $k ? 'active' : '' ?>" href="admin.php?page=<?= $k ?>"><?= $v ?></a><?php endforeach ?></nav>
      <div class="sidebar-bottom"><a href="index.php" target="_blank">View portfolio ↗</a></div>
    </aside>
    <main>
      <header class="topbar">
        <button class="mobile-nav-trigger" type="button" aria-label="Open navigation" aria-controls="sidebar" aria-expanded="false"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg></button>
        <div class="header-title"><h1><?= e(['projects' => 'Projects', 'interactive' => 'Video Interaktif', 'media' => 'Media Library', 'profile' => 'Public Profile', 'settings' => 'Settings'][$page] ?? 'Dashboard') ?></h1></div>
        <div class="topbar-actions account-menu"><button class="account-trigger" id="account-trigger" type="button" aria-expanded="false" aria-controls="account-dropdown"><span class="avatar"><?php if (!empty($profile['photo'])): ?><img src="<?= e($profile['photo']) ?>" alt=""><?php else: ?><?= e(strtoupper(substr($account['display_name'] ?: $account['username'], 0, 1))) ?><?php endif ?></span><span class="account-display-name"><?= e($account['display_name'] ?: $account['username']) ?></span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 9 5 5 5-5"/></svg></button><nav class="account-dropdown" id="account-dropdown" aria-label="Account" hidden><a href="admin.php?page=settings"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 3-.6 2.4-2 .9-2.2-.7-2 3.4L4 10.7v2.6l-1.8 1.7 2 3.4 2.2-.7 2 .9L9 21h4l.6-2.4 2-.9 2.2.7 2-3.4-1.8-1.7v-2.6L19.8 9l-2-3.4-2.2.7-2-.9L13 3Z"/><circle cx="11" cy="12" r="3"/></svg><span>Settings</span></a><a class="account-logout" href="logout.php"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5H4v14h5M9 12h12m-4-4 4 4-4 4"/></svg><span>Logout</span></a></nav></div>
      </header>
      <section class="page-content"><?php if (isset($msgs[$_GET['status'] ?? ''])): ?><div class="notice"><?= $msgs[$_GET['status']] ?></div><?php endif ?>
        <?php if ($page === 'projects'): ?><section class="content panel highlights-panel"><div class="section-head">
            <div>
              <h2>Featured Highlights</h2>
              <p>Slider beranda menggunakan cover project.</p>
            </div>
          </div>
          <div class="catalogue-tools highlight-order-tools"><p id="highlight-reorder-help" hidden>Drag cards to arrange the highlight order.</p><div class="highlight-order-actions"><button class="sort-btn" id="toggle-highlight-reorder" type="button" aria-pressed="false" aria-controls="highlight-sortable"><svg viewBox="0 0 24 24"><path d="M5 6h14M5 12h14M5 18h14"/></svg><span>Reorder</span></button><button class="sort-btn" id="save-highlight-order" type="submit" form="highlight-order-form" hidden><svg viewBox="0 0 24 24"><path d="M5 12l4 4L19 6"/></svg><span>Done</span></button></div></div>
          <form method="post" id="highlight-order-form"><input type="hidden" name="action" value="reorderslides"><input type="hidden" name="slide_order_ids" id="slide-order-ids" value="<?=e(implode(',',array_column($slides,'id')))?>">
            <table class="table">
              <thead>
                <tr>
                  <th class="drag-column"></th>
                  <th>Highlight</th>
                  <th>Order</th>
                  <th>Link</th>
                  <th class="actions-column"></th>
                </tr>
              </thead>
              <tbody id="highlight-sortable"><?php foreach (array_slice($slides, 0, 5) as $x): ?><tr class="highlight-row" draggable="false" data-slide-id="<?=$x['id']?>">
                    <td class="drag-column"><button class="drag-handle" type="button" aria-label="Drag to reorder" title="Drag to reorder"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 6h14M5 12h14M5 18h14"/></svg></button></td>
                    <td><div class="product"><img class="product-cover" src="<?=e($x['image'])?>" alt=""><span><strong><?= e($x['title']) ?></strong><small><?= e($x['description']) ?></small></span></div></td>
                    <td><span class="tag live">#<?= $x['slide_order'] ?></span></td>
                    <td><?=!empty($x['link'])?'<span class="tag draft">Linked</span>':'—'?></td>
                    <td class="actions-column"><div class="row-actions"><a class="row-edit highlight-list-edit" href="admin.php?page=projects&highlight_edit=<?=$x['id']?>" aria-label="Edit <?=e($x['title'])?>" title="Edit highlight"><svg viewBox="0 0 24 24"><path d="m4 16-.7 4.7L8 20l11-11-4-4zM16 5l4 4"/></svg></a><button class="delete-button row-delete highlight-list-delete" type="button" data-highlight-id="<?=$x['id']?>" data-highlight-name="<?=e($x['title'])?>" aria-label="Delete <?=e($x['title'])?>" title="Delete highlight"><svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6m4-6v6M9 7l1-3h4l1 3m-9 0 1 14h10l1-14"/></svg></button></div></td>
                  </tr><?php endforeach ?>
                  <?php for ($slot = min(count($slides), 5) + 1; $slot <= 5; $slot++): ?>
                    <tr class="highlight-empty-row"><td></td><td><div class="product"><i class="product-icon">—</i><span><strong>Highlight kosong</strong><small>Pilih project melalui tombol edit.</small></span></div></td><td><span class="tag live">#<?= $slot ?></span></td><td>—</td><td class="actions-column"><div class="row-actions"><button type="button" class="row-edit" data-dialog="slide-modal" aria-label="Isi highlight kosong" title="Pilih project"><svg viewBox="0 0 24 24"><path d="m4 16-.7 4.7L8 20l11-11-4-4zM16 5l4 4"/></svg></button></div></td></tr>
                  <?php endfor ?></tbody>
            </table></form>
          </section>
          <dialog class="product-editor confirmation-dialog" id="highlight-list-delete-dialog"><form method="dialog"><div class="editor-head"><div><p class="eyebrow">Confirm action</p><h2>Delete this highlight?</h2></div><button class="icon-button" value="cancel" formnovalidate aria-label="Close confirmation">&times;</button></div><p class="confirmation-message">This permanently removes the highlight from the portfolio slider. This action cannot be undone.</p><div class="confirmation-field"><span>Type <button class="confirmation-product-name" id="copy-highlight-list-delete-name" type="button"><span id="highlight-list-delete-label"></span><svg viewBox="0 0 24 24"><rect x="9" y="9" width="10" height="10" rx="1.5"/><path d="M15 9V6.5A1.5 1.5 0 0 0 13.5 5h-8A1.5 1.5 0 0 0 4 6.5v8A1.5 1.5 0 0 0 5.5 16H9"/></svg></button> to confirm</span><input id="confirm-highlight-list-delete-name" autocomplete="off" spellcheck="false" placeholder="Start typing the highlight name"></div><div class="editor-actions"><button class="cancel-button" value="cancel">Cancel</button><button class="delete-button" id="confirm-highlight-list-delete" type="button" disabled>Delete highlight</button></div></form></dialog><form id="delete-highlight-list-form" method="post" hidden><input type="hidden" name="action" value="delslide"><input type="hidden" name="id" id="delete-highlight-list-id"></form>
          <dialog id="slide-modal" class="product-editor">
            <form method="post" id="highlight-form"><input type="hidden" name="action" value="slide"><input type="hidden" name="id" value="<?= $highlightEdit['id'] ?? '' ?>">
              <div class="editor-head">
                <div><p class="eyebrow">Edit Highlight</p><h2><?= $highlightEdit?e($highlightEdit['title']):'Select project' ?></h2></div><button type="button" data-close class="icon-button">×</button>
              </div>
              <div class="editor-fields"><p class="editor-section">Highlight information</p><label class="full-field"><span class="field-label">Project <span class="required-mark">*</span></span><select id="highlight-project-select" name="project_id" required><option value="">Select a project</option><?php foreach ($projects as $x): if (!empty($x['image'])): ?><option value="<?= $x['id'] ?>" <?= ($highlightEdit['project_id'] ?? 0) == $x['id'] ? 'selected' : '' ?>><?= e($x['title']) ?> — <?= e($x['category']) ?></option><?php endif; endforeach ?></select><span class="field-help">Hanya project yang memiliki cover yang dapat dipilih sebagai Highlight. Urutan highlight baru ditambahkan otomatis setelah urutan terakhir.</span></label></div>
              <div class="editor-actions"><?php if($highlightEdit):?><button class="delete-button" type="button" id="delete-highlight">Delete</button><?php endif?><span class="editor-spacer"></span><button class="cancel-button" type="button" data-close>Cancel</button><button class="primary">Save changes</button></div>
            </form>
          </dialog>
          <?php if($highlightEdit):?><dialog class="product-editor confirmation-dialog" id="highlight-delete-dialog"><form method="dialog"><div class="editor-head"><div><p class="eyebrow">Confirm action</p><h2>Delete this highlight?</h2></div><button class="icon-button" value="cancel" formnovalidate>&times;</button></div><p class="confirmation-message">This permanently removes the highlight from the portfolio slider. This action cannot be undone.</p><div class="confirmation-field"><span>Type <button class="confirmation-product-name" id="copy-highlight-delete-name" type="button"><span><?=e($highlightEdit['title'])?></span><svg viewBox="0 0 24 24"><rect x="9" y="9" width="10" height="10" rx="1.5"/><path d="M15 9V6.5A1.5 1.5 0 0 0 13.5 5h-8A1.5 1.5 0 0 0 4 6.5v8A1.5 1.5 0 0 0 5.5 16H9"/></svg></button> to confirm</span><input id="confirm-highlight-delete-name" autocomplete="off" placeholder="Start typing the highlight name"></div><div class="editor-actions"><button class="cancel-button" value="cancel">Cancel</button><button class="delete-button" id="confirm-highlight-delete" type="button" disabled>Delete highlight</button></div></form></dialog><form id="delete-highlight-form" method="post" hidden><input type="hidden" name="action" value="delslide"><input type="hidden" name="id" value="<?=$highlightEdit['id']?>"></form><?php endif?>
          <?php if ($highlightEdit || isset($_GET['highlight_slot'])): ?><script>
              addEventListener('DOMContentLoaded', () => { document.getElementById('slide-modal').showModal(); history.replaceState({}, '', 'admin.php?page=projects'); })
            </script><?php endif ?>
          <section class="content panel projects-panel"><div class="section-head">
            <div>
              <h2>Project Library</h2>
              <p>Kelola karya yang tampil di website.</p>
            </div><a class="primary primary-action" href="admin.php?page=projects&add=1"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>Add project</a>
          </div>
          <div class="stats">
            <div><span>Total Projects</span><strong><?= count($projects) ?></strong></div>
            <div><span>Total categories</span><strong><?= count(array_unique(array_filter(array_map(static fn($project) => strtolower(trim($project['category'])), $projects), static fn($category) => $category !== ''))) ?></strong></div>
          </div>
          <div class="catalogue-tools">
            <label class="search"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6"></circle><path d="m16 16 4 4"></path></svg><input class="table-search" type="search" placeholder="Search projects..."></label>
            <button class="sort-btn" type="button"><svg viewBox="0 0 24 24"><path d="M7 4v14m0 0-4-4m4 4 4-4M17 20V6m0 0-4 4m4-4 4 4"/></svg><span>Sort: Newest</span></button>
            </div>
            <div class="table-wrap">
              <table class="table">
                <thead>
                  <tr>
                    <th>Project</th>
                    <th>Category</th>
                    <th>Added</th>
                    <th class="actions-column"></th>
                  </tr>
                </thead>
                <tbody><?php foreach ($projects as $x): ?><tr class="project-row" tabindex="0" data-edit-url="admin.php?page=projects&edit=<?= $x['id'] ?>" onclick="window.location.href=this.dataset.editUrl" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();window.location.href=this.dataset.editUrl}">
                      <td><div class="product"><?php if($x['image']):?><img class="product-cover" src="<?=e($x['image'])?>" alt=""><?php else:?><i class="product-icon"><?=e(strtoupper(substr($x['title'],0,1)))?></i><?php endif?><span><strong><?= e($x['title']) ?></strong><small><?= e($x['description']) ?></small></span></div></td>
                      <td><span class="tag category-tag" style="--category-hue:<?=abs(crc32(strtolower(trim($x['category']))))%360?>"><?= e($x['category']) ?></span></td>
                      <td data-created="<?= e($x['created_at']) ?>"><?= e(date('d M Y', strtotime($x['created_at']))) ?></td>
                      <td class="actions-column"><button class="delete-button row-delete project-list-delete" type="button" data-project-id="<?=$x['id']?>" data-project-name="<?=e($x['title'])?>" aria-label="Delete <?=e($x['title'])?>" title="Delete project"><svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6m4-6v6M9 7l1-3h4l1 3m-9 0 1 14h10l1-14"/></svg></button></td>
                    </tr><?php endforeach ?></tbody>
              </table>
            </div>
          </section>
          <dialog class="product-editor confirmation-dialog" id="project-list-delete-dialog"><form method="dialog"><div class="editor-head"><div><p class="eyebrow">Confirm action</p><h2>Delete this project?</h2></div><button class="icon-button" value="cancel" formnovalidate aria-label="Close confirmation">&times;</button></div><p class="confirmation-message">This will permanently delete this project. This action cannot be undone.</p><div class="confirmation-field"><span>Type <button class="confirmation-product-name" id="copy-project-list-delete-name" type="button" title="Copy project name"><span id="project-list-delete-label"></span><svg viewBox="0 0 24 24"><rect x="9" y="9" width="10" height="10" rx="1.5"/><path d="M15 9V6.5A1.5 1.5 0 0 0 13.5 5h-8A1.5 1.5 0 0 0 4 6.5v8A1.5 1.5 0 0 0 5.5 16H9"/></svg></button> to confirm</span><input id="confirm-project-list-delete-name" autocomplete="off" spellcheck="false" placeholder="Start typing the project name"></div><div class="editor-actions"><button class="cancel-button" value="cancel">Cancel</button><button class="delete-button" id="confirm-project-list-delete" type="button" disabled>Delete project</button></div></form></dialog><form id="delete-project-list-form" method="post" hidden><input type="hidden" name="action" value="delproject"><input type="hidden" name="id" id="delete-project-list-id" value=""></form>
          <dialog id="project-modal" class="product-editor">
            <form method="post" id="project-form"><input name="action" value="project" type="hidden"><input name="id" value="<?= $edit['id'] ?? '' ?>" type="hidden">
              <div class="editor-head">
                <div>
                  <p class="eyebrow"><?= $edit ? 'Edit Project' : 'Add Project' ?></p>
                  <h2><?= $edit ? e($edit['title']) : 'New Project' ?></h2>
                </div><button type="button" data-close class="icon-button">×</button>
              </div>
              <div class="editor-fields"><p class="editor-section">Basic information</p><label><span class="field-label">Project title <span class="required-mark">*</span></span><input name="title" required value="<?= e($edit['title'] ?? '') ?>"></label><label><span class="field-label">Category <span class="required-mark">*</span></span><input name="category" required value="<?= e($edit['category'] ?? '') ?>"></label><label class="full-field">Description<textarea name="description" rows="5"><?= e($edit['description'] ?? '') ?></textarea></label><p class="editor-section">Media & link</p><label class="full-field">Cover media<select id="project-cover-select" name="image">
                    <option value="">No cover</option><?php foreach ($media as $f): if (preg_match('/\.(jpg|jpeg|png|gif|svg|webp)$/i', $f['fileName'])): ?><option value="<?= e($f['fileAddress']) ?>" <?= ($edit['image'] ?? '') === $f['fileAddress'] ? 'selected' : '' ?>><?= e($f['fileName']) ?></option><?php endif;
                                                                                                                                                                                                                                                                                        endforeach ?>
                  </select></label><label class="full-field">Project link<input name="link" value="<?= e($edit['project_link'] ?? '') ?>" type="url" placeholder="https://..."></label></div>
              <div class="editor-actions"><?php if($edit):?><button class="delete-button" type="button" id="delete-project">Delete</button><?php endif?><span class="editor-spacer"></span><button class="cancel-button" type="button" data-close>Cancel</button><button class="primary" type="submit"><?= $edit ? 'Save changes' : 'Create project' ?></button></div>
            </form>
          </dialog>
          <?php if($edit):?><dialog class="product-editor confirmation-dialog" id="project-delete-dialog"><form method="dialog"><div class="editor-head"><div><p class="eyebrow">Confirm action</p><h2>Delete this project?</h2></div><button class="icon-button" value="cancel" formnovalidate aria-label="Close confirmation">&times;</button></div><p class="confirmation-message">This will permanently delete this project. This action cannot be undone.</p><div class="confirmation-field"><span id="confirm-project-delete-instruction">Type <button class="confirmation-product-name" id="copy-project-delete-name" type="button" title="Copy project name"><span><?=e($edit['title'])?></span><svg viewBox="0 0 24 24"><rect x="9" y="9" width="10" height="10" rx="1.5"/><path d="M15 9V6.5A1.5 1.5 0 0 0 13.5 5h-8A1.5 1.5 0 0 0 4 6.5v8A1.5 1.5 0 0 0 5.5 16H9"/></svg></button> to confirm</span><input id="confirm-project-delete-name" autocomplete="off" spellcheck="false" placeholder="Start typing the project name"></div><div class="editor-actions"><button class="cancel-button" value="cancel">Cancel</button><button class="delete-button" id="confirm-project-delete" type="button" disabled>Delete project</button></div></form></dialog><form id="delete-project-form" method="post" hidden><input type="hidden" name="action" value="delproject"><input type="hidden" name="id" value="<?=$edit['id']?>"></form><?php endif?>
          <?php if ($edit): ?><script>
              addEventListener('DOMContentLoaded', () => {
                document.getElementById('project-modal').showModal();
                history.replaceState({}, '', 'admin.php?page=projects');
              })
            </script><?php endif ?>
          <?php if (isset($_GET['add'])): ?><script>
              addEventListener('DOMContentLoaded', () => document.getElementById('project-modal').showModal())
            </script><?php endif ?>
        <?php elseif ($page === 'interactive'): ?>
          <?php require __DIR__ . (($_GET['scenario'] ?? '') === '1' ? '/dashboard/interactive.php' : '/dashboard/interactive-menu.php'); ?>
        <?php elseif ($page === 'media'): ?>
          <section class="content panel media-browser-panel">
            <div class="section-head">
              <div>
                <h2>Gallery</h2>
                <p class="media-note">Kelola gambar, video, dan dokumen lokal untuk portofolio.</p>
              </div>
              <button class="primary primary-action" data-dialog="media-modal" type="button"><svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 15V3m0 0L7.5 7.5M12 3l4.5 4.5M5 15.5V20h14v-4.5" />
                </svg>Upload file</button>
            </div>
            <div class="stats media-stats">
              <div class="stat"><span>Total files</span><strong><?= count($media) ?></strong></div>
              <div class="stat"><span>Total file size</span><strong><?= e($mediaTotalSize) ?></strong></div>
            </div>
            <div class="media-tools">
              <label class="search"><svg viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="11" cy="11" r="6"></circle>
                  <path d="m16 16 4 4"></path>
                </svg><input id="media-search" type="search" placeholder="Search media..." aria-label="Search media"></label>
              <div class="media-view-actions">
                <div class="view-toggle" role="group" aria-label="Media view"><button class="active" type="button" data-media-view="grid" title="Grid view"><svg viewBox="0 0 24 24">
                      <rect x="4" y="4" width="6" height="6"></rect>
                      <rect x="14" y="4" width="6" height="6"></rect>
                      <rect x="4" y="14" width="6" height="6"></rect>
                      <rect x="14" y="14" width="6" height="6"></rect>
                    </svg></button><button type="button" data-media-view="list" title="List view"><svg viewBox="0 0 24 24">
                      <path d="M8 6h12M8 12h12M8 18h12"></path>
                      <circle cx="4" cy="6" r=".8"></circle>
                      <circle cx="4" cy="12" r=".8"></circle>
                      <circle cx="4" cy="18" r=".8"></circle>
                    </svg></button></div>
              </div>
            </div>
            <div class="media-gallery" id="media-gallery">
              <?php foreach ($media as $f): $ext = strtoupper(pathinfo($f['fileName'], PATHINFO_EXTENSION)); ?>
                <article class="media-card" data-name="<?= e($f['fileName']) ?>" data-created="<?= e($f['created_at'] ?? '') ?>" data-id="<?= (int)$f['id'] ?>">
                  <a class="media-preview" href="<?= e($f['fileAddress']) ?>" target="_blank" title="Open <?= e($f['fileName']) ?>"><?php if (preg_match('/\.(jpg|jpeg|png|gif|svg|webp)$/i', $f['fileName'])): ?><img src="<?= e($f['fileAddress']) ?>" alt="<?= e($f['fileName']) ?>" loading="lazy"><?php else: ?><span><?= $ext ?></span><?php endif ?></a>
                  <div class="media-card-body">
                    <p class="media-name" title="<?= e(pathinfo($f['fileName'], PATHINFO_FILENAME)) ?>"><?= e(pathinfo($f['fileName'], PATHINFO_FILENAME)) ?></p>
                    <p class="media-meta"><?= e($ext) ?> &bull; <?= e(mediaFileSizeLabel($f['fileAddress'])) ?> &bull; <?php if (!empty($f['created_at'])): ?><time datetime="<?= e(date('c', strtotime($f['created_at']))) ?>"><?= e(date('d M Y, H:i', strtotime($f['created_at']))) ?></time><?php else: ?><span>Tanggal tidak tersedia</span><?php endif ?></p>
                    <div class="media-actions">
                      <button class="media-edit media-rename" type="button" data-media-id="<?= (int)$f['id'] ?>" data-media-name="<?= e(pathinfo($f['fileName'], PATHINFO_FILENAME)) ?>" data-media-extension="<?= e(pathinfo($f['fileName'], PATHINFO_EXTENSION)) ?>" title="Rename" aria-label="Rename <?= e($f['fileName']) ?>"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m16 3 5 5-12 12-6 1 1-6L16 3ZM14 5l5 5"/></svg></button>
                      <button class="media-delete media-confirm-delete" type="button" data-media-id="<?= (int)$f['id'] ?>" data-media-name="<?= e(pathinfo($f['fileName'], PATHINFO_FILENAME)) ?>" title="Delete" aria-label="Delete <?= e($f['fileName']) ?>"><svg viewBox="0 0 24 24">
                            <path d="M4 7h16M10 11v6m4-6v6M9 7l1-3h4l1 3m-9 0 1 14h10l1-14" />
                          </svg></button>
                    </div>
                  </div>
                </article>
              <?php endforeach ?>
              <?php if (!$media): ?><p class="media-empty">No files uploaded yet.</p><?php endif ?>
            </div>
            <div class="pagination media-pagination"><span id="media-page-info">Showing 0-0 of 0 files</span>
              <div class="page-actions"><button type="button" data-media-page="first">&laquo;</button><button type="button" data-media-page="prev">&larr;</button><button class="current" type="button" id="media-current-page">1</button><button type="button" data-media-page="next">&rarr;</button><button type="button" data-media-page="last">&raquo;</button></div>
            </div>
          </section>
          <dialog id="media-delete-dialog" class="product-editor confirmation-dialog">
            <form method="post" action="admin.php?page=media">
              <input type="hidden" name="action" value="delmedia"><input type="hidden" name="id" id="delete-media-id"><input type="hidden" name="csrf_token" value="<?= e($_SESSION['settings_token']) ?>">
              <div class="editor-head"><div><p class="eyebrow">Confirm action</p><h2>Delete this file?</h2></div><button type="button" data-close class="icon-button" aria-label="Close confirmation">&times;</button></div>
              <p class="confirmation-message">File <strong id="delete-media-name"></strong> akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.</p>
              <div class="editor-actions"><button class="cancel-button" type="button" data-close autofocus>Cancel</button><button class="delete-button" type="submit">Delete file</button></div>
            </form>
          </dialog>
          <dialog id="media-rename-dialog" class="product-editor">
            <form method="post" action="admin.php?page=media">
              <input type="hidden" name="action" value="renamemedia"><input type="hidden" name="id" id="rename-media-id"><input type="hidden" name="csrf_token" value="<?= e($_SESSION['settings_token']) ?>">
              <div class="editor-head"><div><p class="eyebrow">MEDIA LIBRARY</p><h2>Rename file</h2></div><button type="button" data-close class="icon-button" aria-label="Close">×</button></div>
              <div class="editor-fields"><label class="full-field" for="rename-media-name">File name<input id="rename-media-name" name="file_name" required maxlength="200" autocomplete="off"><span class="field-help">Format <span id="rename-media-extension"></span> tetap dipertahankan.</span></label></div>
              <div class="editor-actions"><button type="button" data-close class="cancel-button">Cancel</button><button class="primary" type="submit">Save name</button></div>
            </form>
          </dialog>
          <dialog id="media-modal" class="product-editor">
            <form method="post" enctype="multipart/form-data"><input type="hidden" name="action" value="upload">
              <div class="editor-head">
                <div>
                  <p class="eyebrow">MEDIA LIBRARY</p>
                  <h2>Upload file</h2>
                </div><button type="button" data-close class="icon-button">×</button>
              </div>
              <div class="upload-content">
                <label class="upload-dropzone" id="upload-dropzone" for="upload-file"><input id="upload-file" type="file" name="file" required accept=".jpg,.jpeg,.png,.gif,.svg,.webp,.mp4,.webm,.mov,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt" aria-describedby="upload-help upload-error"><span class="upload-symbol"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V4m-4 4 4-4 4 4M4 15v5h16v-5"/></svg></span><strong>Pilih atau tarik file ke sini</strong><span>Klik untuk memilih file dari perangkat</span></label>
                <p id="upload-help" class="upload-help">Gambar, video, atau dokumen · Maksimum 10 MB per file</p>
                <div class="upload-selection" id="upload-selection" hidden><div class="upload-file-preview"><img alt="Preview file" hidden><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h8l4 4v14H6zM14 3v5h4M9 12h6M9 16h6"/></svg></div><div class="upload-file-info"><strong id="upload-file-name"></strong><span id="upload-file-size"></span></div><button type="button" id="upload-remove" aria-label="Remove selected file">&times;</button></div>
                <p id="upload-error" class="upload-error" role="alert" hidden></p>
              </div>
              <div class="editor-actions"><button type="button" class="cancel-button" data-close>Cancel</button><button class="primary" type="submit">Upload file</button></div>
            </form>
          </dialog>
        <?php elseif ($page === 'settings'): ?>
          <div class="page-heading"><div><h2>Account Details</h2><p>Kelola identitas dan kata sandi akun dashboard Anda.</p></div></div>
          <section class="panel account-settings-panel">
            <?php if ($settingsError): ?><div class="notice settings-error" role="alert"><?= e($settingsError) ?></div><?php endif ?>
            <form method="post" action="admin.php?page=settings">
              <input type="hidden" name="action" value="account_settings"><input type="hidden" name="csrf_token" value="<?= e($_SESSION['settings_token']) ?>">
              <div class="editor-fields">
                <p class="editor-section">Account information</p>
                <label>Display name<input name="display_name" required maxlength="150" autocomplete="name" value="<?= e($settingsValues['display_name'] ?: $settingsValues['username']) ?>"></label>
                <label>Username<input name="username" required minlength="3" maxlength="50" pattern="[A-Za-z0-9_.-]{3,50}" autocomplete="username" value="<?= e($settingsValues['username']) ?>"></label>
                <p class="editor-section">Change password</p>
                <p class="field-help full-field">Kosongkan kata sandi baru jika tidak ingin mengubahnya.</p>
                <label>New password<input id="new-password" type="password" name="new_password" minlength="8" maxlength="72" autocomplete="new-password" aria-describedby="password-strength-label"><span class="password-strength" id="password-strength" hidden><span class="password-strength-track" role="meter" aria-label="Kekuatan kata sandi" aria-valuemin="0" aria-valuemax="4" aria-valuenow="0"><span class="password-strength-fill"></span></span><span id="password-strength-label" aria-live="polite"></span></span></label>
                <label>Confirm new password<input type="password" name="confirm_password" minlength="8" maxlength="72" autocomplete="new-password"></label>
              </div>
              <div class="editor-actions"><button class="primary" type="submit">Save settings</button></div>
            </form>
          </section>
        <?php elseif ($page === 'profile'): ?><div class="page-heading">
            <div>
              <h2>Profile Details</h2>
              <p>Identitas kreator di halaman portofolio.</p>
            </div>
          </div>
          <section class="panel form-panel">
            <form method="post"><input type="hidden" name="action" value="profile">
              <div class="editor-fields"><label>Name<input name="name" value="<?= e($profile['name']) ?>"></label><label>Username<input name="username" value="<?= e($profile['username']) ?>"></label><label>Email<input name="email" value="<?= e($profile['email']) ?>"></label><label>Phone<input name="phone" value="<?= e($profile['phone']) ?>"></label><label class="wide">Avatar<select id="profile-photo-select" name="photo">
                    <option value="">No avatar</option><?php foreach ($media as $f): if (preg_match('/\.(jpg|jpeg|png|gif|svg|webp)$/i', $f['fileName'])): ?><option value="<?= e($f['fileAddress']) ?>" <?= $profile['photo'] === $f['fileAddress'] ? 'selected' : '' ?>><?= e($f['fileName']) ?></option><?php endif;
                                                                                                                                                                                                                                                                                      endforeach ?>
                  </select></label><label class="wide">Bio<textarea name="description"><?= e($profile['description']) ?></textarea></label></div><button class="primary">Save profile</button>
            </form>
          </section>
        <?php endif ?>
      </section>
    </main>
  </div>
  <script src="dashboard/dashboard.js?v=20261022-1"></script>
<?php if ($page === 'interactive' && ($_GET['scenario'] ?? '') === '1'): ?><script src="dashboard/interactive.js?v=11"></script><?php endif ?>
</body>

</html>
