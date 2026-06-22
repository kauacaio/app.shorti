/* =====================================================
   app/sentry.js — Instrumentação Sentry (breadcrumbs + eventos)
   ===================================================== */

const SLog = {

  /* ── Breadcrumb genérico ───────────────────────────── */
  crumb(category, message, data = {}, level = 'info') {
    if (!window.Sentry) return;
    Sentry.addBreadcrumb({ category, message, data, level, timestamp: Date.now() / 1000 });
  },

  /* ── Captura evento explícito (aparece na lista do Sentry) ── */
  event(message, data = {}, level = 'info') {
    if (!window.Sentry) return;
    Sentry.captureMessage(message, { level, extra: data });
  },

  /* ── Auth ──────────────────────────────────────────── */
  loginOk(email, tenant) {
    if (!window.Sentry) return;
    Sentry.setUser({ email });
    if (tenant) Sentry.setTag('tenant', tenant);
    this.crumb('auth', 'Login bem-sucedido', { email, tenant }, 'info');
  },

  loginFail(email, reason) {
    if (!window.Sentry) return;
    this.crumb('auth', 'Falha no login', { email, reason }, 'warning');
    this.event('Login falhou', { email, reason }, 'warning');
  },

  logout(email) {
    if (!window.Sentry) return;
    this.crumb('auth', 'Logout', { email }, 'info');
    Sentry.setUser(null);
  },

  workspaceSelected(slug, nome) {
    this.crumb('auth', 'Workspace selecionado', { slug, nome }, 'info');
    if (window.Sentry) Sentry.setTag('tenant', slug);
  },

  sessionExpired() {
    this.crumb('auth', 'Sessão expirada — redirecionando para login', {}, 'warning');
    this.event('Sessão expirada', {}, 'warning');
  },

  /* ── Navegação ─────────────────────────────────────── */
  page(name) {
    this.crumb('navigation', `Navegou para ${name}`, { page: name });
  },

  /* ── Erros de negócio ──────────────────────────────── */
  err(context, error) {
    if (!window.Sentry) return;
    Sentry.captureException(error instanceof Error ? error : new Error(String(error)), {
      tags: { context }
    });
  }
};
