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
const galeriaFotosPorNegocio = new Map();
const fotoPerfilPorNegocio = new Map();
const produtosPorNegocio = new Map();

const MAX_IMAGEM_BYTES = 2 * 1024 * 1024;
const MAX_GALERIA_FOTOS = 5;
const MAX_PRODUTOS = 6;

function escapeHtml(texto) {
  return String(texto ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function valorRedeSocial(negocio, chave) {
  if (!negocio || !negocio.redesSociais || typeof negocio.redesSociais !== 'object') return '';
  return String(negocio.redesSociais[chave] || '');
}

function extrairDigitos(valor) {
  return String(valor || '').replace(/\D/g, '');
}

function formatarTelefone(valor) {
  const digitos = extrairDigitos(valor).slice(0, 11);
  if (digitos.length <= 2) return digitos;
  if (digitos.length <= 6) return `(${digitos.slice(0, 2)}) ${digitos.slice(2)}`;
  if (digitos.length <= 10) return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 6)}-${digitos.slice(6)}`;
  return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 7)}-${digitos.slice(7)}`;
}

function obterDocumentoNegocio(negocio) {
  const tipo = negocio?.documentoTipo === 'cnpj' ? 'cnpj' : 'cpf';
  const numero = extrairDigitos(negocio?.documento || (tipo === 'cnpj' ? negocio?.cnpj : negocio?.cpf));
  return { tipo, numero };
}

function mascararDocumentoParcial(tipo, numero) {
  if (!numero) return 'Não informado';

  if (tipo === 'cnpj') {
    if (numero.length !== 14) return `CNPJ ${numero}`;
    return `CNPJ ${numero.slice(0, 2)}.***.***/****-${numero.slice(-2)}`;
  }

  if (numero.length !== 11) return `CPF ${numero}`;
  return `CPF ${numero.slice(0, 3)}.***.***-${numero.slice(-2)}`;
}

function formatarDocumentoResumoNegocio(negocio) {
  const { tipo, numero } = obterDocumentoNegocio(negocio);
  return mascararDocumentoParcial(tipo, numero);
}

