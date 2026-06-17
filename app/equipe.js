/* =====================================================
   app/equipe.js — Gestão de equipe por tenant
   NOTA: Este arquivo não é carregado diretamente no erp.html.
   A lógica foi migrada para o modal cfg-modal (inline em erp.html).
   Mantido como referência e para compatibilidade futura.
   ===================================================== */

async function rEquipe() {
  const wrap = $('equipe-list');
  if (!wrap) return;
  wrap.innerHTML = '<p class="equipe-loading">Carregando…</p>';

  const isAdmin = window._tenantRole === 'admin';
  const invBtn  = $('equipe-invite-btn');
  if (invBtn) invBtn.style.display = isAdmin ? '' : 'none';

  try {
    const members = await SBTeam.list(window._tenant?.id);
    if (!members.length) {
      wrap.innerHTML = '<p class="equipe-empty">Nenhum membro ainda.</p>';
      return;
    }
    wrap.innerHTML = members.map(m => `
      <div class="equipe-card" data-id="${m.id}">
        <div class="equipe-av">${(m.nome || '?')[0].toUpperCase()}</div>
        <div class="equipe-info">
          <div class="equipe-nome">${esc(m.nome || 'Sem nome')}</div>
          <div class="equipe-role ${m.role}">${m.role === 'admin' ? 'Admin' : 'Funcionário'}</div>
        </div>
        ${isAdmin ? `
        <div class="equipe-actions">
          <button class="equipe-role-btn" title="Alterar cargo"
            onclick="toggleMemberRole('${m.id}','${m.role}')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="equipe-del-btn" title="Remover"
            onclick="removeMember('${m.id}')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
          </button>
        </div>` : ''}
      </div>
    `).join('');
  } catch(e) {
    wrap.innerHTML = `<p class="equipe-empty" style="color:var(--err)">Erro: ${esc(e.message)}</p>`;
  }
}

async function toggleMemberRole(id, currentRole) {
  const newRole = currentRole === 'admin' ? 'funcionario' : 'admin';
  try {
    await SBTeam.updateRole(id, window._tenant?.id, newRole);
    showToast(`Cargo alterado para ${newRole === 'admin' ? 'Admin' : 'Funcionário'}`, 'ok');
    rEquipe();
  } catch(e) { showToast(e.message, 'err'); }
}

async function removeMember(id) {
  if (!confirm('Remover este membro do painel?')) return;
  try {
    await SBTeam.remove(id, window._tenant?.id);
    showToast('Membro removido', 'ok');
    rEquipe();
  } catch(e) { showToast(e.message, 'err'); }
}

/* Modal de convite */
function openEquipeInvite() {
  $('inv-email').value = '';
  $('inv-nome').value  = '';
  $('inv-role').value  = 'funcionario';
  $('inv-alert').style.display = 'none';
  openMod('mod-equipe-invite');
}

async function sendEquipeInvite() {
  const email = $('inv-email')?.value?.trim();
  const nome  = $('inv-nome')?.value?.trim();
  const role  = $('inv-role')?.value || 'funcionario';
  const alert = $('inv-alert');

  if (!email) { alert.textContent = 'Informe o e-mail.'; alert.style.display = 'block'; return; }

  const btn = $('inv-send-btn');
  btn.disabled = true; btn.classList.add('ld');
  alert.style.display = 'none';

  try {
    await SBTeam.invite({ email, nome, role, tenantId: window._tenant?.id });
    btn.disabled = false; btn.classList.remove('ld');
    showToast('Convite enviado ✓', 'ok');
    closeMod('mod-equipe-invite');
    rEquipe();
  } catch(e) {
    btn.disabled = false; btn.classList.remove('ld');
    alert.textContent = e.message;
    alert.style.display = 'block';
  }
}
