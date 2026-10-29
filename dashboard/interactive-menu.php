<?php
require_once __DIR__ . '/interactive-store.php';
initializeInteractiveDraft($conn);
$scenarios = $conn->query('SELECT id,graph,updated_at FROM interactive_video ORDER BY id DESC')->fetch_all(MYSQLI_ASSOC);
?>
<section class="content panel projects-panel" aria-labelledby="iv-scenarios-title">
  <div class="section-head">
    <div><h2 id="iv-scenarios-title">Scenario Library</h2><p>Kelola cerita dan susun alur video interaktif.</p></div>
    <form method="post"><input type="hidden" name="action" value="create_scenario"><input type="hidden" name="csrf_token" value="<?= e($_SESSION['settings_token']) ?>"><button class="primary primary-action" type="submit"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>Tambah skenario</button></form>
  </div>
  <div class="stats"><div><span>Total skenario</span><strong><?= count($scenarios) ?></strong></div></div>
  <div class="table-wrap"><table class="table">
    <thead><tr><th>Skenario</th><th>Scene</th><th>Terakhir diperbarui</th><th class="actions-column"></th></tr></thead>
    <tbody><?php foreach ($scenarios as $scenario): $graph = json_decode($scenario['graph'], true, 512, JSON_THROW_ON_ERROR); ?><tr>
      <td><div class="product"><i class="product-icon" aria-hidden="true">▶</i><span><strong><?= e($graph['title']) ?></strong><small>Draft skenario</small></span></div></td>
      <td><?= count($graph['scenes']) ?> scene</td>
      <td><?= e(date('d M Y', strtotime($scenario['updated_at']))) ?></td>
      <td class="actions-column"><a class="iv-button" href="admin.php?page=interactive&amp;scenario=<?= (int)$scenario['id'] ?>" aria-label="Buka editor <?= e($graph['title']) ?>">Buka editor →</a></td>
    </tr><?php endforeach ?></tbody>
  </table></div>
</section>
