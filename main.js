 let dadosFppOriginais = [];



window.addEventListener('DOMContentLoaded', () => {
  fetch('fpp.csv')
    .then(response => response.text())
    .then(data => {
      const workbook = XLSX.read(data, { type: 'string' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(sheet, { defval: 0 }).map(row => {
        const cleanRow = {};

        for (let key in row) {
          let val = row[key];
          if (typeof val === 'string') {
            try {
              val = decodeURIComponent(escape(val));
            } catch (e) {}
          }
          cleanRow[key] = val;
        }

        if ('TARGERT' in cleanRow && !('TARGET' in cleanRow)) {
          cleanRow['TARGET'] = cleanRow['TARGERT'];
          delete cleanRow['TARGERT'];
        }

        return cleanRow;
      });

      dadosFppOriginais = json;
      popularSemanasFpp(json);
      filtrarPorSemanaFpp();
    })
    .catch(error => {
      console.error('❌ Erro ao carregar o CSV:', error);
    });
});



function renderSkuCardPanel(semanaSelecionada) {
  const container = document.getElementById('skuCardWrapper');
  container.innerHTML = '';

  const dados = dadosFppOriginais.filter(d =>
    String(d.PROCESSO).toUpperCase().includes('SKU COM MAIOR IMPACTO') &&
    d.WEEK_VISIVEL === semanaSelecionada &&
    !isNaN(d.DPMO)
  );

  // Agrupar 1 SKU por FC
  const agrupado = {};
  dados.forEach(d => {
    const fc = d.WAREHOUSE_ID;
    if (!agrupado[fc] || d.DPMO > agrupado[fc].DPMO) {
      agrupado[fc] = d;
    }
  });

const topSkus = Object.values(agrupado)
  .sort((a, b) => {
    const valA = parseFloat((a.TARGET || a.TARGERT || 0).toString().replace(',', '.'));
    const valB = parseFloat((b.TARGET || b.TARGERT || 0).toString().replace(',', '.'));
    return valB - valA;
  })
  .slice(0, 4);


  topSkus.forEach(item => {
    const row = document.createElement('div');
    row.className = 'sku-row';
    row.innerHTML = `
<div class="sku-fc">${item.WAREHOUSE_ID}</div>


      <div class="sku-image">
        <img src="${item.Thumbnail}" alt="produto" onerror="this.src='https://http2.mlstatic.com/frontend-assets/ui-navigation/5.21.11/mercadolibre/302f.svg'">
      </div>
      <div class="sku-detail">
        <div class="title">${item.ITEM_TITLE}</div>
        <div><strong>Unidades:</strong> ${parseInt(item.DPMO)}</div>
        <div><strong>Valor agregado:</strong> ${formatarDolar(item.TARGET || item.TARGERT)}</div>


        <div><strong>SKU MELI:</strong> ${item.MELI}</div>
      </div>
    `;
    container.appendChild(row);
  });
}
function getFcForaDoTarget(dados, semana) {
  return dados.filter(item => {
    const isFpp = String(item.PROCESSO || '').toUpperCase().includes("FPP DPMO");
    const isSemana = item.WEEK_VISIVEL === semana;
    const dpmo = parseFloat(item.DPMO);
    const target = parseFloat(item.TARGET);
    return isFpp && isSemana && dpmo > target;
  });
}

function getTopRegistro(dados, processo, semana) {
  const filtrado = dados.filter(z => z.PROCESO === processo && z.WEEK_VISIVEL === semana);
  return filtrado.sort((a, b) => parseFloat(b.TARGERT) - parseFloat(a.TARGERT))[0];
}

function gerarComentarioAutomatico() {
  const semana = document.getElementById("semanaSelectFpp").value;
  const dados = window.dadosFppOriginais || [];
  const fcFora = getFcForaDoTarget(dados, semana);
  const zonaTop = getTopRegistro(dados, "ZONA COM MAIOR IMPACTO", semana);
  const categoriaTop = getTopRegistro(dados, "CATEGORIA COM MAIOR IMPACTO", semana);

  let comentario = `📊 Semana ${semana}\n`;

  if (fcFora.length > 0) {
    comentario += `• FCs fora do target:\n`;
    fcFora.forEach(fc => {
      const site = fc.WAREHOUSE_ID || fc.SITE || fc.FACILITY;
      const dpmo = parseFloat(fc.DPMO);
      const target = parseFloat(fc.TARGET);
      const variacao = (((dpmo - target) / target) * 100).toFixed(1);
      const wow = parseFloat(fc.WOW || 0);
      const wowClass = wow > 0 ? 'wow-vermelho' : 'wow-verde';
      const wowTexto = `${wow > 0 ? '🔺' : '🔻'} ${Math.abs(wow).toFixed(2)}% WoW`;
      comentario += `&nbsp;&nbsp;- <span class="${wowClass}">📍 ${site} — ${wowTexto} | ${variacao}% acima do target</span>\n`;
    });
  }

  if (categoriaTop) {
    comentario += `\n• Categoria com maior impacto: <strong>${categoriaTop.MELI}</strong> (${parseFloat(categoriaTop.TARGERT).toFixed(1)}%)\n`;
  }
  if (zonaTop) {
    comentario += `• Zona de maior impacto: <strong>${zonaTop.MELI}</strong> (${parseFloat(zonaTop.TARGERT).toFixed(1)}%)\n`;
  }

  comentario += "\n\n🔁 Reforce atuação nas zonas e categorias com maior peso e monitore FCs com crescimento WoW elevado.";

  document.getElementById("comentarioGeral").value = comentario;
  salvarComentario();
}
function formatarDolar(valor) {
  if (!valor) return '$0,00';
  let numero = parseFloat(
    typeof valor === 'string' ? valor.replace(',', '.') : valor
  );
  if (isNaN(numero)) numero = 0;
  return numero.toLocaleString('pt-BR', { style: 'currency', currency: 'USD' });
}
function renderZonaImpacto(baseZona) {
  const container = document.getElementById("zonaImpactoContainer");
  container.innerHTML = "";

  const semanaAtual = document.getElementById("semanaSelectFpp").value;

  const zonasFiltradas = baseZona.filter(z => z.PROCESO === "ZONA COM MAIOR IMPACTO" && z.WEEK_VISIVEL === semanaAtual);

  zonasFiltradas.forEach(z => {
    const zonaKey = z.MELI;
    const valor = parseFloat(z.TARGERT).toFixed(1);

    const imgPath = `${zonaKey.toLowerCase().replace(/[^a-z0-9_-]/g, '_')}.png`;

    const card = document.createElement("div");
    card.className = "zona-card";
    card.innerHTML = `
      <img src="${imgPath}" alt="${zonaKey}" class="zona-icon" onerror="this.style.display='none'">
      <div class="zona-info">
        <div><strong>${zonaKey}</strong></div>
        <div class="zona-impacto-percentual">${valor}%</div>
      </div>
    `;
    container.appendChild(card);
  });
}

function gerarComentarioAutomatico() {
  const semana = document.getElementById("semanaSelectFpp").value;
  const zonaCards = document.querySelectorAll(".zona-card");
  const categorias = document.querySelectorAll("#impactoCategoriaContainer .categoria-card");
  const tendencia = document.querySelectorAll("#justificativasContainer .bloco-justificativa");

  let comentario = `📊 Semana ${semana}\n`;

if (tendencia.length) {
  comentario += `• FCs fora do target:\n`;
  tendencia.forEach(bloco => {
    const titulo = bloco.querySelector("div").textContent.trim(); 
    comentario += `  - ${titulo}\n`;
  });
}


  if (categorias.length) {
    const catTop = categorias[0].querySelector("strong").textContent.trim();
    const valor = categorias[0].querySelector(".categoria-info > div:nth-child(2)").textContent.trim();
    comentario += `• Categoria com maior impacto: ${catTop} (${valor})\n`;
  }

  if (zonaCards.length) {
    const zonaTop = zonaCards[0].querySelector("strong").textContent.trim();
    const val = zonaCards[0].querySelector(".zona-impacto-percentual").textContent.trim();
    comentario += `• Zona de maior impacto: ${zonaTop} (${val})\n`;
  }

  comentario += "\n🔁 Reforce atuação nas zonas e categorias com maior peso e monitore FCs com crescimento WoW elevado.";

  document.getElementById("comentarioGeral").value = comentario;
}


    function popularSemanasFpp(lista) {
      const select = document.getElementById('semanaSelectFpp');
      const semanas = [...new Set(lista.map(i => i.WEEK_VISIVEL))]
  .filter(Boolean)
  .sort((a, b) => b.localeCompare(a));

      select.innerHTML = semanas.map(s => `<option value="${s}">${s}</option>`).join('');
    }


    function filtrarPorSemanaFpp() {
      const semana = document.getElementById('semanaSelectFpp').value;
      // Atualiza o texto do topo com a semana selecionada
const weekNumber = semana.split('-')[1]; // extrai o número da semana
document.getElementById('weekDisplay').textContent = weekNumber;

      
      const filtrado = dadosFppOriginais.filter(i =>
  i.WEEK_VISIVEL == semana && String(i.PROCESSO).toUpperCase().includes('FPP DPMO')
);

      
      renderTabelaFpp(filtrado);
      renderSkuCardPanel(semana);
      renderImpactoPorCategoria(semana);
      renderZonaImpacto(semana);
      carregarComentario();




    }
    function getNormalizedValue(obj, possibleKeys) {
  for (const key of possibleKeys) {
    if (obj.hasOwnProperty(key)) return obj[key];
  }
  return undefined;
}
function salvarComentario() {
  const semana = document.getElementById("semanaSelectFpp").value;
  const texto = document.getElementById("comentarioGeral").value.trim();
  if (texto) {
    localStorage.setItem(`conclusao_${semana}`, texto);
    renderizarComentarioSalvo(texto);
  }
}

function editarComentario() {
  const semana = document.getElementById("semanaSelectFpp").value;
  const textoSalvo = localStorage.getItem(`conclusao_${semana}`) || "";

  const bloco = document.getElementById("blocoComentario");
  bloco.innerHTML = `
    <textarea id="comentarioGeral" placeholder="Digite sua conclusão da semana...">${textoSalvo}</textarea>
    <button onclick="salvarComentario()">Salvar Comentário</button>
  `;
}

function renderizarComentarioSalvo(texto) {
  const bloco = document.getElementById("blocoComentario");
  bloco.innerHTML = `
    <div class="texto-comentario-salvo">${texto}</div>
    <button onclick="editarComentario()">Editar Comentário</button>
  `;
}

function carregarComentario() {
  const semana = document.getElementById("semanaSelectFpp").value;
  const textoSalvo = localStorage.getItem(`conclusao_${semana}`) || "";

  if (textoSalvo) {
    renderizarComentarioSalvo(textoSalvo);
  } else {
    editarComentario(); // mostra textarea se não tiver nada salvo
  }
}


// ⚠️ Dentro da função filtrarPorSemanaFpp() já existente:
carregarComentario();


    function renderTabelaFpp(lista) {
      const container = document.getElementById('fppTabelaContainer');
      container.innerHTML = '';
      
lista.sort((a, b) => {
  const aDpmo = parseFloat(String(getNormalizedValue(a, ['DPMO', 'dpmo', 'Dpm']) || 0).replace(",", "."));
  const bDpmo = parseFloat(String(getNormalizedValue(b, ['DPMO', 'dpmo', 'Dpm']) || 0).replace(",", "."));
  return bDpmo - aDpmo;
});

      

const semanaSelecionada = document.getElementById('semanaSelectFpp').value;
// Ordena todas as semanas disponíveis (do mais recente pro mais antigo)
const todasSemanas = [...new Set(dadosFppOriginais.map(i => i.WEEK_VISIVEL))]
  .filter(Boolean)
  .sort((a, b) => b.localeCompare(a)); // decrescente

// Define semana anterior (para cálculo de WoW)
const indexAtual = todasSemanas.indexOf(semanaSelecionada);
const semanaAnterior = todasSemanas[indexAtual + 1]; // próxima na ordem reversa

const fcAcimaTarget = lista
  .map(l => {
    const site = l.FACILITY || l.SITE || l.WAREHOUSE_ID;
    const dpmoAtual = parseFloat(getNormalizedValue(l, ['DPMO', 'dpmo']));
    const target = parseFloat(getNormalizedValue(l, ['TARGET', 'Target']));

    // Buscar a linha da semana anterior do mesmo site
const linhaAnterior = dadosFppOriginais.find(
  x => (x.FACILITY || x.SITE || x.WAREHOUSE_ID) === site &&
       x.WEEK_VISIVEL === semanaAnterior &&
       String(x.PROCESSO || '').toUpperCase().includes('FPP DPMO')
);

    const dpmoAnterior = linhaAnterior
      ? parseFloat(getNormalizedValue(linhaAnterior, ['DPMO', 'dpmo']))
      : NaN;

    const wow =
      !isNaN(dpmoAtual) && !isNaN(dpmoAnterior) && dpmoAnterior !== 0
        ? ((dpmoAtual - dpmoAnterior) / dpmoAnterior) * 100
        : 0;

    return { site, dpmo: dpmoAtual, target, wow };
  })

  .filter(fc => fc.dpmo > fc.target && !isNaN(fc.dpmo) && !isNaN(fc.target));

const linhaMLB = lista.find(l => {
  const fc = (l.WAREHOUS || l.WAREHOUSE || l.FACILITY || l.SITE || l.WAREHOUSE_ID || "").toString().toUpperCase();
  const semanaLinha = (l.WEEK_VISIVEL || "").toString().trim();
  return fc === "MLB" && semanaLinha === semanaSelecionada;
});

let total = 0;
let target = 0;
let colorClass = 'dpmo-ok';
let iconeHTML = ''; // classe CSS que será aplicada

if (linhaMLB) {
  const rawDpmo = getNormalizedValue(linhaMLB, ['DPMO', 'dpmo', 'Dpm']);
  const rawTarget = getNormalizedValue(linhaMLB, ['TARGET', 'Target', 'T']);

  total = parseFloat((rawDpmo || "").toString().replace(",", "."));
  target = parseFloat((rawTarget || "").toString().replace(",", "."));

  if (!isNaN(total) && !isNaN(target) && total > target) {
    colorClass = 'dpmo-alerta';
    iconeHTML = `<img src="joinhabaixo.png" alt="ruim" style="height: 28px; vertical-align: middle; margin-left: 12px;">`;
  } else {
    iconeHTML = `<img src="joinhacima.png" alt="bom" style="height: 28px; vertical-align: middle; margin-left: 12px;">`;
  }
}




      const metade = Math.ceil(lista.length / 2);
      const colEsquerda = lista.slice(0, metade);
      const colDireita = lista.slice(metade);

      const criarColuna = (col) => {
        return `
          <div class="dpmo-column">
            <div class="dpmo-header">
              <span>Site</span>
              <span>Target</span>
              <span>DPMO</span>
              <span>Status</span>
            </div>
            ${col.map(l => {
              
              const site = l.FACILITY || l.SITE || l.WAREHOUSE_ID || '---';
              const dpmo = parseFloat(getNormalizedValue(l, ['DPMO', 'dpmo', 'Dpm']));
              const target = parseFloat(getNormalizedValue(l, ['TARGET', 'Target', 'T']));


              const status = !isNaN(dpmo) && !isNaN(target) && dpmo > target ? '🔴' : '🟢';
              

              return `
  <div class="dpmo-row">
    <span>${site}</span>
<span>${isNaN(target) ? '-' : target.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</span>
<span>${isNaN(dpmo) ? '-' : dpmo.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</span>


    <span class="dpmo-status">${status}</span>
  </div>
`;

            }).join('')}
          </div>
        `;
      };

container.innerHTML = `
  <div class="section-title" style="margin-bottom: 8px;">📌 FPP DPMO por FC</div>
<div class="dpmo-total ${colorClass}">
  ${iconeHTML}
  ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
  <span style="font-size:14px">DPMO</span>
</div>

  <div class="dpmo-table-wrapper">
    ${criarColuna(colEsquerda)}
    ${criarColuna(colDireita)}
  </div>
`;


  // 🔽 Agora sim: renderiza os blocos abaixo da tabela
renderJustificativas(fcAcimaTarget, semanaSelecionada);



    }


function renderGraficoMini(siteOriginal, site, semana, canvas) {
  const semanasOrdenadas = [...new Set(
    dadosFppOriginais.map(x => x.WEEK_VISIVEL)
  )].filter(Boolean).sort((a, b) => a.localeCompare(b));

  const posSelecionada = semanasOrdenadas.indexOf(semana);
  const ultimasSemanas = semanasOrdenadas.slice(
    Math.max(0, posSelecionada - 3),
    posSelecionada + 1
  );

  const dpmoTrend = ultimasSemanas.map(sem => {
    const linha = dadosFppOriginais.find(x =>
      (x.FACILITY || x.SITE || x.WAREHOUSE_ID) === siteOriginal &&
      x.WEEK_VISIVEL === sem &&
      String(x.PROCESSO || '').toUpperCase().includes('FPP DPMO')
    );
    return linha
      ? parseFloat((getNormalizedValue(linha, ['DPMO', 'dpmo']) || '0').toString().replace(',', '.'))
      : 0;
  });

  new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: {
      labels: ultimasSemanas,
      datasets: [{
        data: dpmoTrend,
        borderColor: '#F4F4F4',
        backgroundColor: 'rgba(52, 131, 250, 0.1)',
        borderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointBackgroundColor: '#1976d2',
        fill: true,
        tension: 0.3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { top: 24, bottom: 8, right: 12, left: 12 } },
      plugins: {
        legend: { display: false },
        tooltip: {
          enabled: true,
          callbacks: {
            label: ctx => `DPMO: ${ctx.raw.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`

          }
        },
        datalabels: {
          color: '#000',
          font: { size: 10 },
          anchor: 'end',
          align: 'top',
          offset: -6,
          formatter: (value) => value.toLocaleString('pt-BR', { maximumFractionDigits: 0 })

        }
      },
      scales: {
        x: {
          display: true,
          ticks: { font: { size: 10 } },
          grid: { display: false }
        },
        y: { display: false }
      }
    },
    plugins: [ChartDataLabels]
  });
}
function renderZonaImpacto(semanaSelecionada) {
  const container = document.getElementById('zonaImpactoContainer');
  container.innerHTML = '';

  const semanasOrdenadas = [...new Set(dadosFppOriginais.map(d => d.WEEK_VISIVEL))].filter(Boolean).sort();
  const indexSemanaAtual = semanasOrdenadas.indexOf(semanaSelecionada);
  const semanaAnterior = semanasOrdenadas[indexSemanaAtual - 1];

  const dadosAtual = dadosFppOriginais.filter(d =>
    String(d.PROCESSO || d.PROCESO || '').toUpperCase() === 'ZONA COM MAIOR IMPACTO' &&
    d.WEEK_VISIVEL === semanaSelecionada &&
    !isNaN(parseFloat(d.DPMO)) &&
    (d.MELI || d.ZONA)
  );

  const dadosAnterior = dadosFppOriginais.filter(d =>
    String(d.PROCESSO || d.PROCESO || '').toUpperCase() === 'ZONA COM MAIOR IMPACTO' &&
    d.WEEK_VISIVEL === semanaAnterior &&
    !isNaN(parseFloat(d.DPMO)) &&
    (d.MELI || d.ZONA)
  );

  const impactoAtual = {};
  dadosAtual.forEach(d => {
    const zona = (d.MELI || d.ZONA || '').trim();
    const valor = parseFloat(d.DPMO);
    impactoAtual[zona] = (impactoAtual[zona] || 0) + valor;
  });

  const impactoAnterior = {};
  dadosAnterior.forEach(d => {
    const zona = (d.MELI || d.ZONA || '').trim();
    const valor = parseFloat(d.DPMO);
    impactoAnterior[zona] = (impactoAnterior[zona] || 0) + valor;
  });

  const totalImpacto = Object.values(impactoAtual).reduce((a, b) => a + b, 0);

  const topZonas = Object.entries(impactoAtual)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

  topZonas.forEach(([zona, impacto]) => {
    const div = document.createElement('div');
    div.className = 'categoria-card'; // mesmo estilo visual das categorias

    const percentual = (100 * impacto / totalImpacto).toFixed(1);
    const impactoAnt = impactoAnterior[zona] || 0;
    let wow = impactoAnt > 0 ? ((impacto - impactoAnt) / impactoAnt) * 100 : 0;
    const wowAbs = Math.abs(wow).toFixed(2);

    let wowTexto = '';
    if (wow > 0) {
      wowTexto = `<span class="wow-vermelho">🔺 ${wowAbs}% WoW</span>`;
    } else if (wow < 0) {
      wowTexto = `<span class="wow-verde">🔻 ${wowAbs}% WoW</span>`;
    }
const zonaIconMap = {
  "Transferência": "transferencia.png",
  "MZ": "MZ.png",
  "MU": "MU.png",
  "RK": "RK.png"
};

const imagem = zona
  .toLowerCase()
  .normalize("NFD").replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]/g, '_')
  .replace(/_+/g, '_')
  .replace(/^_|_$/g, '') + ".png";

const iconePath = zonaIconMap[zona] || imagem;



    div.innerHTML = `
      <img src="${iconePath}" class="zona-icon" onerror="this.style.display='none'">
      <div class="categoria-info">
        <div><strong>${zona}</strong></div>
        <div><strong style="font-size: 15px; color: #333;">${percentual}%</strong> do impacto da semana  ${wowTexto}</div>
        <div>DFL total: <strong>${impacto.toLocaleString('pt-BR', {
          style: 'currency',
          currency: 'USD'
        })}</strong></div>
      </div>
    `;

    container.appendChild(div);
  });
}


function renderImpactoPorCategoria(semanaSelecionada) {
  const container = document.getElementById('impactoCategoriaContainer');
  container.innerHTML = '';

  // lista de semanas ordenada
  const semanasOrdenadas = [...new Set(dadosFppOriginais.map(d => d.WEEK_VISIVEL))].filter(Boolean).sort();
  const indexSemanaAtual = semanasOrdenadas.indexOf(semanaSelecionada);
  const semanaAnterior = semanasOrdenadas[indexSemanaAtual - 1];

  // filtrar dados atuais e anteriores
  const dadosAtual = dadosFppOriginais.filter(d =>
    (d.PROCESSO || '').toUpperCase() === 'CATEGORIA COM MAIOR IMPACTO' &&
    d.WEEK_VISIVEL === semanaSelecionada &&
    !isNaN(parseFloat(d.DPMO)) &&
    d.MELI
  );

  const dadosAnterior = dadosFppOriginais.filter(d =>
    (d.PROCESSO || '').toUpperCase() === 'CATEGORIA COM MAIOR IMPACTO' &&
    d.WEEK_VISIVEL === semanaAnterior &&
    !isNaN(parseFloat(d.DPMO)) &&
    d.MELI
  );

  // somar impacto por categoria
  const impactoAtual = {};
  dadosAtual.forEach(d => {
    const cat = d.MELI.trim();
    const valor = parseFloat(d.DPMO);
    impactoAtual[cat] = (impactoAtual[cat] || 0) + valor;
  });

  const impactoAnterior = {};
  dadosAnterior.forEach(d => {
    const cat = d.MELI.trim();
    const valor = parseFloat(d.DPMO);
    impactoAnterior[cat] = (impactoAnterior[cat] || 0) + valor;
  });

  const totalImpacto = Object.values(impactoAtual).reduce((a, b) => a + b, 0);

  const topCategorias = Object.entries(impactoAtual)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

  topCategorias.forEach(([categoria, impacto]) => {
    const div = document.createElement('div');
    div.className = 'categoria-card';

    const percentual = (100 * impacto / totalImpacto).toFixed(1);

    const impactoAnt = impactoAnterior[categoria] || 0;
    let wow = impactoAnt > 0 ? ((impacto - impactoAnt) / impactoAnt) * 100 : 0;
    const wowAbs = Math.abs(wow).toFixed(2);

    let wowTexto = '';
    if (wow > 0) {
      wowTexto = `<span class="wow-vermelho">🔺 ${wowAbs}% WoW</span>`;
    } else if (wow < 0) {
      wowTexto = `<span class="wow-verde">🔻 ${wowAbs}% WoW</span>`;
    }

    const imagem = categoria
  .toLowerCase()
  .normalize("NFD").replace(/[\u0300-\u036f]/g, '') // remove acento
  .replace(/[^a-z0-9]/g, '_') // troca qualquer coisa que não for letra/número por "_"
  .replace(/_+/g, '_') // remove underlines duplicados
  .replace(/^_|_$/g, '') // remove underlines nas pontas
  + ".png";

    const iconePath = `${imagem}`;

    div.innerHTML = `
      <img src="${iconePath}" class="categoria-icon" onerror="this.style.display='none'">
      <div class="categoria-info">
        <div><strong>${categoria}</strong></div>
        <div><strong style="font-size: 15px; color: #333;">${percentual}%</strong> do impacto da semana  ${wowTexto}</div>
        <div>DFL total: <strong>${impacto.toLocaleString('pt-BR', {
          style: 'currency',
          currency: 'USD'
        })}</strong></div>
      </div>
    `;

    container.appendChild(div);
  });
}



function renderJustificativas(fcList, semana) {
  const container = document.getElementById('justificativasContainer');
  container.innerHTML = '';

  fcList.forEach(fc => {
    const siteOriginal = fc.site;
    const site = siteOriginal.replace(/\s+/g, '').replace(/[^a-zA-Z0-9_-]/g, '');

    const wow = fc.wow;
    const dpmo = fc.dpmo;
    const target = fc.target;
    const acima = ((dpmo - target) / target) * 100;

    const wowClass = wow > 0 ? 'wow-vermelho' : 'wow-verde';
    const wowTexto = `${wow > 0 ? '🔺' : '🔻'} ${Math.abs(wow).toFixed(2)}% WoW`;

    const bloco = document.createElement('div');
    bloco.className = 'bloco-justificativa';

    const cabecalho = document.createElement('div');
    cabecalho.style.fontWeight = 'bold';
    cabecalho.style.marginBottom = '4px';
    cabecalho.innerHTML = `📍 ${siteOriginal} — <span class="${wowClass}">${wowTexto}</span> | ${acima.toFixed(0)}% acima do target`;

    const conteudo = document.createElement('div');
    conteudo.className = 'justificativa-conteudo';
    conteudo.dataset.site = site;

    const blocoGrafico = document.createElement('div');
    blocoGrafico.className = 'grafico-mini';
    const canvas = document.createElement('canvas');
    canvas.id = `grafico-${site}`;
    blocoGrafico.appendChild(canvas);

    conteudo.appendChild(document.createElement('div')); // espaço para justificativa futura
    conteudo.appendChild(blocoGrafico);

    bloco.appendChild(cabecalho);
    bloco.appendChild(conteudo);
    container.appendChild(bloco);

    const semanasOrdenadas = [...new Set(dadosFppOriginais.map(x => x.WEEK_VISIVEL))].filter(Boolean).sort((a, b) => a.localeCompare(b));
    const posSelecionada = semanasOrdenadas.indexOf(semana);
    const ultimasSemanas = semanasOrdenadas.slice(Math.max(0, posSelecionada - 3), posSelecionada + 1);

    const dpmoTrend = ultimasSemanas.map(sem => {
      const linha = dadosFppOriginais.find(x =>
        (x.FACILITY || x.SITE || x.WAREHOUSE_ID) === siteOriginal &&
        x.WEEK_VISIVEL === sem &&
        String(x.PROCESSO || '').toUpperCase().includes('FPP DPMO')
      );
      return linha ? parseFloat((getNormalizedValue(linha, ['DPMO', 'dpmo']) || '0').toString().replace(',', '.')) : 0;
    });

    setTimeout(() => {
      const ctx = document.getElementById(`grafico-${site}`);
      if (ctx) {
        new Chart(ctx, {
          type: 'line',
          data: {
            labels: ultimasSemanas,
            datasets: [{
              data: dpmoTrend,
              borderColor: '#F4F4F4',
              backgroundColor: 'rgba(52, 131, 250, 0.1)',
              borderWidth: 2,
              pointRadius: 4,
              pointHoverRadius: 6,
              pointBackgroundColor: '#1976d2',
              fill: true,
              tension: 0.3
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: { padding: { top: 24, bottom: 8, right: 12, left: 12 } },
            plugins: {
              legend: { display: false },
              tooltip: {
                enabled: true,
                callbacks: {
                  label: ctx => `DPMO: ${ctx.raw.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`

                }
              },
              datalabels: {
                color: '#000',
                font: { size: 10 },
                anchor: 'end',
                align: 'top',
                offset: -6,
                formatter: (value) => value.toLocaleString('pt-BR', { maximumFractionDigits: 0 })

              }
            },
            scales: {
              x: { display: true, ticks: { font: { size: 10 } }, grid: { display: false } },
              y: { display: false }
            }
          },
          plugins: [ChartDataLabels]
        });
      }
    }, 0);
  });
}







document.addEventListener('click', function (e) {
  const container = e.target.closest('.justificativa-conteudo');
  if (!container) return;

  const site = container.dataset.site;
  const semana = document.getElementById('semanaSelectFpp').value;

  if (e.target.classList.contains('editar-btn') || e.target.classList.contains('placeholder')) {
    const valorSalvo = localStorage.getItem(`${site}_${semana}`) || '';

    container.innerHTML = `
      <textarea class="just-input" rows="3">${valorSalvo}</textarea>
      <button class="salvar-btn">Salvar</button>
    `;
  }

  if (e.target.classList.contains('salvar-btn')) {
    const textarea = container.querySelector('textarea');
    const texto = textarea.value.trim();

    if (texto) {
      localStorage.setItem(`${site}_${semana}`, texto);
      container.innerHTML = `
        <div class="texto-salvo">${texto}</div>
        <button class="editar-btn">Editar</button>
      `;
    }
  }
});
