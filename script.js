(() => {
  'use strict';

  // Данные из файлов «списки агентов.xlsx» и «АДРЕСА АГЕНТОВ для сайта.xlsx».
  const cities = {
    melitopol: { name: 'Мелитополь', agents: 57 },
    berdyansk: { name: 'Бердянск', agents: 25 },
    energodar: { name: 'Энергодар', agents: 14 },
    tokmak: { name: 'Токмак', agents: 11 },
    vasilevka: { name: 'Васильевка', agents: 3 },
    kamenka: { name: 'Каменка-Днепровская', agents: 7 },
    primorsk: { name: 'Приморск', agents: 9 },
    veseloe: { name: 'Весёлое', agents: 2 },
    znamenka: { name: 'Великая Знаменка', agents: 2 }
  };

  const additionalDirectory = window.ASTRO_AGENT_DATA?.additional || {};
  const additionalCities = Object.fromEntries(Object.entries(additionalDirectory).map(([key, [name, points]]) => [
    key,
    { name, agents: points.reduce((sum, [address, phones]) => sum + (address === 'Без офиса' ? phones.length : 1), 0) }
  ]));

  // Районирование по справочнику административно-территориального деления
  // Запорожской области (границы районов по состоянию на 16 сентября 1991 года).
  const additionalDistricts = [
    { key: 'akimovsky', name: 'Акимовский район', cities: ['akimovka', 'kirillovka', 'shevlyuki'] },
    { key: 'berdyansky', name: 'Бердянский район', cities: ['andreevka', 'osipenko', 'troyany'] },
    { key: 'vasilevsky', name: 'Васильевский район', cities: ['dneprorudnoe', 'malaya-belozerka', 'skelki'] },
    { key: 'kamensko-dneprovsky', name: 'Каменско-Днепровский район', cities: ['blagoveshchenka', 'velikaya-belozerka', 'vodyanoe', 'zapovitnoe', 'ivanovka', 'novovodyanoe', 'novodneprovka'] },
    { key: 'kuybyshevsky', name: 'Куйбышевский район', cities: ['belotserkovka', 'kamysh-zarya', 'kuybyshevo', 'rozovka'] },
    { key: 'melitopolsky', name: 'Мелитопольский район', cities: ['novobogdanovka', 'polyanovka', 'terpenye'] },
    { key: 'mikhailovsky', name: 'Михайловский район', cities: ['mikhailovka'] },
    { key: 'pologovsky', name: 'Пологовский район', cities: ['pologi'] },
    { key: 'priazovsky', name: 'Приазовский район', cities: ['aleksandrovka', 'annovka', 'bogdanovka', 'vladimirovka', 'girsovka', 'dunaevka', 'nadezhdino', 'novovasilevka', 'novokonstantinovka', 'priazovskoe', 'stepanovka', 'stepanovka-pervaya'] },
    { key: 'primorsky', name: 'Приморский район', cities: ['zelenovka', 'komarovka', 'yuryevka'] },
    { key: 'chernigovsky', name: 'Черниговский район', cities: ['chernigovka'] }
  ];

  const pointLabel = (count) => {
    const mod100 = count % 100;
    const mod10 = count % 10;
    const word = mod100 >= 11 && mod100 <= 19 ? 'точек' : mod10 === 1 ? 'точка' : mod10 >= 2 && mod10 <= 4 ? 'точки' : 'точек';
    return `${count} ${word}`;
  };

  const formatPhone = (phone) => `+7 (${phone.slice(1, 4)}) ${phone.slice(4, 7)}-${phone.slice(7, 9)}-${phone.slice(9, 11)}`;

  const renderAdditionalCities = () => {
    const list = document.querySelector('.additional-city-list');
    if (!list || !Object.keys(additionalDirectory).length) return;
    list.className = 'additional-district-list';
    list.replaceChildren();

    const createCityAccordion = (key, [name, sourcePoints]) => {
      const points = sourcePoints.flatMap(([address, phones]) => address === 'Без офиса'
        ? phones.map((phone) => [address, [phone]])
        : [[address, phones]]);
      const details = document.createElement('details');
      details.className = 'additional-city';
      details.id = `additional-${key}`;
      details.dataset.additionalCity = key;

      const summary = document.createElement('summary');
      summary.setAttribute('aria-expanded', 'false');
      const title = document.createElement('span');
      const strong = document.createElement('strong');
      strong.textContent = name;
      const count = document.createElement('small');
      count.textContent = pointLabel(points.length);
      title.append(strong, count);
      const icon = document.createElement('span');
      icon.className = 'additional-city-icon';
      icon.setAttribute('aria-hidden', 'true');
      summary.append(title, icon);

      const content = document.createElement('div');
      content.className = 'additional-city-content';
      const grid = document.createElement('div');
      grid.className = 'additional-agent-grid';
      points.forEach(([address, phones], index) => {
        const card = document.createElement('article');
        card.className = 'additional-agent-card';
        const number = document.createElement('span');
        number.className = 'additional-agent-number';
        number.textContent = String(index + 1).padStart(2, '0');
        const heading = document.createElement('h4');
        heading.textContent = address;
        card.append(number, heading);
        if (address === 'Без офиса') {
          const note = document.createElement('p');
          note.textContent = 'Свяжитесь с агентом, чтобы договориться о встрече';
          card.append(note);
        }
        const phoneList = document.createElement('div');
        phoneList.className = 'additional-agent-phones';
        phoneList.setAttribute('aria-label', 'Телефоны агента');
        phones.forEach((phone) => {
          const link = document.createElement('a');
          link.className = 'additional-agent-phone track-phone';
          link.href = `tel:+${phone}`;
          link.textContent = formatPhone(phone);
          phoneList.append(link);
        });
        card.append(phoneList);
        grid.append(card);
      });
      content.append(grid);
      details.append(summary, content);
      return details;
    };

    const assignedCities = new Set();
    additionalDistricts.forEach((district) => {
      const cityKeys = district.cities.filter((key) => additionalDirectory[key]);
      if (!cityKeys.length) return;
      cityKeys.forEach((key) => assignedCities.add(key));

      const details = document.createElement('details');
      details.className = 'additional-district';
      details.id = `district-${district.key}`;
      details.dataset.additionalDistrict = district.key;

      const summary = document.createElement('summary');
      summary.setAttribute('aria-expanded', 'false');
      const title = document.createElement('span');
      const strong = document.createElement('strong');
      strong.textContent = district.name;
      const pointCount = cityKeys.reduce((sum, key) => sum + additionalCities[key].agents, 0);
      const count = document.createElement('small');
      count.textContent = `${cityKeys.length} ${cityKeys.length === 1 ? 'населённый пункт' : cityKeys.length >= 2 && cityKeys.length <= 4 ? 'населённых пункта' : 'населённых пунктов'} · ${pointLabel(pointCount)}`;
      title.append(strong, count);
      const icon = document.createElement('span');
      icon.className = 'additional-district-icon';
      icon.setAttribute('aria-hidden', 'true');
      summary.append(title, icon);

      const content = document.createElement('div');
      content.className = 'additional-district-content';
      const cityList = document.createElement('div');
      cityList.className = 'additional-city-list';
      cityKeys.forEach((key) => cityList.append(createCityAccordion(key, additionalDirectory[key])));
      content.append(cityList);
      details.append(summary, content);
      list.append(details);
    });

    const unassigned = Object.keys(additionalDirectory).filter((key) => !assignedCities.has(key));
    if (unassigned.length) {
      const details = document.createElement('details');
      details.className = 'additional-district';
      details.dataset.additionalDistrict = 'other';
      const summary = document.createElement('summary');
      summary.setAttribute('aria-expanded', 'false');
      summary.innerHTML = '<span><strong>Другие населённые пункты</strong></span><span class="additional-district-icon" aria-hidden="true"></span>';
      const content = document.createElement('div');
      content.className = 'additional-district-content';
      const cityList = document.createElement('div');
      cityList.className = 'additional-city-list';
      unassigned.forEach((key) => cityList.append(createCityAccordion(key, additionalDirectory[key])));
      content.append(cityList);
      details.append(summary, content);
      list.append(details);
    }
  };

  renderAdditionalCities();

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
      { selector: '.additional-cities-heading, .additional-district', variant: 'reveal-up', step: 45 },
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
    const districts = [...document.querySelectorAll('.additional-district')];
    const accordions = [...document.querySelectorAll('.additional-city')];
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const syncExpandedState = (accordion) => {
      accordion.querySelector(':scope > summary')?.setAttribute('aria-expanded', String(accordion.open));
    };

    const openCity = (cityKey, { updateHash = true, scroll = true } = {}) => {
      const target = document.querySelector(`[data-additional-city="${cityKey}"]`);
      if (!target) return;
      const targetDistrict = target.closest('.additional-district');

      accordions.forEach((accordion) => {
        accordion.open = accordion === target;
        syncExpandedState(accordion);
      });
      districts.forEach((district) => {
        district.open = district === targetDistrict;
        syncExpandedState(district);
      });

      if (updateHash) window.history.pushState(null, '', `#${target.id}`);
      if (scroll) {
        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(() => {
            target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
          });
        });
      }
    };

    districts.forEach((district) => {
      district.addEventListener('toggle', () => {
        if (district.open) {
          districts.forEach((other) => {
            if (other !== district) other.open = false;
            syncExpandedState(other);
          });
        }
        syncExpandedState(district);
      });
      syncExpandedState(district);
    });

    accordions.forEach((accordion) => {
      accordion.addEventListener('toggle', () => {
        if (accordion.open) {
          const parentDistrict = accordion.closest('.additional-district');
          if (parentDistrict) parentDistrict.open = true;
          accordions.forEach((other) => {
            if (other !== accordion) other.open = false;
            syncExpandedState(other);
          });
        }
        syncExpandedState(accordion);
      });
      syncExpandedState(accordion);
    });

    const openFromHash = () => {
      const target = document.getElementById(location.hash.slice(1));
      const cityKey = target?.dataset.additionalCity;
      if (cityKey) openCity(cityKey, { updateHash: false });
    };

    if (location.hash) openFromHash();
    window.addEventListener('hashchange', openFromHash);
    return openCity;
  };

  const openAdditionalCity = setupAdditionalCities();

  const setupHeaderCitySearch = () => {
    const root = document.querySelector('[data-header-search]');
    if (!root) return;

    const toggle = root.querySelector('.header-search-toggle');
    const overlay = root.querySelector('[data-header-search-overlay]');
    const dialog = root.querySelector('[data-header-search-dialog]');
    const closeButton = root.querySelector('.header-search-close');
    const input = root.querySelector('input');
    const mobileMedia = window.matchMedia('(max-width: 720px)');
    if (!toggle || !overlay || !dialog || !closeButton || !input) return;

    let lastFocusedElement = null;

    const closeModal = ({ restoreFocus = true } = {}) => {
      const wasOpen = overlay.classList.contains('is-open');
      overlay.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
      document.body.classList.remove('city-search-modal-open');
      if (mobileMedia.matches) overlay.setAttribute('aria-hidden', 'true');
      if (wasOpen && restoreFocus) (lastFocusedElement || toggle).focus();
    };

    const openModal = () => {
      if (!mobileMedia.matches) return;
      lastFocusedElement = document.activeElement;
      overlay.classList.add('is-open');
      overlay.setAttribute('aria-hidden', 'false');
      toggle.setAttribute('aria-expanded', 'true');
      document.body.classList.add('city-search-modal-open');
      window.requestAnimationFrame(() => input.focus());
    };

    const syncMode = () => {
      closeModal({ restoreFocus: false });
      if (mobileMedia.matches) {
        overlay.setAttribute('aria-hidden', 'true');
        dialog.setAttribute('role', 'dialog');
        dialog.setAttribute('aria-modal', 'true');
      } else {
        overlay.setAttribute('aria-hidden', 'false');
        dialog.removeAttribute('role');
        dialog.removeAttribute('aria-modal');
      }
    };

    toggle.addEventListener('click', openModal);
    closeButton.addEventListener('click', () => closeModal());
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) closeModal();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && overlay.classList.contains('is-open')) closeModal();
    });
    window.addEventListener('hub:close-city-search', () => closeModal({ restoreFocus: false }));
    mobileMedia.addEventListener('change', syncMode);
    syncMode();
  };

  const setupAdditionalCitySearch = () => {
    const searches = [...document.querySelectorAll('[data-city-search]')];
    if (!searches.length || !openAdditionalCity) return;

    const districtByCity = Object.fromEntries(additionalDistricts.flatMap((district) =>
      district.cities.map((cityKey) => [cityKey, district.name])
    ));
    const primaryCityOptions = Object.entries(cities).map(([key, city]) => ({
      key,
      name: city.name,
      district: `Основной город · ${agentLabel(city.agents)}`,
      href: document.querySelector(`.city-card[data-city="${key}"]`)?.href || `${key}/index.html`,
      isPrimary: true
    }));
    const additionalCityOptions = Object.entries(additionalCities)
      .map(([key, city]) => ({ key, name: city.name, district: districtByCity[key] || 'Другие населённые пункты', isPrimary: false }));
    const cityOptions = [...primaryCityOptions, ...additionalCityOptions]
      .sort((first, second) => first.name.localeCompare(second.name, 'ru'));
    const normalize = (value) => value.toLocaleLowerCase('ru').replaceAll('ё', 'е');

    searches.forEach((search, searchIndex) => {
      const input = search.querySelector('input');
      const suggestions = search.querySelector('.additional-city-suggestions');
      const clearButton = search.querySelector('.additional-city-search-clear');
      const status = search.querySelector('.additional-city-search-status');
      if (!input || !suggestions || !clearButton || !status) return;

      let matches = [];
      let activeIndex = -1;

      const closeSuggestions = () => {
        suggestions.hidden = true;
        input.setAttribute('aria-expanded', 'false');
        input.removeAttribute('aria-activedescendant');
        activeIndex = -1;
      };

      const setActiveOption = (index) => {
        const options = [...suggestions.querySelectorAll('[role="option"]')];
        if (!options.length) return;
        activeIndex = (index + options.length) % options.length;
        options.forEach((option, optionIndex) => {
          const isActive = optionIndex === activeIndex;
          option.classList.toggle('is-active', isActive);
          option.setAttribute('aria-selected', String(isActive));
        });
        input.setAttribute('aria-activedescendant', options[activeIndex].id);
        options[activeIndex].scrollIntoView({ block: 'nearest' });
      };

      const selectCity = (city) => {
        input.value = city.name;
        clearButton.hidden = false;
        status.textContent = `Выбрано: ${city.name}, ${city.district}`;
        closeSuggestions();
        window.dispatchEvent(new CustomEvent('hub:close-city-search'));
        trackGoal('hub_city_search_select', { city: city.key, type: city.isPrimary ? 'primary' : 'additional' });
        if (city.isPrimary) {
          window.location.href = city.href;
          return;
        }
        openAdditionalCity(city.key);
      };

      const renderSuggestions = () => {
        const query = normalize(input.value.trim());
        clearButton.hidden = !input.value;
        suggestions.replaceChildren();
        activeIndex = -1;

        if (!query) {
          status.textContent = '';
          closeSuggestions();
          return;
        }

        matches = cityOptions
          .filter((city) => normalize(city.name).includes(query))
          .sort((first, second) => {
            const firstStarts = normalize(first.name).startsWith(query);
            const secondStarts = normalize(second.name).startsWith(query);
            return Number(secondStarts) - Number(firstStarts) || first.name.localeCompare(second.name, 'ru');
          })
          .slice(0, 8);

        if (!matches.length) {
          const empty = document.createElement('p');
          empty.className = 'additional-city-search-empty';
          empty.textContent = 'Населённый пункт не найден';
          suggestions.append(empty);
          suggestions.hidden = false;
          input.setAttribute('aria-expanded', 'true');
          status.textContent = 'Совпадений не найдено';
          return;
        }

        matches.forEach((city, index) => {
          const option = document.createElement('button');
          option.type = 'button';
          option.id = `additional-city-option-${searchIndex}-${city.key}`;
          option.className = 'additional-city-suggestion';
          option.setAttribute('role', 'option');
          option.setAttribute('aria-selected', 'false');
          option.innerHTML = `<strong>${city.name}</strong><small>${city.district}</small>`;
          option.addEventListener('pointerdown', (event) => event.preventDefault());
          option.addEventListener('click', () => selectCity(city));
          option.addEventListener('mouseenter', () => setActiveOption(index));
          suggestions.append(option);
        });

        suggestions.hidden = false;
        input.setAttribute('aria-expanded', 'true');
        status.textContent = `Найдено вариантов: ${matches.length}`;
      };

      input.addEventListener('input', renderSuggestions);
      input.addEventListener('focus', () => {
        if (input.value.trim()) renderSuggestions();
      });
      input.addEventListener('keydown', (event) => {
        if (suggestions.hidden && event.key === 'ArrowDown') renderSuggestions();
        if (event.key === 'ArrowDown' && matches.length) {
          event.preventDefault();
          setActiveOption(activeIndex + 1);
        } else if (event.key === 'ArrowUp' && matches.length) {
          event.preventDefault();
          setActiveOption(activeIndex - 1);
        } else if (event.key === 'Enter' && activeIndex >= 0 && matches[activeIndex]) {
          event.preventDefault();
          selectCity(matches[activeIndex]);
        } else if (event.key === 'Escape') {
          closeSuggestions();
        }
      });
      clearButton.addEventListener('click', () => {
        input.value = '';
        clearButton.hidden = true;
        status.textContent = '';
        closeSuggestions();
        input.focus();
      });
      document.addEventListener('click', (event) => {
        if (!search.contains(event.target)) closeSuggestions();
      });
    });
  };

  setupHeaderCitySearch();
  setupAdditionalCitySearch();

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
