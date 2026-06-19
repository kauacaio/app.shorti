/* =====================================================
   app/tour.js — Tour guiado do Shorti (Driver.js)
   Opcional: aparece uma vez para usuários novos.
   Pode ser relançado via menu Conta → "Tour do sistema"
   ===================================================== */

const TOUR_KEY = 'srt_tour_done_v1';

/* ── Verifica se deve mostrar automaticamente ─────── */
function initTour() {
  if (localStorage.getItem(TOUR_KEY)) return;
  /* Delay: aguarda o ERP terminar de carregar */
  setTimeout(showTourPrompt, 2200);
}

/* ── Prompt: pergunta se quer o tour ─────────────── */
function showTourPrompt() {
  const el = document.getElementById('tour-prompt');
  if (!el) return;
  el.classList.add('on');
}

function dismissTourPrompt() {
  const el = document.getElementById('tour-prompt');
  if (el) el.classList.remove('on');
  localStorage.setItem(TOUR_KEY, '1');
}

function acceptTour() {
  dismissTourPrompt();
  startTour();
}

/* ── Tour principal ───────────────────────────────── */
async function startTour() {
  /* Driver.js v1 IIFE: this.driver.js.driver() — o ponto no nome do pacote cria a cadeia */
  const driverFn = window?.driver?.js?.driver;

  if (typeof driverFn !== 'function') {
    showToast('Tour não disponível. Recarregue a página.', '');
    return;
  }

  /* Garante que começa no dashboard */
  epage('dashboard', document.querySelector('.nav-link'));

  await new Promise(r => setTimeout(r, 300));

  const driverObj = driverFn({
    animate: true,
    smoothScroll: true,
    allowClose: true,
    overlayColor: 'rgba(15,23,42,.7)',
    stagePadding: 8,
    popoverClass: 'srt-tour-pop',
    nextBtnText: 'Próximo →',
    prevBtnText: '← Voltar',
    doneBtnText: 'Concluir ✓',
    onDestroyStarted: () => {
      localStorage.setItem(TOUR_KEY, '1');
      driverObj.destroy();
    },
    steps: [
      {
        element: '#ep-dashboard',
        popover: {
          title: '👋 Bem-vindo ao Shorti!',
          description: 'Este é o seu painel principal. Aqui você acompanha as vendas, o faturamento e os alertas do dia em tempo real.',
          side: 'right', align: 'start'
        }
      },
      {
        element: '#mgrid',
        popover: {
          title: '📊 Métricas do mês',
          description: 'Faturamento, pedidos, ticket médio e estoque — sempre atualizados. Clique em qualquer card para ver mais detalhes.',
          side: 'bottom', align: 'start'
        }
      },
      {
        element: '.dash-greeting-actions',
        popover: {
          title: '⚡ Ações rápidas',
          description: 'Acesse o extrato mensal ou inicie uma nova venda diretamente daqui.',
          side: 'left', align: 'start'
        }
      },
      {
        element: '.nav-link[title="Nova Venda"]',
        popover: {
          title: '🛒 Nova venda',
          description: 'Registre uma venda rapidamente: escolha o produto, a quantidade e o meio de pagamento. Tem scanner de código de barras integrado!',
          side: 'right', align: 'start',
          onNextClick: () => {
            epage('estoque', document.querySelector('.nav-link[title="Estoque"]'));
            setTimeout(() => driverObj.moveNext(), 400);
          }
        }
      },
      {
        element: '.nav-link[title="Estoque"]',
        popover: {
          title: '📦 Estoque',
          description: 'Cadastre produtos, controle quantidades e receba alertas quando o estoque estiver baixo. Pode fazer tudo pelo celular também.',
          side: 'right', align: 'start',
          onNextClick: () => {
            epage('clientes', document.querySelector('.nav-link[title="Clientes"]'));
            setTimeout(() => driverObj.moveNext(), 400);
          }
        }
      },
      {
        element: '.nav-link[title="Clientes"]',
        popover: {
          title: '👥 Clientes',
          description: 'Histórico de compras, controle de fiados e perfil completo de cada cliente. Quem comprou mais? Quem está em débito? Tudo aqui.',
          side: 'right', align: 'start',
          onNextClick: () => {
            epage('financeiro', document.querySelector('.nav-link[title="Financeiro"]'));
            setTimeout(() => driverObj.moveNext(), 400);
          }
        }
      },
      {
        element: '.nav-link[title="Financeiro"]',
        popover: {
          title: '💰 Financeiro',
          description: 'Lançamentos de receitas e despesas, fluxo de caixa e controle do que ainda vai entrar. Tudo em um só lugar.',
          side: 'right', align: 'start',
          onNextClick: () => {
            epage('loja', document.querySelector('.nav-link[title="Configurar loja"]'));
            setTimeout(() => driverObj.moveNext(), 400);
          }
        }
      },
      {
        element: '.nav-link[title="Configurar loja"]',
        popover: {
          title: '🛍️ Sua loja pública',
          description: 'Configure e publique sua loja online. Personalize cores, produtos em destaque, banner e formas de pagamento. Cada loja tem um link próprio para compartilhar.',
          side: 'right', align: 'start',
          onNextClick: () => {
            epage('dashboard', document.querySelector('.nav-link'));
            setTimeout(() => driverObj.moveNext(), 400);
          }
        }
      },
      {
        element: '#tb-usr-btn',
        popover: {
          title: '⚙️ Sua conta',
          description: 'Acesse as configurações, altere seu nome, configure o WhatsApp e o Pix, e ative a biometria para destravar o app rapidamente.',
          side: 'bottom', align: 'end'
        }
      },
      {
        element: '#ep-dashboard',
        popover: {
          title: '✅ Você está pronto!',
          description: 'O Shorti foi feito pra quem não para. Qualquer dúvida, o tour pode ser feito novamente pelo menu da conta. Boas vendas! 🚀',
          side: 'over', align: 'center'
        }
      }
    ]
  });

  driverObj.drive();
}

/* ── Relançar o tour (chamado pelo menu) ──────────── */
function restartTour() {
  localStorage.removeItem(TOUR_KEY);
  closeTbMenu();
  startTour();
}