function lerArquivoBase64(arquivo) {
  return new Promise((resolve, reject) => {
    if (arquivo.size > MAX_IMAGEM_BYTES) {
      reject(new Error(`A imagem "${arquivo.name}" excede o limite de 2 MB.`));
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = () => reject(new Error('Erro ao ler arquivo da imagem.'));
    reader.readAsDataURL(arquivo);
  });
}

function getFotoPerfilNegocio(negocioId) {
  return fotoPerfilPorNegocio.get(String(negocioId)) ?? null;
}

function setFotoPerfilNegocio(negocioId, foto) {
  fotoPerfilPorNegocio.set(String(negocioId), foto || null);
}

function renderFotoPerfilEdicao(formEl, negocioId) {
  const preview = formEl.querySelector('.edit-foto-perfil-preview');
  const btnRemover = formEl.querySelector('.edit-foto-perfil-remove');
  if (!preview || !btnRemover) return;

  const foto = getFotoPerfilNegocio(negocioId);
  if (foto) {
    preview.innerHTML = `<img src="${foto}" alt="Foto de perfil do empreendedor">`;
    btnRemover.style.display = 'inline-flex';
  } else {
    preview.innerHTML = '<i class="fa-solid fa-user"></i>';
    btnRemover.style.display = 'none';
  }
}

function getProdutosNegocio(negocioId) {
  return produtosPorNegocio.get(String(negocioId)) || [];
}

function setProdutosNegocio(negocioId, produtos) {
  produtosPorNegocio.set(String(negocioId), Array.isArray(produtos) ? produtos.slice(0, MAX_PRODUTOS) : []);
}

function normalizarProdutosNegocio(lista) {
  if (!Array.isArray(lista)) return [];
  return lista.slice(0, MAX_PRODUTOS).map((produto) => ({
    id: Number.isFinite(Number(produto?.id)) ? Number(produto.id) : Date.now() + Math.floor(Math.random() * 10000),
    nome: String(produto?.nome || '').trim(),
    descricao: String(produto?.descricao || '').trim(),
    preco: String(produto?.preco || '').trim(),
    foto: produto?.foto || null,
  }));
}

function formatarPrecoProduto(preco) {
  if (!preco) return '';
  const valor = Number(String(preco).replace(',', '.'));
  if (!Number.isFinite(valor)) return String(preco);
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function renderProdutosEdicao(formEl, negocioId) {
  const listaEl = formEl.querySelector('.edit-produtos-list');
  const helperEl = formEl.querySelector('.edit-produtos-helper');
  if (!listaEl || !helperEl) return;

  const produtos = getProdutosNegocio(negocioId);
  helperEl.textContent = `${produtos.length} de ${MAX_PRODUTOS} produtos cadastrados.`;

  if (!produtos.length) {
    listaEl.innerHTML = '<p class="address-help" style="margin-top: 0.4rem;">Nenhum produto cadastrado ainda.</p>';
    return;
  }

  listaEl.innerHTML = produtos.map((produto, index) => `
    <div class="produto-edit-item">
      <div class="produto-edit-top">
        <strong>Produto ${index + 1}</strong>
        <button type="button" class="btn btn-outline btn-remover-produto" data-negocio-id="${negocioId}" data-produto-idx="${index}">
          <i class="fa-solid fa-trash"></i> Remover produto
        </button>
      </div>

      <div class="produto-edit-grid">
        <div class="form-group">
          <label>Nome do produto</label>
          <input type="text" class="edit-produto-field" data-negocio-id="${negocioId}" data-produto-idx="${index}" data-campo="nome" value="${escapeHtml(produto.nome || '')}" placeholder="Ex: Combo Sushi Executivo" required>
        </div>

        <div class="form-group">
          <label>Preço</label>
          <input type="text" class="edit-produto-field" data-negocio-id="${negocioId}" data-produto-idx="${index}" data-campo="preco" value="${escapeHtml(produto.preco || '')}" placeholder="Ex: 39,90">
        </div>

        <div class="form-group produto-edit-descricao">
          <label>Descrição</label>
          <textarea class="edit-produto-field" data-negocio-id="${negocioId}" data-produto-idx="${index}" data-campo="descricao" placeholder="Descreva o produto...">${escapeHtml(produto.descricao || '')}</textarea>
        </div>
      </div>

      <div class="produto-foto-upload">
        <div class="produto-foto-preview">
          ${produto.foto ? `<img src="${produto.foto}" alt="Foto de ${escapeHtml(produto.nome || `Produto ${index + 1}`)}">` : '<i class="fa-solid fa-box-open"></i>'}
        </div>
        <div class="produto-foto-actions">
          <label for="edit-produto-foto-${negocioId}-${index}" class="btn btn-outline" style="cursor:pointer;">
            <i class="fa-solid fa-camera"></i> Escolher foto do produto
          </label>
          <input type="file" id="edit-produto-foto-${negocioId}-${index}" class="edit-produto-foto-input" data-negocio-id="${negocioId}" data-produto-idx="${index}" accept="image/*" style="display:none;">
          <button type="button" class="btn btn-outline btn-danger-outline btn-remover-foto-produto" data-negocio-id="${negocioId}" data-produto-idx="${index}" ${produto.foto ? '' : 'style="display:none;"'}>
            <i class="fa-solid fa-trash"></i> Remover foto
          </button>
          ${formatarPrecoProduto(produto.preco) ? `<small class="address-help">Preço atual: ${formatarPrecoProduto(produto.preco)}</small>` : '<small class="address-help">Máximo 2 MB · JPG, PNG ou WEBP</small>'}
        </div>
      </div>
    </div>
  `).join('');
}

function getGaleriaNegocio(negocioId) {
  return galeriaFotosPorNegocio.get(String(negocioId)) || [];
}

function setGaleriaNegocio(negocioId, fotos) {
  galeriaFotosPorNegocio.set(String(negocioId), Array.isArray(fotos) ? fotos : []);
}

function renderGaleriaEdicao(formEl, negocioId) {
  const grid = formEl.querySelector('.edit-galeria-preview-grid');
  if (!grid) return;

  const fotos = getGaleriaNegocio(negocioId);
  grid.innerHTML = fotos.map((src, idx) => `
    <div class="galeria-thumb">
      <img src="${src}" alt="Foto ${idx + 1}">
      <button
        type="button"
        class="galeria-thumb-remove edit-galeria-remove"
        data-negocio-id="${negocioId}"
        data-idx="${idx}"
        aria-label="Remover foto ${idx + 1}"
      >
        <i class="fa-solid fa-xmark"></i>
      </button>
    </div>`).join('');
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
    const infoDocumentoEl = document.getElementById('info-documento');
    const infoNegociosEl = document.getElementById('info-negocios');
    if (infoDocumentoEl) infoDocumentoEl.textContent = 'Não informado';
    if (infoNegociosEl) infoNegociosEl.textContent = '0';

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

    const infoNegociosEl = document.getElementById('info-negocios');
    if (infoNegociosEl) infoNegociosEl.textContent = String(meusNegocios.length);

    const infoDocumentoEl = document.getElementById('info-documento');
    if (infoDocumentoEl) {
      const negocioComDocumento = meusNegocios.find((negocio) => {
        const { numero } = obterDocumentoNegocio(negocio);
        return Boolean(numero);
      });
      infoDocumentoEl.textContent = negocioComDocumento
        ? formatarDocumentoResumoNegocio(negocioComDocumento)
        : 'Não informado';
    }

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
      setFotoPerfilNegocio(negocio.id, negocio.fotoPerfil || null);
      setGaleriaNegocio(negocio.id, Array.isArray(negocio.galeriaFotos) ? negocio.galeriaFotos : []);
      setProdutosNegocio(negocio.id, normalizarProdutosNegocio(negocio.produtos || []));

      const icone = ICONES[negocio.tipoNegocio] || 'fa-building';
      const label = LABELS[negocio.tipoNegocio] || negocio.tipoNegocio;
      const dataCadastro = new Date(negocio.dataCadastro).toLocaleDateString('pt-BR');
      const documentoResumo = formatarDocumentoResumoNegocio(negocio);
      const opcoesTipos = TIPOS_NEGOCIO
        .map((tipo) => `<option value="${tipo.value}" ${tipo.value === negocio.tipoNegocio ? 'selected' : ''}>${tipo.label}</option>`)
        .join('');
      const totalFotos = getGaleriaNegocio(negocio.id).length;

      return `
        <div class="negocio-item" data-negocio-id="${negocio.id}">
          <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.5rem;">
            <i class="fa-solid ${icone}" style="color: var(--purple); font-size: 1.2rem;"></i>
            <h3 style="margin: 0;">${escapeHtml(negocio.nomeNegocio)}</h3>
          </div>
          <p><strong>Categoria:</strong> ${escapeHtml(label)}</p>
          <p><strong>Descrição:</strong> ${escapeHtml(negocio.descricao)}</p>
          <p><strong>Endereço:</strong> ${escapeHtml(negocio.endereco)}</p>
          <p><strong>Documento:</strong> ${escapeHtml(documentoResumo)}</p>
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
              <input type="text" name="telefone" class="edit-telefone-input" inputmode="tel" value="${escapeHtml(negocio.telefone || '')}">
            </div>

            <div class="form-group">
              <label>Redes sociais</label>
              <div class="social-links-group">
                <label class="social-input-label">
                  <i class="fa-brands fa-instagram social-icon instagram"></i>
                  <input type="url" name="socialInstagram" placeholder="https://instagram.com/seunegocio" value="${escapeHtml(valorRedeSocial(negocio, 'instagram'))}">
                </label>
                <label class="social-input-label">
                  <i class="fa-brands fa-facebook-f social-icon facebook"></i>
                  <input type="url" name="socialFacebook" placeholder="https://facebook.com/seunegocio" value="${escapeHtml(valorRedeSocial(negocio, 'facebook'))}">
                </label>
                <label class="social-input-label">
                  <i class="fa-brands fa-whatsapp social-icon whatsapp"></i>
                  <input type="url" name="socialWhatsapp" placeholder="https://wa.me/5531999999999" value="${escapeHtml(valorRedeSocial(negocio, 'whatsapp'))}">
                </label>
                <label class="social-input-label">
                  <i class="fa-brands fa-linkedin-in social-icon linkedin"></i>
                  <input type="url" name="socialLinkedin" placeholder="https://linkedin.com/company/seunegocio" value="${escapeHtml(valorRedeSocial(negocio, 'linkedin'))}">
                </label>
                <label class="social-input-label">
                  <i class="fa-solid fa-globe social-icon website"></i>
                  <input type="url" name="socialWebsite" placeholder="https://www.seunegocio.com.br" value="${escapeHtml(valorRedeSocial(negocio, 'website'))}">
                </label>
              </div>
            </div>

            <div class="form-group">
              <label>Foto de perfil do empreendedor</label>
              <div class="foto-perfil-upload">
                <div class="foto-perfil-preview edit-foto-perfil-preview">
                  <i class="fa-solid fa-user"></i>
                </div>
                <div class="foto-perfil-actions">
                  <label for="edit-foto-perfil-${negocio.id}" class="btn btn-outline" style="cursor:pointer;">
                    <i class="fa-solid fa-camera"></i> Escolher foto
                  </label>
                  <input
                    type="file"
                    id="edit-foto-perfil-${negocio.id}"
                    class="edit-foto-perfil-input"
                    data-negocio-id="${negocio.id}"
                    accept="image/*"
                    style="display:none;"
                  >
                  <button type="button" class="btn btn-outline btn-danger-outline edit-foto-perfil-remove" data-negocio-id="${negocio.id}" style="display:none;">
                    <i class="fa-solid fa-trash"></i> Remover
                  </button>
                  <small class="address-help">Máximo 2 MB · JPG, PNG ou WEBP</small>
                </div>
              </div>
            </div>

            <div class="form-group">
              <label>Galeria de fotos do negócio</label>
              <div class="galeria-upload">
                <label for="edit-galeria-fotos-${negocio.id}" class="galeria-dropzone">
                  <i class="fa-solid fa-images"></i>
                  <span>Clique para adicionar fotos</span>
                  <small>Máximo ${MAX_GALERIA_FOTOS} fotos · 2 MB cada · JPG, PNG ou WEBP</small>
                </label>
                <input
                  type="file"
                  id="edit-galeria-fotos-${negocio.id}"
                  class="edit-galeria-input"
                  data-negocio-id="${negocio.id}"
                  accept="image/*"
                  multiple
                  style="display:none;"
                >
                <small class="address-help edit-galeria-helper">${totalFotos} de ${MAX_GALERIA_FOTOS} fotos adicionadas.</small>
                <div class="galeria-preview-grid edit-galeria-preview-grid"></div>
              </div>
            </div>

            <div class="form-group">
              <div class="produto-edit-header">
                <label style="margin-bottom:0;">Produtos do negócio</label>
                <button type="button" class="btn btn-secondary btn-add-produto" data-negocio-id="${negocio.id}">
                  <i class="fa-solid fa-plus"></i> Adicionar produto
                </button>
              </div>
              <small class="address-help edit-produtos-helper"></small>
              <div class="edit-produtos-list"></div>
            </div>

            <div class="negocio-actions">
              <button type="submit" class="btn btn-primary">Salvar alterações</button>
              <button type="button" class="btn btn-outline btn-cancelar-edicao" data-negocio-id="${negocio.id}">Cancelar</button>
            </div>
          </form>
        </div>`;
    }).join('');

    listaNegociios.querySelectorAll('.negocio-edit-form').forEach((formEl) => {
      const negocioId = formEl.dataset.editFormId;
      renderFotoPerfilEdicao(formEl, negocioId);
      renderGaleriaEdicao(formEl, negocioId);
      renderProdutosEdicao(formEl, negocioId);
      const telefoneInput = formEl.querySelector('.edit-telefone-input');
      if (telefoneInput) {
        telefoneInput.value = formatarTelefone(telefoneInput.value);
      }
    });

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
    redesSociais: {
      instagram: String(formData.get('socialInstagram') || '').trim() || null,
      facebook: String(formData.get('socialFacebook') || '').trim() || null,
      whatsapp: String(formData.get('socialWhatsapp') || '').trim() || null,
      linkedin: String(formData.get('socialLinkedin') || '').trim() || null,
      website: String(formData.get('socialWebsite') || '').trim() || null,
    },
    fotoPerfil: getFotoPerfilNegocio(negocioId),
    galeriaFotos: getGaleriaNegocio(negocioId),
    produtos: normalizarProdutosNegocio(getProdutosNegocio(negocioId)),
  };

  if (payload.produtos.length > MAX_PRODUTOS) {
    alert(`Cada negócio pode ter no máximo ${MAX_PRODUTOS} produtos.`);
    return;
  }

  const produtoInvalido = payload.produtos.find((p) => p.nome && !p.foto);
  if (produtoInvalido) {
    alert('Todo produto com nome deve ter foto.');
    return;
  }

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
      return;
    }

    const btnRemoverFoto = event.target.closest('.edit-galeria-remove');
    if (btnRemoverFoto) {
      const negocioId = btnRemoverFoto.dataset.negocioId;
      const idx = Number(btnRemoverFoto.dataset.idx);
      const fotos = getGaleriaNegocio(negocioId);
      if (!Number.isFinite(idx) || idx < 0 || idx >= fotos.length) return;

      fotos.splice(idx, 1);
      setGaleriaNegocio(negocioId, fotos);

      const formEl = btnRemoverFoto.closest('.negocio-edit-form');
      if (formEl) {
        renderGaleriaEdicao(formEl, negocioId);
        const helper = formEl.querySelector('.edit-galeria-helper');
        if (helper) helper.textContent = `${fotos.length} de ${MAX_GALERIA_FOTOS} fotos adicionadas.`;
      }
      return;
    }

    const btnRemoverFotoPerfil = event.target.closest('.edit-foto-perfil-remove');
    if (btnRemoverFotoPerfil) {
      const negocioId = String(btnRemoverFotoPerfil.dataset.negocioId || '');
      if (!negocioId) return;

      setFotoPerfilNegocio(negocioId, null);
      const formEl = btnRemoverFotoPerfil.closest('.negocio-edit-form');
      if (formEl) {
        const inputFoto = formEl.querySelector('.edit-foto-perfil-input');
        if (inputFoto) inputFoto.value = '';
        renderFotoPerfilEdicao(formEl, negocioId);
      }
      return;
    }

    const btnAddProduto = event.target.closest('.btn-add-produto');
    if (btnAddProduto) {
      const negocioId = String(btnAddProduto.dataset.negocioId || '');
      const formEl = btnAddProduto.closest('.negocio-edit-form');
      if (!negocioId || !formEl) return;

      const produtos = getProdutosNegocio(negocioId);
      if (produtos.length >= MAX_PRODUTOS) {
        alert(`Cada negócio pode cadastrar até ${MAX_PRODUTOS} produtos.`);
        return;
      }

      produtos.push({
        id: Date.now() + Math.floor(Math.random() * 1000),
        nome: '',
        descricao: '',
        preco: '',
        foto: null,
      });
      setProdutosNegocio(negocioId, produtos);
      renderProdutosEdicao(formEl, negocioId);
      return;
    }

    const btnRemoverProduto = event.target.closest('.btn-remover-produto');
    if (btnRemoverProduto) {
      const negocioId = String(btnRemoverProduto.dataset.negocioId || '');
      const idx = Number(btnRemoverProduto.dataset.produtoIdx);
      const formEl = btnRemoverProduto.closest('.negocio-edit-form');
      if (!negocioId || !formEl) return;

      const produtos = getProdutosNegocio(negocioId);
      if (!Number.isFinite(idx) || idx < 0 || idx >= produtos.length) return;
      produtos.splice(idx, 1);
      setProdutosNegocio(negocioId, produtos);
      renderProdutosEdicao(formEl, negocioId);
      return;
    }

    const btnRemoverFotoProduto = event.target.closest('.btn-remover-foto-produto');
    if (btnRemoverFotoProduto) {
      const negocioId = String(btnRemoverFotoProduto.dataset.negocioId || '');
      const idx = Number(btnRemoverFotoProduto.dataset.produtoIdx);
      const formEl = btnRemoverFotoProduto.closest('.negocio-edit-form');
      if (!negocioId || !formEl) return;

      const produtos = getProdutosNegocio(negocioId);
      if (!Number.isFinite(idx) || idx < 0 || idx >= produtos.length) return;
      produtos[idx].foto = null;
      setProdutosNegocio(negocioId, produtos);
      renderProdutosEdicao(formEl, negocioId);
    }
  });

  container.addEventListener('input', (event) => {
    const telefoneInput = event.target.closest('.edit-telefone-input');
    if (telefoneInput) {
      telefoneInput.value = formatarTelefone(telefoneInput.value);
      return;
    }

    const produtoField = event.target.closest('.edit-produto-field');
    if (produtoField) {
      const negocioId = String(produtoField.dataset.negocioId || '');
      const idx = Number(produtoField.dataset.produtoIdx);
      const campo = String(produtoField.dataset.campo || '');
      if (!negocioId || !Number.isFinite(idx) || !campo) return;

      const produtos = getProdutosNegocio(negocioId);
      if (!produtos[idx]) return;
      produtos[idx][campo] = produtoField.value;
      setProdutosNegocio(negocioId, produtos);
      return;
    }

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

  container.addEventListener('change', async (event) => {
    const inputFotoProduto = event.target.closest('.edit-produto-foto-input');
    if (inputFotoProduto) {
      const negocioId = String(inputFotoProduto.dataset.negocioId || '');
      const idx = Number(inputFotoProduto.dataset.produtoIdx);
      const formEl = inputFotoProduto.closest('.negocio-edit-form');
      if (!negocioId || !formEl || !Number.isFinite(idx)) return;

      const arquivo = inputFotoProduto.files?.[0];
      if (!arquivo) return;

      try {
        const b64 = await lerArquivoBase64(arquivo);
        const produtos = getProdutosNegocio(negocioId);
        if (!produtos[idx]) return;
        produtos[idx].foto = b64;
        setProdutosNegocio(negocioId, produtos);
        renderProdutosEdicao(formEl, negocioId);
      } catch (err) {
        alert(err.message || 'Não foi possível carregar a foto do produto.');
        inputFotoProduto.value = '';
      }
      return;
    }

    const inputFotoPerfil = event.target.closest('.edit-foto-perfil-input');
    if (inputFotoPerfil) {
      const negocioId = String(inputFotoPerfil.dataset.negocioId || '');
      const formEl = inputFotoPerfil.closest('.negocio-edit-form');
      if (!negocioId || !formEl) return;

      const arquivo = inputFotoPerfil.files?.[0];
      if (!arquivo) return;

      try {
        const b64 = await lerArquivoBase64(arquivo);
        setFotoPerfilNegocio(negocioId, b64);
        renderFotoPerfilEdicao(formEl, negocioId);
      } catch (err) {
        alert(err.message || 'Não foi possível carregar a foto de perfil.');
        inputFotoPerfil.value = '';
      }
      return;
    }

    const inputGaleria = event.target.closest('.edit-galeria-input');
    if (!inputGaleria) return;

    const negocioId = String(inputGaleria.dataset.negocioId || '');
    const formEl = inputGaleria.closest('.negocio-edit-form');
    if (!negocioId || !formEl) return;

    const fotosAtuais = getGaleriaNegocio(negocioId);
    const arquivos = Array.from(inputGaleria.files || []);
    const vagas = MAX_GALERIA_FOTOS - fotosAtuais.length;

    if (vagas <= 0) {
      alert(`Você já adicionou o máximo de ${MAX_GALERIA_FOTOS} fotos.`);
      inputGaleria.value = '';
      return;
    }

    const selecionados = arquivos.slice(0, vagas);
    if (arquivos.length > vagas) {
      alert(`Limite de ${MAX_GALERIA_FOTOS} fotos. Apenas as primeiras ${vagas} foram adicionadas.`);
    }

    const erros = [];
    for (const arquivo of selecionados) {
      try {
        const b64 = await lerArquivoBase64(arquivo);
        fotosAtuais.push(b64);
      } catch (err) {
        erros.push(err.message);
      }
    }

    setGaleriaNegocio(negocioId, fotosAtuais);
    renderGaleriaEdicao(formEl, negocioId);
    const helper = formEl.querySelector('.edit-galeria-helper');
    if (helper) helper.textContent = `${fotosAtuais.length} de ${MAX_GALERIA_FOTOS} fotos adicionadas.`;

    if (erros.length) {
      alert(erros.join('\n'));
    }

    inputGaleria.value = '';
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
