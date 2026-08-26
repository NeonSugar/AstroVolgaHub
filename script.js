(() => {
  'use strict';

  // Данные отдела маркетинга из файла «списки агентов.xlsx» от 19.08.2026.
  const cities = {
    melitopol: { name: 'Мелитополь', agents: 14 },
    berdyansk: { name: 'Бердянск', agents: 13 },
    energodar: { name: 'Энергодар', agents: 8 },
    tokmak: { name: 'Токмак', agents: 5 },
    vasilevka: { name: 'Васильевка', agents: 2 },
    kamenka: { name: 'Каменка-Днепровская', agents: 3 },
    primorsk: { name: 'Приморск', agents: 5 },
    veseloe: { name: 'Весёлое', agents: 2 },
    znamenka: { name: 'Великая Знаменка', agents: 2 }
  };

  // Дополнительные точки с официальной страницы «ОСАГО в Новороссии».
  const additionalCities = {
    blagoveshchenka: { name: 'Благовещенка', agents: 2 },
    vodyanoe: { name: 'Водяное', agents: 1 },
    dneprorudnoe: { name: 'Днепрорудное', agents: 1 },
    zapovitnoe: { name: 'Заповитное', agents: 1 },
    ivanovka: { name: 'Ивановка', agents: 1 },
    kirillovka: { name: 'Кирилловка', agents: 1 },
    'malaya-belozerka': { name: 'Малая Белозерка', agents: 1 },
    mikhailovka: { name: 'Михайловка', agents: 1 },
    novovasilevka: { name: 'Нововасильевка', agents: 1 },
    novodneprovka: { name: 'Новоднепровка', agents: 1 },
    priazovskoe: { name: 'Приазовское', agents: 1 },
    rozovka: { name: 'Розовка', agents: 1 }
  };

  const agentLabel = (count) => {
    if (!Number.isFinite(count)) return 'агенты рядом';
    const mod100 = count % 100;
    const mod10 = count % 10;
    const word = mod100 >= 11 && mod100 <= 19 ? 'агентов' : mod10 === 1 ? 'агент' : mod10 >= 2 && mod10 <= 4 ? 'агента' : 'агентов';
    return `${count} ${word}`;
  };

  const trackGoal = (goal, params = {}) => {
    if (typeof window.ym === 'function' && window.YM_COUNTER_ID) {
      window.ym(window.YM_COUNTER_ID, 'reachGoal', goal, params);
    }
    window.dispatchEvent(new CustomEvent('hub:goal', { detail: { goal, params } }));
  };

  const setupScrollReveal = () => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const revealGroups = [
      { selector: '.section-heading, .trust-copy, .footer-top', variant: 'reveal-up', step: 0 },
      { selector: '.map-shell', variant: 'reveal-scale', step: 0 },
      { selector: '.city-card', variant: 'reveal-up', step: 70 },
      { selector: '.additional-cities-heading, .additional-city', variant: 'reveal-up', step: 45 },
      { selector: '.service-card', variant: 'reveal-up', step: 100 },
      { selector: '.stat', variant: 'reveal-up', step: 90 },
      { selector: '.why-slider', variant: 'reveal-up', step: 0 },
      { selector: '.footer-details > *, .disclaimer, .footer-bottom', variant: 'reveal-up', step: 80 }
    ];

    const revealItems = [];
    revealGroups.forEach(({ selector, variant, step }) => {
      document.querySelectorAll(selector).forEach((element, index) => {
        element.classList.add('reveal-item', variant);
        element.style.setProperty('--reveal-delay', `${Math.min(index * step, 420)}ms`);
        revealItems.push(element);
      });
    });

    if (!revealItems.length || reduceMotion || !('IntersectionObserver' in window)) {
      revealItems.forEach((element) => element.classList.add('is-revealed'));
      return;
    }

    document.documentElement.classList.add('reveal-ready');
    const revealObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-revealed');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -2% 0px' });

    revealItems.forEach((element) => revealObserver.observe(element));
  };

  setupScrollReveal();

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
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
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
        behavior: reduceMotion ? 'auto' : 'smooth'
      });
    };

    previousButton?.addEventListener('click', () => moveSlider(-1));
    nextButton?.addEventListener('click', () => moveSlider(1));
    dots.forEach((dot, index) => {
      dot.addEventListener('click', () => {
        viewport.scrollTo({
          left: index * getStep(),
          behavior: reduceMotion ? 'auto' : 'smooth'
        });
      });
    });
    viewport.addEventListener('scroll', queueUpdate, { passive: true });
    viewport.addEventListener('keydown', (event) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault();
      moveSlider(event.key === 'ArrowRight' ? 1 : -1);
    });

    if ('ResizeObserver' in window) {
      new ResizeObserver(queueUpdate).observe(viewport);
    } else {
      window.addEventListener('resize', queueUpdate);
    }

    updateSlider();
  };

  setupWhySlider();

  const setupServiceCards = () => {
    document.querySelectorAll('[data-service-card]').forEach((card) => {
      const front = card.querySelector('.service-card-front');
      const back = card.querySelector('.service-card-back');
      const serviceName = card.dataset.serviceName;

      const setFlipped = (isFlipped) => {
        card.classList.toggle('is-flipped', isFlipped);
        card.setAttribute('aria-pressed', String(isFlipped));
        card.setAttribute('aria-label', isFlipped
          ? `Вернуться к краткому описанию: ${serviceName}`
          : `Показать подробности: ${serviceName}`);
        front?.setAttribute('aria-hidden', String(isFlipped));
        back?.setAttribute('aria-hidden', String(!isFlipped));
      };

      const toggleCard = () => setFlipped(!card.classList.contains('is-flipped'));

      card.addEventListener('click', toggleCard);
      card.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        toggleCard();
      });
    });
  };

  setupServiceCards();

  const setupServicesAccordion = () => {
    const accordion = document.querySelector('.services-accordion');
    const summary = accordion?.querySelector('summary');
    if (!accordion || !summary) return;

    const syncExpandedState = () => {
      summary.setAttribute('aria-expanded', String(accordion.open));
    };

    summary.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      accordion.open = !accordion.open;
    });
    accordion.addEventListener('toggle', syncExpandedState);
    syncExpandedState();
  };

  setupServicesAccordion();

  const setupAdditionalCities = () => {
    const accordions = [...document.querySelectorAll('.additional-city')];
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const syncExpandedState = (accordion) => {
      accordion.querySelector('summary')?.setAttribute('aria-expanded', String(accordion.open));
    };

    const openCity = (cityKey, { updateHash = true, scroll = true } = {}) => {
      const target = document.querySelector(`[data-additional-city="${cityKey}"]`);
      if (!target) return;

      accordions.forEach((accordion) => {
        accordion.open = accordion === target;
        syncExpandedState(accordion);
      });

      if (updateHash) window.history.pushState(null, '', `#${target.id}`);
      if (scroll) {
        window.requestAnimationFrame(() => {
          target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
        });
      }
    };

    accordions.forEach((accordion) => {
      accordion.addEventListener('toggle', () => {
        if (accordion.open) {
          accordion.style.background='var(--sky)';
          accordions.forEach((other) => {
            if (other !== accordion) {
              other.open = false;
              other.style.background='none';
            }
            syncExpandedState(other);
          });
        }
        else {
          accordion.open = false;
          accordion.style.background='none';
        }
        syncExpandedState(accordion);
      });
      syncExpandedState(accordion);
    });

    const openFromHash = () => {
      const target = document.querySelector(location.hash);
      const cityKey = target?.dataset.additionalCity;
      if (cityKey) openCity(cityKey, { updateHash: false });
    };

    if (location.hash) openFromHash();
    window.addEventListener('hashchange', openFromHash);
    return openCity;
  };

  const openAdditionalCity = setupAdditionalCities();

  document.querySelectorAll('[data-city]').forEach((element) => {
    const city = cities[element.dataset.city];
    if (!city) return;

    const label = agentLabel(city.agents);
    const small = element.querySelector('small');
    if (small) small.textContent = label;
    const link = element.matches('a') ? element : element.querySelector('a');
    if (link) link.setAttribute('aria-label', `${city.name}, ${label}`);
  });

  const totalAgents = Object.values(cities).reduce((sum, city) => sum + city.agents, 0);
  const totalAgentsValue = document.querySelector('#total-agents');
  const totalAgentsLabel = document.querySelector('#total-agents-label');
  if (totalAgentsValue) totalAgentsValue.textContent = totalAgents;
  if (totalAgentsLabel) totalAgentsLabel.textContent = agentLabel(totalAgents).replace(/^\d+\s+/, '');

  document.querySelectorAll('.city-card').forEach((link) => {
    link.addEventListener('click', () => trackGoal('hub_city_click', { city: link.dataset.city, source: 'button' }));
  });

  const map = document.querySelector('#region-map');
  const tooltip = map?.querySelector('.map-tooltip');
  map?.querySelectorAll('.map-point').forEach((point) => {
    const cityKey = point.dataset.city || point.dataset.extraCity;
    const city = cities[point.dataset.city] || additionalCities[point.dataset.extraCity];
    const showTooltip = () => {
      if (!tooltip || !city) return;
      const pointBox = point.getBoundingClientRect();
      const mapBox = map.getBoundingClientRect();
      tooltip.textContent = `${city.name} · ${agentLabel(city.agents)}`;
      tooltip.style.left = `${pointBox.left - mapBox.left + pointBox.width / 2}px`;
      tooltip.style.top = `${pointBox.top - mapBox.top}px`;
      tooltip.classList.add('is-visible');
      tooltip.setAttribute('aria-hidden', 'false');
    };
    const hideTooltip = () => {
      tooltip?.classList.remove('is-visible');
      tooltip?.setAttribute('aria-hidden', 'true');
    };
    point.addEventListener('mouseenter', showTooltip);
    point.addEventListener('mouseleave', hideTooltip);
    point.addEventListener('focus', showTooltip);
    point.addEventListener('blur', hideTooltip);
    point.addEventListener('click', (event) => {
      if (point.dataset.extraCity) {
        event.preventDefault();
        openAdditionalCity(point.dataset.extraCity);
      }
      trackGoal('hub_city_click', { city: cityKey, source: 'map' });
      trackGoal('hub_map_click', { city: cityKey });
    });
  });

  document.querySelectorAll('.track-phone').forEach((phone) => {
    phone.addEventListener('click', () => trackGoal('hub_phone_click'));
  });

  // Геобаннер можно проверить локально параметром ?city=melitopol (или другим ключом из cities).
  const requestedCity = new URLSearchParams(window.location.search).get('city');
  const geoBanner = document.querySelector('#geo-banner');
  if (requestedCity && cities[requestedCity] && geoBanner) {
    const city = cities[requestedCity];
    const citySourceLink = document.querySelector(`.city-card[data-city="${requestedCity}"]`);
    const cityName = geoBanner.querySelector('#geo-city-name');
    const cityLink = geoBanner.querySelector('#geo-city-link');
    cityName.textContent = city.name;
    cityLink.href = citySourceLink?.href || '#cities';
    window.setTimeout(() => {
      geoBanner.hidden = false;
      trackGoal('hub_geobanner_shown', { city: requestedCity });
    }, 700);
    cityLink.addEventListener('click', () => trackGoal('hub_geobanner_click', { city: requestedCity }));
    geoBanner.querySelector('.geo-close')?.addEventListener('click', () => { geoBanner.hidden = true; });
  }
})();
