/**
 * empreendedores.js
 * Carrega os empreendedores cadastrados via API e renderiza os cards dinamicamente.
 */

const ICONES = {
  tecnologia: 'fa-laptop-code',
  comercio: 'fa-shop',
  servicos: 'fa-briefcase',
  consultoria: 'fa-chart-line',
  educacao: 'fa-graduation-cap',
  outro: 'fa-user-tie',
};

const LABELS = {
  tecnologia: 'Tecnologia',
  comercio: 'Comércio',
  servicos: 'Serviços',
  consultoria: 'Consultoria',
  educacao: 'Educação',
  outro: 'Outro',
};

const API_BASE = window.location.origin.includes('localhost:3000') ? '' : 'http://localhost:3000';

async function carregarEmpreendedores() {
  const grid = document.getElementById('empreendedores-grid');

  grid.innerHTML = `
    <div style="grid-column: 1/-1; text-align:center; padding: 2rem; color: var(--gray);">
      <i class="fa-solid fa-spinner fa-spin" style="font-size:2rem;"></i>
      <p>Carregando empreendedores...</p>
    </div>`;

  try {
    const res = await fetch(`${API_BASE}/api/empreendedores`);
    if (!res.ok) throw new Error('Resposta inválida do servidor');

    const data = await res.json();
    const lista = data.empreendedores;

    if (!lista || lista.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1/-1; text-align:center; padding: 2rem; color: var(--gray);">
          <i class="fa-solid fa-users-slash" style="font-size:2rem; margin-bottom:1rem;"></i>
          <p>Nenhum empreendedor cadastrado ainda.<br>
          <a href="cadastro-empreendedor.html" class="btn btn-primary" style="margin-top:1rem;">Seja o primeiro!</a></p>
        </div>`;
      return;
    }

    grid.innerHTML = lista.map((e) => {
      const icone = ICONES[e.tipoNegocio] || 'fa-user-tie';
      const label = LABELS[e.tipoNegocio] || e.tipoNegocio;
      return `
        <div class="card">
          <div class="card-icon"><i class="fa-solid ${icone}"></i></div>
          <h3>${e.nome}</h3>
          <p><strong>Negócio:</strong> ${e.nomeNegocio}</p>
          <p><strong>Ramo:</strong> ${label}</p>
          <p>${e.descricao}</p>
          <p style="margin-top: 0.5rem;">
            <i class="fa-solid fa-location-dot color-purple"></i>
            <span style="color: var(--gray); font-size: 0.9rem;"> ${e.endereco}</span>
          </p>
        </div>`;
    }).join('');

  } catch (err) {
    grid.innerHTML = `
      <div style="grid-column: 1/-1; text-align:center; padding: 2rem; color: var(--pink);">
        <i class="fa-solid fa-triangle-exclamation" style="font-size:2rem; margin-bottom:1rem;"></i>
        <p>Erro ao carregar empreendedores.<br>Verifique se o servidor está rodando.</p>
      </div>`;
  }
}

carregarEmpreendedores();
