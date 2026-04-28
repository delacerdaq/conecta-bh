/**
 * perfil.js
 * Carrega informações do perfil do usuário e seus negócios
 */

const API_BASE = window.location.origin.includes('localhost:3000') ? '' : 'http://localhost:3000';

async function carregarPerfil() {
  const token = localStorage.getItem('conectabh_token');
  const usuarioData = localStorage.getItem('conectabh_usuario');

  if (!token || !usuarioData) {
    window.location.href = './login.html';
    return;
  }

  try {
    const usuario = JSON.parse(usuarioData);

    document.getElementById('perfil-nome').textContent = usuario.nome;
    document.getElementById('perfil-email').textContent = usuario.email;
    document.getElementById('info-email').textContent = usuario.email;

    const dataCadastro = new Date().toLocaleDateString('pt-BR');
    document.getElementById('info-data').textContent = dataCadastro;

    carregarMeusNegocios(usuario.id, token);

  } catch (e) {
    console.error('Erro ao carregar perfil:', e);
  }
}

async function carregarMeusNegocios(usuarioId, token) {
  try {
    const res = await fetch(`${API_BASE}/api/empreendedores`);
    const data = await res.json();

    const meusNegocios = (data.empreendedores || []).filter(
      emp => emp.usuarioId === usuarioId
    );

    const listaNegociios = document.getElementById('negocios-lista');

    if (meusNegocios.length === 0) {
      listaNegociios.innerHTML = `
        <div class="sem-negocios">
          <i class="fa-solid fa-inbox"></i>
          <p>Você ainda não cadastrou nenhum negócio.</p>
          <a href="cadastro-empreendedor.html" class="btn btn-primary" style="margin-top: 1rem;">Criar o seu agora</a>
        </div>`;
      return;
    }

    const ICONES = {
      tecnologia: 'fa-laptop-code',
      comercio: 'fa-shop',
      servicos: 'fa-briefcase',
      consultoria: 'fa-chart-line',
      educacao: 'fa-graduation-cap',
      criatividade: 'fa-palette',
      outro: 'fa-building',
    };

    const LABELS = {
      tecnologia: 'Tecnologia',
      comercio: 'Comércio',
      servicos: 'Serviços',
      consultoria: 'Consultoria',
      educacao: 'Educação',
      criatividade: 'Criatividade',
      outro: 'Outro',
    };

    listaNegociios.innerHTML = meusNegocios.map(negocio => {
      const icone = ICONES[negocio.tipoNegocio] || 'fa-building';
      const label = LABELS[negocio.tipoNegocio] || negocio.tipoNegocio;
      const dataCadastro = new Date(negocio.dataCadastro).toLocaleDateString('pt-BR');

      return `
        <div class="negocio-item">
          <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.5rem;">
            <i class="fa-solid ${icone}" style="color: var(--purple); font-size: 1.2rem;"></i>
            <h3 style="margin: 0;">${negocio.nomeNegocio}</h3>
          </div>
          <p><strong>Categoria:</strong> ${label}</p>
          <p><strong>Descrição:</strong> ${negocio.descricao}</p>
          <p><strong>Endereço:</strong> ${negocio.endereco}</p>
          <p><strong>Contato:</strong> ${negocio.email || 'Não informado'} | ${negocio.telefone || 'Não informado'}</p>
          <span class="negocio-badge">Cadastrado em ${dataCadastro}</span>
        </div>`;
    }).join('');

  } catch (err) {
    console.error('Erro ao carregar negócios:', err);
    document.getElementById('negocios-lista').innerHTML = `
      <div class="sem-negocios" style="color: var(--pink);">
        <i class="fa-solid fa-triangle-exclamation"></i>
        <p>Erro ao carregar seus negócios. Tente novamente.</p>
      </div>`;
  }
}

const btnLogout = document.getElementById('btn-logout');
if (btnLogout) {
  btnLogout.addEventListener('click', () => {
    if (confirm('Tem certeza que deseja sair?')) {
      localStorage.removeItem('conectabh_token');
      localStorage.removeItem('conectabh_usuario');
      window.location.href = './login.html';
    }
  });
}

document.addEventListener('DOMContentLoaded', carregarPerfil);
