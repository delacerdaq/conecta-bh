<div align="center">
  <img src="images/conectabh-logo.png" alt="ConectaBH" width="220"/>

  <h3>Conecta BH</h3>

  <p>
    <img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js"/>
    <img src="https://img.shields.io/badge/Express-000000?style=for-the-badge&logo=express&logoColor=white" alt="Express"/>
    <img src="https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black" alt="JavaScript"/>
    <img src="https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white" alt="HTML5"/>
    <img src="https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white" alt="CSS3"/>
  </p>
</div>

---

## 📌 Sobre o projeto

O **ConectaBH** é uma vitrine digital criada para dar visibilidade a pequenos empreendedores locais de Belo Horizonte. A plataforma reúne cadastro de negócios, catálogo público, busca por mapa, área de perfil e calculadora de lucro, tudo em um só lugar, acessível e fácil de usar.

> Projeto desenvolvido como trabalho final de disciplina, unindo aprendizado técnico e impacto social real.

---

## ✨ Funcionalidades

| # | Funcionalidade | Descrição |
|---|---|---|
| 🔐 | **Autenticação** | Cadastro e login com senha criptografada (bcrypt) e sessão por token |
| 🏪 | **Cadastro de negócios** | Foto de perfil, galeria, produtos, endereço e redes sociais |
| 📋 | **Catálogo público** | Listagem de todos os empreendedores e negócios |
| 🗺️ | **Encontre negócios** | Busca por região/categoria com mapa interativo |
| 👤 | **Perfil do empreendedor** | Edição e exclusão dos próprios negócios |
| 🧮 | **Calculadora de lucro** | Ferramenta de apoio financeiro |

---

## 🛠️ Tecnologias utilizadas

| Camada | Tecnologia |
|---|---|
| 🖥️ Front-end | HTML5, CSS3, JavaScript |
| ⚙️ Back-end | Node.js + Express |
| 🔑 Autenticação | bcryptjs + token em Base64 |
| 💾 Persistência | JSON (arquivo local) |
| 🗺️ Mapa | Leaflet.js + Nominatim (OpenStreetMap) |
| 🎨 Ícones | Font Awesome 6 |
| ☁️ Deploy | Render |

---

## 📁 Estrutura do projeto

```
conecta-bh/
├── 📄 server.js              # API e servidor Express
├── 📄 package.json
├── 📄 index.html             # Página inicial
├── 📂 css/
│   └── main.css              # Estilos globais
├── 📂 js/
│   ├── autenticacao.js       # Login e registro
│   ├── cadastro.js           # Cadastro de negócios
│   ├── perfil.js             # Gestão do perfil
│   ├── empreendedores.js     # Listagem de empreendedores
│   ├── negocios.js           # Busca e mapa
│   ├── calculadora-lucro.js  # Calculadora financeira
│   └── menu-usuario.js       # Estado do menu autenticado
├── 📂 pages/                 # Páginas HTML
├── 📂 data/                  # Persistência JSON
│   ├── usuarios.json
│   └── empreendedores.json
├── 📂 images/                # Imagens e logos
└── 📂 document/
    └── readme.txt            # Documentação acadêmica
```

---

## 🚀 Como rodar localmente

**Pré-requisitos:** [Node.js](https://nodejs.org) instalado

```bash
# Clone o repositório
git clone https://github.com/seu-usuario/conecta-bh.git
cd conecta-bh

# Instale as dependências
npm install

# Inicie o servidor
npm start
```

Acesse em: **http://localhost:3000**

---

## 🔒 Segurança implementada

- 🧹 Sanitização de entradas (remoção de tags HTML)
- ✅ Validação de e-mail, CPF/CNPJ e força de senha
- ⏱️ Rate limit por IP nas rotas sensíveis
- 🍯 Honeypot anti-bot nos formulários
- 🖼️ Validação de imagens em Base64

---

## 📄 Licença

Este projeto foi desenvolvido como trabalho acadêmico. Consulte o arquivo [LICENSE](LICENSE) para mais detalhes.

---

<div align="center">
  <sub>Feito com 💜</sub>
</div>
