const API = {
  base: window.location.port === '3001' ? '' : 'http://localhost:3001',

  async request(method, url, body) {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(this.base + url, opts);
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
  },

  async get(url) { return this.request('GET', url); },
  async post(url, data) { return this.request('POST', url, data); },
  async put(url, data) { return this.request('PUT', url, data); },
  async del(url) { return this.request('DELETE', url); },

  // Members
  getMembers() { return this.get('/api/members'); },
  createMember(data) { return this.post('/api/members', data); },
  updateMember(id, data) { return this.put('/api/members/' + encodeURIComponent(id), data); },
  deleteMember(id) { return this.del('/api/members/' + encodeURIComponent(id)); },

  // Payments
  getPayments() { return this.get('/api/payments'); },
  createPayment(data) { return this.post('/api/payments', data); },
  deletePayment(txnId) { return this.del('/api/payments/' + encodeURIComponent(txnId)); },

  // Settings
  getSettings() { return this.get('/api/settings'); },
  saveSettings(data) { return this.put('/api/settings', data); },

  // Status
  getStatus() { return this.get('/api/status'); },

  // Trainers
  getTrainers() { return this.get('/api/trainers'); },
  createTrainer(data) { return this.post('/api/trainers', data); },
  deleteTrainer(id) { return this.del('/api/trainers/' + encodeURIComponent(id)); }
};
