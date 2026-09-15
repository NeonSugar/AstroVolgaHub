(() => {
  'use strict';

  const loginView = document.querySelector('[data-login-view]');
  const dashboard = document.querySelector('[data-dashboard]');
  const loginForm = document.querySelector('[data-login-form]');
  const loginStatus = document.querySelector('[data-login-status]');
  const dashboardStatus = document.querySelector('[data-dashboard-status]');
  const requestList = document.querySelector('[data-request-list]');
  const requestTable = document.querySelector('.cabinet-request-table');
  const emptyState = document.querySelector('[data-empty]');
  const requestSearch = document.querySelector('[data-request-search]');
  const filterButtons = [...document.querySelectorAll('[data-filter]')];
  const sidebarFilterButtons = [...document.querySelectorAll('[data-sidebar-filter]')];
  const summaryFilterButtons = [...document.querySelectorAll('[data-summary-filter]')];
  const logoutButtons = [...document.querySelectorAll('[data-logout]')];
  const metricElements = [...document.querySelectorAll('[data-metric]')];
  const sidebarCounts = [...document.querySelectorAll('[data-sidebar-count]')];
  const agentName = document.querySelector('[data-agent-name]');
  const agentCity = document.querySelector('[data-agent-city]');
  const agentInitial = document.querySelector('[data-agent-initial]');
  const currentDate = document.querySelector('[data-current-date]');
  const statusModal = document.querySelector('[data-status-modal]');
  const statusForm = document.querySelector('[data-status-form]');
  const statusTitle = document.querySelector('[data-status-title]');
  const statusDescription = document.querySelector('[data-status-description]');
  const statusError = document.querySelector('[data-status-error]');
  const statusFieldGroups = [...document.querySelectorAll('[data-status-fields]')];
  const statusCancelButtons = [...document.querySelectorAll('[data-status-cancel]')];
  const followUpDateField = document.querySelector('[data-follow-up-date]');

  let csrfToken = '';
  let activeFilter = 'all';
  let searchQuery = '';
  let allRequests = [];
  let requestStats = null;
  let refreshTimer;
  let requestsLoading = false;
  let pendingStatusChange = null;
  const autoRefreshInterval = 15_000;

  const statusLabels = {
    new: 'Новая',
    in_progress: 'В работе',
    processed: 'Обработанные',
    rejected: 'Отказ'
  };

  const statusDescriptions = {
    new: 'Заявка снова появится среди новых и будет ожидать обработки.',
    in_progress: 'Укажите, почему заявка остаётся в работе.',
    processed: 'Отметьте одну или несколько услуг, которые получил клиент.',
    rejected: 'Укажите причину, по которой заявка была отклонена.'
  };

  const serviceLabels = {
    osago: 'ОСАГО',
    kasko: 'КАСКО',
    health: 'Здоровье',
    property: 'Имущество',
    other: 'Другое'
  };

  const cityLabels = {
    berdyansk: 'Бердянск',
    energodar: 'Энергодар',
    kamenka: 'Каменка-Днепровская',
    melitopol: 'Мелитополь',
    primorsk: 'Приморск',
    tokmak: 'Токмак',
    vasilevka: 'Васильевка',
    veseloe: 'Весёлое',
    znamenka: 'Великая Знаменка'
  };

  const formatPhone = (phone) => {
    const digits = String(phone || '').replace(/\D/g, '');
    if (digits.length !== 11) return phone;
    return `+${digits[0]} (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7, 9)}-${digits.slice(9)}`;
  };

  const formatRequestDate = (value) => {
    const date = new Date(value);
    return {
      date: new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' }).format(date),
      time: new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' }).format(date)
    };
  };

  const requestDetailsLabel = (request) => {
    const details = request.statusDetails || {};
    if (request.status === 'in_progress') {
      const reason = details.reason === 'rescheduled' ? 'Перенесено' : details.reason === 'no_answer' ? 'Недозвон' : '';
      if (!reason) return '';
      if (!details.followUpDate) return reason;
      const date = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
        .format(new Date(`${details.followUpDate}T12:00:00`));
      return `${reason} до ${date}`;
    }
    if (request.status === 'processed') {
      const services = Array.isArray(details.services) ? details.services.map((service) => serviceLabels[service]).filter(Boolean) : [];
      return services.length ? `Услуги: ${services.join(', ')}` : '';
    }
    if (request.status === 'rejected' && details.comment) return `Причина: ${details.comment}`;
    return '';
  };

  const normalize = (value) => String(value || '')
    .toLocaleLowerCase('ru-RU')
    .replace(/ё/g, 'е')
    .replace(/[^а-яa-z0-9]+/g, ' ')
    .trim();

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

  const createLabel = (text) => {
    const label = document.createElement('span');
    label.className = 'cabinet-cell-label';
    label.textContent = text;
    return label;
  };

  const createRequestCard = (request) => {
    const date = formatRequestDate(request.createdAt);
    const article = document.createElement('article');
    article.className = 'cabinet-request';

    const client = document.createElement('div');
    client.className = 'cabinet-request-client';
    const title = document.createElement('h2');
    title.textContent = request.customerName;
    const phone = document.createElement('a');
    phone.className = 'cabinet-request-phone';
    phone.href = `tel:+${request.customerPhone}`;
    phone.textContent = `☎ ${formatPhone(request.customerPhone)}`;
    const code = document.createElement('span');
    code.className = 'cabinet-request-code';
    code.textContent = `AV-${request.id.slice(0, 8).toUpperCase()}`;
    client.append(createLabel('Клиент'), title, phone, code);

    const dateCell = document.createElement('div');
    dateCell.className = 'cabinet-request-date';
    const dateValue = document.createElement('strong');
    dateValue.textContent = date.date;
    const timeValue = document.createElement('small');
    timeValue.textContent = date.time;
    dateCell.append(createLabel('Дата и время'), dateValue, timeValue);

    const status = document.createElement('div');
    status.className = 'cabinet-request-status';
    const statusButton = document.createElement('button');
    statusButton.type = 'button';
    statusButton.className = 'cabinet-status-button';
    statusButton.dataset.status = request.status;
    statusButton.setAttribute('aria-label', `Изменить статус заявки ${request.customerName}`);
    statusButton.textContent = statusLabels[request.status];
    statusButton.addEventListener('click', () => openStatusModal(request, statusButton));
    status.append(createLabel('Статус'), statusButton);

    const comment = document.createElement('div');
    comment.className = 'cabinet-request-comment';
    const detailsText = requestDetailsLabel(request);
    const details = document.createElement('p');
    details.className = 'cabinet-request-details';
    details.textContent = detailsText || '—';
    comment.append(createLabel('Комментарий'), details);

    article.append(client, status, comment, dateCell);
    return article;
  };

  const localRequestCounts = () => ({
    all: allRequests.length,
    new: allRequests.filter((request) => request.status === 'new').length,
    in_progress: allRequests.filter((request) => request.status === 'in_progress').length,
    processed: allRequests.filter((request) => request.status === 'processed').length,
    rejected: allRequests.filter((request) => request.status === 'rejected').length
  });

  const updateCounters = () => {
    const counts = requestStats || localRequestCounts();
    metricElements.forEach((element) => {
      element.textContent = counts[element.dataset.metric] ?? 0;
    });
    sidebarCounts.forEach((element) => {
      element.textContent = counts[element.dataset.sidebarCount] ?? 0;
    });
  };

  const filteredRequests = () => allRequests.filter((request) => {
    if (activeFilter !== 'all' && request.status !== activeFilter) return false;
    if (!searchQuery) return true;
    const searchable = normalize(`${request.customerName} ${request.customerPhone} ${request.sourcePath}`);
    return searchable.includes(searchQuery);
  });

  const renderRequests = () => {
    const requests = filteredRequests();
    requestList.replaceChildren(...requests.map(createRequestCard));
    requestTable.hidden = requests.length === 0;
    emptyState.hidden = requests.length !== 0;
    dashboardStatus.textContent = requests.length ? `Показано заявок: ${requests.length}` : '';
    updateCounters();
  };

  const setFilter = (filter) => {
    activeFilter = filter;
    filterButtons.forEach((button) => button.classList.toggle('is-active', button.dataset.filter === filter));
    sidebarFilterButtons.forEach((button) => button.classList.toggle('is-active', button.dataset.sidebarFilter === filter));
    summaryFilterButtons.forEach((button) => button.classList.toggle('is-active', button.dataset.summaryFilter === filter));
    renderRequests();
  };

  const setAuthenticated = (agent) => {
    document.body.classList.add('is-authenticated');
    loginView.hidden = true;
    dashboard.hidden = false;
    agentName.textContent = agent.displayName;
    agentCity.textContent = `${cityLabels[agent.citySlug] || agent.citySlug} · ${agent.address}`;
    agentInitial.textContent = agent.displayName.trim().charAt(0).toLocaleUpperCase('ru-RU') || 'А';
    window.clearInterval(refreshTimer);
    refreshTimer = window.setInterval(() => loadRequests(false), autoRefreshInterval);
  };

  const setLoggedOut = () => {
    document.body.classList.remove('is-authenticated');
    if (!statusModal.hidden) closeStatusModal();
    window.clearInterval(refreshTimer);
    dashboard.hidden = true;
    loginView.hidden = false;
    allRequests = [];
    requestStats = null;
    requestList.replaceChildren();
    requestSearch.value = '';
    searchQuery = '';
  };

  const loadRequests = async (announce = true) => {
    if (requestsLoading) return;
    requestsLoading = true;
    if (announce) dashboardStatus.textContent = 'Обновляем список…';
    try {
      const data = await apiRequest('/api/agent/callback-requests?status=all');
      allRequests = data.requests;
      requestStats = data.stats || null;
      renderRequests();
    } catch (error) {
      if (error.status === 401) {
        setLoggedOut();
        loginStatus.textContent = 'Сессия завершена. Войдите снова.';
        return;
      }
      dashboardStatus.textContent = error.message;
    } finally {
      requestsLoading = false;
    }
  };

  const updateStatus = async (id, status, details) => {
    dashboardStatus.textContent = 'Сохраняем статус…';
    try {
      const data = await apiRequest(`/api/agent/callback-requests/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status, details })
      });
      const index = allRequests.findIndex((request) => request.id === id);
      if (index >= 0) allRequests[index] = data.request;
      requestStats = null;
      closeStatusModal();
      renderRequests();
      await loadRequests(false);
      dashboardStatus.textContent = 'Статус сохранён.';
      return true;
    } catch (error) {
      statusError.textContent = error.message;
      return false;
    }
  };

  const configureStatusFields = (nextStatus) => {
    pendingStatusChange.nextStatus = nextStatus;
    statusDescription.textContent = statusDescriptions[nextStatus];
    statusFieldGroups.forEach((group) => {
      const inactive = group.dataset.statusFields !== nextStatus;
      group.hidden = inactive;
      group.querySelectorAll('input, textarea').forEach((control) => {
        control.disabled = inactive;
      });
    });
    followUpDateField.hidden = true;
  };

  function openStatusModal(request, button) {
    pendingStatusChange = { request, button, nextStatus: '' };
    statusForm.reset();
    statusError.textContent = '';
    statusTitle.textContent = `Статус заявки — ${request.customerName}`;
    statusDescription.textContent = 'Выберите новый статус заявки.';
    statusForm.querySelectorAll('input[name="nextStatus"]').forEach((input) => {
      const isCurrent = input.value === request.status;
      input.disabled = isCurrent;
      input.closest('label').classList.toggle('is-current', isCurrent);
    });
    statusFieldGroups.forEach((group) => {
      group.hidden = true;
      group.querySelectorAll('input, textarea').forEach((control) => {
        control.disabled = true;
      });
    });
    followUpDateField.hidden = true;
    const dateInput = statusForm.elements.followUpDate;
    dateInput.min = new Date().toISOString().slice(0, 10);
    statusModal.hidden = false;
    document.body.classList.add('has-cabinet-modal');
    const firstStatus = statusForm.querySelector('input[name="nextStatus"]:not(:disabled)');
    window.setTimeout(() => firstStatus?.focus(), 0);
  }

  function closeStatusModal() {
    pendingStatusChange = null;
    statusModal.hidden = true;
    statusError.textContent = '';
    document.body.classList.remove('has-cabinet-modal');
  }

  const collectStatusDetails = (status) => {
    if (status === 'new') return {};
    if (status === 'in_progress') {
      const reason = statusForm.elements.workReason.value;
      if (!reason) throw new Error('Выберите причину: «Перенесено» или «Недозвон».');
      return {
        reason,
        followUpDate: reason === 'rescheduled' ? statusForm.elements.followUpDate.value || null : null
      };
    }
    if (status === 'processed') {
      const services = [...statusForm.querySelectorAll('input[name="services"]:checked')].map((input) => input.value);
      if (!services.length) throw new Error('Выберите хотя бы одну оказанную услугу.');
      return { services };
    }
    const comment = statusForm.elements.rejectionComment.value.trim();
    if (!comment) throw new Error('Добавьте комментарий с причиной отказа.');
    return { comment };
  };

  statusForm.addEventListener('change', (event) => {
    if (event.target.name === 'nextStatus') {
      configureStatusFields(event.target.value);
    }
    if (event.target.name === 'workReason') {
      followUpDateField.hidden = event.target.value !== 'rescheduled';
      if (followUpDateField.hidden) statusForm.elements.followUpDate.value = '';
    }
  });

  statusForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!pendingStatusChange) return;
    statusError.textContent = '';
    const nextStatus = statusForm.elements.nextStatus.value;
    if (!nextStatus) {
      statusError.textContent = 'Выберите новый статус заявки.';
      return;
    }
    let details;
    try {
      details = collectStatusDetails(nextStatus);
    } catch (error) {
      statusError.textContent = error.message;
      return;
    }
    const submitButton = statusForm.querySelector('[type="submit"]');
    submitButton.disabled = true;
    await updateStatus(pendingStatusChange.request.id, nextStatus, details);
    submitButton.disabled = false;
  });

  statusCancelButtons.forEach((button) => button.addEventListener('click', closeStatusModal));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !statusModal.hidden) closeStatusModal();
  });

  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    loginStatus.textContent = 'Входим…';
    const formData = new FormData(loginForm);
    try {
      const data = await apiRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ login: formData.get('login'), password: formData.get('password') })
      });
      csrfToken = data.token;
      loginForm.reset();
      loginStatus.textContent = '';
      setAuthenticated(data.agent);
      await loadRequests();
    } catch (error) {
      loginStatus.textContent = error.message;
    }
  });

  logoutButtons.forEach((button) => {
    button.addEventListener('click', async () => {
      try {
        await apiRequest('/api/auth/logout', { method: 'POST' });
        setLoggedOut();
        await fetchCsrf();
      } catch (error) {
        dashboardStatus.textContent = error.message;
      }
    });
  });

  filterButtons.forEach((button) => {
    button.addEventListener('click', () => setFilter(button.dataset.filter));
  });
  sidebarFilterButtons.forEach((button) => {
    button.addEventListener('click', () => setFilter(button.dataset.sidebarFilter));
  });
  summaryFilterButtons.forEach((button) => {
    button.addEventListener('click', () => setFilter(button.dataset.summaryFilter));
  });
  requestSearch.addEventListener('input', () => {
    searchQuery = normalize(requestSearch.value);
    renderRequests();
  });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && !dashboard.hidden) loadRequests(false);
  });

  const formattedCurrentDate = new Intl.DateTimeFormat('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  }).format(new Date());
  currentDate.textContent = formattedCurrentDate.charAt(0).toLocaleUpperCase('ru-RU') + formattedCurrentDate.slice(1);

  const bootstrap = async () => {
    try {
      await fetchCsrf();
      const data = await apiRequest('/api/auth/me');
      setAuthenticated(data.agent);
      await loadRequests();
    } catch (error) {
      if (error.status !== 401) loginStatus.textContent = 'Сервис временно недоступен.';
      setLoggedOut();
    }
  };

  bootstrap();
})();
