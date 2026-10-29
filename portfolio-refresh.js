(() => {
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  if ('IntersectionObserver' in window && !reducedMotion.matches) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.remove('reveal-pending');
        entry.target.classList.add('reveal-entered');
        observer.unobserve(entry.target);
      });
    }, {threshold:0.08});
    document.querySelectorAll('.section-title,.project-card,.profile-card').forEach(element => {
      element.classList.add('reveal-pending');
      observer.observe(element);
    });
    reducedMotion.addEventListener('change', event => {
      if (event.matches) { observer.disconnect(); document.querySelectorAll('.reveal-pending').forEach(element => element.classList.remove('reveal-pending')); }
    });
  }
  const back = document.querySelector('.back-to-top');
  function updateScroll() { back.hidden = scrollY < 500; }
  window.addEventListener('scroll', updateScroll, {passive:true});
  updateScroll();
  back.addEventListener('click', () => { window.scrollTo({top:0,behavior:reducedMotion.matches ? 'instant' : 'smooth'}); document.querySelector('.brand').focus({preventScroll:true}); });
  if ('IntersectionObserver' in window) {
    const links = [...document.querySelectorAll('.nav-links a')];
    const sections = ['beranda','slider','projects','profil'].map(id => document.getElementById(id)).filter(Boolean);
    const observer = new IntersectionObserver(entries => {
      const visible = entries.filter(entry => entry.isIntersecting).sort((a,b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      links.forEach(link => {
        const active = link.hash === '#' + visible.target.id;
        link.classList.toggle('active', active);
        if (active) link.setAttribute('aria-current','location'); else link.removeAttribute('aria-current');
      });
    }, {rootMargin:'-15% 0px -55% 0px',threshold:0});
    sections.forEach(section => observer.observe(section));
  }
})();
