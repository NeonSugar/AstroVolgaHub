(() => {
  'use strict';

  const search = document.querySelector('#agent-search');
  const cards = [...document.querySelectorAll('[data-agent-card]')];
  const result = document.querySelector('#agents-result');
  const empty = document.querySelector('#agents-empty');

  const pointLabel = (count) => {
    const mod100 = count % 100;
    const mod10 = count % 10;
    const word = mod100 >= 11 && mod100 <= 19 ? 'точек' : mod10 === 1 ? 'точка' : mod10 >= 2 && mod10 <= 4 ? 'точки' : 'точек';
    return `${count} ${word}`;
  };

  const normalize = (value) => value
    .toLocaleLowerCase('ru-RU')
    .replace(/ё/g, 'е')
    .replace(/[^а-яa-z0-9]+/g, ' ')
    .trim();

  const filterAgents = () => {
    const query = normalize(search?.value || '');
    let visibleCount = 0;

    cards.forEach((card) => {
      const searchText = `${card.dataset.search || ''} ${card.textContent || ''}`;
      const isVisible = !query || normalize(searchText).includes(query);
      card.hidden = !isVisible;
      if (isVisible) visibleCount += 1;
    });

    if (result) result.textContent = pointLabel(visibleCount);
    if (empty) empty.hidden = visibleCount !== 0;
  };

  search?.addEventListener('input', filterAgents);

  const setupProductsMarquee = () => {
    const marquee = document.querySelector('.city-products-marquee');
    const track = marquee?.querySelector('.city-products-track');
    const sourceSet = track?.querySelector('.city-products-set');
    if (!marquee || !track || !sourceSet) return;

    const originalItems = [...sourceSet.children].map((item) => item.cloneNode(true));
    let resizeFrame;

    const rebuildMarquee = () => {
      track.classList.remove('is-ready');
      track.querySelectorAll('.city-products-set').forEach((set, index) => {
        if (index > 0) set.remove();
      });
      sourceSet.replaceChildren(...originalItems.map((item) => item.cloneNode(true)));

      let repeatCount = 0;
      while (sourceSet.getBoundingClientRect().width < marquee.clientWidth + 160 && repeatCount < 12) {
        originalItems.forEach((item) => {
          const duplicate = item.cloneNode(true);
          duplicate.setAttribute('aria-hidden', 'true');
          duplicate.removeAttribute('role');
          sourceSet.append(duplicate);
        });
        repeatCount += 1;
      }

      const distance = Math.ceil(sourceSet.getBoundingClientRect().width);
      const duplicateSet = sourceSet.cloneNode(true);
      duplicateSet.setAttribute('aria-hidden', 'true');
      duplicateSet.removeAttribute('role');
      track.append(duplicateSet);
      track.style.setProperty('--marquee-offset', `-${distance}px`);
      track.style.setProperty('--marquee-duration', `${Math.max(22, distance / 72)}s`);
      window.requestAnimationFrame(() => track.classList.add('is-ready'));
    };

    const queueRebuild = () => {
      window.cancelAnimationFrame(resizeFrame);
      resizeFrame = window.requestAnimationFrame(rebuildMarquee);
    };

    rebuildMarquee();
    document.fonts?.ready.then(queueRebuild);
    if ('ResizeObserver' in window) new ResizeObserver(queueRebuild).observe(marquee);
    else window.addEventListener('resize', queueRebuild);
  };

  setupProductsMarquee();

  const revealItems = [
    ...document.querySelectorAll('.agents-heading, .agents-toolbar, .agent-card, .city-services-heading, .city-services-card, .city-help-inner, .footer-top, .footer-details > *, .disclaimer, .footer-bottom')
  ];
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  revealItems.forEach((item, index) => {
    item.classList.add('city-reveal');
    item.style.setProperty('--city-reveal-delay', `${Math.min((index % 6) * 65, 325)}ms`);
  });

  if (reduceMotion || !('IntersectionObserver' in window)) {
    revealItems.forEach((item) => item.classList.add('is-revealed'));
  } else {
    document.documentElement.classList.add('city-reveal-ready');
    const observer = new IntersectionObserver((entries, currentObserver) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-revealed');
        currentObserver.unobserve(entry.target);
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -3% 0px' });

    revealItems.forEach((item) => observer.observe(item));
  }
})();
