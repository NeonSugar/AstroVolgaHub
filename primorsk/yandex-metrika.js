(function setupYandexMetrika() {
  const counterId = 113123799;
  const tagSource = `https://mc.yandex.ru/metrika/tag.js?id=${counterId}`;
  window.YM_COUNTER_ID = counterId;

  (function initializeYandexMetrika(windowObject, documentObject, tagName, source, functionName, script, firstScript) {
    windowObject[functionName] = windowObject[functionName] || function queueYandexMetrikaCall() {
      (windowObject[functionName].a = windowObject[functionName].a || []).push(arguments);
    };
    windowObject[functionName].l = 1 * new Date();

    for (let index = 0; index < documentObject.scripts.length; index += 1) {
      if (documentObject.scripts[index].src === source) return;
    }

    script = documentObject.createElement(tagName);
    firstScript = documentObject.getElementsByTagName(tagName)[0];
    script.async = true;
    script.src = source;
    firstScript.parentNode.insertBefore(script, firstScript);
  })(window, document, 'script', tagSource, 'ym');

  window.ym(counterId, 'init', {
    ssr: true,
    webvisor: true,
    clickmap: true,
    ecommerce: 'dataLayer',
    referrer: document.referrer,
    url: location.href,
    accurateTrackBounce: true,
    trackLinks: true
  });

  document.addEventListener('DOMContentLoaded', () => {
    const sendGoal = (goalName, params) => {
      if (typeof window.ym === 'function') window.ym(counterId, 'reachGoal', goalName, params || {});
    };

    document.addEventListener('click', (event) => {
      const targetLink = event.target.closest('a');
      if (!targetLink) return;

      const href = targetLink.href || '';

      if (href.includes('t.me/astro_volga_zo')) sendGoal('telegram_click');
      if (href.includes('max.ru/channel_astrovolga_zo')) sendGoal('max_click');

      if (targetLink.classList.contains('agent-map-link')) {
        sendGoal('go_to_map_click');
      }

      if (href.startsWith('tel:')) sendGoal('phone_click');
    });

    document.addEventListener('submit', (event) => {
      if (event.target.tagName.toLowerCase() === 'form') sendGoal('form_submit');
    });
  });
})();

