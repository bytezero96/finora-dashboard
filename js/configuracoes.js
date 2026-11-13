
/* ========================================= */
/* FINORA — CONFIGURAÇÕES */
/* FIREBASE AUTH + PREFERÊNCIAS LOCAIS */
/* ========================================= */

(function () {
    "use strict";

    const CHAVE_IDIOMA = "finora_idioma";
    const idiomasValidos = ["pt-BR", "en", "es"];

    let idiomaAtual = obterIdioma();
    let secaoAtual = "perfil";
    let usuarioAtual = null;
    let auth = null;
    let funcoesAuth = null;
    let focoAnterior = null;

    const textos = {
        "pt-BR": {
            menuTitulo: "Preferências",
            perfil: "Perfil",
            aparencia: "Aparência",
            idioma: "Idioma",
            seguranca: "Segurança",
            subtitulo: "Personalize sua experiência no Finora",
            fechar: "Fechar configurações",
            rodape: "Finora — Controle de Finanças",

            perfilTitulo: "Perfil",
            perfilDescricao: "Gerencie as informações da sua conta.",
            perfilGrupo: "Informações da conta",
            nome: "Nome",
            email: "E-mail",
            salvarPerfil: "Salvar alterações",
            perfilAjuda: "Seu nome será atualizado na sua conta.",
            perfilSucesso: "Nome atualizado com sucesso.",
            perfilErro: "Não foi possível atualizar seu nome.",

            aparenciaTitulo: "Aparência",
            aparenciaDescricao: "Preferências visuais do sistema.",
            aparenciaGrupo: "Tema do sistema",
            aparenciaAjuda: "As opções de tema claro e escuro serão disponibilizadas em uma próxima etapa.",

            idiomaTitulo: "Idioma",
            idiomaDescricao: "Escolha o idioma utilizado nas configurações do Finora.",
            idiomaGrupo: "Idioma da interface",
            idiomaAjuda: "Selecione o idioma que deseja utilizar nesta janela.",

            segurancaTitulo: "Segurança",
            segurancaDescricao: "Gerencie a proteção e o acesso à sua conta.",
            segurancaGrupo: "Proteção da conta",
            redefinirSenha: "Redefinir senha",
            redefinirAjuda: "Enviaremos um link de redefinição para o e-mail cadastrado.",
            enviarEmail: "Enviar e-mail",
            sairConta: "Sair da conta",
            sairAjuda: "Encerra sua sessão atual no Finora.",
            confirmarSaida: "Deseja realmente sair da sua conta?",
            emailEnviado: "E-mail de redefinição enviado com sucesso.",
            emailErro: "Não foi possível enviar o e-mail de redefinição.",
            semSenha: "Sua conta não utiliza senha por e-mail. Entre pelo método de acesso original.",
            sessaoEncerrada: "Sessão encerrada.",
            erroGeral: "Ocorreu um erro. Tente novamente.",

            opcaoPt: "Português (Brasil)",
            opcaoEn: "English",
            opcaoEs: "Español",
            placeholderNome: "Digite seu nome"
        },

        "en": {
            menuTitulo: "Preferences",
            perfil: "Profile",
            aparencia: "Appearance",
            idioma: "Language",
            seguranca: "Security",
            subtitulo: "Customize your Finora experience",
            fechar: "Close settings",
            rodape: "Finora — Finance Manager",

            perfilTitulo: "Profile",
            perfilDescricao: "Manage your account information.",
            perfilGrupo: "Account information",
            nome: "Name",
            email: "Email",
            salvarPerfil: "Save changes",
            perfilAjuda: "Your name will be updated in your account.",
            perfilSucesso: "Name updated successfully.",
            perfilErro: "Could not update your name.",

            aparenciaTitulo: "Appearance",
            aparenciaDescricao: "System visual preferences.",
            aparenciaGrupo: "System theme",
            aparenciaAjuda: "Light and dark theme options will be available in a future update.",

            idiomaTitulo: "Language",
            idiomaDescricao: "Choose the language used in Finora settings.",
            idiomaGrupo: "Interface language",
            idiomaAjuda: "Select the language you want to use in this window.",

            segurancaTitulo: "Security",
            segurancaDescricao: "Manage your account security and access.",
            segurancaGrupo: "Account protection",
            redefinirSenha: "Reset password",
            redefinirAjuda: "We will send a reset link to your registered email.",
            enviarEmail: "Send email",
            sairConta: "Sign out",
            sairAjuda: "End your current Finora session.",
            confirmarSaida: "Are you sure you want to sign out?",
            emailEnviado: "Password reset email sent successfully.",
            emailErro: "Could not send the reset email.",
            semSenha: "Your account does not use an email password. Sign in using your original method.",
            sessaoEncerrada: "Session ended.",
            erroGeral: "An error occurred. Please try again.",

            opcaoPt: "Portuguese (Brazil)",
            opcaoEn: "English",
            opcaoEs: "Spanish",
            placeholderNome: "Enter your name"
        },

        "es": {
            menuTitulo: "Preferencias",
            perfil: "Perfil",
            aparencia: "Apariencia",
            idioma: "Idioma",
            seguranca: "Seguridad",
            subtitulo: "Personaliza tu experiencia en Finora",
            fechar: "Cerrar configuración",
            rodape: "Finora — Gestión Financiera",

            perfilTitulo: "Perfil",
            perfilDescricao: "Administra la información de tu cuenta.",
            perfilGrupo: "Información de la cuenta",
            nome: "Nombre",
            email: "Correo electrónico",
            salvarPerfil: "Guardar cambios",
            perfilAjuda: "Tu nombre se actualizará en tu cuenta.",
            perfilSucesso: "Nombre actualizado correctamente.",
            perfilErro: "No se pudo actualizar tu nombre.",

            aparenciaTitulo: "Apariencia",
            aparenciaDescricao: "Preferencias visuales del sistema.",
            aparenciaGrupo: "Tema del sistema",
            aparenciaAjuda: "Las opciones de tema claro y oscuro estarán disponibles en una próxima actualización.",

            idiomaTitulo: "Idioma",
            idiomaDescricao: "Elige el idioma utilizado en la configuración de Finora.",
            idiomaGrupo: "Idioma de la interfaz",
            idiomaAjuda: "Selecciona el idioma que deseas utilizar en esta ventana.",

            segurancaTitulo: "Seguridad",
            segurancaDescricao: "Administra la protección y el acceso a tu cuenta.",
            segurancaGrupo: "Protección de la cuenta",
            redefinirSenha: "Restablecer contraseña",
            redefinirAjuda: "Enviaremos un enlace de restablecimiento a tu correo registrado.",
            enviarEmail: "Enviar correo",
            sairConta: "Cerrar sesión",
            sairAjuda: "Finaliza tu sesión actual en Finora.",
            confirmarSaida: "¿Realmente deseas cerrar sesión?",
            emailEnviado: "Correo de restablecimiento enviado correctamente.",
            emailErro: "No se pudo enviar el correo de restablecimiento.",
            semSenha: "Tu cuenta no utiliza contraseña por correo. Inicia sesión con tu método original.",
            sessaoEncerrada: "Sesión finalizada.",
            erroGeral: "Ocurrió un error. Inténtalo de nuevo.",

            opcaoPt: "Portugués (Brasil)",
            opcaoEn: "Inglés",
            opcaoEs: "Español",
            placeholderNome: "Escribe tu nombre"
        }
    };

    /* ========================================= */
    /* IDIOMA */
    /* ========================================= */

    function obterIdioma() {
        try {
            const idiomaSalvo = localStorage.getItem(CHAVE_IDIOMA);

            return idiomasValidos.includes(idiomaSalvo)
                ? idiomaSalvo
                : "pt-BR";
        } catch (erro) {
            return "pt-BR";
        }
    }

    function salvarIdioma(idioma) {
        if (!idiomasValidos.includes(idioma)) {
            idioma = "pt-BR";
        }

        idiomaAtual = idioma;

        try {
            localStorage.setItem(CHAVE_IDIOMA, idiomaAtual);
        } catch (erro) {
            console.warn("Não foi possível salvar o idioma.", erro);
        }

        document.documentElement.lang = idiomaAtual;
        atualizarJanela();
    }

    /* ========================================= */
    /* ESTILOS COMPLEMENTARES */
    /* ========================================= */

    function adicionarEstilos() {
        if (document.getElementById("finoraConfigEstilos")) {
            return;
        }

        const estilo = document.createElement("style");
        estilo.id = "finoraConfigEstilos";

        estilo.textContent = `
            .config-campo {
                display: flex;
                flex-direction: column;
                gap: 7px;
                margin: 16px 0;
            }

            .config-campo label {
                font-size: 13px;
                font-weight: 600;
            }

            .config-input {
                width: 100%;
                box-sizing: border-box;
                padding: 11px 13px;
                border: 1px solid #dce2ea;
                border-radius: 8px;
                background: #fff;
                color: #202938;
                font: inherit;
                outline: none;
            }

            .config-input:focus {
                border-color: #3978b8;
                box-shadow: 0 0 0 3px rgba(57,120,184,.12);
            }

            .config-botao-acao {
                padding: 10px 16px;
                border: 0;
                border-radius: 8px;
                background: #123c4a;
                color: #fff;
                font-weight: 600;
                cursor: pointer;
            }

            .config-botao-acao:disabled {
                opacity: .6;
                cursor: wait;
            }

            .config-botao-secundario {
                background: #eef1f5;
                color: #273444;
            }

            .config-mensagem {
                margin-top: 12px;
                font-size: 13px;
                line-height: 1.5;
            }

            .config-mensagem.erro {
                color: #c0392b;
            }

            .config-mensagem.sucesso {
                color: #16834a;
            }

            .config-acoes {
                display: flex;
                flex-wrap: wrap;
                gap: 10px;
                margin-top: 16px;
            }

            .config-grupo + .config-grupo {
                margin-top: 22px;
            }
        `;

        document.head.appendChild(estilo);
    }

    /* ========================================= */
    /* CRIAÇÃO DA JANELA */
    /* ========================================= */

    function criarJanela() {
        if (document.getElementById("finoraConfiguracoes")) {
            return;
        }

        const overlay = document.createElement("div");

        overlay.id = "finoraConfiguracoes";
        overlay.className = "config-overlay";
        overlay.setAttribute("aria-hidden", "true");

        overlay.innerHTML = `
            <section
                class="config-janela"
                role="dialog"
                aria-modal="true"
                aria-labelledby="configTitulo"
            >
                <aside class="config-menu">
                    <div class="config-marca">CONFIGURAÇÕES</div>

                    <p class="config-menu-titulo" data-texto="menuTitulo">
                        Preferências
                    </p>

                    <nav
                        class="config-navegacao"
                        aria-label="Configurações"
                        id="configNavegacao"
                    >
                        <button type="button" class="config-nav-item" data-secao="perfil">
                            <span class="config-nav-ponto"></span>
                            <span data-texto="perfil">Perfil</span>
                        </button>

                        <button type="button" class="config-nav-item" data-secao="aparencia">
                            <span class="config-nav-ponto"></span>
                            <span data-texto="aparencia">Aparência</span>
                        </button>

                        <button type="button" class="config-nav-item" data-secao="idioma">
                            <span class="config-nav-ponto"></span>
                            <span data-texto="idioma">Idioma</span>
                        </button>

                        <button type="button" class="config-nav-item" data-secao="seguranca">
                            <span class="config-nav-ponto"></span>
                            <span data-texto="seguranca">Segurança</span>
                        </button>
                    </nav>
                </aside>

                <div class="config-principal">
                    <header class="config-topo">
                        <div>
                            <h2 id="configTitulo">Perfil</h2>
                            <p id="configSubtitulo"></p>
                        </div>

                        <button
                            type="button"
                            class="config-fechar"
                            id="configFechar"
                            aria-label="Fechar configurações"
                            title="Fechar"
                        >×</button>
                    </header>

                    <main class="config-conteudo" id="configConteudo"></main>

                    <footer class="config-rodape" id="configRodape">
                        Finora — Controle de Finanças
                    </footer>
                </div>
            </section>
        `;

        document.body.appendChild(overlay);

        overlay.querySelector("#configFechar")
            .addEventListener("click", fecharJanela);

        overlay.addEventListener("click", function (evento) {
            if (evento.target === overlay) {
                fecharJanela();
            }
        });

        overlay.querySelectorAll("[data-secao]").forEach(function (botao) {
            botao.addEventListener("click", function () {
                secaoAtual = botao.dataset.secao;
                atualizarJanela();
            });
        });

        document.addEventListener("keydown", controlarTeclado);

        atualizarJanela();
    }

    /* ========================================= */
    /* PERFIL */
    /* ========================================= */

    function renderizarPerfil() {
        const t = textos[idiomaAtual];
        const conteudo = document.getElementById("configConteudo");

        const nomeAtual = usuarioAtual?.displayName || "";
        const emailAtual = usuarioAtual?.email || "";

        conteudo.innerHTML = `
            <h3>${t.perfilTitulo}</h3>
            <p class="config-descricao">${t.perfilDescricao}</p>

            <div class="config-grupo">
                <span class="config-grupo-titulo">${t.perfilGrupo}</span>

                <div class="config-campo">
                    <label for="configNome">${t.nome}</label>
                    <input
                        type="text"
                        id="configNome"
                        class="config-input"
                        value="${escaparHTML(nomeAtual)}"
                        placeholder="${t.placeholderNome}"
                        maxlength="80"
                    >
                </div>

                <div class="config-campo">
                    <label for="configEmail">${t.email}</label>
                    <input
                        type="email"
                        id="configEmail"
                        class="config-input"
                        value="${escaparHTML(emailAtual)}"
                        readonly
                    >
                </div>

                <p class="config-grupo-ajuda">${t.perfilAjuda}</p>

                <div class="config-acoes">
                    <button
                        type="button"
                        id="configSalvarPerfil"
                        class="config-botao-acao"
                    >${t.salvarPerfil}</button>
                </div>

                <p
                    id="configMensagemPerfil"
                    class="config-mensagem"
                    role="status"
                    aria-live="polite"
                ></p>
            </div>
        `;

        document.getElementById("configSalvarPerfil")
            .addEventListener("click", salvarPerfil);
    }

    async function salvarPerfil() {
        const t = textos[idiomaAtual];
        const campo = document.getElementById("configNome");
        const botao = document.getElementById("configSalvarPerfil");
        const mensagem = document.getElementById("configMensagemPerfil");

        const nome = campo.value.trim();

        if (!nome) {
            mostrarMensagem(mensagem, t.perfilErro, "erro");
            campo.focus();
            return;
        }

        if (!usuarioAtual || !funcoesAuth) {
            mostrarMensagem(mensagem, t.perfilErro, "erro");
            return;
        }

        botao.disabled = true;

        try {
            await funcoesAuth.updateProfile(usuarioAtual, {
                displayName: nome
            });

            usuarioAtual = auth.currentUser;

            const saudacao = document.querySelector(".henrique");

            if (saudacao) {
                saudacao.textContent = `Olá, ${nome}`;
            }

            mostrarMensagem(mensagem, t.perfilSucesso, "sucesso");

        } catch (erro) {
            console.error("Erro ao atualizar perfil:", erro);
            mostrarMensagem(mensagem, t.perfilErro, "erro");

        } finally {
            botao.disabled = false;
        }
    }

    /* ========================================= */
    /* APARÊNCIA */
    /* ========================================= */

    function renderizarAparencia() {
        const t = textos[idiomaAtual];
        const conteudo = document.getElementById("configConteudo");

        conteudo.innerHTML = `
            <h3>${t.aparenciaTitulo}</h3>
            <p class="config-descricao">${t.aparenciaDescricao}</p>

            <div class="config-grupo">
                <span class="config-grupo-titulo">${t.aparenciaGrupo}</span>
                <p class="config-grupo-ajuda">${t.aparenciaAjuda}</p>
            </div>
        `;
    }

    /* ========================================= */
    /* IDIOMA */
    /* ========================================= */

    function renderizarIdioma() {
        const t = textos[idiomaAtual];
        const conteudo = document.getElementById("configConteudo");

        conteudo.innerHTML = `
            <h3>${t.idiomaTitulo}</h3>
            <p class="config-descricao">${t.idiomaDescricao}</p>

            <div class="config-grupo">
                <label class="config-grupo-titulo" for="configIdioma">
                    ${t.idiomaGrupo}
                </label>

                <p class="config-grupo-ajuda">${t.idiomaAjuda}</p>

                <select id="configIdioma" class="config-idioma">
                    <option value="pt-BR">${t.opcaoPt}</option>
                    <option value="en">${t.opcaoEn}</option>
                    <option value="es">${t.opcaoEs}</option>
                </select>
            </div>
        `;

        const seletor = document.getElementById("configIdioma");
        seletor.value = idiomaAtual;

        seletor.addEventListener("change", function () {
            salvarIdioma(seletor.value);
        });
    }

    /* ========================================= */
    /* SEGURANÇA */
    /* ========================================= */

    function renderizarSeguranca() {
        const t = textos[idiomaAtual];
        const conteudo = document.getElementById("configConteudo");

        const possuiSenha = usuarioAtual?.providerData?.some(function (provedor) {
            return provedor.providerId === "password";
        });

        conteudo.innerHTML = `
            <h3>${t.segurancaTitulo}</h3>
            <p class="config-descricao">${t.segurancaDescricao}</p>

            <div class="config-grupo">
                <span class="config-grupo-titulo">${t.segurancaGrupo}</span>

                <p class="config-grupo-ajuda">${t.redefinirAjuda}</p>

                <div class="config-acoes">
                    <button
                        type="button"
                        id="configRedefinirSenha"
                        class="config-botao-acao config-botao-secundario"
                        ${possuiSenha ? "" : "disabled"}
                    >${t.enviarEmail}</button>
                </div>

                <p
                    id="configMensagemSeguranca"
                    class="config-mensagem"
                    role="status"
                    aria-live="polite"
                ></p>
            </div>

            <div class="config-grupo">
                <span class="config-grupo-titulo">${t.sairConta}</span>
                <p class="config-grupo-ajuda">${t.sairAjuda}</p>

                <div class="config-acoes">
                    <button
                        type="button"
                        id="configSairConta"
                        class="config-botao-acao"
                    >${t.sairConta}</button>
                </div>
            </div>
        `;

        document.getElementById("configRedefinirSenha")
            .addEventListener("click", enviarRedefinicaoSenha);

        document.getElementById("configSairConta")
            .addEventListener("click", sairDaConta);

        if (!possuiSenha) {
            const mensagem = document.getElementById("configMensagemSeguranca");
            mostrarMensagem(mensagem, t.semSenha, "erro");
        }
    }

    async function enviarRedefinicaoSenha() {
        const t = textos[idiomaAtual];
        const botao = document.getElementById("configRedefinirSenha");
        const mensagem = document.getElementById("configMensagemSeguranca");

        if (!usuarioAtual?.email || !funcoesAuth) {
            mostrarMensagem(mensagem, t.emailErro, "erro");
            return;
        }

        botao.disabled = true;

        try {
            await funcoesAuth.sendPasswordResetEmail(
                auth,
                usuarioAtual.email
            );

            mostrarMensagem(mensagem, t.emailEnviado, "sucesso");

        } catch (erro) {
            console.error("Erro ao enviar redefinição:", erro);
            mostrarMensagem(mensagem, t.emailErro, "erro");

        } finally {
            botao.disabled = false;
        }
    }

    async function sairDaConta() {
        const t = textos[idiomaAtual];

        if (!confirm(t.confirmarSaida)) {
            return;
        }

        try {
            await funcoesAuth.signOut(auth);
            window.location.reload();

        } catch (erro) {
            console.error("Erro ao encerrar sessão:", erro);
            alert(t.erroGeral);
        }
    }

    /* ========================================= */
    /* RENDERIZAÇÃO */
    /* ========================================= */

    function renderizarConteudo() {
        const conteudo = document.getElementById("configConteudo");

        if (!conteudo) {
            return;
        }

        if (secaoAtual === "perfil") {
            renderizarPerfil();
        } else if (secaoAtual === "aparencia") {
            renderizarAparencia();
        } else if (secaoAtual === "idioma") {
            renderizarIdioma();
        } else if (secaoAtual === "seguranca") {
            renderizarSeguranca();
        }
    }

    function atualizarJanela() {
        const overlay = document.getElementById("finoraConfiguracoes");

        if (!overlay) {
            return;
        }

        const t = textos[idiomaAtual];

        overlay.querySelectorAll("[data-texto]").forEach(function (elemento) {
            const chave = elemento.dataset.texto;

            if (t[chave]) {
                elemento.textContent = t[chave];
            }
        });

        overlay.querySelectorAll("[data-secao]").forEach(function (botao) {
            const selecionado = botao.dataset.secao === secaoAtual;

            botao.classList.toggle("ativo", selecionado);

            if (selecionado) {
                botao.setAttribute("aria-current", "page");
            } else {
                botao.removeAttribute("aria-current");
            }
        });

        const titulos = {
            perfil: t.perfilTitulo,
            aparencia: t.aparenciaTitulo,
            idioma: t.idiomaTitulo,
            seguranca: t.segurancaTitulo
        };

        document.getElementById("configTitulo").textContent =
            titulos[secaoAtual];

        document.getElementById("configSubtitulo").textContent =
            t.subtitulo;

        document.getElementById("configRodape").textContent =
            t.rodape;

        document.getElementById("configFechar").setAttribute(
            "aria-label",
            t.fechar
        );

        overlay.querySelector(".config-navegacao").setAttribute(
            "aria-label",
            t.menuTitulo
        );

        renderizarConteudo();
    }

    /* ========================================= */
    /* ABRIR E FECHAR */
    /* ========================================= */

    function abrirJanela() {
        const overlay = document.getElementById("finoraConfiguracoes");

        if (!overlay) {
            return;
        }

        focoAnterior = document.activeElement;

        overlay.classList.add("aberta");
        overlay.setAttribute("aria-hidden", "false");

        document.body.classList.add("config-sem-rolagem");

        atualizarJanela();

        document.getElementById("configFechar").focus();
    }

    function fecharJanela() {
        const overlay = document.getElementById("finoraConfiguracoes");

        if (!overlay) {
            return;
        }

        overlay.classList.remove("aberta");
        overlay.setAttribute("aria-hidden", "true");

        document.body.classList.remove("config-sem-rolagem");

        if (focoAnterior && typeof focoAnterior.focus === "function") {
            focoAnterior.focus();
        }
    }

    function controlarTeclado(evento) {
        const overlay = document.getElementById("finoraConfiguracoes");

        if (!overlay || !overlay.classList.contains("aberta")) {
            return;
        }

        if (evento.key === "Escape") {
            fecharJanela();
            return;
        }

        if (evento.key !== "Tab") {
            return;
        }

        const elementos = overlay.querySelectorAll(
            'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href]'
        );

        const primeiro = elementos[0];
        const ultimo = elementos[elementos.length - 1];

        if (!primeiro || !ultimo) {
            return;
        }

        if (evento.shiftKey && document.activeElement === primeiro) {
            evento.preventDefault();
            ultimo.focus();
        } else if (!evento.shiftKey && document.activeElement === ultimo) {
            evento.preventDefault();
            primeiro.focus();
        }
    }

    /* ========================================= */
    /* MENU DE CONFIGURAÇÕES */
    /* ========================================= */

    function conectarMenuConfiguracoes() {
        document.querySelectorAll('a[href="#config"]').forEach(function (link) {
            if (link.dataset.configConectado === "true") {
                return;
            }

            link.dataset.configConectado = "true";

            link.addEventListener("click", function (evento) {
                evento.preventDefault();
                abrirJanela();
            });
        });
    }

    /* ========================================= */
    /* FUNÇÕES AUXILIARES */
    /* ========================================= */

    function mostrarMensagem(elemento, mensagem, tipo) {
        if (!elemento) {
            return;
        }

        elemento.textContent = mensagem;
        elemento.className = `config-mensagem ${tipo || ""}`;
    }

    function escaparHTML(valor) {
        return String(valor || "").replace(/[&<>"']/g, function (caractere) {
            const mapa = {
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#039;"
            };

            return mapa[caractere];
        });
    }

    /* ========================================= */
    /* INICIALIZAÇÃO FIREBASE */
    /* ========================================= */

    async function iniciar() {
        try {
            const moduloDB = await import("./finora-db.js");

            auth = moduloDB.auth;

            const moduloAuth = await import(
                "https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js"
            );

            funcoesAuth = {
                updateProfile: moduloAuth.updateProfile,
                sendPasswordResetEmail: moduloAuth.sendPasswordResetEmail,
                signOut: moduloAuth.signOut
            };

            usuarioAtual = auth.currentUser;

            adicionarEstilos();
            criarJanela();
            conectarMenuConfiguracoes();

            document.documentElement.lang = idiomaAtual;

        } catch (erro) {
            console.error("Erro ao iniciar Configurações:", erro);
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", iniciar);
    } else {
        iniciar();
    }

})();