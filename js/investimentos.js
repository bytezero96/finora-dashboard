
/* ========================================= */
/* FINORA — INVESTIMENTOS */
/* FIRESTORE */
/* CONTROLE DA CARTEIRA E MOVIMENTAÇÕES */
/* ========================================= */

import {
    listarRegistros,
    salvarRegistro,
    excluirRegistro,
    executarLote
} from "./finora-db.js";

(function () {
    "use strict";

    /* ========================================= */
    /* COLEÇÕES E CHAVES ANTIGAS */
    /* ========================================= */

    const COLECAO_INVESTIMENTOS = "investimentos";
    const COLECAO_MOVIMENTACOES = "movimentacoes_investimentos";

    const CHAVE_INVESTIMENTOS_FINORA = "finora_investimentos";
    const CHAVE_MOVIMENTACOES_INVESTIMENTOS =
        "finora_movimentacoes_investimentos";

    /* ========================================= */
    /* ELEMENTOS DO HTML */
    /* ========================================= */

    const form = document.getElementById("formInvestimentos");

    const campoTipo = document.getElementById("tipoMovimentacao");
    const campoDescricao = document.getElementById("investimentoDescricao");
    const campoCategoria = document.getElementById("investimentoCategoria");
    const campoValor = document.getElementById("investimentoValor");
    const campoData = document.getElementById("investimentoData");
    const campoInstituicao = document.getElementById("investimentoInstituicao");
    const campoObservacao = document.getElementById("investimentoObservacao");

    const mensagem = document.getElementById("mensagemInvestimentos");

    const totalAplicado = document.getElementById("totalAplicado");
    const saldoAtualCarteira = document.getElementById("saldoAtualCarteira");
    const totalRendimentos = document.getElementById("totalRendimentos");
    const rentabilidadeCarteira = document.getElementById("rentabilidadeCarteira");

    const listaCategorias = document.getElementById(
        "listaCategoriasInvestimentos"
    );

    const listaMovimentacoes = document.getElementById(
        "listaMovimentacoesInvestimentos"
    );

    const botaoSalvar = document.getElementById("btnSalvarInvestimento");

    /* ========================================= */
    /* ESTADO DO MÓDULO */
    /* ========================================= */

    let investimentos = [];
    let movimentacoes = [];

    let editandoId = null;
    let editandoOrigem = null;

    let carregando = false;

    /* ========================================= */
    /* FUNÇÕES AUXILIARES */
    /* ========================================= */

    function gerarId() {
        return (
            Date.now().toString(36) +
            Math.random().toString(36).substring(2, 9)
        );
    }

    function obterValorNumerico(valor) {
        const numero = Number(valor);

        return Number.isFinite(numero) && numero > 0
            ? numero
            : 0;
    }

    function formatarMoeda(valor) {
        return Number(valor || 0).toLocaleString(
            "pt-BR",
            {
                style: "currency",
                currency: "BRL"
            }
        );
    }

    function formatarData(data) {
        if (!data) return "—";

        const partes = String(data).split("-");

        if (partes.length !== 3) {
            return data;
        }

        return `${partes[2]}/${partes[1]}/${partes[0]}`;
    }

    function obterDataAtual() {
        const hoje = new Date();

        const ano = hoje.getFullYear();

        const mes = String(
            hoje.getMonth() + 1
        ).padStart(2, "0");

        const dia = String(
            hoje.getDate()
        ).padStart(2, "0");

        return `${ano}-${mes}-${dia}`;
    }

    function escaparHTML(valor) {
        return String(valor ?? "").replace(
            /[&<>"']/g,
            caractere => {
                const entidades = {
                    "&": "&amp;",
                    "<": "&lt;",
                    ">": "&gt;",
                    '"': "&quot;",
                    "'": "&#039;"
                };

                return entidades[caractere];
            }
        );
    }

    function mostrarMensagem(texto, tipo = "sucesso") {
        if (!mensagem) return;

        mensagem.textContent = texto;

        mensagem.className =
            `mensagem-investimentos ${tipo}`;
    }

    function limparMensagem() {
        if (!mensagem) return;

        mensagem.textContent = "";

        mensagem.className = "mensagem-investimentos";
    }

    function definirBotaoCarregando(estado, texto) {
        if (!botaoSalvar) return;

        botaoSalvar.disabled = estado;

        if (estado) {
            botaoSalvar.innerHTML = `
                <i class="fa-solid fa-spinner fa-spin"
                   aria-hidden="true"></i>
                Processando...
            `;
        } else {
            botaoSalvar.innerHTML = texto;
        }
    }

    function notificarAtualizacaoFinanceira() {
        window.dispatchEvent(
            new CustomEvent("finora:atualizacao-financeira")
        );
    }

    /* ========================================= */
    /* NORMALIZAÇÃO DOS REGISTROS */
    /* ========================================= */

    function normalizarInvestimento(item) {
        return {
            ...item,
            id: String(item.id),
            tipoMovimentacao: "aplicacao",
            origemRegistro: "investimentos"
        };
    }

    function normalizarMovimentacao(item) {
        const tipo = item.tipo || item.tipoMovimentacao;

        return {
            ...item,
            id: String(item.id),
            tipoMovimentacao:
                tipo === "resgate" ? "resgate" : "aplicacao",
            origemRegistro: "movimentacoes"
        };
    }

    function obterTodasMovimentacoes() {
        const aplicacoes = investimentos.map(normalizarInvestimento);

        const outrasMovimentacoes =
            movimentacoes.map(normalizarMovimentacao);

        return [
            ...aplicacoes,
            ...outrasMovimentacoes
        ].sort((a, b) => {
            const dataA = String(a.data || "");
            const dataB = String(b.data || "");

            if (dataA !== dataB) {
                return dataB.localeCompare(dataA);
            }

            return String(b.id).localeCompare(String(a.id));
        });
    }

    /* ========================================= */
    /* MIGRAÇÃO DOS DADOS ANTIGOS */
    /* SESSIONSTORAGE → FIRESTORE */
    /* ========================================= */

    function lerDadosAntigos(chave) {
        try {
            const dados = sessionStorage.getItem(chave);

            if (!dados) return [];

            const convertidos = JSON.parse(dados);

            return Array.isArray(convertidos)
                ? convertidos
                : [];

        } catch (erro) {
            console.error(
                `Erro ao ler dados antigos (${chave}):`,
                erro
            );

            return [];
        }
    }

    async function migrarDadosAntigos() {
        const antigasAplicacoes = lerDadosAntigos(
            CHAVE_INVESTIMENTOS_FINORA
        );

        const antigasMovimentacoes = lerDadosAntigos(
            CHAVE_MOVIMENTACOES_INVESTIMENTOS
        );

        if (
            antigasAplicacoes.length === 0 &&
            antigasMovimentacoes.length === 0
        ) {
            return false;
        }

        /*
         * Não importa os dados antigos se alguma das
         * coleções já possui registros no Firestore.
         *
         * Isso evita duplicações ou sobrescritas.
         */

        if (
            investimentos.length > 0 ||
            movimentacoes.length > 0
        ) {
            console.info(
                "Migração antiga ignorada: já existem registros no Firestore."
            );

            return false;
        }

        const operacoes = [];

        antigasAplicacoes.forEach(item => {
            if (
                !item ||
                item.id === undefined ||
                !Number.isFinite(Number(item.valor)) ||
                Number(item.valor) <= 0
            ) {
                return;
            }

            const dados = {
                ...item,
                id: String(item.id),
                formaPagamento: "investimento",
                tipo: "investimento",
                movimentacao: "aplicacao"
            };

            operacoes.push({
                tipo: "salvar",
                colecao: COLECAO_INVESTIMENTOS,
                id: String(item.id),
                dados
            });
        });

        antigasMovimentacoes.forEach(item => {
            if (
                !item ||
                item.id === undefined ||
                !Number.isFinite(Number(item.valor)) ||
                Number(item.valor) <= 0
            ) {
                return;
            }

            const tipo =
                item.tipo === "resgate" ? "resgate" : "aplicacao";

            const dados = {
                ...item,
                id: String(item.id),
                tipo,
                origem: "investimentos"
            };

            operacoes.push({
                tipo: "salvar",
                colecao: COLECAO_MOVIMENTACOES,
                id: String(item.id),
                dados
            });
        });

        if (operacoes.length === 0) {
            return false;
        }

        /*
         * Os registros só são removidos do armazenamento
         * antigo depois que o lote for salvo com sucesso.
         */

        await executarLote(operacoes);

        sessionStorage.removeItem(CHAVE_INVESTIMENTOS_FINORA);

        sessionStorage.removeItem(
            CHAVE_MOVIMENTACOES_INVESTIMENTOS
        );

        console.info(
            "Dados antigos de investimentos migrados para o Firestore."
        );

        return true;
    }

    /* ========================================= */
    /* CARREGAR DADOS DO FIRESTORE */
    /* ========================================= */

    async function carregarDados() {
        try {
            const [dadosInvestimentos, dadosMovimentacoes] =
                await Promise.all([
                    listarRegistros(COLECAO_INVESTIMENTOS),
                    listarRegistros(COLECAO_MOVIMENTACOES)
                ]);

            investimentos = dadosInvestimentos || [];
            movimentacoes = dadosMovimentacoes || [];

            const migrou = await migrarDadosAntigos();

            if (migrou) {
                const [novosInvestimentos, novasMovimentacoes] =
                    await Promise.all([
                        listarRegistros(COLECAO_INVESTIMENTOS),
                        listarRegistros(COLECAO_MOVIMENTACOES)
                    ]);

                investimentos = novosInvestimentos || [];
                movimentacoes = novasMovimentacoes || [];
            }

            atualizarTela();

        } catch (erro) {
            console.error(
                "Erro ao carregar investimentos:",
                erro
            );

            mostrarMensagem(
                "Não foi possível carregar os investimentos. Verifique sua conexão e tente novamente.",
                "erro"
            );

            throw erro;
        }
    }

    /* ========================================= */
    /* CÁLCULO DA CARTEIRA */
    /* ========================================= */

    function calcularCarteira(
        excluirId = null,
        excluirOrigem = null
    ) {
        const registros = obterTodasMovimentacoes();

        let totalAplicacoes = 0;
        let totalResgates = 0;

        registros.forEach(item => {
            if (
                excluirId !== null &&
                String(item.id) === String(excluirId) &&
                item.origemRegistro === excluirOrigem
            ) {
                return;
            }

            const valor = obterValorNumerico(item.valor);

            if (item.tipoMovimentacao === "resgate") {
                totalResgates += valor;
            } else {
                totalAplicacoes += valor;
            }
        });

        const saldoInvestido = Math.max(
            0,
            totalAplicacoes - totalResgates
        );

        return {
            totalAplicacoes,
            totalResgates,
            saldoInvestido,
            totalRendimentos: null,
            saldoAtual: null,
            rentabilidade: null
        };
    }

    /* ========================================= */
    /* ATUALIZAÇÃO DOS INDICADORES */
    /* ========================================= */

    function atualizarResumo() {
        const carteira = calcularCarteira();

        if (totalAplicado) {
            totalAplicado.textContent = formatarMoeda(
                carteira.saldoInvestido
            );
        }

        /*
         * O saldo atual e a rentabilidade dependem
         * de informações que ainda não são registradas.
         * Não apresentar valores fictícios.
         */

        if (saldoAtualCarteira) {
            saldoAtualCarteira.textContent = "—";
        }

        if (totalRendimentos) {
            totalRendimentos.textContent = "—";
        }

        if (rentabilidadeCarteira) {
            rentabilidadeCarteira.textContent = "—";
        }
    }

    /* ========================================= */
    /* COMPOSIÇÃO DA CARTEIRA */
    /* ========================================= */

    function atualizarComposicao() {
        if (!listaCategorias) return;

        const registros = obterTodasMovimentacoes();

        const categorias = {};

        registros.forEach(item => {
            const categoria = item.categoria || "Outros";
            const valor = obterValorNumerico(item.valor);

            if (!categorias[categoria]) {
                categorias[categoria] = 0;
            }

            if (item.tipoMovimentacao === "resgate") {
                categorias[categoria] -= valor;
            } else {
                categorias[categoria] += valor;
            }
        });

        const categoriasValidas = Object.entries(categorias)
            .map(([nome, valor]) => ({
                nome,
                valor: Math.max(0, valor)
            }))
            .filter(item => item.valor > 0)
            .sort((a, b) => b.valor - a.valor);

        const total = categoriasValidas.reduce(
            (soma, item) => soma + item.valor,
            0
        );

        if (total <= 0) {
            listaCategorias.innerHTML = `
                <p class="investimentos-vazio">
                    Nenhum investimento cadastrado.
                </p>
            `;

            return;
        }

        listaCategorias.innerHTML = categoriasValidas.map(item => {
            const percentual = (item.valor / total) * 100;

            return `
                <div class="categoria-investimento">

                    <div class="categoria-investimento-cabecalho">

                        <span class="categoria-investimento-nome">
                            ${escaparHTML(item.nome)}
                        </span>

                        <span class="categoria-investimento-valor">
                            ${formatarMoeda(item.valor)}
                        </span>

                    </div>

                    <div class="categoria-investimento-barra">

                        <div
                            class="categoria-investimento-progresso"
                            style="width: ${percentual.toFixed(2)}%">
                        </div>

                    </div>

                    <span class="categoria-investimento-percentual">
                        ${percentual.toFixed(1).replace(".", ",")}%
                    </span>

                </div>
            `;
        }).join("");
    }

    /* ========================================= */
    /* HISTÓRICO DE MOVIMENTAÇÕES */
    /* ========================================= */

    function atualizarHistorico() {
        if (!listaMovimentacoes) return;

        const registros = obterTodasMovimentacoes();

        if (registros.length === 0) {
            listaMovimentacoes.innerHTML = `
                <tr>
                    <td colspan="6" class="investimentos-vazio">
                        Nenhuma movimentação cadastrada.
                    </td>
                </tr>
            `;

            return;
        }

        listaMovimentacoes.innerHTML = registros.map(item => {
            const ehResgate =
                item.tipoMovimentacao === "resgate";

            const tipo = ehResgate ? "Resgate" : "Aplicação";
            const classeTipo = ehResgate ? "resgate" : "aplicacao";
            const classeValor = ehResgate
                ? "valor-resgate"
                : "valor-aplicacao";

            const sinal = ehResgate ? "− " : "+ ";

            return `
                <tr>

                    <td>
                        <strong>
                            ${escaparHTML(item.descricao || "Investimento")}
                        </strong>

                        ${
                            item.instituicao
                                ? `<br><small>${escaparHTML(item.instituicao)}</small>`
                                : ""
                        }
                    </td>

                    <td>
                        <span class="tipo-movimentacao ${classeTipo}">
                            ${tipo}
                        </span>
                    </td>

                    <td>
                        ${escaparHTML(item.categoria || "Outros")}
                    </td>

                    <td>
                        ${formatarData(item.data)}
                    </td>

                    <td class="${classeValor}">
                        ${sinal}${formatarMoeda(item.valor)}
                    </td>

                    <td>

                        <div class="acoes-investimento">

                            <button
                                type="button"
                                class="btn-editar-investimento"
                                data-acao="editar"
                                data-id="${escaparHTML(item.id)}"
                                data-origem="${item.origemRegistro}"
                                title="Editar movimentação"
                                aria-label="Editar movimentação">

                                <i class="fa-solid fa-pen"></i>

                            </button>

                            <button
                                type="button"
                                class="btn-excluir-investimento"
                                data-acao="excluir"
                                data-id="${escaparHTML(item.id)}"
                                data-origem="${item.origemRegistro}"
                                title="Excluir movimentação"
                                aria-label="Excluir movimentação">

                                <i class="fa-solid fa-trash"></i>

                            </button>

                        </div>

                    </td>

                </tr>
            `;
        }).join("");
    }

    /* ========================================= */
    /* ATUALIZAÇÃO GERAL */
    /* ========================================= */

    function atualizarTela() {
        atualizarResumo();
        atualizarComposicao();
        atualizarHistorico();
    }

    /* ========================================= */
    /* DADOS PARA SALVAR */
    /* ========================================= */

    function montarDadosAplicacao(dados, id) {
        return {
            id,
            descricao: dados.descricao,
            valor: dados.valor,
            data: dados.data,
            categoria: dados.categoria,
            instituicao: dados.instituicao,
            observacao: dados.observacao,

            formaPagamento: "investimento",
            origem: "investimentos",
            tipo: "investimento",
            movimentacao: "aplicacao"
        };
    }

    function montarDadosMovimentacao(dados, id) {
        return {
            id,
            descricao: dados.descricao,
            valor: dados.valor,
            data: dados.data,
            categoria: dados.categoria,
            instituicao: dados.instituicao,
            observacao: dados.observacao,

            tipo: dados.tipoMovimentacao,
            origem: "investimentos"
        };
    }

    /* ========================================= */
    /* CADASTRAR MOVIMENTAÇÃO */
    /* ========================================= */

    async function cadastrarMovimentacao(dados) {
        const id = gerarId();

        if (dados.tipoMovimentacao === "resgate") {
            await salvarRegistro(
                COLECAO_MOVIMENTACOES,
                montarDadosMovimentacao(dados, id),
                id
            );
        } else {
            await salvarRegistro(
                COLECAO_INVESTIMENTOS,
                montarDadosAplicacao(dados, id),
                id
            );
        }

        await carregarDados();

        notificarAtualizacaoFinanceira();
    }

    /* ========================================= */
    /* EDITAR MOVIMENTAÇÃO */
    /* ========================================= */

    async function editarMovimentacao(id, origem, dados) {
        const registro = obterTodasMovimentacoes().find(item => {
            return (
                String(item.id) === String(id) &&
                item.origemRegistro === origem
            );
        });

        if (!registro) {
            throw new Error(
                "Não foi possível localizar essa movimentação."
            );
        }

        /*
         * Registros da coleção investimentos são aplicações
         * e permanecem aplicações durante a edição.
         */

        if (origem === "investimentos") {
            const dadosAtualizados = {
                ...registro,
                ...montarDadosAplicacao(dados, String(id))
            };

            await salvarRegistro(
                COLECAO_INVESTIMENTOS,
                dadosAtualizados,
                String(id)
            );
        } else {
            const colecaoAtual =
                registro.tipoMovimentacao === "resgate"
                    ? COLECAO_MOVIMENTACOES
                    : COLECAO_INVESTIMENTOS;

            const colecaoDestino =
                dados.tipoMovimentacao === "resgate"
                    ? COLECAO_MOVIMENTACOES
                    : COLECAO_INVESTIMENTOS;

            const dadosAtualizados =
                dados.tipoMovimentacao === "resgate"
                    ? montarDadosMovimentacao(dados, String(id))
                    : montarDadosAplicacao(dados, String(id));

            if (colecaoAtual === colecaoDestino) {
                await salvarRegistro(
                    colecaoDestino,
                    dadosAtualizados,
                    String(id)
                );
            } else {
                await executarLote([
                    {
                        tipo: "excluir",
                        colecao: colecaoAtual,
                        id: String(id)
                    },
                    {
                        tipo: "salvar",
                        colecao: colecaoDestino,
                        id: String(id),
                        dados: dadosAtualizados
                    }
                ]);
            }
        }

        await carregarDados();

        notificarAtualizacaoFinanceira();
    }

    /* ========================================= */
    /* EXCLUIR MOVIMENTAÇÃO */
    /* ========================================= */

    async function excluirMovimentacao(id, origem) {
        const colecao = origem === "investimentos"
            ? COLECAO_INVESTIMENTOS
            : COLECAO_MOVIMENTACOES;

        await excluirRegistro(colecao, String(id));

        await carregarDados();

        notificarAtualizacaoFinanceira();
    }

    /* ========================================= */
    /* PREENCHER FORMULÁRIO PARA EDIÇÃO */
    /* ========================================= */

    function preencherFormularioEdicao(id, origem) {
        const item = obterTodasMovimentacoes().find(registro => {
            return (
                String(registro.id) === String(id) &&
                registro.origemRegistro === origem
            );
        });

        if (!item) {
            mostrarMensagem(
                "Não foi possível localizar essa movimentação.",
                "erro"
            );

            return;
        }

        editandoId = String(id);
        editandoOrigem = origem;

        campoTipo.value = item.tipoMovimentacao || "aplicacao";

        /*
         * Aplicações da coleção principal permanecem
         * como aplicações para preservar sua identificação.
         */

        campoTipo.disabled = origem === "investimentos";

        campoDescricao.value = item.descricao || "";
        campoCategoria.value = item.categoria || "Outros";
        campoValor.value = Number(item.valor).toFixed(2);
        campoData.value = item.data || obterDataAtual();
        campoInstituicao.value = item.instituicao || "";
        campoObservacao.value = item.observacao || "";

        if (botaoSalvar) {
            botaoSalvar.innerHTML = `
                <i class="fa-solid fa-check" aria-hidden="true"></i>
                Salvar alterações
            `;
        }

        form.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });

        mostrarMensagem(
            "Editando movimentação. Altere os dados e salve as alterações.",
            "aviso"
        );
    }

    /* ========================================= */
    /* LIMPAR FORMULÁRIO */
    /* ========================================= */

    function limparFormulario() {
        form.reset();

        editandoId = null;
        editandoOrigem = null;

        campoTipo.disabled = false;

        if (campoData) {
            campoData.value = obterDataAtual();
        }

        if (botaoSalvar) {
            botaoSalvar.innerHTML = `
                <i class="fa-solid fa-plus" aria-hidden="true"></i>
                Registrar movimentação
            `;
        }
    }

    /* ========================================= */
    /* COLETAR DADOS DO FORMULÁRIO */
    /* ========================================= */

    function coletarDadosFormulario() {
        return {
            tipoMovimentacao: campoTipo.value,
            descricao: campoDescricao.value.trim(),
            categoria: campoCategoria.value,
            valor: obterValorNumerico(campoValor.value),
            data: campoData.value,
            instituicao: campoInstituicao.value.trim(),
            observacao: campoObservacao.value.trim()
        };
    }

    /* ========================================= */
    /* VALIDAR FORMULÁRIO */
    /* ========================================= */

    function validarFormulario(dados) {
        if (!dados.descricao) {
            mostrarMensagem(
                "Informe a descrição do investimento.",
                "erro"
            );

            campoDescricao.focus();
            return false;
        }

        if (!dados.categoria) {
            mostrarMensagem(
                "Selecione uma categoria.",
                "erro"
            );

            campoCategoria.focus();
            return false;
        }

        if (dados.valor <= 0) {
            mostrarMensagem(
                "Informe um valor válido para a movimentação.",
                "erro"
            );

            campoValor.focus();
            return false;
        }

        if (!dados.data) {
            mostrarMensagem(
                "Informe a data da movimentação.",
                "erro"
            );

            campoData.focus();
            return false;
        }

        if (
            dados.tipoMovimentacao !== "aplicacao" &&
            dados.tipoMovimentacao !== "resgate"
        ) {
            mostrarMensagem(
                "Selecione um tipo de movimentação válido.",
                "erro"
            );

            campoTipo.focus();
            return false;
        }

        if (dados.tipoMovimentacao === "resgate") {
            const carteira = calcularCarteira(
                editandoId,
                editandoOrigem
            );

            if (dados.valor > carteira.saldoInvestido) {
                mostrarMensagem(
                    "O valor do resgate não pode ser maior que o total líquido investido.",
                    "erro"
                );

                campoValor.focus();
                return false;
            }
        }

        return true;
    }

    /* ========================================= */
    /* EVENTO DO FORMULÁRIO */
    /* ========================================= */

    if (form) {
        form.addEventListener("submit", async function (evento) {
            evento.preventDefault();

            if (carregando) return;

            limparMensagem();

            const dados = coletarDadosFormulario();

            if (!validarFormulario(dados)) return;

            carregando = true;

            definirBotaoCarregando(true);

            try {
                if (editandoId !== null) {
                    await editarMovimentacao(
                        editandoId,
                        editandoOrigem,
                        dados
                    );

                    mostrarMensagem(
                        "Movimentação atualizada com sucesso!",
                        "sucesso"
                    );
                } else {
                    await cadastrarMovimentacao(dados);

                    mostrarMensagem(
                        dados.tipoMovimentacao === "resgate"
                            ? "Resgate registrado com sucesso!"
                            : "Aplicação registrada com sucesso!",
                        "sucesso"
                    );
                }

                limparFormulario();

            } catch (erro) {
                console.error(
                    "Erro ao salvar movimentação:",
                    erro
                );

                mostrarMensagem(
                    "Não foi possível salvar a movimentação. Tente novamente.",
                    "erro"
                );

            } finally {
                carregando = false;

                if (botaoSalvar) {
                    botaoSalvar.disabled = false;
                }

                if (editandoId !== null) {
                    botaoSalvar.innerHTML = `
                        <i class="fa-solid fa-check" aria-hidden="true"></i>
                        Salvar alterações
                    `;
                } else {
                    botaoSalvar.innerHTML = `
                        <i class="fa-solid fa-plus" aria-hidden="true"></i>
                        Registrar movimentação
                    `;
                }
            }
        });
    }

    /* ========================================= */
    /* EVENTOS DA TABELA */
    /* ========================================= */

    if (listaMovimentacoes) {
        listaMovimentacoes.addEventListener(
            "click",
            async function (evento) {
                const botao = evento.target.closest(
                    "button[data-acao]"
                );

                if (!botao || carregando) return;

                const acao = botao.dataset.acao;
                const id = botao.dataset.id;
                const origem = botao.dataset.origem;

                if (acao === "editar") {
                    preencherFormularioEdicao(id, origem);
                    return;
                }

                if (acao === "excluir") {
                    const confirmar = window.confirm(
                        "Deseja realmente excluir esta movimentação?"
                    );

                    if (!confirmar) return;

                    carregando = true;

                    try {
                        await excluirMovimentacao(id, origem);

                        if (
                            String(editandoId) === String(id) &&
                            editandoOrigem === origem
                        ) {
                            limparFormulario();
                        }

                        mostrarMensagem(
                            "Movimentação excluída com sucesso!",
                            "sucesso"
                        );

                    } catch (erro) {
                        console.error(
                            "Erro ao excluir movimentação:",
                            erro
                        );

                        mostrarMensagem(
                            "Não foi possível excluir a movimentação. Tente novamente.",
                            "erro"
                        );

                    } finally {
                        carregando = false;
                    }
                }
            }
        );
    }

    /* ========================================= */
    /* INICIALIZAÇÃO */
    /* ========================================= */

    async function inicializarInvestimentos() {
        if (!form) {
            console.error(
                "Formulário de investimentos não encontrado."
            );

            return;
        }

        limparFormulario();

        carregando = true;

        definirBotaoCarregando(true);

        try {
            await carregarDados();

        } finally {
            carregando = false;

            if (botaoSalvar) {
                botaoSalvar.disabled = false;

                botaoSalvar.innerHTML = `
                    <i class="fa-solid fa-plus" aria-hidden="true"></i>
                    Registrar movimentação
                `;
            }
        }
    }

    inicializarInvestimentos();

})();