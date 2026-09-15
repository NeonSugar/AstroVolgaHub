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

  const agentLabel = (count) => {
    if (!Number.isFinite(count)) return 'агенты рядом';
    const mod100 = count % 100;
    const mod10 = count % 10;
    const word = mod100 >= 11 && mod100 <= 19 ? 'агентов' : mod10 === 1 ? 'агент' : mod10 >= 2 && mod10 <= 4 ? 'агента' : 'агентов';
    return `${word}`;
  };

  const renderCityBenefits = () => {
    const mount = document.querySelector('[data-city-benefits]');
    if (!mount) return;

    mount.innerHTML = `
      <section class="trust section" aria-labelledby="trust-title">
        <div class="container trust-inner">
          <div class="trust-copy">
            <p class="eyebrow"><span></span> Честно. Просто. Быстро.</p>
            <h2 id="trust-title">Почему выбирают нас</h2>
            <p>Федеральная страховая компания и местные специалисты, которые знают свой город.</p>
          </div>
          <div class="stats-grid">
            <div class="stat"><strong>В +40% случаев при&nbsp;ДТП</strong><span>Решение принимается на месте</span><p>В неспорных случаях, наш выездной комиссар урегулирует выплату страховки в день ДТП</p></div>
            <div class="stat"><strong>Минимум жалоб</strong><span>по ренкингу договоров ОСАГО Банка России</span><p>среди крупных страховщиков Астро-Волга занимает первое место по минимальному количеству жалоб (0,17 на 10 000 полисов)</p></div>
            <div class="stat"><strong>200+ агентов</strong><span>По Запорожской области</span><p>Работают практически во всех населённых пунктах области — оформляйте полис рядом с домом или работой</p></div>
            <div class="stat"><strong>15 мин</strong><span>среднее время оформления ОСАГО</span><p>Опытный агент рассчитает стоимость и оформит полис примерно за 15 минут — в день обращения, в удобной для вас точке</p></div>
          </div>
        </div>
      </section>

      <section class="why-us section" aria-labelledby="why-us-title">
        <div class="container">
          <div class="section-heading compact-heading why-us-heading">
            <div>
              <p class="eyebrow eyebrow-blue"><span></span> Награды и рейтинги</p>
              <h2 id="why-us-title">Почему мы?</h2>
            </div>
            <p>Независимые рейтинги и профессиональные награды подтверждают надёжность и качество нашей работы.</p>
          </div>

          <div class="why-slider" data-why-slider>
            <div class="why-slider-viewport" tabindex="0" aria-label="Награды и рейтинги Астро-Волги">
              <div class="why-slider-track">
                <article class="why-slide" role="group" aria-label="1 из 7">
                  <div class="why-slide-logo"><img src="../assets/images/why-bank-russia.webp" alt="Банк России" width="300" height="74"></div>
                  <p>Первое место в рейтинге по степени лояльности к клиентам.</p>
                </article>
                <article class="why-slide" role="group" aria-label="2 из 7">
                  <div class="why-slide-logo"><img src="../assets/images/why-finombudsman.webp" alt="Финансовый уполномоченный" width="338" height="74"></div>
                  <p>Первое место в рейтинге за минимальную долю жалоб по ОСАГО.</p>
                </article>
                <article class="why-slide" role="group" aria-label="3 из 7">
                  <div class="why-slide-logo"><img src="../assets/images/why-sberbank.webp" alt="Сбербанк" width="295" height="74"></div>
                  <p>Наши полисы принимают все банки России.</p>
                </article>
                <article class="why-slide" role="group" aria-label="4 из 7">
                  <div class="why-slide-logo"><img src="../assets/images/why-akra.webp" alt="АКРА" width="184" height="74"></div>
                  <p>Кредитный рейтинг A+(RU), прогноз «Стабильный».</p>
                </article>
                <article class="why-slide" role="group" aria-label="5 из 7">
                  <div class="why-slide-logo"><img src="../assets/images/why-asn.webp" alt="Агентство страховых новостей" width="300" height="58"></div>
                  <p>ТОП-10. Народный топ. Рейтинг страховых компаний.</p>
                </article>
                <article class="why-slide" role="group" aria-label="6 из 7">
                  <div class="why-slide-logo"><img src="../assets/images/why-social-project.webp" alt="Лучший социальный проект России" width="87" height="74"></div>
                  <p>Победитель конкурса «Лучший социальный проект России» 2024 года.</p>
                </article>
                <article class="why-slide" role="group" aria-label="7 из 7">
                  <div class="why-slide-logo"><img src="../assets/images/why-consumers-choice.webp" alt="Выбор потребителей" width="196" height="74"></div>
                  <p>Номинация «Сервис года в страховании» премии «Выбор потребителей».</p>
                </article>
              </div>
            </div>

            <button class="why-slider-button why-slider-prev" type="button" aria-label="Предыдущий слайд" disabled>
              <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M19 12H5m5 5-5-5 5-5"/></svg>
            </button>
            <button class="why-slider-button why-slider-next" type="button" aria-label="Следующий слайд">
              <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M5 12h14m-5-5 5 5-5 5"/></svg>
            </button>

            <div class="why-slider-meta">
              <span class="why-slider-progress" aria-hidden="true"><span data-why-progress></span></span>
              <div class="why-slider-dots" aria-label="Навигация по слайдам">
                <button class="why-slider-dot is-active" type="button" aria-label="Перейти к слайду 1" aria-current="true"></button>
                <button class="why-slider-dot" type="button" aria-label="Перейти к слайду 2"></button>
                <button class="why-slider-dot" type="button" aria-label="Перейти к слайду 3"></button>
                <button class="why-slider-dot" type="button" aria-label="Перейти к слайду 4"></button>
                <button class="why-slider-dot" type="button" aria-label="Перейти к слайду 5"></button>
                <button class="why-slider-dot" type="button" aria-label="Перейти к слайду 6"></button>
                <button class="why-slider-dot" type="button" aria-label="Перейти к слайду 7"></button>
              </div>
            </div>
          </div>
        </div>
      </section>`;
  };

  renderCityBenefits();

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
  const heroCountText = document.querySelector('.city-count span');
  if (heroCount) heroCount.textContent = cards.length;
  if (heroCountText) heroCountText.textContent = agentLabel(cards.length);
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

  const setupCallbackRequests = async () => {
    let publicAgents;
    try {
      const response = await fetch(`/api/public/agents?city=${encodeURIComponent(cityKey)}`, {
        credentials: 'same-origin',
        headers: { Accept: 'application/json' }
      });
      if (!response.ok) return;
      const data = await response.json();
      publicAgents = Array.isArray(data.agents) ? data.agents : [];
    } catch (_error) {
      return;
    }
    if (!publicAgents.length) return;

    const modal = document.createElement('div');
    modal.className = 'callback-modal';
    modal.hidden = true;
    modal.innerHTML = `
      <div class="callback-modal-backdrop" data-callback-close></div>
      <div class="callback-dialog" role="dialog" aria-modal="true" aria-labelledby="callback-title">
        <button class="callback-close" type="button" aria-label="Закрыть форму" data-callback-close>×</button>
        <p class="eyebrow eyebrow-blue"><span></span> Связаться с агентом</p>
        <h2 id="callback-title">Оставить заявку</h2>
        <p class="callback-agent" data-callback-agent></p>
        <form class="callback-form" data-callback-form novalidate>
          <label><span>Ваше имя</span><input name="name" type="text" autocomplete="name" minlength="2" maxlength="80" required></label>
          <label><span>Номер телефона</span><input name="phone" type="tel" autocomplete="tel" inputmode="tel" placeholder="+7 900 000-00-00" maxlength="24" required></label>
          <label class="callback-consent"><input name="consent" type="checkbox" required><span>Я соглашаюсь на обработку персональных данных согласно <a href="https://astrovolga.ru/upload/medialibrary/86b/bzomnwfohjp5w7qe4ob6o2xubyf0gc7t.pdf" target="_blank" rel="noopener">политике конфиденциальности</a>.</span></label>
          <button class="button button-primary" type="submit">Отправить заявку</button>
          <p class="callback-status" data-callback-status role="status"></p>
        </form>
      </div>`;
    document.body.append(modal);

    const form = modal.querySelector('[data-callback-form]');
    const status = modal.querySelector('[data-callback-status]');
    const agentLabelElement = modal.querySelector('[data-callback-agent]');
    const submitButton = form.querySelector('button[type="submit"]');
    let selectedAgent = null;
    let previouslyFocused = null;

    const closeModal = () => {
      modal.hidden = true;
      document.body.classList.remove('callback-modal-open');
      selectedAgent = null;
      form.reset();
      status.textContent = '';
      submitButton.disabled = false;
      previouslyFocused?.focus();
    };

    const openModal = (agent, trigger) => {
      selectedAgent = agent;
      previouslyFocused = trigger;
      agentLabelElement.textContent = `${agent.displayName} · ${agent.address}`;
      modal.hidden = false;
      document.body.classList.add('callback-modal-open');
      window.requestAnimationFrame(() => form.elements.name.focus());
    };

    modal.querySelectorAll('[data-callback-close]').forEach((button) => button.addEventListener('click', closeModal));
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !modal.hidden) closeModal();
    });

    cards.forEach((card) => {
      const addressKey = normalizeAddress(card.querySelector('h3')?.textContent);
      const phoneNumbers = [...card.querySelectorAll('[href^="tel:"]')]
        .map((link) => link.href.replace(/\D/g, ''));
      const agent = publicAgents.find((item) => item.addressKey === addressKey && phoneNumbers.includes(item.phone));
      if (!agent) return;
      const button = document.createElement('button');
      button.className = 'agent-callback-button';
      button.type = 'button';
      button.textContent = 'Оставить заявку';
      button.addEventListener('click', () => openModal(agent, button));
      const mapLink = card.querySelector('.agent-map-link');
      if (mapLink) mapLink.before(button);
      else card.append(button);
    });

    const getCsrfToken = async () => {
      const response = await fetch('/api/csrf', { credentials: 'same-origin' });
      if (!response.ok) throw new Error('Не удалось подготовить форму.');
      return (await response.json()).token;
    };

    const sendRequest = async (payload, csrfToken) => fetch('/api/callback-requests', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
      body: JSON.stringify(payload)
    });

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!selectedAgent || !form.reportValidity()) return;
      submitButton.disabled = true;
      status.classList.remove('is-success');
      status.textContent = 'Отправляем заявку…';
      const formData = new FormData(form);
      const payload = {
        agentId: selectedAgent.id,
        name: formData.get('name'),
        phone: formData.get('phone'),
        consent: formData.get('consent') === 'on',
        sourcePath: location.pathname
      };

      try {
        let csrfToken = await getCsrfToken();
        let response = await sendRequest(payload, csrfToken);
        if (response.status === 403) {
          csrfToken = await getCsrfToken();
          response = await sendRequest(payload, csrfToken);
        }
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'Не удалось отправить заявку.');
        form.reset();
        status.classList.add('is-success');
        status.textContent = 'Заявка отправлена. Агент свяжется с вами.';
      } catch (error) {
        status.textContent = error.message;
      } finally {
        submitButton.disabled = false;
      }
    });
  };

  setupCallbackRequests();

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

  const setupWhySlider = () => {
    const slider = document.querySelector('[data-why-slider]');
    if (!slider) return;

    const viewport = slider.querySelector('.why-slider-viewport');
    const track = slider.querySelector('.why-slider-track');
    const slides = [...slider.querySelectorAll('.why-slide')];
    const previousButton = slider.querySelector('.why-slider-prev');
    const nextButton = slider.querySelector('.why-slider-next');
    const progress = slider.querySelector('[data-why-progress]');
    const dots = [...slider.querySelectorAll('.why-slider-dot')];
    const reduceSliderMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let updateFrame;

    const getStep = () => {
      if (!slides.length) return 0;
      const styles = window.getComputedStyle(track);
      const gap = Number.parseFloat(styles.columnGap || styles.gap) || 0;
      return slides[0].getBoundingClientRect().width + gap;
    };

    const updateSlider = () => {
      const maxScroll = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
      const step = getStep();
      const activeIndex = Math.min(slides.length - 1, step ? Math.round(viewport.scrollLeft / step) : 0);
      const scrollRatio = maxScroll ? Math.min(1, viewport.scrollLeft / maxScroll) : 0;

      if (progress) progress.style.transform = `scaleX(${Math.max(1 / slides.length, scrollRatio)})`;
      dots.forEach((dot, index) => {
        const isActive = index === activeIndex;
        dot.classList.toggle('is-active', isActive);
        if (isActive) dot.setAttribute('aria-current', 'true');
        else dot.removeAttribute('aria-current');
      });
      if (previousButton) previousButton.disabled = viewport.scrollLeft <= 2;
      if (nextButton) nextButton.disabled = viewport.scrollLeft >= maxScroll - 2;
    };

    const queueUpdate = () => {
      window.cancelAnimationFrame(updateFrame);
      updateFrame = window.requestAnimationFrame(updateSlider);
    };

    const moveSlider = (direction) => {
      viewport.scrollBy({
        left: direction * getStep(),
        behavior: reduceSliderMotion ? 'auto' : 'smooth'
      });
    };

    previousButton?.addEventListener('click', () => moveSlider(-1));
    nextButton?.addEventListener('click', () => moveSlider(1));
    dots.forEach((dot, index) => {
      dot.addEventListener('click', () => {
        viewport.scrollTo({
          left: index * getStep(),
          behavior: reduceSliderMotion ? 'auto' : 'smooth'
        });
      });
    });
    viewport.addEventListener('scroll', queueUpdate, { passive: true });
    viewport.addEventListener('keydown', (event) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault();
      moveSlider(event.key === 'ArrowRight' ? 1 : -1);
    });

    if ('ResizeObserver' in window) new ResizeObserver(queueUpdate).observe(viewport);
    else window.addEventListener('resize', queueUpdate);

    updateSlider();
  };

  setupWhySlider();

  const revealItems = [
    ...document.querySelectorAll('.agents-heading, .agents-toolbar, .agent-card, .city-services-heading, .city-services-card, .trust-copy, .stat, .why-slider, .footer-top, .footer-details > *, .disclaimer, .footer-bottom')
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
