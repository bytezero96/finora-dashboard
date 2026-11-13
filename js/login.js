// =========================================
// FINORA — AUTENTICAÇÃO
// LOGIN, CADASTRO E RECUPERAÇÃO DE SENHA
// INTEGRAÇÃO COM FIREBASE AUTHENTICATION
// =========================================

import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    sendPasswordResetEmail,
    sendEmailVerification,
    GoogleAuthProvider,
    signInWithPopup,
    updateProfile,
    signOut
} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js";

import { auth } from "./firebase-config.js";

(function () {
    "use strict";

    // =========================================
    // CONFIGURAÇÕES
    // =========================================

    const MINIMO_SENHA = 8;
    const PAGINA_INICIAL = "index.html";

    let modalAnterior = null;

    // =========================================
    // ELEMENTOS
    // =========================================

    const loginForm = document.getElementById("loginForm");
    const registerForm = document.getElementById("registerForm");
    const recoveryForm = document.getElementById("recoveryForm");

    const registerModal = document.getElementById("registerModal");
    const recoveryModal = document.getElementById("recoveryModal");

    const loginMessage = document.getElementById("loginMessage");
    const registerMessage = document.getElementById("registerMessage");
    const recoveryMessage = document.getElementById("recoveryMessage");

    const loginEmail = document.getElementById("loginEmail");
    const loginPassword = document.getElementById("loginPassword");

    const registerName = document.getElementById("registerName");
    const registerEmail = document.getElementById("registerEmail");
    const registerPassword = document.getElementById("registerPassword");
    const registerConfirmPassword = document.getElementById("registerConfirmPassword");

    const recoveryEmail = document.getElementById("recoveryEmail");

    const strengthBar = document.getElementById("strengthBar");
    const strengthText = document.getElementById("strengthText");

    const googleLogin = document.getElementById("googleLogin");

    const currentYear = document.getElementById("currentYear");

    // =========================================
    // VALIDAÇÃO DOS ELEMENTOS
    // =========================================

    if (
        !loginForm ||
        !registerForm ||
        !recoveryForm ||
        !registerModal ||
        !recoveryModal
    ) {
        console.error(
            "Finora: elementos principais da autenticação não encontrados."
        );
        return;
    }

    // =========================================
    // FUNÇÕES AUXILIARES
    // =========================================

    function emailValido(email) {
        const expressao = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return expressao.test(email);
    }

    function mostrarMensagem(elemento, mensagem, tipo = "info") {
        if (!elemento) return;

        elemento.textContent = mensagem;
        elemento.className = "form-message visible " + tipo;
    }

    function limparMensagem(elemento) {
        if (!elemento) return;

        elemento.textContent = "";
        elemento.className = "form-message";
    }

    function limparMensagens() {
        limparMensagem(loginMessage);
        limparMensagem(registerMessage);
        limparMensagem(recoveryMessage);
    }

    function bloquearRolagem(bloquear) {
        document.body.style.overflow = bloquear ? "hidden" : "";
    }

    // Preserva o conteúdo original do botão, inclusive SVGs.
    async function executarComBotao(botao, acao, textoCarregamento = "Aguarde...") {
        if (botao && botao.disabled) return;

        const conteudoOriginal = botao ? botao.innerHTML : "";
        const estavaDesabilitado = botao ? botao.disabled : false;

        if (botao) {
            botao.disabled = true;
            botao.setAttribute("aria-busy", "true");

            const texto = botao.querySelector("span");

            if (texto) {
                texto.textContent = textoCarregamento;
            } else if (botao.id !== "googleLogin") {
                botao.textContent = textoCarregamento;
            }
        }

        try {
            await acao();
        } catch (erro) {
            console.error("Erro inesperado na operação:", erro);

            mostrarMensagem(
                loginMessage,
                "Ocorreu um erro inesperado. Tente novamente.",
                "error"
            );
        } finally {
            if (botao) {
                botao.innerHTML = conteudoOriginal;
                botao.disabled = estavaDesabilitado;
                botao.removeAttribute("aria-busy");
            }
        }
    }

    function obterMensagemErro(erro) {
        const mensagens = {
            "auth/invalid-email":
                "O endereço de e-mail informado é inválido.",

            "auth/user-not-found":
                "Não encontramos uma conta com esse e-mail.",

            "auth/wrong-password":
                "A senha informada está incorreta.",

            "auth/invalid-credential":
                "E-mail ou senha incorretos.",

            "auth/email-already-in-use":
                "Este e-mail já possui uma conta cadastrada.",

            "auth/weak-password":
                "A senha precisa ter pelo menos 6 caracteres.",

            "auth/too-many-requests":
                "Muitas tentativas. Aguarde alguns minutos e tente novamente.",

            "auth/network-request-failed":
                "Falha de conexão. Verifique sua internet.",

            "auth/popup-closed-by-user":
                "A janela de autenticação foi fechada.",

            "auth/popup-blocked":
                "O navegador bloqueou a janela. Permita pop-ups e tente novamente.",

            "auth/cancelled-popup-request":
                "A solicitação de autenticação foi cancelada.",

            "auth/operation-not-allowed":
                "Este método de autenticação ainda não foi ativado no Firebase.",

            "auth/unauthorized-domain":
                "Este domínio ainda não está autorizado no Firebase.",

            "auth/invalid-api-key":
                "A configuração do Firebase está incorreta.",

            "auth/account-exists-with-different-credential":
                "Já existe uma conta com este e-mail usando outro método de acesso.",

            "auth/weak-password":
                "A senha informada é muito fraca.",

            "auth/credential-already-in-use":
                "Esta credencial já está vinculada a outra conta.",

            "auth/internal-error":
                "O Firebase encontrou um erro interno. Tente novamente."
        };

        console.error("Código do erro Firebase:", erro.code || erro);

        return mensagens[erro.code] ||
            "Não foi possível concluir a operação. Verifique sua conexão e tente novamente.";
    }

    // =========================================
    // CONTROLE DOS MODAIS
    // =========================================

    function abrirModal(modal) {
        if (!modal) return;

        fecharTodosModais(false);

        modalAnterior = document.activeElement;

        modal.classList.add("active");
        modal.setAttribute("aria-hidden", "false");

        bloquearRolagem(true);

        const primeiroCampo = modal.querySelector("input");

        if (primeiroCampo) {
            setTimeout(function () {
                primeiroCampo.focus();
            }, 100);
        }
    }

    function fecharModal(modal, restaurarFoco = true) {
        if (!modal) return;

        modal.classList.remove("active");
        modal.setAttribute("aria-hidden", "true");

        if (!document.querySelector(".modal-overlay.active")) {
            bloquearRolagem(false);

            if (
                restaurarFoco &&
                modalAnterior &&
                typeof modalAnterior.focus === "function"
            ) {
                modalAnterior.focus();
            }
        }
    }

    function fecharTodosModais(restaurarFoco = true) {
        document.querySelectorAll(".modal-overlay").forEach(function (modal) {
            modal.classList.remove("active");
            modal.setAttribute("aria-hidden", "true");
        });

        bloquearRolagem(false);

        if (
            restaurarFoco &&
            modalAnterior &&
            typeof modalAnterior.focus === "function"
        ) {
            modalAnterior.focus();
        }
    }

    // =========================================
    // ABRIR CADASTRO
    // =========================================

    const openRegister = document.getElementById("openRegister");

    if (openRegister) {
        openRegister.addEventListener("click", function (evento) {
            evento.preventDefault();

            limparMensagem(registerMessage);
            registerForm.reset();
            atualizarForcaSenha("");

            abrirModal(registerModal);
        });
    }

    // =========================================
    // ABRIR RECUPERAÇÃO DE SENHA
    // =========================================

    const openRecovery = document.getElementById("openRecovery");

    if (openRecovery) {
        openRecovery.addEventListener("click", function (evento) {
            evento.preventDefault();

            limparMensagem(recoveryMessage);
            recoveryForm.reset();

            const emailDigitado = loginEmail.value.trim();

            recoveryEmail.value = emailValido(emailDigitado)
                ? emailDigitado
                : "";

            abrirModal(recoveryModal);
        });
    }

    // =========================================
    // VOLTAR AO LOGIN PELO CADASTRO
    // =========================================

    const backToLogin = document.getElementById("backToLogin");

    if (backToLogin) {
        backToLogin.addEventListener("click", function (evento) {
            evento.preventDefault();

            fecharModal(registerModal);
            limparMensagem(loginMessage);

            loginEmail.focus();
        });
    }

    // =========================================
    // VOLTAR AO LOGIN PELA RECUPERAÇÃO
    // =========================================

    const backFromRecovery = document.getElementById("backFromRecovery");

    if (backFromRecovery) {
        backFromRecovery.addEventListener("click", function (evento) {
            evento.preventDefault();

            fecharModal(recoveryModal);
            limparMensagem(loginMessage);

            loginEmail.focus();
        });
    }

    // =========================================
    // FECHAR PELOS BOTÕES
    // =========================================

    document.querySelectorAll("[data-close-modal]").forEach(function (botao) {
        botao.addEventListener("click", function () {
            const modal = botao.closest(".modal-overlay");
            fecharModal(modal);
        });
    });

    // =========================================
    // FECHAR CLICANDO FORA DO MODAL
    // =========================================

    document.querySelectorAll(".modal-overlay").forEach(function (modal) {
        modal.addEventListener("click", function (evento) {
            if (evento.target === modal) {
                fecharModal(modal);
            }
        });
    });

    // =========================================
    // FECHAR COM ESC
    // =========================================

    document.addEventListener("keydown", function (evento) {
        if (evento.key === "Escape") {
            const modalAberto = document.querySelector(".modal-overlay.active");

            if (modalAberto) {
                fecharModal(modalAberto);
            }
        }
    });

    // =========================================
    // MOSTRAR E OCULTAR SENHA
    // =========================================

    document.querySelectorAll("[data-toggle-password]").forEach(function (botao) {
        botao.addEventListener("click", function (evento) {
            evento.preventDefault();

            const idCampo = botao.getAttribute("data-toggle-password");
            const campo = document.getElementById(idCampo);

            if (!campo) return;

            const mostrar = campo.type === "password";

            campo.type = mostrar ? "text" : "password";

            botao.setAttribute(
                "aria-label",
                mostrar ? "Ocultar senha" : "Mostrar senha"
            );

            botao.setAttribute(
                "aria-pressed",
                mostrar ? "true" : "false"
            );
        });
    });

    // =========================================
    // FORÇA DA SENHA
    // =========================================

    function calcularForcaSenha(senha) {
        let pontos = 0;

        if (senha.length >= MINIMO_SENHA) pontos++;
        if (/[a-z]/.test(senha) && /[A-Z]/.test(senha)) pontos++;
        if (/[0-9]/.test(senha)) pontos++;
        if (/[^a-zA-Z0-9]/.test(senha)) pontos++;

        return pontos;
    }

    function atualizarForcaSenha(senha) {
        if (!strengthBar || !strengthText) return;

        const forca = calcularForcaSenha(senha);

        const estados = [
            {
                largura: "0%",
                cor: "#D94B4B",
                texto: "Use pelo menos 8 caracteres."
            },
            {
                largura: "25%",
                cor: "#D94B4B",
                texto: "Senha fraca."
            },
            {
                largura: "50%",
                cor: "#E5A33D",
                texto: "Senha razoável."
            },
            {
                largura: "75%",
                cor: "#16858A",
                texto: "Senha boa."
            },
            {
                largura: "100%",
                cor: "#16865B",
                texto: "Senha forte."
            }
        ];

        const estado = estados[forca];

        strengthBar.style.width = estado.largura;
        strengthBar.style.background = estado.cor;
        strengthText.textContent = estado.texto;
    }

    if (registerPassword) {
        registerPassword.addEventListener("input", function () {
            atualizarForcaSenha(registerPassword.value);
        });
    }

    // =========================================
    // LOGIN COM E-MAIL E SENHA
    // =========================================

    loginForm.addEventListener("submit", async function (evento) {
        evento.preventDefault();

        limparMensagem(loginMessage);

        const botao = evento.submitter ||
            loginForm.querySelector('[type="submit"]');

        const email = loginEmail.value.trim();
        const senha = loginPassword.value;

        if (!email || !senha) {
            mostrarMensagem(
                loginMessage,
                "Preencha seu e-mail e sua senha.",
                "error"
            );
            return;
        }

        if (!emailValido(email)) {
            mostrarMensagem(
                loginMessage,
                "Informe um endereço de e-mail válido.",
                "error"
            );

            loginEmail.focus();
            return;
        }

        await executarComBotao(botao, async function () {
            try {
                const resultado = await signInWithEmailAndPassword(
                    auth,
                    email,
                    senha
                );

                const usuario = resultado.user;

                if (!usuario.emailVerified) {
                    try {
                        await sendEmailVerification(usuario);
                    } catch (erroVerificacao) {
                        console.warn(
                            "Não foi possível reenviar a verificação:",
                            erroVerificacao
                        );
                    }

                    await signOut(auth);

                    mostrarMensagem(
                        loginMessage,
                        "Seu e-mail ainda não foi confirmado. Verifique sua caixa de entrada e confirme o endereço antes de entrar.",
                        "error"
                    );

                    return;
                }

                mostrarMensagem(
                    loginMessage,
                    "Login realizado com sucesso! Redirecionando...",
                    "success"
                );

                window.location.replace(PAGINA_INICIAL);

            } catch (erro) {
                console.error("Erro no login:", erro);

                mostrarMensagem(
                    loginMessage,
                    obterMensagemErro(erro),
                    "error"
                );
            }
        }, "Entrando...");
    });

    // =========================================
    // LOGIN COM GOOGLE
    // =========================================

    if (googleLogin) {
        googleLogin.addEventListener("click", async function (evento) {
            evento.preventDefault();

            limparMensagem(loginMessage);

            await executarComBotao(googleLogin, async function () {
                try {
                    const provedor = new GoogleAuthProvider();

                    provedor.setCustomParameters({
                        prompt: "select_account"
                    });

                    const resultado = await signInWithPopup(
                        auth,
                        provedor
                    );

                    if (!resultado.user) {
                        throw new Error("Usuário não retornado pelo Firebase.");
                    }

                    window.location.replace(PAGINA_INICIAL);

                } catch (erro) {
                    console.error("Erro no login com Google:", erro);

                    mostrarMensagem(
                        loginMessage,
                        obterMensagemErro(erro),
                        "error"
                    );
                }
            }, "Conectando...");
        });
    }

    // =========================================
    // CRIAÇÃO DE CONTA
    // =========================================

    registerForm.addEventListener("submit", async function (evento) {
        evento.preventDefault();

        limparMensagem(registerMessage);

        const botao = evento.submitter ||
            registerForm.querySelector('[type="submit"]');

        const nome = registerName.value.trim();
        const email = registerEmail.value.trim();
        const senha = registerPassword.value;
        const confirmarSenha = registerConfirmPassword.value;

        if (!nome || !email || !senha || !confirmarSenha) {
            mostrarMensagem(
                registerMessage,
                "Preencha todos os campos para continuar.",
                "error"
            );
            return;
        }

        if (nome.length < 2) {
            mostrarMensagem(
                registerMessage,
                "Informe um nome válido.",
                "error"
            );

            registerName.focus();
            return;
        }

        if (!emailValido(email)) {
            mostrarMensagem(
                registerMessage,
                "Informe um endereço de e-mail válido.",
                "error"
            );

            registerEmail.focus();
            return;
        }

        if (senha.length < MINIMO_SENHA) {
            mostrarMensagem(
                registerMessage,
                "Sua senha precisa ter pelo menos 8 caracteres.",
                "error"
            );

            registerPassword.focus();
            return;
        }

        if (senha !== confirmarSenha) {
            mostrarMensagem(
                registerMessage,
                "As senhas não coincidem. Confira os dois campos.",
                "error"
            );

            registerConfirmPassword.focus();
            return;
        }

        await executarComBotao(botao, async function () {
            let usuarioCriado = null;

            try {
                const resultado = await createUserWithEmailAndPassword(
                    auth,
                    email,
                    senha
                );

                usuarioCriado = resultado.user;

                await updateProfile(usuarioCriado, {
                    displayName: nome
                });

                await sendEmailVerification(usuarioCriado);

                await signOut(auth);

                registerForm.reset();
                atualizarForcaSenha("");

                mostrarMensagem(
                    registerMessage,
                    "Conta criada! Enviamos um link de confirmação para seu e-mail. Confirme o endereço antes de fazer login.",
                    "success"
                );

            } catch (erro) {
                console.error("Erro no cadastro:", erro);

                if (usuarioCriado) {
                    try {
                        await signOut(auth);
                    } catch (erroSaida) {
                        console.warn("Erro ao encerrar sessão:", erroSaida);
                    }

                    mostrarMensagem(
                        registerMessage,
                        "Sua conta foi criada, mas não conseguimos concluir o envio do e-mail de confirmação. Tente entrar novamente ou solicite o reenvio da confirmação.",
                        "error"
                    );

                    return;
                }

                mostrarMensagem(
                    registerMessage,
                    obterMensagemErro(erro),
                    "error"
                );
            }
        }, "Criando conta...");
    });

    // =========================================
    // RECUPERAÇÃO DE SENHA
    // =========================================

    recoveryForm.addEventListener("submit", async function (evento) {
        evento.preventDefault();

        limparMensagem(recoveryMessage);

        const botao = evento.submitter ||
            recoveryForm.querySelector('[type="submit"]');

        const email = recoveryEmail.value.trim();

        if (!email) {
            mostrarMensagem(
                recoveryMessage,
                "Informe o e-mail cadastrado.",
                "error"
            );
            return;
        }

        if (!emailValido(email)) {
            mostrarMensagem(
                recoveryMessage,
                "Informe um endereço de e-mail válido.",
                "error"
            );

            recoveryEmail.focus();
            return;
        }

        await executarComBotao(botao, async function () {
            try {
                await sendPasswordResetEmail(auth, email);

                mostrarMensagem(
                    recoveryMessage,
                    "Se existir uma conta associada a esse endereço, você receberá um e-mail com as instruções para redefinir sua senha.",
                    "success"
                );

            } catch (erro) {
                console.error("Erro na recuperação:", erro);

                mostrarMensagem(
                    recoveryMessage,
                    obterMensagemErro(erro),
                    "error"
                );
            }
        }, "Enviando...");
    });

    // =========================================
    // ANO AUTOMÁTICO NO RODAPÉ
    // =========================================

    if (currentYear) {
        currentYear.textContent = new Date().getFullYear();
    }

    // =========================================
    // INICIALIZAÇÃO
    // =========================================

    limparMensagens();
    atualizarForcaSenha("");

    console.log("Finora: autenticação inicializada.");

})();