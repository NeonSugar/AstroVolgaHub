(() => {
  'use strict';

  const loginView = document.querySelector('[data-login-view]');
  const dashboard = document.querySelector('[data-dashboard]');
  const loginForm = document.querySelector('[data-login-form]');
  const loginStatus = document.querySelector('[data-login-status]');
  const pageTitle = document.querySelector('[data-page-title]');
  const sectionButtons = [...document.querySelectorAll('[data-section-button]')];
  const mobileSectionButtons = [...document.querySelectorAll('[data-mobile-section]')];
  const sections = [...document.querySelectorAll('[data-section]')];
  const logoutButtons = [...document.querySelectorAll('[data-logout]')];
  const currentDate = document.querySelector('[data-current-date]');
  const requestStatus = document.querySelector('[data-request-status]');
  const requestLocality = document.querySelector('[data-request-locality]');
  const requestAgent = document.querySelector('[data-request-agent]');
  const requestSearch = document.querySelector('[data-request-search]');
  const requestList = document.querySelector('[data-request-list]');
  const requestTable = document.querySelector('.admin-request-table');
  const requestEmpty = document.querySelector('[data-request-empty]');
  const requestStatusMessage = document.querySelector('[data-request-status-message]');
  const requestReset = document.querySelector('[data-request-reset]');
  const requestPagination = document.querySelector('[data-request-pagination]');
  const sidebarCityToggle = document.querySelector('[data-sidebar-city-toggle]');
  const sidebarCityList = document.querySelector('[data-sidebar-city-list]');
  const sidebarCityLabel = document.querySelector('[data-sidebar-city-label]');
  const agentLocality = document.querySelector('[data-agent-locality]');
  const agentState = document.querySelector('[data-agent-state]');
  const agentSearch = document.querySelector('[data-agent-search]');
  const agentList = document.querySelector('[data-agent-list]');
  const agentEmpty = document.querySelector('[data-agent-empty]');
  const agentStatusMessage = document.querySelector('[data-agent-status-message]');
  const agentReset = document.querySelector('[data-agent-reset]');
  const agentPagination = document.querySelector('[data-agent-pagination]');
  const agentModal = document.querySelector('[data-agent-modal]');
  const agentForm = document.querySelector('[data-agent-form]');
  const agentFormStatus = document.querySelector('[data-agent-form-status]');
  const cabinetToggle = agentForm?.elements.cabinetEnabled;
  const cabinetFields = document.querySelector('[data-cabinet-fields]');
  const cabinetModal = document.querySelector('[data-cabinet-modal]');
  const cabinetForm = document.querySelector('[data-cabinet-form]');
  const cabinetFormStatus = document.querySelector('[data-cabinet-form-status]');
  const cabinetModalTitle = document.querySelector('[data-cabinet-modal-title]');
  const cabinetAgentName = document.querySelector('[data-cabinet-agent-name]');
  const cabinetHint = document.querySelector('[data-cabinet-hint]');
  const toast = document.querySelector('[data-toast]');

  let csrfToken = '';
  let overview = { stats: {}, agentStats: {}, cities: [] };
  let agents = [];
  let requests = [];
  let refreshTimer;
  let loading = false;
  let requestPage = 1;
  let agentPage = 1;
  let activeSection = 'requests';
  let selectedCabinetAgent = null;
  let toastTimer;
  const refreshInterval = 15_000;
  const requestPageSize = 25;
  const agentPageSize = 20;

  const statusLabels = { new: 'Новая', in_progress: 'В работе', processed: 'Обработанные', rejected: 'Отказ' };
  const serviceLabels = { osago: 'ОСАГО', kasko: 'КАСКО', health: 'Здоровье', property: 'Имущество', other: 'Другое' };
  const passwordAlphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';

  const normalize = (value) => String(value || '').toLocaleLowerCase('ru-RU').replace(/ё/g, 'е').replace(/[^а-яa-z0-9]+/g, ' ').trim();
  const formatPhone = (value) => {
    const digits = String(value || '').replace(/\D/g, '');
    return digits.length === 11 ? `+${digits[0]} (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7, 9)}-${digits.slice(9)}` : value;
  };
  const formatDate = (value) => {
    const date = new Date(value);
    return {
      date: new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' }).format(date),
      time: new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' }).format(date)
    };
  };

  const randomString = (alphabet, length) => {
    const values = crypto.getRandomValues(new Uint32Array(length));
    return [...values].map((value) => alphabet[value % alphabet.length]).join('');
  };
  const generatePassword = () => randomString(passwordAlphabet, 18);
  const generateLogin = ({ localitySlug, phone, id } = {}) => {
    const locality = (String(localitySlug || 'agent').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || 'agent').slice(0, 48);
    const digits = String(phone || '').replace(/\D/g, '').slice(-6);
    const unique = String(id || '').replace(/-/g, '').slice(0, 4) || randomString('abcdefghijkmnopqrstuvwxyz23456789', 4);
    return `agent-${locality}-${digits || 'user'}-${unique}`.slice(0, 120);
  };

  const copyCredentials = async (login, password) => {
    if (!login || !password) {
      showToast('Сначала создайте логин и пароль.', 'error');
      return;
    }
    try {
      await navigator.clipboard.writeText(`Логин: ${login}\nПароль: ${password}`);
      showToast('Логин и пароль скопированы.');
    } catch (_error) {
      showToast('Не удалось скопировать автоматически. Выделите данные вручную.', 'error');
    }
  };

  const showToast = (message, type = 'success') => {
    window.clearTimeout(toastTimer);
    toast.textContent = message;
    toast.dataset.type = type;
    toast.hidden = false;
    window.requestAnimationFrame(() => toast.classList.add('is-visible'));
    toastTimer = window.setTimeout(() => {
      toast.classList.remove('is-visible');
      window.setTimeout(() => { toast.hidden = true; }, 220);
    }, 3200);
  };

  const renderPagination = (container, totalItems, pageSize, currentPage, onPageChange) => {
    const pageCount = Math.max(1, Math.ceil(totalItems / pageSize));
    container.replaceChildren();
    container.hidden = pageCount <= 1;
    if (pageCount <= 1) return;

    const createButton = (label, page, disabled = false, className = '') => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = className;
      button.textContent = label;
      button.disabled = disabled;
      button.addEventListener('click', () => onPageChange(page));
      return button;
    };
    container.append(createButton('←', currentPage - 1, currentPage === 1, 'is-arrow'));
    const start = Math.max(1, Math.min(currentPage - 1, pageCount - 2));
    const end = Math.min(pageCount, start + 2);
    for (let page = start; page <= end; page += 1) {
      const button = createButton(String(page), page, false, page === currentPage ? 'is-active' : '');
      button.setAttribute('aria-label', `Страница ${page}`);
      if (page === currentPage) button.setAttribute('aria-current', 'page');
      container.append(button);
    }
    const label = document.createElement('span');
    label.textContent = `из ${pageCount}`;
    container.append(label, createButton('→', currentPage + 1, currentPage === pageCount, 'is-arrow'));
  };

  const updateFilterUi = () => {
    const requestCount = Number(requestStatus.value !== 'all') + Number(Boolean(requestLocality.value)) + Number(Boolean(requestAgent.value));
    const agentCount = Number(Boolean(agentLocality.value)) + Number(agentState.value !== 'active');
    const requestCountElement = document.querySelector('[data-filter-count="requests"]');
    const agentCountElement = document.querySelector('[data-filter-count="agents"]');
    requestCountElement.textContent = requestCount;
    requestCountElement.hidden = requestCount === 0;
    agentCountElement.textContent = agentCount;
    agentCountElement.hidden = agentCount === 0;
    requestReset.hidden = requestCount === 0 && !requestSearch.value;
    agentReset.hidden = agentCount === 0 && !agentSearch.value;
    document.querySelectorAll('[data-status-filter]').forEach((item) => item.classList.toggle('is-active', requestStatus.value === item.dataset.statusFilter));
    renderSidebarCities();
  };
  const detailsLabel = (request) => {
    const details = request.statusDetails || {};
    if (request.status === 'in_progress') {
      const reason = details.reason === 'rescheduled' ? 'Перенесено' : details.reason === 'no_answer' ? 'Недозвон' : '';
      return details.followUpDate ? `${reason} до ${new Intl.DateTimeFormat('ru-RU').format(new Date(`${details.followUpDate}T12:00:00`))}` : reason;
    }
    if (request.status === 'processed') {
      const values = Array.isArray(details.services) ? details.services.map((item) => serviceLabels[item]).filter(Boolean) : [];
      return values.length ? `Услуги: ${values.join(', ')}` : '';
    }
    if (request.status === 'rejected') return details.comment ? `Причина: ${details.comment}` : '';
    return '';
  };

  const apiRequest = async (path, options = {}) => {
    const headers = new Headers(options.headers || {});
    if (options.body) headers.set('Content-Type', 'application/json');
    if (options.method && options.method !== 'GET') headers.set('X-CSRF-Token', csrfToken);
    const response = await fetch(path, { ...options, headers, credentials: 'same-origin' });
    const data = response.status === 204 ? null : await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data?.error || 'Не удалось выполнить запрос.');
      error.status = response.status;
      throw error;
    }
    return data;
  };

  const fetchCsrf = async () => {
    const data = await apiRequest('/api/csrf');
    csrfToken = data.token;
  };

  const showLogin = () => {
    window.clearInterval(refreshTimer);
    dashboard.hidden = true;
    loginView.hidden = false;
    document.querySelector('.cabinet-header').hidden = false;
  };

  const showDashboard = (administrator) => {
    loginView.hidden = true;
    dashboard.hidden = false;
    document.querySelector('.cabinet-header').hidden = true;
    const name = administrator.displayName || 'Администратор';
    document.querySelector('[data-admin-name]').textContent = name;
    document.querySelector('[data-admin-initial]').textContent = name.slice(0, 1).toLocaleUpperCase('ru-RU');
    currentDate.textContent = new Intl.DateTimeFormat('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
  };

  const setSection = (name) => {
    activeSection = name;
    sections.forEach((section) => { section.hidden = section.dataset.section !== name; });
    sectionButtons.forEach((button) => button.classList.toggle('is-active', button.dataset.sectionButton === name));
    mobileSectionButtons.forEach((button) => button.classList.toggle('is-active', button.dataset.mobileSection === name));
    pageTitle.textContent = name === 'agents' ? 'Управление агентами' : 'Заявки клиентов';
    renderSidebarCities();
  };

  const fillSelect = (select, items, initialLabel, selectedValue = select.value) => {
    select.replaceChildren();
    const initial = document.createElement('option');
    initial.value = '';
    initial.textContent = initialLabel;
    select.append(initial);
    items.forEach(({ value, label }) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      select.append(option);
    });
    if ([...select.options].some((option) => option.value === selectedValue)) select.value = selectedValue;
  };

  function renderSidebarCities() {
    const selectedSlug = activeSection === 'agents' ? agentLocality.value : requestLocality.value;
    const selectedCity = overview.cities.find((city) => city.localitySlug === selectedSlug);
    sidebarCityLabel.textContent = selectedCity?.localityName || 'Все города';
    sidebarCityList.replaceChildren();

    const createCityButton = (city = null) => {
      const slug = city?.localitySlug || '';
      const button = document.createElement('button');
      button.type = 'button';
      button.classList.toggle('is-active', slug === selectedSlug);
      button.dataset.locality = slug;
      const name = document.createElement('span');
      name.textContent = city?.localityName || 'Все города';
      const count = document.createElement('b');
      count.textContent = city
        ? (activeSection === 'agents' ? city.agentCount : city.requests.all)
        : (activeSection === 'agents' ? overview.agentStats.active || 0 : overview.stats.all || 0);
      button.append(name, count);
      button.addEventListener('click', () => {
        if (activeSection === 'agents') {
          agentLocality.value = slug;
          agentPage = 1;
          renderAgents();
        } else {
          requestLocality.value = slug;
          requestAgent.value = '';
          requestPage = 1;
          loadRequests();
        }
        sidebarCityToggle.setAttribute('aria-expanded', 'false');
        sidebarCityList.hidden = true;
        renderSidebarCities();
      });
      return button;
    };

    sidebarCityList.append(createCityButton(), ...overview.cities.map(createCityButton));
  }

  const renderOverview = () => {
    document.querySelectorAll('[data-metric]').forEach((element) => {
      element.textContent = overview.stats[element.dataset.metric] || 0;
    });
    document.querySelectorAll('[data-agent-metric]').forEach((element) => {
      element.textContent = overview.agentStats[element.dataset.agentMetric] || 0;
    });
    document.querySelector('[data-nav-count="requests"]').textContent = overview.stats.all || 0;
    document.querySelector('[data-nav-count="agents"]').textContent = overview.agentStats.active || 0;

    const localityOptions = overview.cities.map((city) => ({ value: city.localitySlug, label: city.localityName }));
    fillSelect(requestLocality, localityOptions, 'Все населённые пункты');
    fillSelect(agentLocality, localityOptions, 'Все населённые пункты');
    const formLocality = agentForm.elements.localitySlug;
    fillSelect(formLocality, localityOptions, 'Выберите населённый пункт');

    updateFilterUi();
  };

  const createCellLabel = (text) => {
    const label = document.createElement('span');
    label.className = 'cabinet-cell-label';
    label.textContent = text;
    return label;
  };

  const createRequestCard = (request) => {
    const article = document.createElement('article');
    article.className = 'cabinet-request admin-request';
    const date = formatDate(request.createdAt);

    const client = document.createElement('div');
    client.className = 'cabinet-request-client';
    const clientName = document.createElement('h2');
    clientName.textContent = request.customerName;
    const clientPhone = document.createElement('a');
    clientPhone.className = 'cabinet-request-phone';
    clientPhone.href = `tel:+${request.customerPhone}`;
    clientPhone.textContent = `☎ ${formatPhone(request.customerPhone)}`;
    client.append(createCellLabel('Клиент'), clientName, clientPhone);

    const agent = document.createElement('div');
    agent.className = 'admin-request-agent';
    const agentName = document.createElement('strong');
    agentName.textContent = request.agent.displayName;
    const agentPlace = document.createElement('small');
    agentPlace.textContent = `${request.agent.localityName} · ${request.agent.address}`;
    const agentPhone = document.createElement('a');
    agentPhone.href = `tel:+${request.agent.phone}`;
    agentPhone.textContent = formatPhone(request.agent.phone);
    agent.append(createCellLabel('Агент'), agentName, agentPlace, agentPhone);

    const status = document.createElement('div');
    const badge = document.createElement('span');
    badge.className = 'cabinet-status-button admin-status-badge';
    badge.dataset.status = request.status;
    badge.textContent = statusLabels[request.status] || request.status;
    status.append(createCellLabel('Статус'), badge);

    const comment = document.createElement('div');
    const details = document.createElement('p');
    details.className = 'cabinet-request-details';
    details.textContent = detailsLabel(request) || '—';
    comment.append(createCellLabel('Комментарий'), details);

    const created = document.createElement('div');
    created.className = 'cabinet-request-date';
    const day = document.createElement('strong');
    day.textContent = date.date;
    const time = document.createElement('small');
    time.textContent = date.time;
    created.append(createCellLabel('Дата'), day, time);
    article.append(client, agent, status, comment, created);
    return article;
  };

  const renderRequests = () => {
    const query = normalize(requestSearch.value);
    const visible = requests.filter((request) => !query || normalize([
      request.customerName, request.customerPhone, request.agent.displayName,
      request.agent.localityName, request.agent.address, request.agent.phone
    ].join(' ')).includes(query));
    const pageCount = Math.max(1, Math.ceil(visible.length / requestPageSize));
    requestPage = Math.min(requestPage, pageCount);
    const start = (requestPage - 1) * requestPageSize;
    const pageItems = visible.slice(start, start + requestPageSize);
    requestList.replaceChildren(...pageItems.map(createRequestCard));
    requestTable.hidden = !visible.length;
    requestEmpty.hidden = Boolean(visible.length);
    requestStatusMessage.textContent = visible.length
      ? `Показано ${start + 1}–${Math.min(start + requestPageSize, visible.length)} из ${visible.length} заявок`
      : '';
    renderPagination(requestPagination, visible.length, requestPageSize, requestPage, (page) => {
      requestPage = page;
      renderRequests();
      requestTable.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    updateFilterUi();
  };

  const loadRequests = async () => {
    const parameters = new URLSearchParams();
    if (requestStatus.value !== 'all') parameters.set('status', requestStatus.value);
    if (requestLocality.value) parameters.set('locality', requestLocality.value);
    if (requestAgent.value) parameters.set('agentId', requestAgent.value);
    requestStatusMessage.textContent = 'Загружаем заявки…';
    try {
      const data = await apiRequest(`/api/admin/callback-requests?${parameters}`);
      requests = data.requests || [];
      renderRequests();
    } catch (error) {
      if (error.status === 401) return showLogin();
      requestStatusMessage.textContent = error.message;
    }
  };

  const createAgentCard = (agent) => {
    const article = document.createElement('article');
    article.className = 'admin-agent-card';
    if (!agent.isActive) article.classList.add('is-inactive');
    const identity = document.createElement('div');
    identity.className = 'admin-agent-identity';
    const name = document.createElement('h2');
    name.textContent = agent.displayName;
    const place = document.createElement('p');
    place.textContent = `${agent.localityName} · ${agent.address}`;
    const phone = document.createElement('a');
    phone.href = `tel:+${agent.phone}`;
    phone.textContent = formatPhone(agent.phone);
    identity.append(name, place, phone);

    const access = document.createElement('div');
    access.className = 'admin-agent-access';
    const state = document.createElement('span');
    state.className = agent.isActive ? 'is-active' : 'is-disabled';
    state.textContent = agent.isActive ? 'На сайте' : 'Удалён';
    const cabinet = document.createElement('small');
    cabinet.textContent = agent.hasCabinet ? `ЛК: ${agent.login}` : 'Без личного кабинета';
    access.append(state, cabinet);

    const stats = document.createElement('div');
    stats.className = 'admin-agent-request-stats';
    stats.innerHTML = `<span><b>${agent.requests.all}</b> всего</span><span><b>${agent.requests.new}</b> новых</span><span><b>${agent.requests.inProgress}</b> в работе</span>`;

    const actions = document.createElement('div');
    actions.className = 'admin-agent-actions';
    const cabinetButton = document.createElement('button');
    cabinetButton.type = 'button';
    cabinetButton.textContent = agent.hasCabinet ? 'Настроить ЛК' : 'Создать ЛК';
    cabinetButton.disabled = !agent.isActive;
    cabinetButton.addEventListener('click', () => openCabinetModal(agent));
    const requestsButton = document.createElement('button');
    requestsButton.type = 'button';
    requestsButton.textContent = 'Заявки агента';
    requestsButton.disabled = !agent.requests.all;
    requestsButton.addEventListener('click', () => {
      requestLocality.value = agent.localitySlug;
      requestAgent.value = agent.id;
      requestPage = 1;
      setSection('requests');
      loadRequests();
    });
    const stateButton = document.createElement('button');
    stateButton.type = 'button';
    stateButton.className = agent.isActive ? 'is-danger' : 'is-restore';
    stateButton.textContent = agent.isActive ? 'Убрать агента' : 'Восстановить';
    stateButton.addEventListener('click', () => changeAgentState(agent));
    actions.append(cabinetButton, requestsButton, stateButton);
    article.append(identity, access, stats, actions);
    return article;
  };

  const renderAgents = () => {
    const query = normalize(agentSearch.value);
    const visible = agents.filter((agent) => {
      if (agentLocality.value && agent.localitySlug !== agentLocality.value) return false;
      if (agentState.value === 'active' && !agent.isActive) return false;
      if (agentState.value === 'inactive' && agent.isActive) return false;
      return !query || normalize(`${agent.displayName} ${agent.localityName} ${agent.address} ${agent.phone} ${agent.login || ''}`).includes(query);
    });
    const pageCount = Math.max(1, Math.ceil(visible.length / agentPageSize));
    agentPage = Math.min(agentPage, pageCount);
    const start = (agentPage - 1) * agentPageSize;
    const pageItems = visible.slice(start, start + agentPageSize);
    agentList.replaceChildren(...pageItems.map(createAgentCard));
    agentEmpty.hidden = Boolean(visible.length);
    agentStatusMessage.textContent = visible.length
      ? `Показано ${start + 1}–${Math.min(start + agentPageSize, visible.length)} из ${visible.length} агентов`
      : '';
    renderPagination(agentPagination, visible.length, agentPageSize, agentPage, (page) => {
      agentPage = page;
      renderAgents();
      agentList.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    updateFilterUi();
  };

  const populateAgentFilter = () => {
    const selected = requestAgent.value;
    fillSelect(requestAgent, agents.filter((agent) => agent.isActive).map((agent) => ({
      value: agent.id,
      label: `${agent.displayName} · ${agent.localityName} · ${formatPhone(agent.phone)}`
    })), 'Все агенты', selected);
  };

  const changeAgentState = async (agent) => {
    const action = agent.isActive ? 'убрать с сайта и приостановить доступ к кабинету' : 'восстановить на сайте';
    if (!window.confirm(`Вы уверены, что хотите ${action}: ${agent.displayName}?`)) return;
    try {
      if (agent.isActive) await apiRequest(`/api/admin/agents/${agent.id}`, { method: 'DELETE' });
      else await apiRequest(`/api/admin/agents/${agent.id}/restore`, { method: 'PATCH' });
      showToast(agent.isActive ? 'Агент убран с сайта. Его заявки сохранены.' : 'Агент восстановлен на сайте.');
      await loadAll();
    } catch (error) {
      agentStatusMessage.textContent = error.message;
      showToast(error.message, 'error');
    }
  };

  const loadAll = async ({ silent = false } = {}) => {
    if (loading) return;
    loading = true;
    if (!silent) requestStatusMessage.textContent = 'Обновляем данные…';
    try {
      const [overviewData, agentData] = await Promise.all([
        apiRequest('/api/admin/overview'),
        apiRequest('/api/admin/agents')
      ]);
      overview = overviewData;
      agents = agentData.agents || [];
      renderOverview();
      populateAgentFilter();
      renderAgents();
      await loadRequests();
    } catch (error) {
      if (error.status === 401) return showLogin();
      requestStatusMessage.textContent = error.message;
      agentStatusMessage.textContent = error.message;
    } finally {
      loading = false;
    }
  };

  const openAgentModal = () => {
    agentForm.reset();
    agentForm.elements.login.dataset.generated = 'false';
    agentForm.elements.password.type = 'password';
    cabinetFields.hidden = true;
    agentFormStatus.textContent = '';
    agentModal.hidden = false;
    document.body.classList.add('has-cabinet-modal');
    window.requestAnimationFrame(() => agentForm.elements.localitySlug.focus());
  };
  const closeAgentModal = () => {
    agentModal.hidden = true;
    document.body.classList.remove('has-cabinet-modal');
  };

  const generateNewAgentLogin = () => {
    agentForm.elements.login.value = generateLogin({
      localitySlug: agentForm.elements.localitySlug.value,
      phone: agentForm.elements.phone.value
    });
    agentForm.elements.login.dataset.generated = 'true';
  };
  const generateNewAgentPassword = () => {
    agentForm.elements.password.value = generatePassword();
    agentForm.elements.password.type = 'text';
  };
  const generateCabinetLogin = () => {
    if (!selectedCabinetAgent) return;
    cabinetForm.elements.login.value = generateLogin(selectedCabinetAgent);
  };
  const generateCabinetPassword = () => {
    cabinetForm.elements.password.value = generatePassword();
  };

  const openCabinetModal = (agent) => {
    selectedCabinetAgent = agent;
    cabinetForm.reset();
    cabinetFormStatus.textContent = '';
    cabinetModalTitle.textContent = agent.hasCabinet ? 'Настроить личный кабинет' : 'Создать личный кабинет';
    cabinetAgentName.textContent = `${agent.displayName} · ${agent.localityName} · ${formatPhone(agent.phone)}`;
    cabinetHint.textContent = agent.hasCabinet
      ? 'После сохранения прежний пароль перестанет работать. Скопируйте новые данные.'
      : 'Скопируйте данные и передайте их агенту.';
    cabinetForm.querySelector('button[type="submit"]').textContent = agent.hasCabinet ? 'Сохранить новый доступ' : 'Создать ЛК';
    cabinetForm.elements.login.value = agent.login || generateLogin(agent);
    generateCabinetPassword();
    cabinetModal.hidden = false;
    document.body.classList.add('has-cabinet-modal');
    window.requestAnimationFrame(() => cabinetForm.elements.login.focus());
  };
  const closeCabinetModal = () => {
    cabinetModal.hidden = true;
    selectedCabinetAgent = null;
    document.body.classList.remove('has-cabinet-modal');
  };

  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!loginForm.reportValidity()) return;
    loginStatus.textContent = 'Входим…';
    try {
      const formData = new FormData(loginForm);
      const data = await apiRequest('/api/admin/auth/login', {
        method: 'POST',
        body: JSON.stringify({ login: formData.get('login'), password: formData.get('password') })
      });
      csrfToken = data.token;
      loginForm.reset();
      loginStatus.textContent = '';
      showDashboard(data.administrator);
      await loadAll();
      window.clearInterval(refreshTimer);
      refreshTimer = window.setInterval(() => loadAll({ silent: true }), refreshInterval);
    } catch (error) {
      loginStatus.textContent = error.message;
    }
  });

  logoutButtons.forEach((button) => button.addEventListener('click', async () => {
    try { await apiRequest('/api/admin/auth/logout', { method: 'POST' }); } catch (_error) { /* session may already be gone */ }
    showLogin();
  }));
  sectionButtons.forEach((button) => button.addEventListener('click', () => setSection(button.dataset.sectionButton)));
  mobileSectionButtons.forEach((button) => button.addEventListener('click', () => setSection(button.dataset.mobileSection)));
  sidebarCityToggle.addEventListener('click', () => {
    const isOpen = sidebarCityList.hidden;
    sidebarCityList.hidden = !isOpen;
    sidebarCityToggle.setAttribute('aria-expanded', String(isOpen));
  });
  document.querySelectorAll('[data-status-filter]').forEach((button) => button.addEventListener('click', () => {
    const status = button.dataset.statusFilter;
    requestStatus.value = requestStatus.value === status ? 'all' : status;
    requestPage = 1;
    updateFilterUi();
    loadRequests();
  }));
  requestStatus.addEventListener('change', () => {
    requestPage = 1;
    updateFilterUi();
    loadRequests();
  });
  requestLocality.addEventListener('change', () => {
    requestAgent.value = '';
    requestPage = 1;
    updateFilterUi();
    loadRequests();
  });
  requestAgent.addEventListener('change', () => { requestPage = 1; updateFilterUi(); loadRequests(); });
  requestSearch.addEventListener('input', () => { requestPage = 1; renderRequests(); });
  agentLocality.addEventListener('change', () => { agentPage = 1; renderAgents(); });
  agentState.addEventListener('change', () => { agentPage = 1; renderAgents(); });
  agentSearch.addEventListener('input', () => { agentPage = 1; renderAgents(); });
  requestReset.addEventListener('click', () => {
    requestStatus.value = 'all';
    requestLocality.value = '';
    requestAgent.value = '';
    requestSearch.value = '';
    requestPage = 1;
    updateFilterUi();
    loadRequests();
  });
  agentReset.addEventListener('click', () => {
    agentLocality.value = '';
    agentState.value = 'active';
    agentSearch.value = '';
    agentPage = 1;
    renderAgents();
  });
  document.querySelectorAll('[data-filter-toggle]').forEach((button) => button.addEventListener('click', () => {
    const panel = document.querySelector(`[data-filter-panel="${button.dataset.filterToggle}"]`);
    const isOpen = panel.classList.toggle('is-mobile-open');
    button.setAttribute('aria-expanded', String(isOpen));
  }));
  document.querySelector('[data-add-agent]').addEventListener('click', openAgentModal);
  document.querySelectorAll('[data-agent-modal-close]').forEach((button) => button.addEventListener('click', closeAgentModal));
  document.querySelectorAll('[data-cabinet-modal-close]').forEach((button) => button.addEventListener('click', closeCabinetModal));
  cabinetToggle.addEventListener('change', () => {
    cabinetFields.hidden = !cabinetToggle.checked;
    agentForm.elements.login.required = cabinetToggle.checked;
    agentForm.elements.password.required = cabinetToggle.checked;
    if (cabinetToggle.checked) {
      generateNewAgentLogin();
      generateNewAgentPassword();
    }
  });
  agentForm.elements.localitySlug.addEventListener('change', () => {
    if (cabinetToggle.checked && agentForm.elements.login.dataset.generated === 'true') generateNewAgentLogin();
  });
  agentForm.elements.phone.addEventListener('input', () => {
    if (cabinetToggle.checked && agentForm.elements.login.dataset.generated === 'true') generateNewAgentLogin();
  });
  agentForm.elements.login.addEventListener('input', () => { agentForm.elements.login.dataset.generated = 'false'; });
  document.querySelector('[data-generate-login]').addEventListener('click', generateNewAgentLogin);
  document.querySelector('[data-generate-password]').addEventListener('click', generateNewAgentPassword);
  document.querySelector('[data-copy-new-agent-credentials]').addEventListener('click', () => {
    copyCredentials(agentForm.elements.login.value, agentForm.elements.password.value);
  });
  document.querySelector('[data-cabinet-generate-login]').addEventListener('click', generateCabinetLogin);
  document.querySelector('[data-cabinet-generate-password]').addEventListener('click', generateCabinetPassword);
  document.querySelector('[data-copy-cabinet-credentials]').addEventListener('click', () => {
    copyCredentials(cabinetForm.elements.login.value, cabinetForm.elements.password.value);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !agentModal.hidden) closeAgentModal();
    if (event.key === 'Escape' && !cabinetModal.hidden) closeCabinetModal();
  });

  agentForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!agentForm.reportValidity()) return;
    const formData = new FormData(agentForm);
    const submit = agentForm.querySelector('button[type="submit"]');
    submit.disabled = true;
    agentFormStatus.textContent = 'Сохраняем…';
    try {
      await apiRequest('/api/admin/agents', {
        method: 'POST',
        body: JSON.stringify({
          localitySlug: formData.get('localitySlug'), displayName: formData.get('displayName'),
          address: formData.get('address'), phone: formData.get('phone'), note: formData.get('note'),
          mapUrl: formData.get('mapUrl'), cabinetEnabled: formData.get('cabinetEnabled') === 'on',
          login: formData.get('login'), password: formData.get('password')
        })
      });
      closeAgentModal();
      showToast('Агент добавлен и уже доступен в каталоге.');
      await loadAll();
    } catch (error) {
      agentFormStatus.textContent = error.message;
      showToast(error.message, 'error');
    } finally {
      submit.disabled = false;
    }
  });

  cabinetForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!selectedCabinetAgent || !cabinetForm.reportValidity()) return;
    const submit = cabinetForm.querySelector('button[type="submit"]');
    submit.disabled = true;
    cabinetFormStatus.textContent = 'Сохраняем доступ…';
    try {
      const formData = new FormData(cabinetForm);
      await apiRequest(`/api/admin/agents/${selectedCabinetAgent.id}/cabinet`, {
        method: 'PATCH',
        body: JSON.stringify({ login: formData.get('login'), password: formData.get('password') })
      });
      closeCabinetModal();
      showToast('Личный кабинет агента настроен.');
      await loadAll();
    } catch (error) {
      cabinetFormStatus.textContent = error.message;
      showToast(error.message, 'error');
    } finally {
      submit.disabled = false;
    }
  });

  const initialize = async () => {
    try {
      await fetchCsrf();
      const data = await apiRequest('/api/admin/auth/me');
      showDashboard(data.administrator);
      await loadAll();
      refreshTimer = window.setInterval(() => loadAll({ silent: true }), refreshInterval);
    } catch (error) {
      if (error.status !== 401) loginStatus.textContent = error.message;
      showLogin();
    }
  };

  initialize();
})();
