<?php
require_once __DIR__ . '/interactive-store.php';
initializeInteractiveDraft($conn);
$draft = interactiveDraft($conn);
$sceneCount = count($draft['graph']['scenes']);
?>
<section class="iv-scenarios" aria-labelledby="iv-scenarios-title">
  <h2 id="iv-scenarios-title">Pilih skenario</h2>
  <p>Buka skenario untuk menyusun video dan pilihan cerita di editor layar penuh.</p>
  <article class="iv-scenario">
    <div><h3><?= e($draft['graph']['title']) ?></h3><p><?= $sceneCount ?> scene · Draft bersama</p></div>
    <a class="iv-button iv-primary" href="admin.php?page=interactive&amp;scenario=1">Buka editor →</a>
  </article>
</section>
