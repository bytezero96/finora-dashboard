
/* ========================================= */
/* FINORA — CONTAS A PAGAR */
/* FIRESTORE */
/* GERENCIAMENTO DE CONTAS E PAGAMENTOS */
/* INTEGRAÇÃO COM DESPESAS */
/* ========================================= */

import {
    listarRegistros,
    executarLote
} from "./finora-db.js";

(function () {
    "use strict";

    /* ========================================= */
    /* CONFIGURAÇÕES */
    /* ========================================= */

    const COLECAO_CONTAS = "contas_pagar";
    const COLECAO_DEBITOS = "debitos";

    const ORIGEM_CONTA = "conta_pagar";

    let contas = [];
    let mensagemTimeout = null;
    let operacaoEmAndamento = false;

    /* ========================================= */
    /* ELEMENTOS */
    /* ========================================= */

    const elementos = {
        btnNovaConta: document.getElementById("btnNovaConta"),
        formularioContainer: document.getElementById("formularioContaContainer"),
        formulario: document.getElementById("formularioConta"),
        tituloFormulario: document.getElementById("tituloFormulario"),

        contaId: document.getElementById("contaId"),
        descricao: document.getElementById("descricaoConta"),
        categoria: document.getElementById("categoriaConta"),
        valor: document.getElementById("valorConta"),
        vencimento: document.getElementById("vencimentoConta"),
        observacoes: document.getElementById("observacoesConta"),
        recorrente: document.getElementById("contaRecorrente"),

        btnFecharFormulario: document.getElementById("btnFecharFormulario"),
        btnCancelarConta: document.getElementById("btnCancelarConta"),
        btnSalvarConta: document.getElementById("btnSalvarConta"),

        listaContas: document.getElementById("listaContas"),
        estadoVazio: document.getElementById("estadoVazioContas"),
        quantidadeContas: document.getElementById("quantidadeContas"),

        busca: document.getElementById("buscaContas"),
        filtroStatus: document.getElementById("filtroStatus"),
        filtroMes: document.getElementById("filtroMes"),

        totalEmAberto: document.getElementById("totalEmAberto"),
        totalVencido: document.getElementById("totalVencido"),
        totalPagoMes: document.getElementById("totalPagoMes"),
        totalProximos: document.getElementById("totalProximos"),

        mensagem: document.getElementById("mensagemContas")
    };

    /* ========================================= */
    /* UTILITÁRIOS */
    /* ========================================= */

    function gerarId() {
        if (
            window.crypto &&
            typeof window.crypto.randomUUID === "function"
        ) {
            return window.crypto.randomUUID();
        }

        return Date.now().toString(36) +
            Math.random().toString(36).substring(2, 10);
    }

    function obterDataLocal() {
        const agora = new Date();

        const ano = agora.getFullYear();
        const mes = String(agora.getMonth() + 1).padStart(2, "0");
        const dia = String(agora.getDate()).padStart(2, "0");

        return `${ano}-${mes}-${dia}`;
    }

    function formatarMoeda(valor) {
        return Number(valor || 0).toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL"
        });
    }

    function formatarData(data) {
        if (!data) return "-";

        const partes = data.split("-");

        if (partes.length !== 3) return "-";

        return `${partes[2]}/${partes[1]}/${partes[0]}`;
    }

    function obterData(data) {
        if (!data || !/^\d{4}-\d{2}-\d{2}$/.test(data)) {
            return null;
        }

        const [ano, mes, dia] = data.split("-").map(Number);
        const resultado = new Date(ano, mes - 1, dia);

        if (
            resultado.getFullYear() !== ano ||
            resultado.getMonth() !== mes - 1 ||
            resultado.getDate() !== dia
        ) {
            return null;
        }

        return resultado;
    }

    function escaparTexto(texto) {
        return String(texto ?? "").replace(/[&<>"']/g, caractere => {
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
    /* ARMAZENAMENTO — FIRESTORE */
    /* ========================================= */

    async function carregarContas() {
        try {
            const registros = await listarRegistros(COLECAO_CONTAS);

            if (!Array.isArray(registros)) {
                throw new Error(
                    "O Firestore retornou um resultado inválido para as contas."
                );
            }

            contas = registros.filter(conta => {
                return (
                    conta &&
                    typeof conta.id === "string" &&
                    typeof conta.descricao === "string" &&
                    typeof conta.vencimento === "string" &&
                    Number.isFinite(Number(conta.valor)) &&
                    Number(conta.valor) > 0
                );
            });

            atualizarInterface();

        } catch (erro) {
            console.error(
                "Erro ao carregar contas do Firestore:",
                erro
            );

            mostrarMensagem(
                "Não foi possível carregar as contas. Verifique sua conexão e tente novamente.",
                "erro"
            );

            // Propaga o erro para impedir a liberação da página.
            throw erro;
        }
    }

    async function carregarDebitos() {
        try {
            const registros = await listarRegistros(COLECAO_DEBITOS);

            if (!Array.isArray(registros)) {
                throw new Error(
                    "O Firestore retornou um resultado inválido para os débitos."
                );
            }

            return registros;

        } catch (erro) {
            console.error(
                "Erro ao carregar débitos do Firestore:",
                erro
            );

            mostrarMensagem(
                "Não foi possível acessar os lançamentos de despesas.",
                "erro"
            );

            return null;
        }
    }

    /* ========================================= */
    /* INTEGRAÇÃO COM DESPESAS */
    /* ========================================= */

    function pertenceAConta(debito, contaId) {
        return (
            debito.contaId === contaId ||
            debito.id === `finora-conta-${contaId}`
        );
    }

    /*
     * Prepara as operações necessárias para manter
     * a conta e sua despesa vinculada sincronizadas.
     *
     * Conta paga:
     * cria ou atualiza o débito correspondente.
     *
     * Conta pendente:
     * remove eventual débito vinculado.
     */

    function obterOperacoesSincronizacao(conta, debitos) {
        const vinculados = debitos.filter(debito =>
            pertenceAConta(debito, conta.id)
        );

        const idDebito = `finora-conta-${conta.id}`;

        const debitoAnterior = vinculados.find(debito =>
            debito.id === idDebito
        ) || vinculados[0] || {};

        const operacoes = [];

        if (conta.status === "paga") {
            const debitoVinculado = {
                ...debitoAnterior,

                id: idDebito,
                contaId: conta.id,
                origem: ORIGEM_CONTA,

                descricao: conta.descricao,
                categoria: conta.categoria,
                valor: Number(conta.valor),

                data: conta.pagoEm || obterDataLocal()
            };

            operacoes.push({
                tipo: "salvar",
                colecao: COLECAO_DEBITOS,
                id: idDebito,
                dados: debitoVinculado
            });
        }

        /*
         * Remove duplicidades ou vínculos antigos.
         * O documento principal é mantido quando a conta está paga.
         */

        vinculados.forEach(debito => {
            if (debito.id === idDebito && conta.status === "paga") {
                return;
            }

            operacoes.push({
                tipo: "excluir",
                colecao: COLECAO_DEBITOS,
                id: debito.id
            });
        });

        return operacoes;
    }

    async function salvarContaIntegrada(conta, debitos) {
        const operacoes = [
            {
                tipo: "salvar",
                colecao: COLECAO_CONTAS,
                id: conta.id,
                dados: conta
            },
            ...obterOperacoesSincronizacao(conta, debitos)
        ];

        await executarLote(operacoes);
    }

    function notificarAtualizacaoDespesas() {
        window.dispatchEvent(
            new CustomEvent("finora:debitos-atualizados")
        );

        window.dispatchEvent(
            new CustomEvent("finora:atualizacao-financeira", {
                detail: {
                    tipo: "despesa_conta_pagar"
                }
            })
        );

        if (typeof window.notificarAtualizacaoFinanceira === "function") {
            Promise.resolve(
                window.notificarAtualizacaoFinanceira()
            ).catch(erro => {
                console.error(
                    "Erro ao atualizar o resumo financeiro:",
                    erro
                );
            });
        }
    }

    /* ========================================= */
    /* SITUAÇÃO DA CONTA */
    /* ========================================= */

    function obterSituacao(conta) {
        if (conta.status === "paga") {
            return "paga";
        }

        if (conta.vencimento < obterDataLocal()) {
            return "vencida";
        }

        return "pendente";
    }

    function obterTextoSituacao(situacao) {
        const textos = {
            pendente: "Pendente",
            vencida: "Vencida",
            paga: "Paga"
        };

        return textos[situacao] || "Pendente";
    }

    /* ========================================= */
    /* MENSAGENS */
    /* ========================================= */

    function mostrarMensagem(texto, tipo = "sucesso") {
        clearTimeout(mensagemTimeout);

        elementos.mensagem.textContent = texto;
        elementos.mensagem.className = `mensagem-contas ${tipo}`;
        elementos.mensagem.hidden = false;

        mensagemTimeout = setTimeout(() => {
            elementos.mensagem.hidden = true;
        }, 4000);
    }

    /* ========================================= */
    /* FORMULÁRIO */
    /* ========================================= */

    function abrirFormulario() {
        limparFormulario();

        elementos.tituloFormulario.textContent =
            "Cadastrar nova conta";

        elementos.btnSalvarConta.innerHTML =
            '<i class="fa-solid fa-check"></i> Salvar conta';

        elementos.formularioContainer.hidden = false;

        elementos.formularioContainer.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });

        elementos.descricao.focus();
    }

    function fecharFormulario() {
        elementos.formularioContainer.hidden = true;
        limparFormulario();
    }

    function limparFormulario() {
        elementos.formulario.reset();
        elementos.contaId.value = "";
    }

    function editarConta(id) {
        const conta = contas.find(item => item.id === id);

        if (!conta) {
            mostrarMensagem("Conta não encontrada.", "erro");
            return;
        }

        elementos.contaId.value = conta.id;
        elementos.descricao.value = conta.descricao;
        elementos.categoria.value = conta.categoria;
        elementos.valor.value = conta.valor;
        elementos.vencimento.value = conta.vencimento;
        elementos.observacoes.value = conta.observacoes || "";
        elementos.recorrente.checked = Boolean(conta.recorrente);

        elementos.tituloFormulario.textContent = "Editar conta";

        elementos.btnSalvarConta.innerHTML =
            '<i class="fa-solid fa-check"></i> Salvar alterações';

        elementos.formularioContainer.hidden = false;

        elementos.formularioContainer.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });

        elementos.descricao.focus();
    }

    async function salvarFormulario(evento) {
        evento.preventDefault();

        if (operacaoEmAndamento) return;

        const id = elementos.contaId.value;

        const descricao = elementos.descricao.value.trim();
        const categoria = elementos.categoria.value;
        const valor = Number(elementos.valor.value);
        const vencimento = elementos.vencimento.value;
        const observacoes = elementos.observacoes.value.trim();
        const recorrente = elementos.recorrente.checked;

        if (!descricao || !categoria || !vencimento) {
            mostrarMensagem(
                "Preencha todos os campos obrigatórios.",
                "erro"
            );
            return;
        }

        if (!Number.isFinite(valor) || valor <= 0) {
            mostrarMensagem(
                "Informe um valor maior que zero.",
                "erro"
            );
            return;
        }

        if (!obterData(vencimento)) {
            mostrarMensagem(
                "Informe uma data de vencimento válida.",
                "erro"
            );
            return;
        }

        operacaoEmAndamento = true;

        try {
            /* ========================================= */
            /* EDIÇÃO DE CONTA EXISTENTE */
            /* ========================================= */

            if (id) {
                const contaAnterior = contas.find(item => item.id === id);

                if (!contaAnterior) {
                    mostrarMensagem("Conta não encontrada.", "erro");
                    return;
                }

                const contaAtualizada = {
                    ...contaAnterior,
                    descricao,
                    categoria,
                    valor: Math.round(valor * 100) / 100,
                    vencimento,
                    observacoes,
                    recorrente
                };

                const debitos = await carregarDebitos();

                if (debitos === null) return;

                await salvarContaIntegrada(contaAtualizada, debitos);

                contas = contas.map(conta =>
                    conta.id === id ? contaAtualizada : conta
                );

                if (contaAtualizada.status === "paga") {
                    notificarAtualizacaoDespesas();
                }

                fecharFormulario();
                atualizarInterface();

                mostrarMensagem("Conta atualizada com sucesso.");

                return;
            }

            /* ========================================= */
            /* CADASTRO DE NOVA CONTA */
            /* ========================================= */

            const novaConta = {
                id: gerarId(),
                descricao,
                categoria,
                valor: Math.round(valor * 100) / 100,
                vencimento,
                observacoes,
                recorrente,
                status: "pendente",
                criadoEm: obterDataLocal(),
                pagoEm: null
            };

            await executarLote([
                {
                    tipo: "salvar",
                    colecao: COLECAO_CONTAS,
                    id: novaConta.id,
                    dados: novaConta
                }
            ]);

            contas.push(novaConta);

            fecharFormulario();
            atualizarInterface();

            mostrarMensagem("Conta cadastrada com sucesso.");

        } catch (erro) {
            console.error("Erro ao salvar conta:", erro);

            mostrarMensagem(
                "Não foi possível salvar a conta. Tente novamente.",
                "erro"
            );

        } finally {
            operacaoEmAndamento = false;
        }
    }

    /* ========================================= */
    /* PAGAMENTO MANUAL */
    /* ========================================= */

    async function marcarComoPaga(id) {
        if (operacaoEmAndamento) return;

        const conta = contas.find(item => item.id === id);

        if (!conta) {
            mostrarMensagem("Conta não encontrada.", "erro");
            return;
        }

        if (conta.status === "paga") return;

        const confirmacao = window.confirm(
            `Deseja marcar "${conta.descricao}" como paga?`
        );

        if (!confirmacao) return;

        operacaoEmAndamento = true;

        try {
            const debitos = await carregarDebitos();

            if (debitos === null) return;

            const contaPaga = {
                ...conta,
                status: "paga",
                pagoEm: obterDataLocal()
            };

            await salvarContaIntegrada(contaPaga, debitos);

            contas = contas.map(item =>
                item.id === id ? contaPaga : item
            );

            notificarAtualizacaoDespesas();

            atualizarInterface();

            mostrarMensagem(
                "Pagamento registrado e despesa integrada com sucesso."
            );

        } catch (erro) {
            console.error("Erro ao registrar pagamento:", erro);

            mostrarMensagem(
                "Não foi possível registrar o pagamento. Nenhuma alteração parcial foi aplicada.",
                "erro"
            );

        } finally {
            operacaoEmAndamento = false;
        }
    }

    /* ========================================= */
    /* EXCLUSÃO */
    /* ========================================= */

    async function excluirConta(id) {
        if (operacaoEmAndamento) return;

        const conta = contas.find(item => item.id === id);

        if (!conta) {
            mostrarMensagem("Conta não encontrada.", "erro");
            return;
        }

        const confirmacao = window.confirm(
            `Deseja realmente excluir a conta "${conta.descricao}"?`
        );

        if (!confirmacao) return;

        operacaoEmAndamento = true;

        try {
            const debitos = await carregarDebitos();

            if (debitos === null) return;

            const vinculados = debitos.filter(debito =>
                pertenceAConta(debito, id)
            );

            const operacoes = [
                {
                    tipo: "excluir",
                    colecao: COLECAO_CONTAS,
                    id
                },
                ...vinculados.map(debito => ({
                    tipo: "excluir",
                    colecao: COLECAO_DEBITOS,
                    id: debito.id
                }))
            ];

            await executarLote(operacoes);

            contas = contas.filter(item => item.id !== id);

            if (vinculados.length > 0) {
                notificarAtualizacaoDespesas();
            }

            atualizarInterface();

            mostrarMensagem("Conta excluída com sucesso.");

        } catch (erro) {
            console.error("Erro ao excluir conta:", erro);

            mostrarMensagem(
                "Não foi possível excluir a conta. Tente novamente.",
                "erro"
            );

        } finally {
            operacaoEmAndamento = false;
        }
    }

    /* ========================================= */
    /* INDICADORES */
    /* ========================================= */

    function atualizarIndicadores() {
        const hoje = obterDataLocal();

        const dataLimite = new Date();

        dataLimite.setHours(0, 0, 0, 0);
        dataLimite.setDate(dataLimite.getDate() + 7);

        const limiteFormatado =
            `${dataLimite.getFullYear()}-${String(dataLimite.getMonth() + 1).padStart(2, "0")}-${String(dataLimite.getDate()).padStart(2, "0")}`;

        const abertas = contas.filter(conta =>
            obterSituacao(conta) !== "paga"
        );

        const vencidas = contas.filter(conta =>
            obterSituacao(conta) === "vencida"
        );

        const pagasNoMes = contas.filter(conta => {
            if (obterSituacao(conta) !== "paga" || !conta.pagoEm) {
                return false;
            }

            return conta.pagoEm.substring(0, 7) === hoje.substring(0, 7);
        });

        const proximas = contas.filter(conta =>
            obterSituacao(conta) === "pendente" &&
            conta.vencimento >= hoje &&
            conta.vencimento <= limiteFormatado
        );

        const somar = lista =>
            lista.reduce((total, conta) =>
                total + Number(conta.valor || 0), 0
            );

        elementos.totalEmAberto.textContent =
            formatarMoeda(somar(abertas));

        elementos.totalVencido.textContent =
            formatarMoeda(somar(vencidas));

        elementos.totalPagoMes.textContent =
            formatarMoeda(somar(pagasNoMes));

        elementos.totalProximos.textContent =
            proximas.length;
    }

    /* ========================================= */
    /* FILTRO POR MÊS */
    /* ========================================= */

    function atualizarFiltroMes() {
        const mesSelecionado = elementos.filtroMes.value;

        const meses = [...new Set(
            contas.map(conta => conta.vencimento.substring(0, 7))
        )].sort().reverse();

        elementos.filtroMes.innerHTML =
            '<option value="todos">Todos os meses</option>';

        meses.forEach(mes => {
            const [ano, numeroMes] = mes.split("-").map(Number);

            const data = new Date(ano, numeroMes - 1, 1);

            const nomeMes = data.toLocaleDateString("pt-BR", {
                month: "long",
                year: "numeric"
            });

            const opcao = document.createElement("option");

            opcao.value = mes;
            opcao.textContent =
                nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1);

            elementos.filtroMes.appendChild(opcao);
        });

        if (meses.includes(mesSelecionado)) {
            elementos.filtroMes.value = mesSelecionado;
        } else {
            elementos.filtroMes.value = "todos";
        }
    }

    /* ========================================= */
    /* RENDERIZAÇÃO DA TABELA */
    /* ========================================= */

    function renderizarContas() {
        const busca = elementos.busca.value
            .trim()
            .toLocaleLowerCase("pt-BR");

        const statusFiltro = elementos.filtroStatus.value;
        const mesFiltro = elementos.filtroMes.value;

        const filtradas = contas
            .filter(conta => {
                const texto = [
                    conta.descricao,
                    conta.categoria,
                    conta.observacoes || ""
                ].join(" ").toLocaleLowerCase("pt-BR");

                const correspondeBusca = texto.includes(busca);

                const situacao = obterSituacao(conta);

                const correspondeStatus =
                    statusFiltro === "todas" ||
                    situacao === statusFiltro;

                const correspondeMes =
                    mesFiltro === "todos" ||
                    conta.vencimento.substring(0, 7) === mesFiltro;

                return correspondeBusca &&
                    correspondeStatus &&
                    correspondeMes;
            })
            .sort((a, b) => {
                if (obterSituacao(a) === "paga" && obterSituacao(b) !== "paga") return 1;
                if (obterSituacao(a) !== "paga" && obterSituacao(b) === "paga") return -1;

                return a.vencimento.localeCompare(b.vencimento);
            });

        elementos.listaContas.innerHTML = "";

        elementos.quantidadeContas.textContent =
            `${filtradas.length} ${filtradas.length === 1 ? "conta" : "contas"}`;

        elementos.estadoVazio.hidden = filtradas.length > 0;

        if (filtradas.length === 0) {
            return;
        }

        elementos.listaContas.innerHTML = filtradas.map(conta => {
            const situacao = obterSituacao(conta);

            const indicadorRecorrencia = conta.recorrente
                ? '<small><i class="fa-solid fa-repeat"></i> Recorrente</small>'
                : "";

            const dataPagamento = conta.pagoEm
                ? `<small>Pago em ${formatarData(conta.pagoEm)}</small>`
                : "";

            const botaoPagar = situacao !== "paga"
                ? `
                    <button
                        type="button"
                        class="acao-conta pagar"
                        data-acao="pagar"
                        data-id="${escaparTexto(conta.id)}"
                        title="Marcar como paga"
                        aria-label="Marcar ${escaparTexto(conta.descricao)} como paga"
                    >
                        <i class="fa-solid fa-check"></i>
                    </button>
                `
                : "";

            return `
                <tr>
                    <td>
                        <div class="conta-descricao">
                            <strong>${escaparTexto(conta.descricao)}</strong>
                            ${indicadorRecorrencia}
                            ${dataPagamento}
                        </div>
                    </td>

                    <td>${escaparTexto(conta.categoria)}</td>

                    <td>${formatarData(conta.vencimento)}</td>

                    <td class="conta-valor">
                        ${formatarMoeda(conta.valor)}
                    </td>

                    <td>
                        <span class="status-conta ${situacao}">
                            ${obterTextoSituacao(situacao)}
                        </span>
                    </td>

                    <td>
                        <div class="acoes-conta">

                            ${botaoPagar}

                            <button
                                type="button"
                                class="acao-conta"
                                data-acao="editar"
                                data-id="${escaparTexto(conta.id)}"
                                title="Editar conta"
                                aria-label="Editar ${escaparTexto(conta.descricao)}"
                            >
                                <i class="fa-solid fa-pen"></i>
                            </button>

                            <button
                                type="button"
                                class="acao-conta excluir"
                                data-acao="excluir"
                                data-id="${escaparTexto(conta.id)}"
                                title="Excluir conta"
                                aria-label="Excluir ${escaparTexto(conta.descricao)}"
                            >
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

    function atualizarInterface() {
        atualizarIndicadores();
        atualizarFiltroMes();
        renderizarContas();
    }

    /* ========================================= */
    /* EVENTOS */
    /* ========================================= */

    function configurarEventos() {
        elementos.btnNovaConta.addEventListener(
            "click",
            abrirFormulario
        );

        elementos.btnFecharFormulario.addEventListener(
            "click",
            fecharFormulario
        );

        elementos.btnCancelarConta.addEventListener(
            "click",
            fecharFormulario
        );

        elementos.formulario.addEventListener(
            "submit",
            salvarFormulario
        );

        elementos.busca.addEventListener(
            "input",
            renderizarContas
        );

        elementos.filtroStatus.addEventListener(
            "change",
            renderizarContas
        );

        elementos.filtroMes.addEventListener(
            "change",
            renderizarContas
        );

        elementos.listaContas.addEventListener("click", evento => {
            const botao = evento.target.closest("[data-acao]");

            if (!botao) return;

            const acao = botao.dataset.acao;
            const id = botao.dataset.id;

            if (acao === "pagar") {
                marcarComoPaga(id);
            }

            if (acao === "editar") {
                editarConta(id);
            }

            if (acao === "excluir") {
                excluirConta(id);
            }
        });
    }

    /* ========================================= */
    /* INICIALIZAÇÃO */
    /* ========================================= */

    async function iniciar() {
        configurarEventos();

        // A inicialização só termina depois que o Firestore responder.
        await carregarContas();
    }

    // O top-level await faz o import() do HTML aguardar a inicialização.
    await iniciar();

})();
