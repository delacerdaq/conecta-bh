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

function formatarPrecoProduto(preco) {
  if (!preco) return '';
  const valor = Number(String(preco).replace(',', '.'));
  if (!Number.isFinite(valor)) return String(preco);
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

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
      const rs = e.redesSociais || {};

      const fotoPerfil = e.fotoPerfil
        ? `<img src="${e.fotoPerfil}" alt="Foto de ${e.nome}" class="card-foto-perfil">`
        : `<div class="card-icon"><i class="fa-solid ${icone}"></i></div>`;

      const galeria = e.galeriaFotos && e.galeriaFotos.length
        ? `<div class="card-galeria">${e.galeriaFotos.map((src, i) => `<img src="${src}" alt="Foto do negócio ${i + 1}">`).join('')}</div>`
        : '';

      const produtos = Array.isArray(e.produtos) ? e.produtos.slice(0, 6) : [];
      const produtosHtml = produtos.length
        ? `<div class="card-produtos">
            <h4>Produtos</h4>
            <div class="card-produtos-grid">
              ${produtos.map((produto, idx) => `
                <div class="produto-card-item">
                  <div class="produto-card-foto">
                    ${produto.foto ? `<img src="${produto.foto}" alt="Foto do produto ${idx + 1}">` : '<i class="fa-solid fa-box-open"></i>'}
                  </div>
                  <div class="produto-card-info">
                    <h5>${produto.nome || `Produto ${idx + 1}`}</h5>
                    ${produto.descricao ? `<p>${produto.descricao}</p>` : ''}
                    ${formatarPrecoProduto(produto.preco) ? `<span class="produto-card-preco">${formatarPrecoProduto(produto.preco)}</span>` : ''}
                  </div>
                </div>
              `).join('')}
            </div>
          </div>`
        : '';

      const sociais = [rs.instagram && `<a href="${rs.instagram}" target="_blank" rel="noopener" class="card-social-link instagram" title="Instagram"><i class="fa-brands fa-instagram"></i></a>`,
                       rs.facebook  && `<a href="${rs.facebook}"  target="_blank" rel="noopener" class="card-social-link facebook"  title="Facebook"><i class="fa-brands fa-facebook-f"></i></a>`,
                       rs.whatsapp  && `<a href="${rs.whatsapp}"  target="_blank" rel="noopener" class="card-social-link whatsapp"  title="WhatsApp"><i class="fa-brands fa-whatsapp"></i></a>`,
                       rs.linkedin  && `<a href="${rs.linkedin}"  target="_blank" rel="noopener" class="card-social-link linkedin"  title="LinkedIn"><i class="fa-brands fa-linkedin-in"></i></a>`,
                       rs.website   && `<a href="${rs.website}"   target="_blank" rel="noopener" class="card-social-link website"   title="Site"><i class="fa-solid fa-globe"></i></a>`]
                      .filter(Boolean).join('');

      return `
        <div class="card">
          ${fotoPerfil}
          <h3>${e.nome}</h3>
          <p><strong>Negócio:</strong> ${e.nomeNegocio}</p>
          <p><strong>Ramo:</strong> ${label}</p>
          <p>${e.descricao}</p>
          <p style="margin-top: 0.5rem;">
            <i class="fa-solid fa-location-dot color-purple"></i>
            <span style="color: var(--gray); font-size: 0.9rem;"> ${e.endereco}</span>
          </p>
          ${sociais ? `<div class="card-social-links">${sociais}</div>` : ''}
          ${galeria}
          ${produtosHtml}
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
