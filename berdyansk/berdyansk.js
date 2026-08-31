(() => {
  'use strict';

  const pathParts = location.pathname.split('/').filter(Boolean);
  const cityKey = pathParts.at(-1) === 'index.html' ? pathParts.at(-2) : pathParts.at(-1) || 'berdyansk';
  const cityNames = {
    berdyansk: 'Бердянск', energodar: 'Энергодар', kamenka: 'Каменка-Днепровская',
    melitopol: 'Мелитополь', primorsk: 'Приморск', tokmak: 'Токмак',
    vasilevka: 'Васильевка', veseloe: 'Весёлое', znamenka: 'Великая Знаменка'
  };
  const cityName = cityNames[cityKey] || document.querySelector('.city-hero h1')?.textContent.trim() || '';
  const additions = window.ASTRO_AGENT_DATA?.existing?.[cityKey] || [];
  const agentsGrid = document.querySelector('#agents-list');

  const normalizeAddress = (value) => String(value || '')
    .toLocaleLowerCase('ru-RU')
    .replace(/ё/g, 'е')
    .replace(/\([^)]*\)/g, '')
    .replace(/^ул\.?\s*/g, '')
    .replace(/^пр(?:оспект|-т|-кт)\s*/g, '')
    .replace(/^мел\.?\s*шоссе/g, 'мелитопольское шоссе')
    .replace(/[^а-яa-z0-9/]+/g, '');

  const formatPhone = (phone) => `+7 (${phone.slice(1, 4)}) ${phone.slice(4, 7)}-${phone.slice(7, 9)}-${phone.slice(9, 11)}`;

  const createPhoneLink = (phone) => {
    const link = document.createElement('a');
    link.className = 'agent-phone track-phone';
    link.href = `tel:+${phone}`;
    link.textContent = formatPhone(phone);
    return link;
  };

  const ensurePhoneContainer = (card) => {
    let container = card.querySelector('.agent-phones');
    if (container) return container;
    container = document.createElement('div');
    container.className = 'agent-phones';
    container.setAttribute('aria-label', 'Телефоны агента');
    const directPhone = card.querySelector(':scope > .agent-phone');
    if (directPhone) directPhone.replaceWith(container);
    if (directPhone) container.append(directPhone);
    else if (card.querySelector('.agent-map-link')) card.querySelector('.agent-map-link').before(container);
    else card.append(container);
    return container;
  };

  const createAgentCard = (address, phones) => {
    const card = document.createElement('article');
    card.className = 'agent-card';
    card.dataset.agentCard = '';
    card.dataset.search = `${cityName} ${address} ${phones.map(formatPhone).join(' ')}`;
    card.innerHTML = `<span class="agent-number"></span><h3>${address}</h3>`;
    const isOffsite = normalizeAddress(address) === 'безофиса';
    if (isOffsite) {
      card.classList.add('agent-card-offsite');
      const note = document.createElement('p');
      note.className = 'agent-note';
      note.textContent = 'Свяжитесь с агентом, чтобы договориться о встрече';
      card.append(note);
    }
    const phoneContainer = ensurePhoneContainer(card);
    phones.forEach((phone) => phoneContainer.append(createPhoneLink(phone)));
    if (!isOffsite) {
      const mapLink = document.createElement('a');
      mapLink.className = 'agent-map-link';
      mapLink.href = `https://yandex.ru/maps/?text=${encodeURIComponent(`${cityName}, ${address}`)}`;
      mapLink.target = '_blank';
      mapLink.rel = 'noopener';
      mapLink.innerHTML = 'Найти на карте <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M7 17 17 7M8 7h9v9"/></svg>';
      card.append(mapLink);
    }
    return card;
  };

  if (agentsGrid && additions.length) {
    additions.forEach(([address, phones]) => {
      if (normalizeAddress(address) === 'безофиса') {
        phones.forEach((phone) => agentsGrid.append(createAgentCard(address, [phone])));
        return;
      }
      const matchingCard = [...agentsGrid.querySelectorAll('[data-agent-card]')]
        .find((card) => normalizeAddress(card.querySelector('h3')?.textContent) === normalizeAddress(address));
      if (!matchingCard) {
        agentsGrid.append(createAgentCard(address, phones));
        return;
      }
      const container = ensurePhoneContainer(matchingCard);
      const currentPhones = new Set([...matchingCard.querySelectorAll('[href^="tel:"]')]
        .map((link) => link.href.replace(/\D/g, '')));
      phones.filter((phone) => !currentPhones.has(phone)).forEach((phone) => container.append(createPhoneLink(phone)));
      matchingCard.dataset.search += ` ${phones.map(formatPhone).join(' ')}`;
    });
  }

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

  cards.forEach((card, index) => {
    const number = card.querySelector('.agent-number');
    if (number) number.textContent = String(index + 1).padStart(2, '0');
  });
  const heroCount = document.querySelector('.city-count strong');
  if (heroCount) heroCount.textContent = cards.length;
  const heroEyebrow = document.querySelector('.city-hero .eyebrow');
  if (heroEyebrow) heroEyebrow.innerHTML = `<span></span> ${pointLabel(cards.length)} в городе`;
  const metaDescription = document.querySelector('meta[name="description"]');
  if (metaDescription) metaDescription.content = `${pointLabel(cards.length)} СК Астро-Волга в ${cityName}. Адреса, телефоны и ссылки на карту.`;

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
