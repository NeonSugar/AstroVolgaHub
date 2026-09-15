export const normalizeLogin = (value) => String(value || '').trim().toLowerCase();

export const validateAgentLogin = (value) => {
  const login = normalizeLogin(value);
  return /^[a-z0-9._@-]{3,120}$/.test(login) ? login : null;
};

export const isUuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  .test(String(value || ''));

export const normalizeAddress = (value) => String(value || '')
  .toLocaleLowerCase('ru-RU')
  .replace(/ё/g, 'е')
  .replace(/\([^)]*\)/g, '')
  .replace(/^ул\.?\s*/g, '')
  .replace(/^пр(?:оспект|-т|-кт)\s*/g, '')
  .replace(/^мел\.?\s*шоссе/g, 'мелитопольское шоссе')
  .replace(/[^а-яa-z0-9/]+/g, '');

export const normalizePhone = (value) => {
  let digits = String(value || '').replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('8')) digits = `7${digits.slice(1)}`;
  if (digits.length === 10) digits = `7${digits}`;
  return digits;
};

export const validateCustomerName = (value) => {
  const name = String(value || '').trim().replace(/\s+/g, ' ');
  return name.length >= 2 && name.length <= 80 ? name : null;
};

export const validateCustomerPhone = (value) => {
  const phone = normalizePhone(value);
  return phone.length >= 10 && phone.length <= 15 ? phone : null;
};

export const validateSourcePath = (value) => {
  const sourcePath = String(value || '').trim();
  if (!sourcePath.startsWith('/') || sourcePath.length > 255) return null;
  return sourcePath;
};

export const callbackStatuses = new Set(['new', 'in_progress', 'processed', 'rejected']);

export const callbackWorkReasons = new Set(['rescheduled', 'no_answer']);
export const callbackServices = new Set(['osago', 'kasko', 'health', 'property', 'other']);

export const validateCallbackStatusDetails = (status, value) => {
  const details = value && typeof value === 'object' && !Array.isArray(value) ? value : {};

  if (status === 'new') return {};

  if (status === 'in_progress') {
    const reason = String(details.reason || '');
    if (!callbackWorkReasons.has(reason)) return null;
    const followUpDate = String(details.followUpDate || '');
    if (followUpDate && !/^\d{4}-\d{2}-\d{2}$/.test(followUpDate)) return null;
    return {
      reason,
      followUpDate: reason === 'rescheduled' && followUpDate ? followUpDate : null
    };
  }

  if (status === 'processed') {
    const services = [...new Set(Array.isArray(details.services) ? details.services.map(String) : [])];
    if (!services.length || services.some((service) => !callbackServices.has(service))) return null;
    return { services };
  }

  if (status === 'rejected') {
    const comment = String(details.comment || '').trim().replace(/\s+/g, ' ');
    if (!comment || comment.length > 1000) return null;
    return { comment };
  }

  return null;
};
