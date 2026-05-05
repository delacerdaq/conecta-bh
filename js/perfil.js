/**
 * perfil.js
 * Carrega informações do perfil do usuário e seus negócios
 */

const API_BASE = window.location.port === '3000' ? '' : 'http://localhost:3000';
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const TIPOS_NEGOCIO = [
  { value: 'comercio', label: 'Comércio' },
  { value: 'servicos', label: 'Serviços' },
  { value: 'consultoria', label: 'Consultoria' },
  { value: 'tecnologia', label: 'Tecnologia' },
  { value: 'educacao', label: 'Educação' },
  { value: 'criatividade', label: 'Criatividade' },
  { value: 'outro', label: 'Outro' },
];

const sugestoesEnderecoPorNegocio = new Map();
const enderecoSelecionadoPorNegocio = new Map();
const debounceBuscaPorNegocio = new Map();
const requestControllerPorNegocio = new Map();

function escapeHtml(texto) {
  return String(texto ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function obterTokenEUsuario() {
  const token = localStorage.getItem('conectabh_token');
  const usuarioData = localStorage.getItem('conectabh_usuario');
  if (!token || !usuarioData) return { token: null, usuario: null };

  try {
    return { token, usuario: JSON.parse(usuarioData) };
  } catch {
    return { token: null, usuario: null };
  }
}

function enderecoPareceCompleto(endereco) {
  const texto = endereco.trim();
  const possuiNumero = /\d+/.test(texto);
  return texto.length >= 12 && possuiNumero;
}

function extrairNumeroDoTexto(texto) {
  const match = texto.match(/(?:,\s*|\s+)(\d+)\s*(?:[,\s]|$)/);
  return match ? match[1] : null;
}

function extrairRuaDoTexto(texto) {
  return texto.replace(/(?:,\s*|\s+)\d+.*$/, '').trim();
}

function injetarNumeroNoDisplayName(displayName, road, numero) {
  if (!road || !numero) return displayName;
  const idx = displayName.indexOf(road);
  if (idx === -1) return displayName;
  const after = displayName.slice(idx + road.length);
  if (/^\s*,\s*\d+/.test(after)) return displayName;
  return displayName.slice(0, idx + road.length) + ', ' + numero + after;
}

function obterElementosEndereco(formEl) {
  return {
    input: formEl.querySelector('.edit-address-input'),
    suggestionsEl: formEl.querySelector('.edit-address-suggestions'),
    validationEl: formEl.querySelector('.edit-address-validation'),
  };
}

function setMensagemEnderecoEdicao(formEl, msg, tipo) {
  const { validationEl } = obterElementosEndereco(formEl);
  if (!validationEl) return;
  validationEl.textContent = msg;
  validationEl.className = `address-validation-msg edit-address-validation${tipo ? ` ${tipo}` : ''}`;
}

function esconderSugestoesEdicao(formEl) {
  const { suggestionsEl } = obterElementosEndereco(formEl);
  if (!suggestionsEl) return;
  suggestionsEl.style.display = 'none';
  suggestionsEl.innerHTML = '';
}

function renderSugestoesEdicao(formEl, negocioId, lista) {
  const { suggestionsEl } = obterElementosEndereco(formEl);
  if (!suggestionsEl) return;

  sugestoesEnderecoPorNegocio.set(String(negocioId), lista);

  if (!lista.length) {
    suggestionsEl.innerHTML = '';
    suggestionsEl.style.display = 'none';
    return;
  }

  suggestionsEl.innerHTML = lista
    .map((item, index) => `
      <button
        type="button"
        class="address-suggestion-item edit-address-suggestion-item"
        data-negocio-id="${negocioId}"
        data-index="${index}"
        role="option"
      >${item.label || item.display_name}</button>`)
    .join('');

  suggestionsEl.style.display = 'block';
}

function selecionarEnderecoEdicao(formEl, negocioId, item) {
  const { input } = obterElementosEndereco(formEl);
  if (!input) return;

  const label = item.label || item.display_name;
  input.value = label;
  enderecoSelecionadoPorNegocio.set(String(negocioId), {
    label,
    lat: Number(item.lat),
    lon: Number(item.lon),
  });
  setMensagemEnderecoEdicao(formEl, 'Endereço validado com sucesso.', 'sucesso');
  esconderSugestoesEdicao(formEl);
}

async function buscarSugestoesEnderecoEdicao(texto, negocioId) {
  const chave = String(negocioId);
  const requestControllerAtual = requestControllerPorNegocio.get(chave);
  if (requestControllerAtual) {
    requestControllerAtual.abort();
  }

  const novoController = new AbortController();
  requestControllerPorNegocio.set(chave, novoController);

  const numero = extrairNumeroDoTexto(texto);
  const textoBusca = numero ? extrairRuaDoTexto(texto) : texto;
  const q = textoBusca.toLowerCase().includes('belo horizonte')
    ? textoBusca
    : `${textoBusca}, Belo Horizonte, Minas Gerais, Brasil`;

  const url = new URL(NOMINATIM_URL);
  url.searchParams.set('q', q);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('limit', '7');
  url.searchParams.set('countrycodes', 'br');

  const res = await fetch(url.toString(), {
    signal: novoController.signal,
    headers: { Accept: 'application/json' },
  });

  if (!res.ok) {
    throw new Error('Falha ao buscar sugestões');
  }

  const data = await res.json();
  const filtrados = data.filter((item) => {
    const nome = (item.display_name || '').toLowerCase();
    const addr = item.address || {};
    const cidade = (addr.city || addr.town || addr.village || '').toLowerCase();
    return nome.includes('belo horizonte') || cidade.includes('belo horizonte');
  });

  return filtrados.map((item) => {
    const addr = item.address || {};
    const road = addr.road || addr.pedestrian || addr.footway || addr.path || addr.street || '';
    const label = numero
      ? injetarNumeroNoDisplayName(item.display_name, road, numero)
      : item.display_name;
    return { ...item, label };
  });
}

async function validarEnderecoEdicao(formEl, negocioId, enderecoAtualOriginal) {
  const { input } = obterElementosEndereco(formEl);
  const endereco = (input?.value || '').trim();

  if (!endereco) {
    setMensagemEnderecoEdicao(formEl, 'Informe o endereço completo da loja.', 'erro');
    return false;
  }

  if (!enderecoPareceCompleto(endereco)) {
    setMensagemEnderecoEdicao(formEl, 'Inclua rua, número e demais informações do endereço.', 'erro');
    return false;
  }

  const selecionado = enderecoSelecionadoPorNegocio.get(String(negocioId));
  if (selecionado && selecionado.label === endereco) {
    setMensagemEnderecoEdicao(formEl, 'Endereço validado com sucesso.', 'sucesso');
    return true;
  }

  if (enderecoAtualOriginal && endereco === enderecoAtualOriginal) {
    setMensagemEnderecoEdicao(formEl, '', '');
    return true;
  }

  try {
    const sugestoes = await buscarSugestoesEnderecoEdicao(endereco, negocioId);
    if (!sugestoes.length) {
      setMensagemEnderecoEdicao(formEl, 'Não encontramos esse endereço em Belo Horizonte. Tente selecionar uma sugestão.', 'erro');
      return false;
    }

    selecionarEnderecoEdicao(formEl, negocioId, sugestoes[0]);
    return true;
  } catch (err) {
    setMensagemEnderecoEdicao(formEl, 'Não foi possível validar o endereço agora. Tente novamente.', 'erro');
    return false;
  }
}

async function lerRespostaApi(res) {
  const contentType = (res.headers.get('content-type') || '').toLowerCase();
  const texto = await res.text();

  let data = null;
  if (texto) {
    try {
      data = JSON.parse(texto);
    } catch {
      data = null;
    }
  }

  if (!data && (contentType.includes('text/html') || texto.trim().startsWith('<!DOCTYPE') || texto.trim().startsWith('<html'))) {
    const erro = new Error('A API retornou HTML em vez de JSON. Verifique se o backend Node está rodando em http://localhost:3000.');
    erro.codigo = 'API_HTML_RESPONSE';
    throw erro;
  }

  return data;
}

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
    const res = await fetch(`${API_BASE}/api/empreendedores`, {
      headers: {
        Accept: 'application/json',
      },
    });
    const data = await lerRespostaApi(res);

    if (!res.ok) {
      throw new Error(data?.error || 'Não foi possível carregar seus negócios.');
    }

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
      const opcoesTipos = TIPOS_NEGOCIO
        .map((tipo) => `<option value="${tipo.value}" ${tipo.value === negocio.tipoNegocio ? 'selected' : ''}>${tipo.label}</option>`)
        .join('');

      return `
        <div class="negocio-item" data-negocio-id="${negocio.id}">
          <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.5rem;">
            <i class="fa-solid ${icone}" style="color: var(--purple); font-size: 1.2rem;"></i>
            <h3 style="margin: 0;">${escapeHtml(negocio.nomeNegocio)}</h3>
          </div>
          <p><strong>Categoria:</strong> ${escapeHtml(label)}</p>
          <p><strong>Descrição:</strong> ${escapeHtml(negocio.descricao)}</p>
          <p><strong>Endereço:</strong> ${escapeHtml(negocio.endereco)}</p>
          <p><strong>Contato:</strong> ${escapeHtml(negocio.email || 'Não informado')} | ${escapeHtml(negocio.telefone || 'Não informado')}</p>
          <span class="negocio-badge">Cadastrado em ${dataCadastro}</span>

          <div class="negocio-actions mt-2">
            <button type="button" class="btn-perfil secondary btn-editar-negocio" data-negocio-id="${negocio.id}">
              <i class="fa-solid fa-pen"></i> Editar
            </button>
            <button type="button" class="btn-perfil danger btn-excluir-negocio" data-negocio-id="${negocio.id}" data-negocio-nome="${escapeHtml(negocio.nomeNegocio)}">
              <i class="fa-solid fa-trash"></i> Excluir
            </button>
          </div>

          <form class="negocio-edit-form" data-edit-form-id="${negocio.id}" style="display:none; margin-top: 1rem;">
            <div class="form-group">
              <label>Nome do negócio</label>
              <input type="text" name="nomeNegocio" value="${escapeHtml(negocio.nomeNegocio)}" required>
            </div>
            <div class="form-group">
              <label>Categoria</label>
              <select name="tipoNegocio" required>
                ${opcoesTipos}
              </select>
            </div>
            <div class="form-group">
              <label>Descrição</label>
              <textarea name="descricao" required>${escapeHtml(negocio.descricao)}</textarea>
            </div>
            <div class="form-group">
              <label>Endereço</label>
              <div class="address-autocomplete edit-address-autocomplete">
                <input
                  type="text"
                  name="endereco"
                  class="edit-address-input"
                  value="${escapeHtml(negocio.endereco)}"
                  data-negocio-id="${negocio.id}"
                  required
                  autocomplete="off"
                >
                <div class="address-suggestions edit-address-suggestions" role="listbox" aria-label="Sugestões de endereço"></div>
              </div>
              <small class="address-help">Digite rua e número e selecione uma sugestão quando necessário.</small>
              <small class="address-validation-msg edit-address-validation" aria-live="polite"></small>
            </div>
            <div class="form-group">
              <label>Email de contato</label>
              <input type="email" name="email" value="${escapeHtml(negocio.email || '')}">
            </div>
            <div class="form-group">
              <label>Telefone de contato</label>
              <input type="text" name="telefone" value="${escapeHtml(negocio.telefone || '')}">
            </div>
            <div class="negocio-actions">
              <button type="submit" class="btn btn-primary">Salvar alterações</button>
              <button type="button" class="btn btn-outline btn-cancelar-edicao" data-negocio-id="${negocio.id}">Cancelar</button>
            </div>
          </form>
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

async function excluirNegocio(negocioId, nomeNegocio) {
  const token = localStorage.getItem('conectabh_token');
  if (!token) {
    alert('Você precisa estar logado para excluir um negócio.');
    return;
  }

  const confirmou = confirm(`Deseja realmente excluir o negócio "${nomeNegocio}"? Esta ação não pode ser desfeita.`);
  if (!confirmou) return;

  try {
    const res = await fetch(`${API_BASE}/api/empreendedores/${negocioId}`, {
      method: 'DELETE',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });
    const data = await lerRespostaApi(res);

    if (!res.ok) {
      throw new Error(data?.error || 'Não foi possível excluir o negócio.');
    }

    alert('Negócio excluído com sucesso.');
    const { usuario } = obterTokenEUsuario();
    if (usuario) {
      carregarMeusNegocios(usuario.id, token);
    }
  } catch (err) {
    alert(err.message || 'Erro ao excluir negócio.');
  }
}

function abrirEdicao(negocioId) {
  document.querySelectorAll('.negocio-edit-form').forEach((form) => {
    form.style.display = form.dataset.editFormId === String(negocioId) ? 'block' : 'none';
  });
}

function fecharEdicao(negocioId) {
  const form = document.querySelector(`.negocio-edit-form[data-edit-form-id="${negocioId}"]`);
  if (form) form.style.display = 'none';
}

async function salvarEdicaoNegocio(negocioId, formEl) {
  const token = localStorage.getItem('conectabh_token');
  if (!token) {
    alert('Você precisa estar logado para editar um negócio.');
    return;
  }

  const formData = new FormData(formEl);
  const payload = {
    nomeNegocio: String(formData.get('nomeNegocio') || '').trim(),
    tipoNegocio: String(formData.get('tipoNegocio') || '').trim(),
    descricao: String(formData.get('descricao') || '').trim(),
    endereco: String(formData.get('endereco') || '').trim(),
    email: String(formData.get('email') || '').trim(),
    telefone: String(formData.get('telefone') || '').trim(),
  };

  const enderecoAtualOriginal = String(formEl.querySelector('.edit-address-input')?.defaultValue || '').trim();
  const enderecoValido = await validarEnderecoEdicao(formEl, negocioId, enderecoAtualOriginal);
  if (!enderecoValido) {
    alert('Corrija o endereço da loja para continuar.');
    return;
  }

  const enderecoSelecionado = enderecoSelecionadoPorNegocio.get(String(negocioId));
  payload.latitude = enderecoSelecionado && enderecoSelecionado.label === payload.endereco
    ? Number(enderecoSelecionado.lat)
    : undefined;
  payload.longitude = enderecoSelecionado && enderecoSelecionado.label === payload.endereco
    ? Number(enderecoSelecionado.lon)
    : undefined;

  if (!payload.nomeNegocio || !payload.tipoNegocio || !payload.descricao || !payload.endereco) {
    alert('Preencha nome, categoria, descrição e endereço para salvar.');
    return;
  }

  const btnSubmit = formEl.querySelector('button[type="submit"]');
  const textoOriginal = btnSubmit ? btnSubmit.textContent : '';
  if (btnSubmit) {
    btnSubmit.disabled = true;
    btnSubmit.textContent = 'Salvando...';
  }

  try {
    const res = await fetch(`${API_BASE}/api/empreendedores/${negocioId}`, {
      method: 'PUT',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await lerRespostaApi(res);
    if (!res.ok) {
      throw new Error(data?.error || 'Não foi possível atualizar o negócio.');
    }

    alert('Negócio atualizado com sucesso.');
    const { usuario } = obterTokenEUsuario();
    if (usuario) {
      carregarMeusNegocios(usuario.id, token);
    }
  } catch (err) {
    alert(err.message || 'Erro ao atualizar negócio.');
  } finally {
    if (btnSubmit) {
      btnSubmit.disabled = false;
      btnSubmit.textContent = textoOriginal;
    }
  }
}

function iniciarAcoesNegocios() {
  const container = document.getElementById('negocios-lista');
  if (!container) return;

  container.addEventListener('click', (event) => {
    const btnEditar = event.target.closest('.btn-editar-negocio');
    if (btnEditar) {
      abrirEdicao(btnEditar.dataset.negocioId);
      return;
    }

    const btnCancelar = event.target.closest('.btn-cancelar-edicao');
    if (btnCancelar) {
      fecharEdicao(btnCancelar.dataset.negocioId);
      return;
    }

    const btnExcluir = event.target.closest('.btn-excluir-negocio');
    if (btnExcluir) {
      excluirNegocio(btnExcluir.dataset.negocioId, btnExcluir.dataset.negocioNome || '');
      return;
    }

    const sugestaoEndereco = event.target.closest('.edit-address-suggestion-item');
    if (sugestaoEndereco) {
      const negocioId = sugestaoEndereco.dataset.negocioId;
      const idx = Number(sugestaoEndereco.dataset.index);
      const sugestoes = sugestoesEnderecoPorNegocio.get(String(negocioId)) || [];
      const item = sugestoes[idx];
      const formEl = sugestaoEndereco.closest('.negocio-edit-form');
      if (item && formEl) {
        selecionarEnderecoEdicao(formEl, negocioId, item);
      }
    }
  });

  container.addEventListener('input', (event) => {
    const inputEndereco = event.target.closest('.edit-address-input');
    if (!inputEndereco) return;

    const negocioId = String(inputEndereco.dataset.negocioId || '');
    const formEl = inputEndereco.closest('.negocio-edit-form');
    if (!negocioId || !formEl) return;

    enderecoSelecionadoPorNegocio.delete(negocioId);
    setMensagemEnderecoEdicao(formEl, '', '');

    const termo = inputEndereco.value.trim();
    if (termo.length < 5) {
      esconderSugestoesEdicao(formEl);
      return;
    }

    const debounceAtual = debounceBuscaPorNegocio.get(negocioId);
    if (debounceAtual) {
      clearTimeout(debounceAtual);
    }

    const timeout = setTimeout(async () => {
      try {
        const sugestoes = await buscarSugestoesEnderecoEdicao(termo, negocioId);
        renderSugestoesEdicao(formEl, negocioId, sugestoes);
      } catch (err) {
        if (err.name !== 'AbortError') {
          esconderSugestoesEdicao(formEl);
        }
      }
    }, 350);

    debounceBuscaPorNegocio.set(negocioId, timeout);
  });

  container.addEventListener('focusout', (event) => {
    const inputEndereco = event.target.closest('.edit-address-input');
    if (!inputEndereco) return;

    const formEl = inputEndereco.closest('.negocio-edit-form');
    const negocioId = String(inputEndereco.dataset.negocioId || '');
    if (!formEl || !negocioId) return;

    setTimeout(() => {
      esconderSugestoesEdicao(formEl);
    }, 120);
  });

  container.addEventListener('submit', (event) => {
    const formEdicao = event.target.closest('.negocio-edit-form');
    if (!formEdicao) return;

    event.preventDefault();
    salvarEdicaoNegocio(formEdicao.dataset.editFormId, formEdicao);
  });
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
document.addEventListener('DOMContentLoaded', iniciarAcoesNegocios);
