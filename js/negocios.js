/**
 * negocios.js
 * Carrega os negócios cadastrados via API, renderiza os cards e
 * aplica filtros por categoria e endereço ao submeter o formulário.
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

let todosEmpreendedores = [];
const API_BASE = window.location.origin.includes('localhost:3000') ? '' : 'http://localhost:3000';

function renderNegocios(lista) {
  const grid = document.getElementById('negocios-grid');

  if (!lista || lista.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1/-1; text-align:center; padding: 2rem; color: var(--gray);">
        <i class="fa-solid fa-magnifying-glass" style="font-size:2rem; margin-bottom:1rem;"></i>
        <p>Nenhum negócio encontrado com esses filtros.</p>
      </div>`;
    return;
  }

  grid.innerHTML = lista.map((e) => {
    const icone = ICONES[e.tipoNegocio] || 'fa-building';
    const label = LABELS[e.tipoNegocio] || e.tipoNegocio;
    return `
      <div class="card">
        <div class="card-icon"><i class="fa-solid ${icone}"></i></div>
        <h3>${e.nomeNegocio}</h3>
        <p><strong>Empreendedor:</strong> ${e.nome}</p>
        <p><strong>Categoria:</strong> ${label}</p>
        <p>${e.descricao}</p>
        <p style="margin-top: 0.5rem;">
          <i class="fa-solid fa-location-dot color-purple"></i>
          <span style="color: var(--gray); font-size: 0.9rem;"> ${e.endereco}</span>
        </p>
        ${e.email ? `<p style="margin-top:0.5rem;"><i class="fa-regular fa-envelope color-purple"></i>
          <a href="mailto:${e.email}" style="color: var(--gray); font-size: 0.9rem;"> ${e.email}</a></p>` : ''}
      </div>`;
  }).join('');
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
  }
}

document.getElementById('form-busca').addEventListener('submit', (e) => {
  e.preventDefault();

  const categoria = document.getElementById('category').value;
  const regiao = document.getElementById('region').value.toLowerCase().trim();

  let filtrados = todosEmpreendedores;

  if (categoria) {
    filtrados = filtrados.filter((e) => e.tipoNegocio === categoria);
  }

  if (regiao) {
    filtrados = filtrados.filter((e) =>
      e.endereco.toLowerCase().includes(regiao)
    );
  }

  renderNegocios(filtrados);
});

document.getElementById('btn-limpar').addEventListener('click', () => {
  document.getElementById('form-busca').reset();
  renderNegocios(todosEmpreendedores);
});

carregarNegocios();
