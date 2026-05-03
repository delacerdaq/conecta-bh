/**
 * negocios.js
 * Carrega os negócios cadastrados via API, renderiza cards,
 * aplica filtros e exibe os resultados em um mapa interativo.
 */

const ICONES = {
  tecnologia: 'fa-laptop-code',
  comercio: 'fa-shop',
  servicos: 'fa-briefcase',
  consultoria: 'fa-chart-line',
  educacao: 'fa-graduation-cap',
  outro: 'fa-building',
};

const LABELS = {
  tecnologia: 'Tecnologia',
  comercio: 'Comércio',
  servicos: 'Serviços',
  consultoria: 'Consultoria',
  educacao: 'Educação',
  outro: 'Outro',
};

const REGIOES = {
  centro: {
    label: 'Centro',
    color: '#7400b3',
    center: [-19.9191, -43.9386],
    aliases: ['centro'],
  },
  pampulha: {
    label: 'Pampulha',
    color: '#0081a7',
    center: [-19.8517, -43.9662],
    aliases: ['pampulha'],
  },
  savassi: {
    label: 'Savassi',
    color: '#fd5f84',
    center: [-19.9366, -43.9349],
    aliases: ['savassi'],
  },
  funcionarios: {
    label: 'Funcionários',
    color: '#99e126',
    center: [-19.9324, -43.9284],
    aliases: ['funcionarios', 'funcionários'],
  },
  lourdes: {
    label: 'Lourdes',
    color: '#fea15a',
    center: [-19.9276, -43.9407],
    aliases: ['lourdes'],
  },
};

const MAPA_PADRAO = {
  center: [-19.9167, -43.9345],
  zoom: 12,
};

let todosEmpreendedores = [];
let mapa;
let camadaMarcadores;
const API_BASE = window.location.origin.includes('localhost:3000') ? '' : 'http://localhost:3000';

function normalizarTexto(texto = '') {
  return texto
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function identificarRegiao(empreendimento) {
  const endereco = normalizarTexto(empreendimento.endereco);

  const regiaoPorTexto = Object.entries(REGIOES).find(([, regiao]) =>
    regiao.aliases.some((alias) => endereco.includes(alias))
  );

  if (regiaoPorTexto) {
    return regiaoPorTexto[0];
  }

  const latitude = Number(empreendimento.latitude);
  const longitude = Number(empreendimento.longitude);

  if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
    let regiaoMaisProxima = 'centro';
    let menorDistancia = Infinity;

    Object.entries(REGIOES).forEach(([chave, regiao]) => {
      const distancia = Math.hypot(latitude - regiao.center[0], longitude - regiao.center[1]);
      if (distancia < menorDistancia) {
        menorDistancia = distancia;
        regiaoMaisProxima = chave;
      }
    });

    return regiaoMaisProxima;
  }

  return 'centro';
}

function obterCoordenadas(empreendimento) {
  const latitude = Number(empreendimento.latitude);
  const longitude = Number(empreendimento.longitude);

  if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
    return [latitude, longitude];
  }

  const regiaoKey = identificarRegiao(empreendimento);
  return REGIOES[regiaoKey].center;
}

