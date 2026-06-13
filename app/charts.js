/* =====================================================
   app/charts.js — Gráficos Chart.js:
   dashboard (faturamento + categorias), financeiro,
   relatórios
   ===================================================== */

let _c = {};
function dc(id) { if (_c[id]) { _c[id].destroy(); delete _c[id]; } }

const ca = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      labels: {
        font: { family: 'Inter', size: 12, weight: '500' },
        color: '#6B7280',
        padding: 16,
        usePointStyle: true,
        pointStyleWidth: 8,
      }
    },
    tooltip: {
      backgroundColor: '#111827',
      titleColor: '#F9FAFB',
      bodyColor: '#9CA3AF',
      padding: 12,
      cornerRadius: 10,
      titleFont: { family: 'Inter', size: 13, weight: '600' },
      bodyFont:  { family: 'Inter', size: 12 },
      displayColors: false,
    }
  },
  scales: {
    x: {
      border: { display: false },
      grid: { display: false },
      ticks: { color: '#9CA3AF', font: { size: 12, family: 'Inter' }, maxRotation: 0 }
    },
    y: {
      border: { display: false },
      grid: { color: '#F3F4F6', lineWidth: 1 },
      ticks: { color: '#9CA3AF', font: { size: 12, family: 'Inter' } }
    }
  }
};

function _lastMonths(n) {
  const now = new Date(), ym = [], lb = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    ym.push(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'));
    lb.push(d.toLocaleString('pt-BR', { month: 'short' }).replace('.', ''));
  }
  return { ym, lb };
}

function rDashCharts() {
  dc('fat'); dc('cat');
  const cf = $('ch-fat'), cc = $('ch-cat');

  if (cf) {
    const { ym, lb } = _lastMonths(6);
    const data = ym.map(m => DB.peds.filter(p => p.dt?.startsWith(m)).reduce((a,b) => a+b.tot, 0));
    const ctx = cf.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, 220);
    grad.addColorStop(0, 'rgba(37,99,235,.18)');
    grad.addColorStop(1, 'rgba(37,99,235,0)');
    _c.fat = new Chart(cf, {
      type: 'line',
      data: {
        labels: lb,
        datasets: [{
          label: 'Faturamento',
          data,
          borderColor: '#2563EB',
          backgroundColor: grad,
          fill: true,
          tension: 0.45,
          borderWidth: 2.5,
          pointRadius: 5,
          pointBackgroundColor: '#fff',
          pointBorderColor: '#2563EB',
          pointBorderWidth: 2.5,
          pointHoverRadius: 7,
        }]
      },
      options: {
        ...ca,
        plugins: {
          ...ca.plugins,
          legend: { display: false },
          tooltip: {
            ...ca.plugins.tooltip,
            callbacks: { label: ctx => ' ' + brl(ctx.parsed.y) }
          }
        },
        scales: {
          x: { ...ca.scales.x },
          y: {
            ...ca.scales.y,
            ticks: {
              ...ca.scales.y.ticks,
              callback: v => v === 0 ? '' : 'R$' + (v >= 1000 ? (v/1000).toFixed(0)+'k' : v)
            }
          }
        }
      }
    });
  }

  if (cc) {
    const cats      = ['pele','maquiagem','corpo','fragrancias'];
    const catLabels = ['Skincare','Maquiagem','Corpo','Fragrâncias'];
    const catColors = ['#2563EB','#7C3AED','#059669','#EA580C'];
    const catData   = cats.map(cat => {
      const names = new Set(DB.prods.filter(p => p.cat === cat).map(p => p.nm));
      return DB.peds.reduce((a,p) => {
        if (p.itens) return a + p.itens.filter(i => names.has(i.nm)).reduce((s,i) => s+i.q, 0);
        return names.has(p.prod) ? a + p.q : a;
      }, 0);
    });
    const hasData = catData.some(v => v > 0);
    _c.cat = new Chart(cc, {
      type: 'doughnut',
      data: {
        labels: catLabels,
        datasets: [{
          data: hasData ? catData : [1,1,1,1],
          backgroundColor: catColors,
          borderWidth: 3,
          borderColor: '#fff',
          hoverOffset: 6,
        }]
      },
      options: {
        ...ca,
        cutout: '68%',
        plugins: {
          legend: {
            position: 'right',
            labels: {
              font: { family: 'Inter', size: 12, weight: '500' },
              color: '#374151', padding: 16,
              usePointStyle: true, pointStyleWidth: 10,
            }
          },
          tooltip: {
            ...ca.plugins.tooltip,
            callbacks: { label: ctx => `  ${ctx.label}: ${ctx.parsed} vendas` }
          }
        }
      }
    });
  }
}

