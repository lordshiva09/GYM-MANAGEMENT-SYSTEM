const API = {
  base: import.meta.env.VITE_API_BASE || '',
  token: localStorage.getItem('rsgym_token') || null,

  setToken(token) {
    this.token = token;
    if (token) {
      localStorage.setItem('rsgym_token', token);
    } else {
      localStorage.removeItem('rsgym_token');
    }
  },

  getToken() {
    return this.token || localStorage.getItem('rsgym_token');
  },

  async request(method, url, body) {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    const token = this.getToken();
    if (token) {
      opts.headers['Authorization'] = `Bearer ${token}`;
    }
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(this.base + url, opts);
    if (res.status === 401 || res.status === 403) {
      this.setToken(null);
      localStorage.removeItem('rsgym_session');
      localStorage.removeItem('rsgym_token');
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: `API error: ${res.status}` }));
      throw new Error(err.error || `API error: ${res.status}`);
    }
    return res.json();
  },

  async get(url) { return this.request('GET', url); },
  async post(url, data) { return this.request('POST', url, data); },
  async put(url, data) { return this.request('PUT', url, data); },
  async del(url) { return this.request('DELETE', url); },

  login(memberId, password) { return this.post('/api/auth/login', { memberId, password }); },
  setupAdmin(memberId, name, password) { return this.post('/api/auth/setup-admin', { memberId, name, password }); },
  getSetupStatus() { return this.get('/api/auth/setup-status'); },
  changePassword(currentPassword, newPassword) { return this.post('/api/auth/change-password', { currentPassword, newPassword }); },

  getMembers() { return this.get('/api/members'); },
  createMember(data) { return this.post('/api/members', data); },
  updateMember(id, data) { return this.put('/api/members/' + encodeURIComponent(id), data); },
  deleteMember(id) { return this.del('/api/members/' + encodeURIComponent(id)); },

  getPayments() { return this.get('/api/payments'); },
  createPayment(data) { return this.post('/api/payments', data); },
  deletePayment(txnId) { return this.del('/api/payments/' + encodeURIComponent(txnId)); },

  getSettings() { return this.get('/api/settings'); },
  saveSettings(data) { return this.put('/api/settings', data); },

  getStatus() { return this.get('/api/status'); },

  getTrainers() { return this.get('/api/trainers'); },
  createTrainer(data) { return this.post('/api/trainers', data); },
  deleteTrainer(id) { return this.del('/api/trainers/' + encodeURIComponent(id)); }
};

window.API = API;