function criarIconeMapa(cor) {
  return L.divIcon({
    className: 'leaflet-div-icon',
    html: `<span class="map-marker" style="background:${cor};"></span>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

function atualizarPainelDetalhes(empreendimento) {
  const painel = document.getElementById('map-selection-info');

  if (!empreendimento) {
    painel.innerHTML = `
      <h3>Detalhes do local</h3>
      <p>Selecione uma bolinha no mapa para ver o nome do negócio e o endereço.</p>`;
    return;
  }

  const regiaoKey = identificarRegiao(empreendimento);
  const regiao = REGIOES[regiaoKey];
  const categoria = LABELS[empreendimento.tipoNegocio] || empreendimento.tipoNegocio;

  painel.innerHTML = `
    <h3>${empreendimento.nomeNegocio}</h3>
    <div class="map-selection-region">
      <span class="legend-dot ${regiaoKey}"></span>
      ${regiao.label}
    </div>
    <p><strong>Categoria:</strong> ${categoria}</p>
    <p><strong>Endereço:</strong> ${empreendimento.endereco}</p>
    <p><strong>Empreendedor:</strong> ${empreendimento.nome}</p>`;
}

function inicializarMapa() {
  if (mapa || typeof L === 'undefined') {
    return;
  }

  mapa = L.map('negocios-map').setView(MAPA_PADRAO.center, MAPA_PADRAO.zoom);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
  }).addTo(mapa);

  camadaMarcadores = L.layerGroup().addTo(mapa);
}

function renderMapa(lista) {
  if (!mapa || !camadaMarcadores) {
    return;
  }

  camadaMarcadores.clearLayers();
  atualizarPainelDetalhes(null);

  if (!lista.length) {
    mapa.setView(MAPA_PADRAO.center, MAPA_PADRAO.zoom);
    return;
  }

  const limites = [];
  const ocupacaoCoordenadas = new Map();

  lista.forEach((empreendimento) => {
    const regiaoKey = identificarRegiao(empreendimento);
    const regiao = REGIOES[regiaoKey];
    const coordenadasBase = obterCoordenadas(empreendimento);
    const chave = `${coordenadasBase[0].toFixed(4)}:${coordenadasBase[1].toFixed(4)}`;
    const repeticoes = ocupacaoCoordenadas.get(chave) || 0;
    ocupacaoCoordenadas.set(chave, repeticoes + 1);

    const deslocamento = repeticoes * 0.0025;
    const coordenadas = [
      coordenadasBase[0] + deslocamento,
      coordenadasBase[1] + deslocamento,
    ];

    const marcador = L.marker(coordenadas, { icon: criarIconeMapa(regiao.color) });

    marcador.on('click', () => {
      atualizarPainelDetalhes(empreendimento);
      marcador.bindPopup(`<strong>${empreendimento.nomeNegocio}</strong><br>${empreendimento.endereco}`).openPopup();
    });

    marcador.addTo(camadaMarcadores);
    limites.push(coordenadas);
  });

  if (limites.length === 1) {
    mapa.setView(limites[0], 14);
  } else {
    mapa.fitBounds(limites, { padding: [30, 30] });
  }
}

function renderNegocios(lista) {
  const grid = document.getElementById('negocios-grid');

  if (!lista || lista.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1/-1; text-align:center; padding: 2rem; color: var(--gray);">
        <i class="fa-solid fa-magnifying-glass" style="font-size:2rem; margin-bottom:1rem;"></i>
        <p>Nenhum negócio encontrado com esses filtros.</p>
      </div>`;
    renderMapa([]);
    return;
  }

  grid.innerHTML = lista.map((e) => {
    const icone = ICONES[e.tipoNegocio] || 'fa-building';
    const label = LABELS[e.tipoNegocio] || e.tipoNegocio;
    const regiaoKey = identificarRegiao(e);
    const regiao = REGIOES[regiaoKey];
    const rs = e.redesSociais || {};

    const fotoPerfil = e.fotoPerfil
      ? `<img src="${e.fotoPerfil}" alt="Foto de ${e.nome}" class="card-foto-perfil">`
      : `<div class="card-icon"><i class="fa-solid ${icone}"></i></div>`;

    const galeria = e.galeriaFotos && e.galeriaFotos.length
      ? `<div class="card-galeria">${e.galeriaFotos.map((src, i) => `<img src="${src}" alt="Foto do negócio ${i + 1}">`).join('')}</div>`
      : '';

    const sociais = [
      rs.instagram && `<a href="${rs.instagram}" target="_blank" rel="noopener" class="card-social-link instagram" title="Instagram"><i class="fa-brands fa-instagram"></i></a>`,
      rs.facebook  && `<a href="${rs.facebook}"  target="_blank" rel="noopener" class="card-social-link facebook"  title="Facebook"><i class="fa-brands fa-facebook-f"></i></a>`,
      rs.whatsapp  && `<a href="${rs.whatsapp}"  target="_blank" rel="noopener" class="card-social-link whatsapp"  title="WhatsApp"><i class="fa-brands fa-whatsapp"></i></a>`,
      rs.linkedin  && `<a href="${rs.linkedin}"  target="_blank" rel="noopener" class="card-social-link linkedin"  title="LinkedIn"><i class="fa-brands fa-linkedin-in"></i></a>`,
      rs.website   && `<a href="${rs.website}"   target="_blank" rel="noopener" class="card-social-link website"   title="Site"><i class="fa-solid fa-globe"></i></a>`,
    ].filter(Boolean).join('');

    return `
      <div class="card">
        ${fotoPerfil}
        <h3>${e.nomeNegocio}</h3>
        <p><strong>Empreendedor:</strong> ${e.nome}</p>
        <p><strong>Categoria:</strong> ${label}</p>
        <p><strong>Região:</strong> ${regiao.label}</p>
        <p>${e.descricao}</p>
        <p style="margin-top: 0.5rem;">
          <i class="fa-solid fa-location-dot color-purple"></i>
          <span style="color: var(--gray); font-size: 0.9rem;"> ${e.endereco}</span>
        </p>
        ${e.email ? `<p style="margin-top:0.5rem;"><i class="fa-regular fa-envelope color-purple"></i>
          <a href="mailto:${e.email}" style="color: var(--gray); font-size: 0.9rem;"> ${e.email}</a></p>` : ''}
        ${sociais ? `<div class="card-social-links">${sociais}</div>` : ''}
        ${galeria}
      </div>`;
  }).join('');

  renderMapa(lista);
}

function aplicarFiltros() {
  const categoria = document.getElementById('category').value;
  const regiao = normalizarTexto(document.getElementById('region').value);

  let filtrados = [...todosEmpreendedores];

  if (categoria) {
    filtrados = filtrados.filter((empreendimento) => empreendimento.tipoNegocio === categoria);
  }

  if (regiao) {
    filtrados = filtrados.filter((empreendimento) => identificarRegiao(empreendimento) === regiao);
  }

  renderNegocios(filtrados);
}

async function carregarNegocios() {
  const grid = document.getElementById('negocios-grid');

  grid.innerHTML = `
    <div style="grid-column: 1/-1; text-align:center; padding: 2rem; color: var(--gray);">
      <i class="fa-solid fa-spinner fa-spin" style="font-size:2rem;"></i>
      <p>Carregando negócios...</p>
    </div>`;

  try {
    const res = await fetch(`${API_BASE}/api/empreendedores`);
    if (!res.ok) throw new Error('Resposta inválida do servidor');

    const data = await res.json();
    todosEmpreendedores = data.empreendedores || [];
    renderNegocios(todosEmpreendedores);
  } catch (err) {
    grid.innerHTML = `
      <div style="grid-column: 1/-1; text-align:center; padding: 2rem; color: var(--pink);">
        <i class="fa-solid fa-triangle-exclamation" style="font-size:2rem; margin-bottom:1rem;"></i>
        <p>Erro ao carregar negócios.<br>Verifique se o servidor está rodando.</p>
      </div>`;
    renderMapa([]);
  }
}

document.getElementById('form-busca').addEventListener('submit', (e) => {
  e.preventDefault();
  aplicarFiltros();
});

document.getElementById('region').addEventListener('change', aplicarFiltros);
document.getElementById('category').addEventListener('change', aplicarFiltros);

document.getElementById('btn-limpar').addEventListener('click', () => {
  document.getElementById('form-busca').reset();
  renderNegocios(todosEmpreendedores);
});

document.addEventListener('DOMContentLoaded', () => {
  inicializarMapa();
  carregarNegocios();
});