function rFlxChart() {
  dc('flx');
  const c = $('ch-flx');
  if (!c) return;
  const { ym, lb } = _lastMonths(6);
  const rec = ym.map(m => DB.trans.filter(t => t.tp==='receita' && t.dt?.startsWith(m)).reduce((a,b) => a+b.vl, 0));
  const des = ym.map(m => DB.trans.filter(t => t.tp==='despesa' && t.dt?.startsWith(m)).reduce((a,b) => a+b.vl, 0));
  const ctx = c.getContext('2d');
  const gRec = ctx.createLinearGradient(0,0,0,220);
  gRec.addColorStop(0, 'rgba(5,150,105,.18)'); gRec.addColorStop(1, 'rgba(5,150,105,0)');
  const gDes = ctx.createLinearGradient(0,0,0,220);
  gDes.addColorStop(0, 'rgba(220,38,38,.14)'); gDes.addColorStop(1, 'rgba(220,38,38,0)');
  _c.flx = new Chart(c, {
    type: 'line',
    data: { labels: lb, datasets: [
      { label: 'Receita', data: rec, borderColor: '#059669', backgroundColor: gRec, fill: true, tension: 0.45, borderWidth: 2.5, pointRadius: 4, pointBackgroundColor: '#fff', pointBorderColor: '#059669', pointBorderWidth: 2 },
      { label: 'Despesa', data: des, borderColor: '#DC2626', backgroundColor: gDes, fill: true, tension: 0.45, borderWidth: 2.5, pointRadius: 4, pointBackgroundColor: '#fff', pointBorderColor: '#DC2626', pointBorderWidth: 2 }
    ]},
    options: {
      ...ca,
      plugins: {
        ...ca.plugins,
        tooltip: {
          ...ca.plugins.tooltip,
          callbacks: { label: ctx => ` ${ctx.dataset.label}: ${brl(ctx.parsed.y)}` }
        }
      },
      scales: {
        x: { ...ca.scales.x },
        y: { ...ca.scales.y, ticks: { ...ca.scales.y.ticks, callback: v => v === 0 ? '' : 'R$'+(v>=1000?(v/1000).toFixed(0)+'k':v) } }
      }
    }
  });
}

function rRel() {
  setTimeout(() => {
    dc('top'); dc('dia');
    const c1 = $('ch-top'), c2 = $('ch-dia');
    const mnNames = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

    if (c1) {
      const counts = {};
      DB.peds.forEach(p => { counts[p.prod] = (counts[p.prod] || 0) + p.q; });
      const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
      if (sorted.length) {
        _c.top = new Chart(c1, { type: 'bar', data: { labels: sorted.map(([nm]) => nm.length > 18 ? nm.slice(0, 16) + '…' : nm), datasets: [{ label: 'Vendas', data: sorted.map(([, v]) => v), backgroundColor: '#24605a', borderRadius: 6 }] }, options: { ...ca, indexAxis: 'y' } });
      }
    }

    if (c2) {
      const days = [0, 0, 0, 0, 0, 0, 0];
      DB.peds.forEach(p => { if (p.dt) days[new Date(p.dt + 'T12:00:00').getDay()]++; });
      _c.dia = new Chart(c2, { type: 'bar', data: { labels: ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'], datasets: [{ label: 'Pedidos', data: days, backgroundColor: '#5f7d78', borderRadius: 6 }] }, options: { ...ca } });
    }

    const { ym } = _lastMonths(6);
    if ($('ratt')) {
      $('ratt').innerHTML = ym.map(m => {
        const pedsMes = DB.peds.filter(p => p.dt?.startsWith(m));
        const fat = pedsMes.reduce((a, b) => a + b.tot, 0);
        const n   = new Set(pedsMes.map(p => p.cid)).size;
        const qtd = pedsMes.length;
        const [y, mo] = m.split('-');
        return `<tr><td>${mnNames[parseInt(mo) - 1]} ${y}</td><td>${qtd}</td><td>${brl(fat)}</td><td>${brl(qtd ? fat / qtd : 0)}</td><td>${n}</td><td><span class="xb ${fat > 0 ? 'xb-green' : 'xb-gray'}">${fat > 0 ? 'Com vendas' : 'Sem vendas'}</span></td></tr>`;
      }).join('');
    }
  }, 80);
}
