<?php
// Memuat koneksi database
require_once 'koneksi.php';

// Urutan acak khusus sesi pengunjung, tetap stabil saat refresh atau filter.
if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}
if (empty($_SESSION['portfolio_project_seed'])) {
    $_SESSION['portfolio_project_seed'] = bin2hex(random_bytes(16));
}
$projectOrderSeed = $_SESSION['portfolio_project_seed'];
session_write_close();

// ==========================================
// 1. AMBIL DATA SLIDES DARI DATABASE
// ==========================================
$slides = [];
$resSlides = $conn->query("SELECT s.id, s.project_id, COALESCE(p.title, s.title) AS title, COALESCE(p.description, s.description) AS description, COALESCE(p.image, s.image) AS image, COALESCE(p.project_link, s.link) AS link, s.slide_order FROM slides s LEFT JOIN projects p ON p.id = s.project_id ORDER BY s.slide_order ASC, s.id DESC LIMIT 5");
if ($resSlides && $resSlides->num_rows > 0) {
    while ($row = $resSlides->fetch_assoc()) {
        $slides[] = $row;
    }
}

// ==========================================
// 2. AMBIL DATA PROFIL ADMIN
// ==========================================
$profile = [
    'name' => 'Administrator',
    'username' => 'admin',
    'email' => 'admin@wbm.local',
    'phone' => '+62 812-3456-7890',
    'photo' => '',
    'description' => ''
];
$resProfile = $conn->query("SELECT * FROM profile WHERE id = 1");
if ($resProfile && $rowP = $resProfile->fetch_assoc()) {
    $profile = $rowP;
}

$projects = [];
$resProjects = $conn->query("SELECT * FROM projects ORDER BY id DESC");
if ($resProjects && $resProjects->num_rows > 0) {
    while ($project = $resProjects->fetch_assoc()) {
        $projects[] = $project;
    }
}

usort($projects, static function ($a, $b) use ($projectOrderSeed) {
    $aHasLink = trim((string)($a['project_link'] ?? '')) !== '';
    $bHasLink = trim((string)($b['project_link'] ?? '')) !== '';
    if ($aHasLink !== $bHasLink) {
        return $bHasLink <=> $aHasLink;
    }
    $aRank = hash('sha256', $projectOrderSeed . ':' . $a['id']);
    $bRank = hash('sha256', $projectOrderSeed . ':' . $b['id']);
    return strcmp($aRank, $bRank) ?: ($a['id'] <=> $b['id']);
});

$projectCategories = array_values(array_unique(array_map(static fn($project) => trim((string)($project['category'] ?? '')) ?: 'Tanpa kategori', $projects)));
natcasesort($projectCategories);
?>
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?= htmlspecialchars($profile['name']) ?> - Portofolio</title>
    <!-- CSS Client Page Simple Modern -->
    <link rel="stylesheet" href="client.css?v=20261007-1">
    <link rel="stylesheet" href="portfolio-refresh.css?v=20261007-3">
