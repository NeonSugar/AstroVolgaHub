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
})(window, document, 'script', 'https://mc.yandex.ru/metrika/tag.js?id=112953289', 'ym');

ym(112953289, 'init', {
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
  const counterId = 112953289;

  const sendGoal = (goalName, params) => {
    if (typeof ym === 'function') ym(counterId, 'reachGoal', goalName, params || {});
  };

  document.addEventListener('click', (event) => {
    const targetLink = event.target.closest('a');
    if (!targetLink) return;

    const href = targetLink.href || '';

    if (href.includes('t.me/astro_volga_zo')) sendGoal('telegram_click');
    if (href.includes('max.ru/channel_astrovolga_zo')) sendGoal('max_click');

    if (targetLink.id && targetLink.id.startsWith('map-')) {
      const city = targetLink.getAttribute('data-city') || targetLink.id.replace('map-', '');
      sendGoal('map_city_click', { city });
    }

    if (targetLink.classList.contains('city-card')) {
      const city = targetLink.getAttribute('data-city') || 'unknown';
      sendGoal('city_card_click', { city });
    }

    if (href.startsWith('tel:')) sendGoal('phone_click');
  });

  document.addEventListener('submit', (event) => {
    if (event.target.tagName.toLowerCase() === 'form') sendGoal('form_submit');
  });
});
