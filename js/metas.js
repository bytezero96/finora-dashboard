
/* ========================================= */
/* FINORA — METAS FINANCEIRAS */
/* FIRESTORE */
/* CADASTRO, PROGRESSO E MOVIMENTAÇÕES */
/* ========================================= */

import {
    listarRegistros,
    salvarRegistro,
    executarLote
} from "./finora-db.js";

(function () {
    "use strict";

    /* ========================================= */
    /* COLEÇÕES */
    /* ========================================= */

    const COLECAO_METAS = "metas";
    const COLECAO_MOVIMENTACOES = "movimentacoes_metas";

    const CHAVE_METAS_LEGADAS = "finora_metas";
    const CHAVE_MOVIMENTACOES_LEGADAS = "finora_movimentacoes_metas";

    const LIMITE_LOTE = 450;

    /* ========================================= */
    /* ELEMENTOS */
    /* ========================================= */

    const formulario = document.getElementById("formMetas");
    const listaMetas = document.getElementById("listaMetas");
    const listaMovimentacoes = document.getElementById("listaMovimentacoesMetas");
    const mensagem = document.getElementById("mensagemMetas");
    const botaoSalvar = document.getElementById("btnSalvarMeta");

    const campoNome = document.getElementById("metaNome");
    const campoCategoria = document.getElementById("metaCategoria");
    const campoObjetivo = document.getElementById("metaValorObjetivo");
    const campoInicial = document.getElementById("metaValorInicial");
    const campoPrazo = document.getElementById("metaPrazo");
    const campoInstituicao = document.getElementById("metaInstituicao");
    const campoObservacao = document.getElementById("metaObservacao");

    /* ========================================= */
    /* ESTADO */
    /* ========================================= */

    let metas = [];
    let movimentacoes = [];

    let metaEmEdicao = null;
    let tipoMovimentacaoAtual = null;
    let metaMovimentacaoAtual = null;

    let carregando = false;
    let operacaoEmAndamento = false;

    /* ========================================= */
    /* FUNÇÕES AUXILIARES */
    /* ========================================= */

    function gerarId() {
        return (
            Date.now().toString(36) +
            Math.random().toString(36).substring(2, 9)
        );
    }

    function escaparHTML(valor) {
        return String(valor ?? "").replace(/[&<>"']/g, function (caractere) {
            const caracteres = {
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#039;"
            };

            return caracteres[caractere];
        });
    }

    function formatarMoeda(valor) {
        return Number(valor || 0).toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL"
        });
    }

    function formatarData(data) {
        if (!data) return "—";

        const partes = String(data).split("-");

        if (partes.length !== 3) return "—";

        return `${partes[2]}/${partes[1]}/${partes[0]}`;
    }

    function obterDataAtual() {
        const hoje = new Date();
        const ano = hoje.getFullYear();
        const mes = String(hoje.getMonth() + 1).padStart(2, "0");
        const dia = String(hoje.getDate()).padStart(2, "0");

        return `${ano}-${mes}-${dia}`;
    }

    function normalizarNumero(valor) {
        const numero = Number(valor);

        return Number.isFinite(numero) ? numero : 0;
    }

    function exibirMensagem(texto, tipo = "sucesso") {
        if (!mensagem) return;

        mensagem.textContent = texto;
        mensagem.className = `mensagem-metas ${tipo}`;
        mensagem.style.display = "block";

        clearTimeout(exibirMensagem.timer);

        exibirMensagem.timer = setTimeout(function () {
            mensagem.style.display = "none";
        }, 4000);
    }

    function obterMeta(id) {
        return metas.find(meta => String(meta.id) === String(id));
    }

    function obterMovimentacao(id) {
        return movimentacoes.find(
            item => String(item.id) === String(id)
        );
    }

    function calcularPercentual(meta) {
        const objetivo = normalizarNumero(meta.valorObjetivo);
        const acumulado = normalizarNumero(meta.valorAcumulado);

        if (objetivo <= 0) return 0;

        return Math.min(100, Math.max(0, (acumulado / objetivo) * 100));
    }

    function obterStatus(meta) {
        const acumulado = normalizarNumero(meta.valorAcumulado);
        const objetivo = normalizarNumero(meta.valorObjetivo);

        if (objetivo > 0 && acumulado >= objetivo) {
            return "concluida";
        }

        if (meta.prazo && meta.prazo < obterDataAtual()) {
            return "atrasada";
        }

        return "ativa";
    }

    function obterTextoStatus(status) {
        const textos = {
            ativa: "Em andamento",
            concluida: "Concluída",
            atrasada: "Prazo vencido"
        };

        return textos[status] || "Em andamento";
    }

    function definirBotaoCarregando(botao, estado) {
        if (!botao) return;

        botao.disabled = estado;
    }

    function atualizarBotaoSalvar() {
        if (!botaoSalvar) return;

        botaoSalvar.disabled = false;

        if (metaEmEdicao) {
            botaoSalvar.innerHTML = `
                <i class="fa-solid fa-check" aria-hidden="true"></i>
                Salvar alterações
            `;
        } else {
            botaoSalvar.innerHTML = `
                <i class="fa-solid fa-plus" aria-hidden="true"></i>
                Criar meta
            `;
        }
    }

    async function executarOperacoesEmLotes(operacoes) {
        for (let i = 0; i < operacoes.length; i += LIMITE_LOTE) {
            const lote = operacoes.slice(i, i + LIMITE_LOTE);

            await executarLote(lote);
        }
    }

    /* ========================================= */
    /* MIGRAÇÃO DOS DADOS ANTIGOS */
    /* ========================================= */

    function obterDadosLegados(chave) {
        try {
            const conteudo = sessionStorage.getItem(chave);

            if (!conteudo) return [];

            const dados = JSON.parse(conteudo);

            return Array.isArray(dados) ? dados : [];

        } catch (erro) {
            console.error(`Erro ao ler dados antigos (${chave}):`, erro);
            return [];
        }
    }

    async function migrarDadosLegadosSeNecessario() {
        const metasAntigas = obterDadosLegados(CHAVE_METAS_LEGADAS);

        const movimentacoesAntigas = obterDadosLegados(
            CHAVE_MOVIMENTACOES_LEGADAS
        );

        if (
            metasAntigas.length === 0 &&
            movimentacoesAntigas.length === 0
        ) {
            return false;
        }

        const idsMetasExistentes = new Set(
            metas.map(meta => String(meta.id))
        );

        const idsMovimentacoesExistentes = new Set(
            movimentacoes.map(item => String(item.id))
        );

        const operacoes = [];

        metasAntigas.forEach(function (meta) {
            if (!meta || !meta.id) return;

            const id = String(meta.id);

            if (idsMetasExistentes.has(id)) return;

            operacoes.push({
                tipo: "salvar",
                colecao: COLECAO_METAS,
                id,
                dados: {
                    ...meta,
                    id
                }
            });

            idsMetasExistentes.add(id);
        });

        movimentacoesAntigas.forEach(function (movimentacao) {
            if (!movimentacao || !movimentacao.id) return;

            const id = String(movimentacao.id);

            if (idsMovimentacoesExistentes.has(id)) return;

            operacoes.push({
                tipo: "salvar",
                colecao: COLECAO_MOVIMENTACOES,
                id,
                dados: {
                    ...movimentacao,
                    id
                }
            });

            idsMovimentacoesExistentes.add(id);
        });

        if (operacoes.length > 0) {
            await executarOperacoesEmLotes(operacoes);
        }

        /*
         * Só remove os dados antigos depois que todas
         * as operações de migração forem concluídas.
         *
         * Se ocorrer erro, os dados antigos permanecem
         * disponíveis para uma nova tentativa.
         */

        sessionStorage.removeItem(CHAVE_METAS_LEGADAS);
        sessionStorage.removeItem(CHAVE_MOVIMENTACOES_LEGADAS);

        console.info(
            `${operacoes.length} registros antigos de metas processados.`
        );

        return operacoes.length > 0;
    }

    /* ========================================= */
    /* CARREGAMENTO DO FIRESTORE */
    /* ========================================= */

    async function carregarDadosMetas() {
        if (carregando) return;

        carregando = true;

        try {
            const [metasBanco, movimentacoesBanco] = await Promise.all([
                listarRegistros(COLECAO_METAS),
                listarRegistros(COLECAO_MOVIMENTACOES)
            ]);

            metas = Array.isArray(metasBanco) ? metasBanco : [];

            movimentacoes = Array.isArray(movimentacoesBanco)
                ? movimentacoesBanco
                : [];

            const houveMigracao = await migrarDadosLegadosSeNecessario();

            if (houveMigracao) {
                const [metasAtualizadas, movimentacoesAtualizadas] =
                    await Promise.all([
                        listarRegistros(COLECAO_METAS),
                        listarRegistros(COLECAO_MOVIMENTACOES)
                    ]);

                metas = Array.isArray(metasAtualizadas)
                    ? metasAtualizadas
                    : [];

                movimentacoes = Array.isArray(movimentacoesAtualizadas)
                    ? movimentacoesAtualizadas
                    : [];
            }

            atualizarTela();

        } catch (erro) {
            console.error("Erro ao carregar metas do Firestore:", erro);

            exibirMensagem(
                "Não foi possível carregar suas metas. Verifique sua conexão e tente novamente.",
                "erro"
            );

        } finally {
            carregando = false;
        }
    }

    /* ========================================= */
    /* RESUMO FINANCEIRO */
    /* ========================================= */

    function atualizarResumo() {
        const totalAcumulado = metas.reduce(function (total, meta) {
            return total + normalizarNumero(meta.valorAcumulado);
        }, 0);

        const metasConcluidas = metas.filter(function (meta) {
            return obterStatus(meta) === "concluida";
        }).length;

        const metasAtivas = metas.length - metasConcluidas;

        const total = document.getElementById("totalAcumuladoMetas");
        const ativas = document.getElementById("quantidadeMetasAtivas");
        const concluidas = document.getElementById("quantidadeMetasConcluidas");

        if (total) total.textContent = formatarMoeda(totalAcumulado);
        if (ativas) ativas.textContent = metasAtivas;
        if (concluidas) concluidas.textContent = metasConcluidas;
    }

    /* ========================================= */
    /* LISTAGEM DAS METAS */
    /* ========================================= */

    function renderizarMetas() {
        if (!listaMetas) return;

        if (metas.length === 0) {
            listaMetas.innerHTML = `
                <div class="metas-vazio">
                    <i class="fa-solid fa-bullseye"></i>
                    <p>Nenhuma meta cadastrada</p>
                    <span>Cadastre sua primeira meta e acompanhe seu progresso.</span>
                </div>
            `;

            return;
        }

        const metasOrdenadas = [...metas].sort(function (a, b) {
            const statusA = obterStatus(a);
            const statusB = obterStatus(b);

            if (statusA === "concluida" && statusB !== "concluida") return 1;
            if (statusA !== "concluida" && statusB === "concluida") return -1;

            return String(a.prazo || "").localeCompare(String(b.prazo || ""));
        });

        listaMetas.innerHTML = metasOrdenadas.map(function (meta) {
            const percentual = calcularPercentual(meta);
            const status = obterStatus(meta);
            const acumulado = normalizarNumero(meta.valorAcumulado);
            const objetivo = normalizarNumero(meta.valorObjetivo);
            const restante = Math.max(0, objetivo - acumulado);

            let classeCard = "pendente";

            if (status === "concluida") classeCard = "concluida";
            else if (status === "atrasada") classeCard = "atrasada";

            return `
                <article class="card-meta ${classeCard}" data-meta-id="${escaparHTML(meta.id)}">

                    <div class="card-meta-cabecalho">
                        <div class="card-meta-identificacao">
                            <h3>${escaparHTML(meta.nome)}</h3>
                            <span class="card-meta-categoria">
                                ${escaparHTML(meta.categoria || "Outros")}
                            </span>
                        </div>

                        <span class="status-meta ${status}">
                            ${obterTextoStatus(status)}
                        </span>
                    </div>

                    <div class="card-meta-valores">
                        <div class="meta-valor-acumulado">
                            <span>Valor acumulado</span>
                            <strong>${formatarMoeda(acumulado)}</strong>
                        </div>

                        <div class="meta-valor-objetivo">
                            <span>Objetivo</span>
                            <strong>${formatarMoeda(objetivo)}</strong>
                        </div>
                    </div>

                    <div class="barra-progresso-meta">
                        <div
                            class="progresso-meta"
                            style="width: ${percentual.toFixed(2)}%;"
                        ></div>
                    </div>

                    <div class="percentual-meta">
                        <span>${percentual.toFixed(1).replace(".", ",")}% concluído</span>
                        <span>
                            ${status === "concluida"
                                ? "Objetivo alcançado"
                                : `Faltam ${formatarMoeda(restante)}`}
                        </span>
                    </div>

                    <div class="card-meta-detalhes">
                        <span>
                            <i class="fa-regular fa-calendar"></i>
                            Prazo: ${formatarData(meta.prazo)}
                        </span>

                        ${meta.instituicao ? `
                            <span>
                                <i class="fa-solid fa-building-columns"></i>
                                ${escaparHTML(meta.instituicao)}
                            </span>
                        ` : ""}
                    </div>

                    ${meta.observacao ? `
                        <p class="observacao-meta">
                            ${escaparHTML(meta.observacao)}
                        </p>
                    ` : ""}

                    <div class="acoes-meta">
                        <button
                            type="button"
                            class="btn-adicionar-meta"
                            data-acao="aporte"
                            data-id="${escaparHTML(meta.id)}"
                        >
                            <i class="fa-solid fa-plus"></i>
                            Aportar
                        </button>

                        <button
                            type="button"
                            class="btn-adicionar-meta"
                            data-acao="retirada"
                            data-id="${escaparHTML(meta.id)}"
                        >
                            <i class="fa-solid fa-minus"></i>
                            Retirar
                        </button>

                        <button
                            type="button"
                            class="btn-editar-meta"
                            data-acao="editar"
                            data-id="${escaparHTML(meta.id)}"
                            title="Editar meta"
                        >
                            <i class="fa-solid fa-pen"></i>
                        </button>

                        <button
                            type="button"
                            class="btn-excluir-meta"
                            data-acao="excluir"
                            data-id="${escaparHTML(meta.id)}"
                            title="Excluir meta"
                        >
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </article>
            `;
        }).join("");
    }

    /* ========================================= */
    /* HISTÓRICO DE MOVIMENTAÇÕES */
    /* ========================================= */

    function renderizarMovimentacoes() {
        if (!listaMovimentacoes) return;

        const ordenadas = [...movimentacoes].sort(function (a, b) {
            return (
                String(b.data || "").localeCompare(String(a.data || "")) ||
                String(b.id || "").localeCompare(String(a.id || ""))
            );
        });

        if (ordenadas.length === 0) {
            listaMovimentacoes.innerHTML = `
                <tr>
                    <td colspan="5" class="metas-historico-vazio">
                        Nenhuma movimentação registrada.
                    </td>
                </tr>
            `;

            return;
        }

        listaMovimentacoes.innerHTML = ordenadas.map(function (movimentacao) {
            const ehAporte = movimentacao.tipo === "aporte";

            return `
                <tr>
                    <td>${escaparHTML(movimentacao.metaNome || "Meta removida")}</td>

                    <td>
                        <span class="tipo-movimentacao-meta ${ehAporte ? "aporte" : "retirada"}">
                            ${ehAporte ? "Aporte" : "Retirada"}
                        </span>
                    </td>

                    <td>${formatarData(movimentacao.data)}</td>

                    <td class="${ehAporte ? "valor-aporte-meta" : "valor-retirada-meta"}">
                        ${ehAporte ? "+" : "-"} ${formatarMoeda(movimentacao.valor)}
                    </td>

                    <td>
                        <div class="acoes-movimentacao-meta">
                            <button
                                type="button"
                                class="btn-excluir-movimentacao-meta"
                                data-acao="excluir-movimentacao"
                                data-id="${escaparHTML(movimentacao.id)}"
                                title="Excluir movimentação"
                            >
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join("");
    }

    function atualizarTela() {
        atualizarResumo();
        renderizarMetas();
        renderizarMovimentacoes();
    }

    /* ========================================= */
    /* FORMULÁRIO */
    /* ========================================= */

    function limparFormulario() {
        if (!formulario) return;

        formulario.reset();

        metaEmEdicao = null;

        campoInicial.disabled = false;
        campoInicial.value = "0";

        atualizarBotaoSalvar();

        const botaoCancelar = document.getElementById("btnCancelarEdicaoMeta");

        if (botaoCancelar) botaoCancelar.remove();
    }

    function prepararBotaoCancelar() {
        if (document.getElementById("btnCancelarEdicaoMeta")) return;

        const areaBotoes = botaoSalvar.parentElement;

        if (!areaBotoes) return;

        const botaoCancelar = document.createElement("button");

        botaoCancelar.type = "button";
        botaoCancelar.id = "btnCancelarEdicaoMeta";
        botaoCancelar.className = "btn-cancelar-meta";
        botaoCancelar.textContent = "Cancelar";

        botaoCancelar.addEventListener("click", limparFormulario);

        areaBotoes.appendChild(botaoCancelar);
    }

    async function salvarMeta(evento) {
        evento.preventDefault();

        if (carregando || operacaoEmAndamento) return;

        const estavaEditando = Boolean(metaEmEdicao);

        const nome = campoNome.value.trim();
        const categoria = campoCategoria.value;
        const objetivo = Number(campoObjetivo.value);
        const prazo = campoPrazo.value;
        const instituicao = campoInstituicao.value.trim();
        const observacao = campoObservacao.value.trim();

        if (!nome) {
            exibirMensagem("Informe o nome da meta.", "erro");
            campoNome.focus();
            return;
        }

        if (!categoria) {
            exibirMensagem("Selecione uma categoria.", "erro");
            campoCategoria.focus();
            return;
        }

        if (!Number.isFinite(objetivo) || objetivo <= 0) {
            exibirMensagem("Informe um valor de objetivo válido.", "erro");
            campoObjetivo.focus();
            return;
        }

        if (campoInicial.value.trim() === "" && !estavaEditando) {
            campoInicial.value = "0";
        }

        const valorInicial = Number(campoInicial.value || 0);

        if (!estavaEditando && (!Number.isFinite(valorInicial) || valorInicial < 0)) {
            exibirMensagem("Informe um valor inicial válido.", "erro");
            campoInicial.focus();
            return;
        }

        operacaoEmAndamento = true;
        definirBotaoCarregando(botaoSalvar, true);

        try {
            if (estavaEditando) {
                const meta = obterMeta(metaEmEdicao);

                if (!meta) {
                    exibirMensagem("Não foi possível localizar a meta.", "erro");
                    limparFormulario();
                    return;
                }

                const metaAtualizada = {
                    ...meta,
                    nome,
                    categoria,
                    valorObjetivo: objetivo,
                    prazo,
                    instituicao,
                    observacao,
                    dataAtualizacao: obterDataAtual()
                };

                const movimentacoesAtualizadas = movimentacoes.filter(
                    item => String(item.metaId) === String(meta.id)
                );

                const operacoes = [{
                    tipo: "salvar",
                    colecao: COLECAO_METAS,
                    id: String(meta.id),
                    dados: metaAtualizada
                }];

                movimentacoesAtualizadas.forEach(function (item) {
                    operacoes.push({
                        tipo: "salvar",
                        colecao: COLECAO_MOVIMENTACOES,
                        id: String(item.id),
                        dados: {
                            ...item,
                            metaNome: nome
                        }
                    });
                });

                await executarOperacoesEmLotes(operacoes);

                metas = metas.map(item =>
                    String(item.id) === String(meta.id)
                        ? metaAtualizada
                        : item
                );

                movimentacoes = movimentacoes.map(function (item) {
                    return String(item.metaId) === String(meta.id)
                        ? { ...item, metaNome: nome }
                        : item;
                });

                limparFormulario();
                atualizarTela();

                exibirMensagem("Meta atualizada com sucesso!");

            } else {
                const novaMeta = {
                    id: gerarId(),
                    nome,
                    categoria,
                    valorObjetivo: objetivo,
                    valorAcumulado: valorInicial,
                    prazo,
                    instituicao,
                    observacao,
                    dataCriacao: obterDataAtual()
                };

                await salvarRegistro(
                    COLECAO_METAS,
                    novaMeta,
                    novaMeta.id
                );

                metas.push(novaMeta);

                limparFormulario();
                atualizarTela();

                exibirMensagem("Meta cadastrada com sucesso!");
            }

        } catch (erro) {
            console.error("Erro ao salvar meta:", erro);

            exibirMensagem(
                "Não foi possível salvar a meta. Tente novamente.",
                "erro"
            );

        } finally {
            operacaoEmAndamento = false;

            atualizarBotaoSalvar();
        }
    }

    function editarMeta(id) {
        if (operacaoEmAndamento) return;

        const meta = obterMeta(id);

        if (!meta) return;

        metaEmEdicao = meta.id;

        campoNome.value = meta.nome || "";
        campoCategoria.value = meta.categoria || "Outros";
        campoObjetivo.value = meta.valorObjetivo || "";
        campoInicial.value = meta.valorAcumulado || 0;
        campoPrazo.value = meta.prazo || "";
        campoInstituicao.value = meta.instituicao || "";
        campoObservacao.value = meta.observacao || "";

        campoInicial.disabled = true;

        atualizarBotaoSalvar();
        prepararBotaoCancelar();

        formulario.scrollIntoView({
            behavior: "smooth",
            block: "center"
        });

        campoNome.focus({ preventScroll: true });
    }

    /* ========================================= */
    /* EXCLUSÃO DE METAS */
    /* ========================================= */

    async function excluirMeta(id) {
        if (operacaoEmAndamento) return;

        const meta = obterMeta(id);

        if (!meta) return;

        const confirmar = confirm(
            `Deseja realmente excluir a meta "${meta.nome}"?\n\n` +
            "As movimentações vinculadas a ela também serão excluídas."
        );

        if (!confirmar) return;

        operacaoEmAndamento = true;

        try {
            const vinculadas = movimentacoes.filter(
                item => String(item.metaId) === String(id)
            );

            const operacoes = [{
                tipo: "excluir",
                colecao: COLECAO_METAS,
                id: String(id)
            }];

            vinculadas.forEach(function (item) {
                operacoes.push({
                    tipo: "excluir",
                    colecao: COLECAO_MOVIMENTACOES,
                    id: String(item.id)
                });
            });

            await executarOperacoesEmLotes(operacoes);

            metas = metas.filter(item => String(item.id) !== String(id));

            movimentacoes = movimentacoes.filter(
                item => String(item.metaId) !== String(id)
            );

            if (String(metaEmEdicao) === String(id)) {
                limparFormulario();
            }

            atualizarTela();

            exibirMensagem("Meta excluída com sucesso!");

        } catch (erro) {
            console.error("Erro ao excluir meta:", erro);

            exibirMensagem(
                "Não foi possível excluir a meta.",
                "erro"
            );

        } finally {
            operacaoEmAndamento = false;
        }
    }

    /* ========================================= */
    /* MODAL DE MOVIMENTAÇÕES */
    /* ========================================= */

    function criarModalMovimentacao() {
        if (document.getElementById("modalMovimentacaoMeta")) return;

        const estilo = document.createElement("style");

        estilo.id = "estiloModalMetas";

        estilo.textContent = `
            .modal-meta-overlay {
                position: fixed;
                inset: 0;
                z-index: 9999;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
                background: rgba(11, 19, 43, 0.48);
                backdrop-filter: blur(3px);
            }

            .modal-meta {
                width: 100%;
                max-width: 440px;
                padding: 28px;
                background: #FFFFFF;
                border: 1px solid #E8EDF3;
                border-radius: 16px;
                box-shadow: 0 18px 55px rgba(15, 23, 42, 0.18);
            }

            .modal-meta-cabecalho {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                gap: 16px;
                margin-bottom: 22px;
            }

            .modal-meta-cabecalho h3 {
                margin: 0 0 6px;
                color: #0B132B;
                font-size: 19px;
            }

            .modal-meta-cabecalho p {
                margin: 0;
                color: #64748B;
                font-size: 13px;
            }

            .modal-meta-fechar {
                border: 0;
                background: transparent;
                color: #64748B;
                font-size: 20px;
                cursor: pointer;
            }

            .modal-meta-campo {
                display: flex;
                flex-direction: column;
                gap: 7px;
                margin-bottom: 17px;
            }

            .modal-meta-campo label {
                color: #334155;
                font-size: 13px;
                font-weight: 600;
            }

            .modal-meta-campo input {
                width: 100%;
                min-height: 44px;
                padding: 10px 12px;
                border: 1px solid #DCE3EC;
                border-radius: 8px;
                outline: none;
                box-sizing: border-box;
                color: #0F172A;
                background: #FFFFFF;
                font: inherit;
            }

            .modal-meta-campo input:focus {
                border-color: #0D9488;
                box-shadow: 0 0 0 3px rgba(13, 148, 136, 0.10);
            }

            .modal-meta-acoes {
                display: flex;
                justify-content: flex-end;
                gap: 10px;
                margin-top: 24px;
            }

            .modal-meta-acoes button {
                min-height: 42px;
                padding: 0 17px;
                border: 0;
                border-radius: 8px;
                font-size: 13px;
                font-weight: 600;
                cursor: pointer;
            }

            .modal-meta-cancelar {
                color: #475569;
                background: #F1F5F9;
            }

            .modal-meta-confirmar {
                color: #FFFFFF;
                background: #0D9488;
            }

            .modal-meta-confirmar.retirada {
                background: #D97706;
            }

            .modal-meta-confirmar:disabled {
                opacity: 0.6;
                cursor: not-allowed;
            }

            .btn-cancelar-meta {
                min-height: 42px;
                padding: 0 17px;
                border: 1px solid #DCE3EC;
                border-radius: 8px;
                background: #FFFFFF;
                color: #475569;
                font-size: 13px;
                font-weight: 600;
                cursor: pointer;
            }

            .metas-historico-vazio {
                padding: 22px !important;
                text-align: center;
                color: #64748B;
            }

            .observacao-meta {
                margin: 14px 0 0;
                color: #64748B;
                font-size: 13px;
                line-height: 1.5;
                overflow-wrap: anywhere;
            }

            @media (max-width: 480px) {
                .modal-meta {
                    padding: 22px;
                }

                .modal-meta-acoes {
                    flex-direction: column-reverse;
                }

                .modal-meta-acoes button {
                    width: 100%;
                }
            }
        `;

        document.head.appendChild(estilo);

        const overlay = document.createElement("div");

        overlay.id = "modalMovimentacaoMeta";
        overlay.className = "modal-meta-overlay";
        overlay.style.display = "none";

        overlay.innerHTML = `
            <div class="modal-meta" role="dialog" aria-modal="true" aria-labelledby="tituloModalMeta">

                <div class="modal-meta-cabecalho">
                    <div>
                        <h3 id="tituloModalMeta">Nova movimentação</h3>
                        <p id="descricaoModalMeta"></p>
                    </div>

                    <button
                        type="button"
                        class="modal-meta-fechar"
                        data-fechar-modal
                        aria-label="Fechar"
                    >
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>

                <form id="formMovimentacaoMeta">
                    <div class="modal-meta-campo">
                        <label for="valorMovimentacaoMeta">Valor (R$)</label>
                        <input
                            type="number"
                            id="valorMovimentacaoMeta"
                            min="0.01"
                            step="0.01"
                            placeholder="0,00"
                            required
                        >
                    </div>

                    <div class="modal-meta-campo">
                        <label for="dataMovimentacaoMeta">Data</label>
                        <input
                            type="date"
                            id="dataMovimentacaoMeta"
                            value="${obterDataAtual()}"
                            required
                        >
                    </div>

                    <div class="modal-meta-acoes">
                        <button
                            type="button"
                            class="modal-meta-cancelar"
                            data-fechar-modal
                        >
                            Cancelar
                        </button>

                        <button
                            type="submit"
                            id="btnConfirmarMovimentacaoMeta"
                            class="modal-meta-confirmar"
                        >
                            Confirmar
                        </button>
                    </div>
                </form>
            </div>
        `;

        document.body.appendChild(overlay);

        overlay.addEventListener("click", function (evento) {
            if (
                evento.target === overlay ||
                evento.target.closest("[data-fechar-modal]")
            ) {
                if (!operacaoEmAndamento) {
                    fecharModalMovimentacao();
                }
            }
        });

        document.getElementById("formMovimentacaoMeta").addEventListener(
            "submit",
            registrarMovimentacao
        );
    }

    function abrirModalMovimentacao(id, tipo) {
        if (operacaoEmAndamento) return;

        const meta = obterMeta(id);

        if (!meta) return;

        criarModalMovimentacao();

        tipoMovimentacaoAtual = tipo;
        metaMovimentacaoAtual = meta.id;

        const overlay = document.getElementById("modalMovimentacaoMeta");
        const titulo = document.getElementById("tituloModalMeta");
        const descricao = document.getElementById("descricaoModalMeta");
        const botao = document.getElementById("btnConfirmarMovimentacaoMeta");
        const campoValor = document.getElementById("valorMovimentacaoMeta");
        const campoData = document.getElementById("dataMovimentacaoMeta");

        titulo.textContent = tipo === "aporte"
            ? "Adicionar aporte"
            : "Registrar retirada";

        descricao.textContent = meta.nome;

        botao.textContent = tipo === "aporte"
            ? "Confirmar aporte"
            : "Confirmar retirada";

        botao.classList.toggle("retirada", tipo === "retirada");

        campoValor.value = "";
        campoData.value = obterDataAtual();

        overlay.style.display = "flex";

        setTimeout(() => campoValor.focus(), 50);
    }

    function fecharModalMovimentacao() {
        const overlay = document.getElementById("modalMovimentacaoMeta");

        if (overlay) overlay.style.display = "none";

        tipoMovimentacaoAtual = null;
        metaMovimentacaoAtual = null;
    }

    /* ========================================= */
    /* REGISTRAR APORTE OU RETIRADA */
    /* ========================================= */

    async function registrarMovimentacao(evento) {
        evento.preventDefault();

        if (operacaoEmAndamento || carregando) return;

        const meta = obterMeta(metaMovimentacaoAtual);

        if (!meta || !tipoMovimentacaoAtual) {
            exibirMensagem("Não foi possível localizar a meta.", "erro");
            fecharModalMovimentacao();
            return;
        }

        const campoValor = document.getElementById("valorMovimentacaoMeta");
        const campoData = document.getElementById("dataMovimentacaoMeta");
        const botao = document.getElementById("btnConfirmarMovimentacaoMeta");

        const valor = Number(campoValor.value);
        const data = campoData.value;

        if (!Number.isFinite(valor) || valor <= 0) {
            alert("Informe um valor válido para a movimentação.");
            return;
        }

        if (!data) {
            alert("Informe a data da movimentação.");
            return;
        }

        const saldoAtual = normalizarNumero(meta.valorAcumulado);

        if (tipoMovimentacaoAtual === "retirada" && valor > saldoAtual) {
            alert(
                "O valor da retirada não pode ser maior que o saldo acumulado da meta."
            );
            return;
        }

        operacaoEmAndamento = true;

        botao.disabled = true;
        botao.textContent = "Salvando...";

        const tipoRegistrado = tipoMovimentacaoAtual;

        const novoSaldo = tipoRegistrado === "aporte"
            ? saldoAtual + valor
            : saldoAtual - valor;

        const novaMovimentacao = {
            id: gerarId(),
            metaId: String(meta.id),
            metaNome: meta.nome,
            tipo: tipoRegistrado,
            valor,
            data,
            dataRegistro: obterDataAtual()
        };

        const metaAtualizada = {
            ...meta,
            valorAcumulado: novoSaldo,
            dataAtualizacao: obterDataAtual()
        };

        try {
            await executarLote([
                {
                    tipo: "salvar",
                    colecao: COLECAO_METAS,
                    id: String(meta.id),
                    dados: metaAtualizada
                },
                {
                    tipo: "salvar",
                    colecao: COLECAO_MOVIMENTACOES,
                    id: String(novaMovimentacao.id),
                    dados: novaMovimentacao
                }
            ]);

            metas = metas.map(item =>
                String(item.id) === String(meta.id)
                    ? metaAtualizada
                    : item
            );

            movimentacoes.push(novaMovimentacao);

            fecharModalMovimentacao();
            atualizarTela();

            exibirMensagem(
                tipoRegistrado === "aporte"
                    ? "Aporte registrado com sucesso!"
                    : "Retirada registrada com sucesso!"
            );

        } catch (erro) {
            console.error("Erro ao registrar movimentação:", erro);

            botao.disabled = false;
            botao.textContent = tipoRegistrado === "aporte"
                ? "Confirmar aporte"
                : "Confirmar retirada";

            exibirMensagem(
                "Não foi possível registrar a movimentação.",
                "erro"
            );

        } finally {
            operacaoEmAndamento = false;
        }
    }

    /* ========================================= */
    /* EXCLUIR MOVIMENTAÇÃO */
    /* ========================================= */

    async function excluirMovimentacao(id) {
        if (operacaoEmAndamento) return;

        const movimentacao = obterMovimentacao(id);

        if (!movimentacao) return;

        const confirmar = confirm(
            "Deseja excluir esta movimentação?\n\n" +
            "O saldo da meta será atualizado automaticamente."
        );

        if (!confirmar) return;

        const meta = obterMeta(movimentacao.metaId);

        if (!meta) {
            exibirMensagem(
                "A meta vinculada não foi encontrada. Atualize a página e tente novamente.",
                "erro"
            );

            return;
        }

        const saldoAnterior = normalizarNumero(meta.valorAcumulado);
        const valor = normalizarNumero(movimentacao.valor);

        const novoSaldo = movimentacao.tipo === "aporte"
            ? saldoAnterior - valor
            : saldoAnterior + valor;

        if (novoSaldo < 0) {
            exibirMensagem(
                "Não foi possível recalcular o saldo desta meta.",
                "erro"
            );

            return;
        }

        const metaAtualizada = {
            ...meta,
            valorAcumulado: novoSaldo,
            dataAtualizacao: obterDataAtual()
        };

        operacaoEmAndamento = true;

        try {
            await executarLote([
                {
                    tipo: "salvar",
                    colecao: COLECAO_METAS,
                    id: String(meta.id),
                    dados: metaAtualizada
                },
                {
                    tipo: "excluir",
                    colecao: COLECAO_MOVIMENTACOES,
                    id: String(movimentacao.id)
                }
            ]);

            metas = metas.map(item =>
                String(item.id) === String(meta.id)
                    ? metaAtualizada
                    : item
            );

            movimentacoes = movimentacoes.filter(
                item => String(item.id) !== String(id)
            );

            atualizarTela();

            exibirMensagem("Movimentação excluída com sucesso!");

        } catch (erro) {
            console.error("Erro ao excluir movimentação:", erro);

            exibirMensagem(
                "Não foi possível excluir a movimentação.",
                "erro"
            );

        } finally {
            operacaoEmAndamento = false;
        }
    }

    /* ========================================= */
    /* EVENTOS */
    /* ========================================= */

    if (formulario) {
        formulario.addEventListener("submit", salvarMeta);
    }

    if (listaMetas) {
        listaMetas.addEventListener("click", function (evento) {
            const botao = evento.target.closest("[data-acao]");

            if (!botao || operacaoEmAndamento) return;

            const acao = botao.dataset.acao;
            const id = botao.dataset.id;

            if (acao === "aporte") {
                abrirModalMovimentacao(id, "aporte");
            }

            if (acao === "retirada") {
                abrirModalMovimentacao(id, "retirada");
            }

            if (acao === "editar") {
                editarMeta(id);
            }

            if (acao === "excluir") {
                excluirMeta(id);
            }
        });
    }

    if (listaMovimentacoes) {
        listaMovimentacoes.addEventListener("click", function (evento) {
            const botao = evento.target.closest("[data-acao]");

            if (!botao || operacaoEmAndamento) return;

            if (botao.dataset.acao === "excluir-movimentacao") {
                excluirMovimentacao(botao.dataset.id);
            }
        });
    }

    /* ========================================= */
    /* INICIALIZAÇÃO */
    /* ========================================= */

    carregarDadosMetas();

})();