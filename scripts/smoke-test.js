import assert from 'node:assert/strict';

const baseUrl = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:4174';
const login = process.env.SMOKE_LOGIN || '';
const password = process.env.SMOKE_PASSWORD || '';
const agentName = process.env.SMOKE_AGENT_NAME || '';

if (!login || !password || !agentName) {
  throw new Error('Set SMOKE_LOGIN, SMOKE_PASSWORD and SMOKE_AGENT_NAME.');
}

const cookieFrom = (response) => {
  const values = typeof response.headers.getSetCookie === 'function'
    ? response.headers.getSetCookie()
    : [response.headers.get('set-cookie')].filter(Boolean);
  return values.map((value) => value.split(';', 1)[0]).join('; ');
};

const requestJson = async (path, options = {}) => {
  const response = await fetch(`${baseUrl}${path}`, options);
  const data = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new Error(`${response.status}: ${data?.error || 'Request failed'}`);
  return { response, data };
};

const health = await requestJson('/api/health');
assert.equal(health.data.status, 'ok');

const publicAgents = await requestJson('/api/public/agents?city=berdyansk');
const agent = publicAgents.data.agents.find((item) => item.displayName === agentName);
assert.ok(agent, 'Test agent was not returned by public API.');

const clientCsrfResponse = await requestJson('/api/csrf');
const clientCookie = cookieFrom(clientCsrfResponse.response);
const callback = await requestJson('/api/callback-requests', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Cookie: clientCookie,
    'X-CSRF-Token': clientCsrfResponse.data.token
  },
  body: JSON.stringify({
    agentId: agent.id,
    name: 'Тестовый клиент',
    phone: '+7 000 000-00-00',
    consent: true,
    sourcePath: '/berdyansk/'
  })
});
assert.equal(callback.data.message, 'Заявка отправлена агенту.');

const agentCsrfResponse = await requestJson('/api/csrf');
const initialAgentCookie = cookieFrom(agentCsrfResponse.response);
const loginResponse = await requestJson('/api/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Cookie: initialAgentCookie,
    'X-CSRF-Token': agentCsrfResponse.data.token
  },
  body: JSON.stringify({ login, password })
});
const authenticatedCookie = cookieFrom(loginResponse.response) || initialAgentCookie;
assert.equal(loginResponse.data.agent.displayName, agentName);

const requests = await requestJson('/api/agent/callback-requests?status=new', {
  headers: { Cookie: authenticatedCookie }
});
const createdRequest = requests.data.requests.find((item) => item.id === callback.data.id);
assert.ok(createdRequest, 'Created callback was not returned to the agent.');

const updated = await requestJson(`/api/agent/callback-requests/${createdRequest.id}`, {
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
    Cookie: authenticatedCookie,
    'X-CSRF-Token': loginResponse.data.token
  },
  body: JSON.stringify({
    status: 'in_progress',
    details: { reason: 'no_answer' }
  })
});
assert.equal(updated.data.request.status, 'in_progress');
assert.deepEqual(updated.data.request.statusDetails, { reason: 'no_answer', followUpDate: null });

await requestJson('/api/auth/logout', {
  method: 'POST',
  headers: {
    Cookie: authenticatedCookie,
    'X-CSRF-Token': loginResponse.data.token
  }
});

console.log('Smoke test passed: health, public agent, callback, login, list, status update, logout.');
