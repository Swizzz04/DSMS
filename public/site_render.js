// ============================================================
// CSHC WEBSITE — RENDERER
// Reads SITE_DATA and builds all HTML dynamically.
// Never edit this file to change content — edit site_data.js.
// ============================================================

(function () {
  const D = SITE_DATA;

  // ── Helpers ───────────────────────────────────────────────
  const esc = (s) => String(s ?? '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');

  const el = (tag, cls, inner, attrs = '') =>
    `<${tag}${cls ? ` class="${cls}"` : ''} ${attrs}>${inner}</${tag}>`;

  // ── 1. Page title + meta ──────────────────────────────────
  document.title = esc(D.school.name);
  document.querySelector('meta[name="description"]')
    ?.setAttribute('content', `${esc(D.school.name)} — Quality education from Pre-Elementary to College.`);

  // ── 2. Navbar ─────────────────────────────────────────────
  document.getElementById('navLinks').innerHTML = D.nav.map(n =>
    `<li><a href="${esc(n.href)}"${n.cta ? ' class="nav-cta"' : ''}>${esc(n.label)}</a></li>`
  ).join('');

  document.getElementById('navLogo').innerHTML = `
    <img src="${esc(D.school.navLogoSrc)}" alt="${esc(D.school.nameShort)} Logo" class="logo-img">
    <div class="logo-text">
      <span class="logo-name">${esc(D.school.name)}</span>
      <span class="logo-tagline">${esc(D.school.tagline)}</span>
    </div>`;

  // ── 3. Hero ───────────────────────────────────────────────
  document.getElementById('heroContent').innerHTML = `
    <img src="${esc(D.school.logoSrc)}" alt="${esc(D.school.nameShort)} Logo" class="hero-logo">
    <div class="hero-badge">
      <span class="badge-dot"></span>
      Enrollment Now Open — A.Y. ${esc(D.school.schoolYear)}
    </div>
    <h1>${esc(D.school.name)}</h1>
    <p class="tagline">"${esc(D.school.tagline)}"</p>
    <div class="hero-buttons">
      <a href="${esc(D.school.enrollmentUrl)}" class="btn btn-primary">Enroll Now &rarr;</a>
      <a href="#about" class="btn btn-secondary">Learn More</a>
    </div>
    <div class="hero-stats">
      ${D.stats.map(s => `
        <div class="hero-stat">
          <span class="hero-stat-num">${esc(s.num)}</span>
          <span class="hero-stat-label">${esc(s.label)}</span>
        </div>`).join('')}
    </div>`;

  // ── 4. About ──────────────────────────────────────────────
  const ab = D.about;
  document.getElementById('aboutSection').innerHTML = `
    <div class="container">
      <p class="section-label">${esc(ab.sectionLabel)}</p>
      <h2 class="section-title">${esc(ab.title)}</h2>
      <p class="section-subtitle">${esc(ab.subtitle)}</p>
      <div class="about-grid reveal">
        ${ab.cards.map(c => `
          <div class="about-card">
            <h3>${esc(c.title)}</h3>
            ${c.type === 'text' ? `<p>${esc(c.content)}</p>` : ''}
            ${c.type === 'ordered-list' ? `<ol class="goal-list">${c.items.map(i=>`<li>${esc(i)}</li>`).join('')}</ol>` : ''}
            ${c.type === 'unordered-list' ? `<ul class="values-list">${c.items.map(i=>`<li>${esc(i)}</li>`).join('')}</ul>` : ''}
          </div>`).join('')}
      </div>
    </div>`;

  // ── 5. Campuses ───────────────────────────────────────────
  document.getElementById('campusGrid').innerHTML = D.campuses.map(c => `
    <div class="campus-card reveal">
      <div class="campus-image">
        <img src="${esc(c.image)}" alt="${esc(c.name)}" loading="lazy"
          onerror="this.style.display='none'">
        <div class="campus-badge">
          ${esc(c.badge)}
        </div>
      </div>
      <div class="campus-info">
        <h3>${esc(c.name)}</h3>
        <p class="campus-location">📍 ${esc(c.address)}</p>
        <p class="campus-description">${esc(c.description)}</p>
        <ul class="campus-features">
          ${c.features.map(f => `<li>${esc(f)}</li>`).join('')}
        </ul>
        <button class="view-gallery-btn" data-campus="${esc(c.key)}">View Campus Gallery</button>
      </div>
    </div>`).join('');

  // ── 6. Programs ───────────────────────────────────────────
  document.getElementById('programGrid').innerHTML = D.programs.map(p => `
    <div class="program-card${p.highlight ? ' program-highlight' : ''} reveal">
      <h3>${esc(p.title)}</h3>
      <p class="program-age">${esc(p.age)}</p>
      <p class="program-description">${esc(p.description)}</p>
      <ul class="program-features">
        ${p.features.map(f => `<li>${esc(f)}</li>`).join('')}
      </ul>
    </div>`).join('');

  // ── 7. Admissions ─────────────────────────────────────────
  document.getElementById('requirementList').innerHTML = D.requirements.map(r => `
    <div class="requirement-item">
      <div class="req-icon">${r.icon}</div>
      <div class="requirement-text">
        <h4>${esc(r.title)}</h4>
        <p>${esc(r.desc)}</p>
      </div>
    </div>`).join('');

  document.getElementById('stepsList').innerHTML = D.steps.map((s, i) => `
    <div class="step">
      <div class="step-number">${i + 1}</div>
      <div class="step-content">
        <h4>${esc(s.title)}</h4>
        <p>${esc(s.desc)}</p>
      </div>
    </div>`).join('');

  document.querySelector('.cta-box .cta-btn').href = D.school.enrollmentUrl;

  // ── 8. Contact ────────────────────────────────────────────
  document.getElementById('contactCards').innerHTML = D.contact.campuses.map(c => `
    <div class="contact-card">
      <h4>${esc(c.name)}</h4>
      <p class="contact-detail">📍 ${esc(c.address)}</p>
      <p class="contact-detail">📞 ${esc(c.phone)}</p>
      <p class="contact-detail">📧 ${esc(c.email)}</p>
    </div>`).join('') + `
    <div class="office-hours">
      <h4>⏰ Office Hours</h4>
      ${D.contact.officeHours.map(h => `<p>${esc(h)}</p>`).join('')}
    </div>`;

  // ── 9. FAQ ────────────────────────────────────────────────
  document.getElementById('faqGrid').innerHTML = D.faq.map(f => `
    <div class="faq-item">
      <h3>${esc(f.q)}</h3>
      <div class="faq-answer"><p>${esc(f.a)}</p></div>
    </div>`).join('');

  // ── 10. Footer ────────────────────────────────────────────
  document.getElementById('footerSchoolName').textContent = D.school.name;
  document.getElementById('footerTagline').textContent    = D.school.tagline;
  document.getElementById('footerEmail').textContent      = D.school.email;
  document.getElementById('footerPhone').textContent      = D.school.phone;
  document.getElementById('footerCredit').textContent     = D.footer.credit;
  document.getElementById('footerYear').textContent       = new Date().getFullYear();

  document.getElementById('footerQuickLinks').innerHTML = D.nav.filter(n => !n.cta).map(n =>
    `<li><a href="${esc(n.href)}">${esc(n.label)}</a></li>`
  ).join('');

  document.getElementById('footerCampuses').innerHTML = D.campuses.map(c =>
    `<li><a href="#campuses">📍 ${esc(c.address)}</a></li>`
  ).join('');

  document.getElementById('footerSocial').innerHTML = D.footer.social.map(s =>
    `<a href="${esc(s.href)}" class="social-icon" title="${esc(s.label)}">${s.icon}</a>`
  ).join('');

  // ── 11. Interactions ──────────────────────────────────────

  // Sticky nav style on scroll
  const nav = document.querySelector('nav');
  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 60);
  }, { passive: true });

  // FAQ accordion
  document.getElementById('faqGrid').addEventListener('click', (e) => {
    const h3 = e.target.closest('.faq-item h3');
    if (!h3) return;
    const item = h3.parentElement;
    const wasOpen = item.classList.contains('open');
    document.querySelectorAll('.faq-item').forEach(i => i.classList.remove('open'));
    if (!wasOpen) item.classList.add('open');
  });

  // Scroll reveal
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); } });
  }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
  document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

})();