</head>
<body class="client-page">

    <!-- NAVIGATION BAR -->
    <nav class="navbar">
        <div class="container nav-container">
            <a href="index.php" class="brand">
                <span>Portofolio</span>
            </a>

            <ul class="nav-links">
                <?php if (!empty($slides)): ?>
                    <li><a href="#slider">Highlights</a></li>
                <?php endif; ?>
                <li><a href="#projects">Projects</a></li>
                <li><a href="#profil">Tentang Saya</a></li>
            </ul>

        </div>
    </nav>

    <!-- MAIN WRAPPER -->
    <main id="beranda">
        <section class="intro-section">
            <div class="container intro-layout">
                <div class="intro-copy">
                    <p class="intro-eyebrow"><span></span>PORTOFOLIO PERSONAL</p>
                    <h1>Halo, saya<br><span><?= htmlspecialchars($profile['name']) ?>.</span></h1>
                    <p class="intro-description">Selamat datang di ruang karya saya. Jelajahi project, ide, dan cerita di balik setiap proses kreatif.</p>
                    <div class="intro-actions"><a class="intro-primary" href="#projects">Jelajahi karya <span aria-hidden="true">↗</span></a><a class="intro-secondary" href="#profil">Kenali saya <span aria-hidden="true">→</span></a></div>
                    <div class="intro-footnote"><span class="intro-line"></span><?= count($projects) ?> project · Satu ruang untuk berbagai ide</div>
                </div>
                <div class="intro-visual" aria-hidden="true">
                    <span class="intro-orbit"></span><span class="intro-spark">✳</span>
                    <div class="intro-photo"><?php if (!empty($profile['photo'])): ?><img src="<?= htmlspecialchars($profile['photo']) ?>" alt=""><?php else: ?><span><?= htmlspecialchars(mb_substr($profile['name'], 0, 1)) ?></span><?php endif ?></div>
                    <div class="intro-note"><span>✦</span><div><strong>Ide menjadi karya.</strong><small>Dibuat dengan perhatian pada detail</small></div></div>
                </div>
            </div>
        </section>

        <!-- ============================================== -->
        <!-- 1. HERO SLIDER / BANNER SECTION (SLIDES TABLE) -->
        <!-- ============================================== -->
        <section class="hero-slider-section" id="slider">
            <div class="container">
                <div class="section-title highlights-title"><span class="section-kicker">01 / HIGHLIGHTS</span><h2>Karya dalam sorotan.</h2><p>Pilihan project yang menjadi bagian dari perjalanan saya.</p></div>
                <div class="slider-wrapper">
                    <div class="slides-container" id="slidesContainer">

                        <?php if (!empty($slides)): ?>
                            <?php foreach ($slides as $idx => $s): ?>
                                <div class="slide-item <?= ($idx === 0) ? 'active' : '' ?>" style="background-image: url('<?= htmlspecialchars($s['image']) ?>');">
                                    <div class="slide-overlay"></div>
                                    <div class="slide-content">
                                        <span class="slide-badge">Featured / <?= str_pad((string)($idx + 1), 2, '0', STR_PAD_LEFT) ?></span>
                                        <h2><?= htmlspecialchars($s['title']) ?></h2>
                                        <?php if (!empty($s['description'])): ?>
                                            <p><?= htmlspecialchars($s['description']) ?></p>
                                        <?php endif; ?>
                                        <?php if (!empty($s['link'])): ?>
                                            <a href="<?= htmlspecialchars($s['link']) ?>" target="_blank" class="btn-slide-link">
                                                <span>Lihat Selengkapnya</span>
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                                    <line x1="5" y1="12" x2="19" y2="12"></line>
                                                    <polyline points="12 5 19 12 12 19"></polyline>
                                                </svg>
                                            </a>
                                        <?php endif; ?>
                                    </div>
                                </div>
                            <?php endforeach; ?>
                        <?php else: ?>
                            <!-- Fallback banner jika belum ada slide yang ditambahkan di admin -->
                            <div class="slide-item active slide-fallback">
                                <div class="slide-content">
                                    <span class="slide-badge">Selamat Datang</span>
                                    <h2>Portofolio Kreatif</h2>
                                    <p>Tampilkan karya, proyek, dan cerita terbaik Anda dalam satu tempat.</p>
                                    <a href="#projects" class="btn-slide-link">
                                        <span>Jelajahi Project →</span>
                                    </a>
                                </div>
                            </div>
                        <?php endif; ?>

                    </div>

                    <?php if (count($slides) > 1): ?>
                        <!-- Tombol Navigasi Slider -->
                        <button class="slider-btn slider-prev" id="prevSlideBtn" aria-label="Slide Sebelumnya">‹</button>
                        <button class="slider-btn slider-next" id="nextSlideBtn" aria-label="Slide Selanjutnya">›</button>
                        <button class="slider-pause" id="pauseSlideBtn" type="button" aria-label="Jeda slideshow" aria-pressed="false">Jeda</button>

                        <!-- Indikator Dots Slider -->
                        <div class="slider-dots" id="sliderDots">
                            <?php foreach ($slides as $idx => $s): ?>
                                <button class="slider-dot <?= ($idx === 0) ? 'active' : '' ?>" data-index="<?= $idx ?>" aria-label="Go to slide <?= $idx + 1 ?>"></button>
                            <?php endforeach; ?>
                        </div>
                    <?php endif; ?>
                </div>
            </div>
        </section>

        <!-- ============================================== -->
        <!-- 2. PROJECTS PORTOFOLIO                         -->
        <!-- ============================================== -->
        <section class="section projects-section" id="projects">
            <div class="container">
                <div class="section-title">
                    <span class="section-kicker">02 / PROJECTS</span><h2>Ide yang diwujudkan.</h2>
                    <p>Beberapa karya dan pengalaman yang pernah saya kerjakan.</p>
                </div>
                <?php if (!empty($projects)): ?>
                    <div class="project-category-filters" role="group" aria-label="Filter kategori project">
                        <button type="button" class="project-category-filter" data-project-category="" aria-pressed="true">Semua</button>
                        <?php foreach ($projectCategories as $category): ?>
                            <button type="button" class="project-category-filter" data-project-category="<?= htmlspecialchars($category, ENT_QUOTES, 'UTF-8') ?>" aria-pressed="false"><?= htmlspecialchars($category) ?></button>
                        <?php endforeach; ?>
                    </div>
                    <p class="project-filter-summary" id="projectFilterSummary" role="status" aria-live="polite"></p>
                    <div class="projects-grid">
                        <?php foreach ($projects as $projectIndex => $project): ?>
                            <article class="project-card <?= ($projectIndex >= 4) ? 'project-extra' : '' ?>" data-project-category="<?= htmlspecialchars(trim((string)($project['category'] ?? '')) ?: 'Tanpa kategori', ENT_QUOTES, 'UTF-8') ?>">
                                <div class="project-cover">
                                    <?php if (!empty($project['image'])): ?>
                                        <img src="<?= htmlspecialchars($project['image']) ?>" alt="<?= htmlspecialchars($project['title']) ?>" loading="lazy">
                                    <?php else: ?>
                                        <span>🗂️</span>
                                    <?php endif; ?>
                                </div>
                                <div class="project-body">
                                    <span class="project-category"><?= htmlspecialchars($project['category']) ?></span>
                                    <h3><?= htmlspecialchars($project['title']) ?></h3>
                                    <?php if (!empty($project['description'])): ?><p><?= htmlspecialchars($project['description']) ?></p><?php endif; ?>
                                    <?php if (!empty($project['project_link'])): ?><a href="<?= htmlspecialchars($project['project_link']) ?>" target="_blank" class="project-link">Lihat Project <span>→</span></a><?php endif; ?>
                                </div>
                            </article>
                        <?php endforeach; ?>
                    </div>
                    <?php if (count($projects) > 4): ?>
                        <div class="projects-more-wrap">
                            <button type="button" class="projects-more-button" id="loadMoreProjects">Lihat karya lainnya <span>↓</span></button>
                        </div>
                    <?php endif; ?>
                <?php else: ?>
                    <p class="projects-empty">Project akan segera ditampilkan di sini.</p>
                <?php endif; ?>
            </div>
        </section>

        <!-- ============================================== -->
        <!-- 3. TENTANG PENGELOLA (PROFILE TABLE)           -->
        <!-- ============================================== -->
        <section class="section profile-section" id="profil">
            <div class="container">
                <div class="section-title">
                    <span class="section-kicker">03 / TENTANG SAYA</span><h2>Di balik setiap karya.</h2>
                    <p>Kenali kreator di balik karya-karya dalam portofolio ini.</p>
                </div>

                <div class="profile-card">
                    <div class="profile-avatar-wrap">
                        <?php if (!empty($profile['photo']) && file_exists($profile['photo'])): ?>
                            <img src="<?= htmlspecialchars($profile['photo']) ?>" alt="<?= htmlspecialchars($profile['name']) ?>" class="profile-avatar">
                        <?php else: ?>
                            <div class="profile-avatar-fallback">👤</div>
                        <?php endif; ?>
                    </div>

                    <div class="profile-details">
                        <h3><?= htmlspecialchars($profile['name']) ?></h3>
                        <div class="profile-role">@<?= htmlspecialchars($profile['username']) ?> &bull; Portfolio Owner</div>
                        <p class="profile-desc">
                            <?= !empty($profile['description']) ? nl2br(htmlspecialchars($profile['description'])) : 'Portofolio ini menampilkan karya, pengalaman, dan informasi profesional saya.' ?>
                        </p>

                        <div class="profile-contacts">
                            <div class="contact-item">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                                    <polyline points="22,6 12,13 2,6"></polyline>
                                </svg>
                                <span><?= htmlspecialchars($profile['email']) ?></span>
                            </div>
                            <?php if (!empty($profile['phone'])): ?>
                                <div class="contact-item">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                                    </svg>
                                    <span><?= htmlspecialchars($profile['phone']) ?></span>
                                </div>
                            <?php endif; ?>
                        </div>
                    </div>
                </div>
            </div>
        </section>

    </main>

    <!-- FOOTER -->
    <footer class="footer">
        <div class="container footer-content">
            <div>
                &copy; <?= date('Y') ?> <strong>Portofolio</strong>. Seluruh karya ditampilkan dengan penuh perhatian.
            </div>
        </div>
    </footer>
    <button class="back-to-top" type="button" aria-label="Kembali ke atas" hidden>↑</button>

    <!-- INTERACTIVE SCRIPTS -->
    <script>
        // ==========================================
        // 1. CAROUSEL SLIDER AUTO & MANUAL
        // ==========================================
        (function() {
            var slides = document.querySelectorAll('.slide-item');
            var dots = document.querySelectorAll('.slider-dot');
            var prevBtn = document.getElementById('prevSlideBtn');
            var nextBtn = document.getElementById('nextSlideBtn');
            var currentIndex = 0;
            var slideTimer = null;
            var autoPlayDelay = 5000;
            var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
            var paused = reducedMotion.matches;
            var pauseBtn = document.getElementById('pauseSlideBtn');
            function updatePauseButton() { if (pauseBtn) { pauseBtn.textContent = paused ? 'Lanjutkan' : 'Jeda'; pauseBtn.setAttribute('aria-pressed', String(paused)); pauseBtn.setAttribute('aria-label', paused ? 'Lanjutkan slideshow' : 'Jeda slideshow'); } }
            updatePauseButton();

            if (slides.length <= 1) return;

            function goToSlide(index) {
                slides[currentIndex].classList.remove('active');
                if (dots[currentIndex]) dots[currentIndex].classList.remove('active');
                
                currentIndex = (index + slides.length) % slides.length;
                
                slides[currentIndex].classList.add('active');
                if (dots[currentIndex]) dots[currentIndex].classList.add('active');
                slides.forEach(function(slide, idx) { slide.inert = idx !== currentIndex; });
                dots.forEach(function(dot, idx) { dot.setAttribute('aria-current', String(idx === currentIndex)); });
            }

            function nextSlide() {
                goToSlide(currentIndex + 1);
            }

            function prevSlide() {
                goToSlide(currentIndex - 1);
            }

            function startAutoPlay() {
                // Hindari timer ganda saat pengguna mengarahkan mouse atau menekan navigasi berulang kali.
                if (slideTimer !== null || document.hidden || paused || wrapper && wrapper.contains(document.activeElement)) return;
                slideTimer = window.setTimeout(function advanceSlide() {
                    nextSlide();
                    slideTimer = window.setTimeout(advanceSlide, autoPlayDelay);
                }, autoPlayDelay);
            }

            function stopAutoPlay() {
                if (slideTimer !== null) {
                    window.clearTimeout(slideTimer);
                    slideTimer = null;
                }
            }

            function restartAutoPlay() {
                stopAutoPlay();
                startAutoPlay();
            }

            if (nextBtn) {
                nextBtn.addEventListener('click', function() {
                    nextSlide();
                    restartAutoPlay();
                });
            }

            if (prevBtn) {
                prevBtn.addEventListener('click', function() {
                    prevSlide();
                    restartAutoPlay();
                });
            }

            dots.forEach(function(dot) {
                dot.addEventListener('click', function() {
                    var idx = parseInt(this.getAttribute('data-index'));
                    goToSlide(idx);
                    restartAutoPlay();
                });
            });

            // Pause saat hover
            var wrapper = document.querySelector('.slider-wrapper');
            if (wrapper) {
                wrapper.addEventListener('mouseenter', stopAutoPlay);
                wrapper.addEventListener('mouseleave', startAutoPlay);
                wrapper.addEventListener('focusin', stopAutoPlay);
                wrapper.addEventListener('focusout', function() { setTimeout(startAutoPlay, 0); });
            }
            if (pauseBtn) pauseBtn.addEventListener('click', function() { paused = !paused; updatePauseButton(); paused ? stopAutoPlay() : startAutoPlay(); });
            reducedMotion.addEventListener('change', function(event) { paused = event.matches; updatePauseButton(); restartAutoPlay(); });
            goToSlide(0);

            // Jangan jalankan timer di tab yang tidak terlihat; lanjutkan kembali ketika pengguna kembali.
            document.addEventListener('visibilitychange', function() {
                if (document.hidden) {
                    stopAutoPlay();
                } else {
                    startAutoPlay();
                }
            });

            startAutoPlay();
        })();

        // Filter kategori dan tampilkan delapan project tambahan dari kategori aktif.
        (function() {
            var cards = Array.from(document.querySelectorAll('#projects .project-card'));
            if (!cards.length) return;
            var filters = Array.from(document.querySelectorAll('.project-category-filter'));
            var loadMoreButton = document.getElementById('loadMoreProjects');
            var category = '';
            var visibleCount = 4;
            cards.forEach(function(card) { card.classList.remove('project-extra'); });
            function renderProjects() {
                var matching = cards.filter(function(card) { return !category || card.dataset.projectCategory === category; });
                var visible = new Set(matching.slice(0, visibleCount));
                cards.forEach(function(card) { card.hidden = !visible.has(card); });
                filters.forEach(function(button) { button.setAttribute('aria-pressed', String(button.dataset.projectCategory === category)); });
                document.getElementById('projectFilterSummary').textContent = matching.length + ' project' + (category ? ' dalam kategori ' + category : ' di semua kategori');
                if (loadMoreButton) loadMoreButton.parentElement.hidden = matching.length <= visibleCount;
            }
            filters.forEach(function(button) {
                button.addEventListener('click', function() {
                    category = button.dataset.projectCategory;
                    visibleCount = 4;
                    renderProjects();
                });
            });
            if (loadMoreButton) loadMoreButton.addEventListener('click', function() { visibleCount += 8; renderProjects(); });
            renderProjects();
        })();

    </script>
    <script src="portfolio-refresh.js?v=20261007-1"></script>
</body>
</html>
