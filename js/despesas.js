
/* ========================================= */
/* FINORA — DESPESAS */
/* INTEGRAÇÃO COM FIRESTORE */
/* CRÉDITO, DÉBITO E PIX */
/* ========================================= */

import {
    listarRegistros,
    salvarRegistro,
    excluirRegistro
} from "./finora-db.js";

/* ========================================= */
/* CONFIGURAÇÕES */
/* ========================================= */

const COLECOES = {
    cartoes: "cartoes",
    compras: "compras_credito",
    debitos: "debitos"
};

/* ========================================= */
/* ELEMENTOS PRINCIPAIS */
/* ========================================= */

const abas = document.querySelectorAll(".aba-despesa");
const paineis = document.querySelectorAll(".conteudo-aba");
const formularios = document.querySelectorAll(".formulario-despesa");

const totalConsumo = document.getElementById("totalConsumo");
const mensagemDespesa = document.getElementById("mensagemDespesa");

const campoCartao = document.getElementById("creditoCartao");
const campoCreditoValor = document.getElementById("creditoValor");
const campoParcelas = document.getElementById("creditoParcelas");
const campoValorParcela = document.getElementById("creditoValorParcela");

/* ========================================= */
/* DADOS EM MEMÓRIA */
/* ========================================= */

const movimentacoes = {
    credito: [],
    debito: [],
    pix: []
};

let cartoesFinora = [];
let comprasCreditoFinora = [];
let debitosFinora = [];

let carregandoDados = false;

/* ========================================= */
/* UTILITÁRIOS */
/* ========================================= */

function arredondarValor(valor) {
    return Math.round(
        (Number(valor) + Number.EPSILON) * 100
    ) / 100;
}

function formatarMoeda(valor) {
    const numero = Number(valor);

    return (Number.isFinite(numero) ? numero : 0)
        .toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL"
        });
}

function formatarData(data) {
    if (!data) return "—";

    const partes = String(data).split("-");

    if (partes.length !== 3) return data;

    return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

function dataHojeISO() {
    const hoje = new Date();

    const ano = hoje.getFullYear();
    const mes = String(hoje.getMonth() + 1).padStart(2, "0");
    const dia = String(hoje.getDate()).padStart(2, "0");

    return `${ano}-${mes}-${dia}`;
}

function gerarId() {
    if (
        typeof crypto !== "undefined" &&
        typeof crypto.randomUUID === "function"
    ) {
        return crypto.randomUUID();
    }

    return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function normalizarTexto(texto) {
    return String(texto ?? "")
        .trim()
        .toLocaleUpperCase("pt-BR");
}

function converterValorDigitado(texto) {
    let valorLimpo = String(texto ?? "")
        .trim()
        .replace(/\s/g, "");

    if (!valorLimpo) return NaN;

    if (valorLimpo.includes(",")) {
        valorLimpo = valorLimpo
            .replace(/\./g, "")
            .replace(",", ".");
    }

    const valor = Number(valorLimpo);

    return Number.isFinite(valor) ? valor : NaN;
}

/* ========================================= */
/* MENSAGENS */
/* ========================================= */

let temporizadorMensagem;

function mostrarMensagem(texto, tipo = "sucesso") {
    if (!mensagemDespesa) return;

    clearTimeout(temporizadorMensagem);

    mensagemDespesa.textContent = texto;
    mensagemDespesa.className = `mensagem-despesas ${tipo}`;

    temporizadorMensagem = setTimeout(() => {
        mensagemDespesa.textContent = "";
        mensagemDespesa.className = "mensagem-despesas";
    }, 5000);
}

function limparMensagem() {
    clearTimeout(temporizadorMensagem);

    if (mensagemDespesa) {
        mensagemDespesa.textContent = "";
        mensagemDespesa.className = "mensagem-despesas";
    }
}

/* ========================================= */
/* DADOS DO FIRESTORE */
/* ========================================= */

async function carregarDadosDespesas() {
    if (carregandoDados) return;

    carregandoDados = true;

    try {
        const [
            cartoes,
            compras,
            debitos
        ] = await Promise.all([
            listarRegistros(COLECOES.cartoes),
            listarRegistros(COLECOES.compras),
            listarRegistros(COLECOES.debitos)
        ]);

        cartoesFinora = cartoes;
        comprasCreditoFinora = compras;
        debitosFinora = debitos;

        carregarLancamentosSalvos();
        atualizarListaCartoes();

        Object.keys(movimentacoes).forEach(tipo => {
            renderizarTabela(tipo);
        });

        atualizarTotais();

    } catch (erro) {
        console.error("Erro ao carregar despesas do Firestore:", erro);

        mostrarMensagem(
            "Não foi possível carregar suas despesas. Atualize a página e tente novamente.",
            "erro"
        );

    } finally {
        carregandoDados = false;
    }
}

function obterCartoesFinora() {
    return cartoesFinora.filter(cartao =>
        cartao &&
        typeof cartao.id === "string" &&
        typeof cartao.nome === "string" &&
        Number.isFinite(Number(cartao.limite)) &&
        Number(cartao.limite) >= 0
    );
}

function obterComprasCreditoFinora() {
    return comprasCreditoFinora.filter(compra =>
        compra &&
        typeof compra.id === "string" &&
        typeof compra.cartaoId === "string" &&
        Number.isFinite(Number(compra.valorOriginal)) &&
        Number(compra.valorOriginal) > 0
    );
}

function obterDebitosCompartilhados() {
    return debitosFinora.filter(debito =>
        debito &&
        typeof debito.id === "string" &&
        Number.isFinite(Number(debito.valor)) &&
        Number(debito.valor) > 0
    );
}

/* ========================================= */
/* ATUALIZAÇÃO DOS OUTROS MÓDULOS */
/* ========================================= */

function notificarDebitosAtualizados() {
    window.dispatchEvent(
        new CustomEvent("finora:debitos-atualizados")
    );

    window.dispatchEvent(
        new CustomEvent("finora:atualizacao-financeira")
    );
}

/* ========================================= */
/* PROTEÇÃO DE CONTAS A PAGAR */
/* ========================================= */

function ehDespesaDeContaPagar(item) {
    return Boolean(
        item &&
        (
            item.origem === "conta_pagar" ||
            item.contaId
        )
    );
}

/* ========================================= */
/* CARTÕES DE CRÉDITO */
/* ========================================= */

function atualizarListaCartoes() {
    if (!campoCartao) return;

    const cartoes = obterCartoesFinora();
    const valorAnterior = campoCartao.value;

    campoCartao.replaceChildren();

    const opcaoInicial = document.createElement("option");

    opcaoInicial.value = "";
    opcaoInicial.textContent = cartoes.length
        ? "Selecione um cartão"
        : "Nenhum cartão cadastrado";

    campoCartao.appendChild(opcaoInicial);

    cartoes.forEach(cartao => {
        const opcao = document.createElement("option");

        opcao.value = cartao.id;
        opcao.textContent =
            `${normalizarTexto(cartao.nome)} — limite ${formatarMoeda(cartao.limite)}`;

        campoCartao.appendChild(opcao);
    });

    campoCartao.disabled = cartoes.length === 0;
    campoCartao.required = true;

    if (cartoes.some(cartao => cartao.id === valorAnterior)) {
        campoCartao.value = valorAnterior;
    }
}

function calcularLimiteUtilizado(cartaoId, ignorarCompraId = null) {
    return obterComprasCreditoFinora()
        .filter(compra =>
            compra.cartaoId === cartaoId &&
            compra.id !== ignorarCompraId
        )
        .reduce((total, compra) => {
            return total + Number(compra.valorOriginal || 0);
        }, 0);
}

/* ========================================= */
/* ABAS */
/* ========================================= */

function selecionarAba(tipoSelecionado) {
    abas.forEach(aba => {
        const selecionada = aba.dataset.aba === tipoSelecionado;

        aba.classList.toggle("ativa", selecionada);
        aba.setAttribute("aria-selected", String(selecionada));
    });

    paineis.forEach(painel => {
        painel.hidden = painel.dataset.painel !== tipoSelecionado;
    });

    limparMensagem();
}

abas.forEach(aba => {
    aba.addEventListener("click", () => {
        selecionarAba(aba.dataset.aba);
    });
});

selecionarAba("credito");

/* ========================================= */
/* CÁLCULOS DO RESUMO */
/* ========================================= */

function atualizarTotais() {
    const totalCredito = movimentacoes.credito.reduce(
        (total, item) => total + Number(item.totalParcelado || 0),
        0
    );

    const totalDebito = movimentacoes.debito.reduce(
        (total, item) => total + Number(item.valor || 0),
        0
    );

    const totalPix = movimentacoes.pix.reduce(
        (total, item) => total + Number(item.valor || 0),
        0
    );

    const consumo = arredondarValor(
        totalCredito + totalDebito + totalPix
    );

    if (totalConsumo) {
        totalConsumo.textContent = formatarMoeda(consumo);
    }
}

/* ========================================= */
/* CRIAÇÃO DE CÉLULAS */
/* ========================================= */

function criarCelula(texto, classe = "") {
    const celula = document.createElement("td");

    celula.textContent = String(texto ?? "");

    if (classe) {
        celula.className = classe;
    }

    return celula;
}

function criarCelulaAcoes(item, tipo) {
    const celula = document.createElement("td");
    const container = document.createElement("div");

    container.className = "acoes-despesa";

    if (tipo === "debito" && ehDespesaDeContaPagar(item)) {
        const aviso = document.createElement("span");

        aviso.className = "despesa-protegida";
        aviso.textContent = "Gerenciar em Contas a Pagar";
        aviso.title = "Esta despesa está vinculada a uma conta a pagar.";

        container.appendChild(aviso);
        celula.appendChild(container);

        return celula;
    }

    const botaoEditar = document.createElement("button");

    botaoEditar.type = "button";
    botaoEditar.className = "botao-editar-despesa";
    botaoEditar.textContent = "Editar valor";
    botaoEditar.dataset.editar = item.id;
    botaoEditar.dataset.tipo = tipo;
    botaoEditar.setAttribute(
        "aria-label",
        `Editar valor de ${item.descricao}`
    );

    const botaoExcluir = document.createElement("button");

    botaoExcluir.type = "button";
    botaoExcluir.className = "botao-excluir-despesa";
    botaoExcluir.textContent = "Excluir";
    botaoExcluir.dataset.excluir = item.id;
    botaoExcluir.dataset.tipo = tipo;
    botaoExcluir.setAttribute(
        "aria-label",
        `Excluir ${item.descricao}`
    );

    container.append(botaoEditar, botaoExcluir);
    celula.appendChild(container);

    return celula;
}

/* ========================================= */
/* RENDERIZAÇÃO DAS TABELAS */
/* ========================================= */

function renderizarTabela(tipo) {
    const idsTabela = {
        credito: "listaCredito",
        debito: "listaDebito",
        pix: "listaPix"
    };

    const tabela = document.getElementById(idsTabela[tipo]);

    if (!tabela || !movimentacoes[tipo]) return;

    tabela.replaceChildren();

    const itens = movimentacoes[tipo];

    if (!itens.length) {
        const linha = document.createElement("tr");
        const celula = document.createElement("td");

        celula.colSpan = tipo === "credito" ? 8 : 5;
        celula.className = "tabela-vazia";
        celula.textContent =
            "Nenhum lançamento cadastrado nesta seção.";

        linha.appendChild(celula);
        tabela.appendChild(linha);

        return;
    }

    itens.forEach(item => {
        const linha = document.createElement("tr");

        if (tipo === "credito") {
            const cartao = obterCartoesFinora().find(
                registro => registro.id === item.cartaoId
            );

            linha.append(
                criarCelula(item.descricao),
                criarCelula(
                    normalizarTexto(
                        item.cartao || cartao?.nome || "CARTÃO"
                    )
                ),
                criarCelula(formatarData(item.data)),
                criarCelula(`${item.parcelas}x`),
                criarCelula(
                    formatarMoeda(item.valorParcela),
                    "valor-tabela"
                ),
                criarCelula(
                    formatarMoeda(item.valorOriginal),
                    "valor-tabela"
                ),
                criarCelula(
                    formatarMoeda(item.totalParcelado),
                    "valor-tabela"
                ),
                criarCelulaAcoes(item, tipo)
            );

        } else {
            linha.append(
                criarCelula(item.descricao),
                criarCelula(item.categoria || "OUTROS"),
                criarCelula(formatarData(item.data)),
                criarCelula(
                    formatarMoeda(item.valor),
                    "valor-tabela"
                ),
                criarCelulaAcoes(item, tipo)
            );
        }

        tabela.appendChild(linha);
    });
}

/* ========================================= */
/* CARREGAR LANÇAMENTOS */
/* ========================================= */

function carregarLancamentosSalvos() {
    movimentacoes.credito = obterComprasCreditoFinora()
        .map(compra => {
            const parcelas = Math.max(
                1,
                Math.min(
                    120,
                    Math.floor(Number(compra.parcelas) || 1)
                )
            );

            const valorOriginal = arredondarValor(
                Number(compra.valorOriginal)
            );

            const valorParcela =
                Number.isFinite(Number(compra.valorParcela)) &&
                Number(compra.valorParcela) > 0
                    ? arredondarValor(compra.valorParcela)
                    : arredondarValor(valorOriginal / parcelas);

            const totalParcelado =
                Number.isFinite(Number(compra.totalParcelado)) &&
                Number(compra.totalParcelado) > 0
                    ? arredondarValor(compra.totalParcelado)
                    : arredondarValor(valorParcela * parcelas);

            return {
                ...compra,
                categoria: normalizarTexto(
                    compra.categoria || "SEM CATEGORIA"
                ),
                formaPagamento: "credito",
                origem: compra.origem || "despesas",
                descricao: normalizarTexto(compra.descricao),
                cartao: normalizarTexto(compra.cartao),
                parcelas,
                valorOriginal,
                valorParcela,
                totalParcelado
            };
        });

    movimentacoes.debito = obterDebitosCompartilhados()
        .filter(debito => debito.formaPagamento !== "pix")
        .map(debito => ({
            ...debito,
            formaPagamento: debito.formaPagamento || "debito",
            descricao: normalizarTexto(debito.descricao),
            categoria: normalizarTexto(debito.categoria),
            valor: arredondarValor(debito.valor)
        }));

    movimentacoes.pix = obterDebitosCompartilhados()
        .filter(debito => debito.formaPagamento === "pix")
        .map(debito => ({
            ...debito,
            descricao: normalizarTexto(debito.descricao),
            categoria: normalizarTexto(debito.categoria),
            valor: arredondarValor(debito.valor)
        }));
}

/* ========================================= */
/* DEFINIR DATAS */
/* ========================================= */

function definirDatasHoje(formulario) {
    const campoData = formulario.querySelector(
        'input[type="date"]'
    );

    if (campoData && !campoData.value) {
        campoData.value = dataHojeISO();
    }
}

/* ========================================= */
/* REGISTRAR LANÇAMENTOS */
/* ========================================= */

formularios.forEach(formulario => {
    formulario.addEventListener("submit", async evento => {
        evento.preventDefault();
        limparMensagem();

        const tipo = formulario.dataset.tipo;
        const dados = new FormData(formulario);

        if (!Object.prototype.hasOwnProperty.call(movimentacoes, tipo)) {
            mostrarMensagem("Tipo de lançamento inválido.", "erro");
            return;
        }

        const descricao = normalizarTexto(dados.get("descricao"));

        const valorDigitado = converterValorDigitado(
            dados.get("valor")
        );

        const valor = arredondarValor(valorDigitado);
        const data = String(dados.get("data") || "");
        const categoria = normalizarTexto(dados.get("categoria"));

        if (
            !descricao ||
            !data ||
            !Number.isFinite(valor) ||
            valor <= 0
        ) {
            mostrarMensagem(
                "Preencha a descrição, a data e um valor maior que zero.",
                "erro"
            );
            return;
        }

        if (!categoria) {
            mostrarMensagem(
                "Selecione uma categoria para a despesa.",
                "erro"
            );
            return;
        }

        const novo = {
            id: gerarId(),
            descricao,
            valor,
            data,
            categoria
        };

        try {
            /* COMPRA NO CRÉDITO */

            if (tipo === "credito") {
                const cartaoId = String(dados.get("cartao") || "");
                const parcelas = Number(dados.get("parcelas"));

                const valorParcela = arredondarValor(
                    converterValorDigitado(dados.get("valorParcela"))
                );

                const cartao = obterCartoesFinora().find(
                    item => item.id === cartaoId
                );

                if (!cartao) {
                    mostrarMensagem(
                        "Cadastre ou selecione um cartão válido na página Cartões.",
                        "erro"
                    );
                    return;
                }

                if (
                    !Number.isInteger(parcelas) ||
                    parcelas < 1 ||
                    parcelas > 120
                ) {
                    mostrarMensagem(
                        "Informe uma quantidade de parcelas entre 1 e 120.",
                        "erro"
                    );
                    return;
                }

                if (!Number.isFinite(valorParcela) || valorParcela <= 0) {
                    mostrarMensagem(
                        "Informe um valor de parcela maior que zero.",
                        "erro"
                    );
                    return;
                }

                const limiteUtilizado = calcularLimiteUtilizado(cartaoId);
                const limiteDisponivel = arredondarValor(
                    Number(cartao.limite) - limiteUtilizado
                );

                if (valor > limiteDisponivel) {
                    mostrarMensagem(
                        `Limite insuficiente. Disponível: ${formatarMoeda(Math.max(0, limiteDisponivel))}.`,
                        "erro"
                    );
                    return;
                }

                const totalParcelado = arredondarValor(
                    valorParcela * parcelas
                );

                const compra = {
                    id: novo.id,
                    cartaoId,
                    cartao: normalizarTexto(cartao.nome),
                    descricao,
                    data,
                    categoria,
                    parcelas,
                    valorOriginal: valor,
                    valorParcela,
                    totalParcelado,
                    formaPagamento: "credito",
                    origem: "despesas",
                    tipo: "despesa"
                };

                await salvarRegistro(
                    COLECOES.compras,
                    compra,
                    compra.id
                );

                comprasCreditoFinora = [
                    ...comprasCreditoFinora,
                    compra
                ];

                movimentacoes.credito.push(compra);

                renderizarTabela("credito");
                atualizarTotais();
                notificarDebitosAtualizados();

                formulario.reset();
                definirDatasHoje(formulario);

                if (campoParcelas) {
                    campoParcelas.value = "1";
                }

                if (campoValorParcela) {
                    campoValorParcela.dataset.editado = "";
                }

                atualizarListaCartoes();
                sugerirValorParcela();

                mostrarMensagem(
                    `Compra registrada. Limite comprometido: ${formatarMoeda(valor)}. Total parcelado: ${formatarMoeda(totalParcelado)}.`,
                    "sucesso"
                );

                return;
            }

            /* DÉBITO */

            if (tipo === "debito") {
                novo.formaPagamento = "debito";
                novo.origem = "despesas";
                novo.tipo = "despesa";
            }

            /* PIX */

            if (tipo === "pix") {
                novo.formaPagamento = "pix";
                novo.origem = "despesas";
                novo.tipo = "despesa";
            }

            await salvarRegistro(
                COLECOES.debitos,
                novo,
                novo.id
            );

            debitosFinora = [
                ...debitosFinora,
                novo
            ];

            movimentacoes[tipo].push(novo);

            renderizarTabela(tipo);
            atualizarTotais();
            notificarDebitosAtualizados();

            formulario.reset();
            definirDatasHoje(formulario);

            mostrarMensagem(
                tipo === "debito"
                    ? "Despesa no débito registrada com sucesso."
                    : "Pagamento via Pix registrado com sucesso.",
                "sucesso"
            );

        } catch (erro) {
            console.error("Erro ao registrar despesa:", erro);

            mostrarMensagem(
                "Não foi possível salvar o lançamento no Firestore. Tente novamente.",
                "erro"
            );
        }
    });
});

/* ========================================= */
/* EDITAR VALOR */
/* ========================================= */

async function editarValor(tipo, id) {
    if (!movimentacoes[tipo]) return;

    const item = movimentacoes[tipo].find(
        registro => registro.id === id
    );

    if (!item) {
        mostrarMensagem(
            "Não foi possível localizar esse lançamento.",
            "erro"
        );
        return;
    }

    if (tipo === "debito" && ehDespesaDeContaPagar(item)) {
        mostrarMensagem(
            "Esta despesa está vinculada a uma conta a pagar. Para alterá-la, acesse a página Contas a Pagar.",
            "erro"
        );
        return;
    }

    const valorAtual = tipo === "credito"
        ? item.valorOriginal
        : item.valor;

    const rotulo = tipo === "credito"
        ? "Digite o novo valor original da compra (R$):"
        : "Digite o novo valor do lançamento (R$):";

    const resposta = window.prompt(
        `${rotulo}\nValor atual: ${formatarMoeda(valorAtual)}`,
        Number(valorAtual).toFixed(2).replace(".", ",")
    );

    if (resposta === null) return;

    const novoValor = arredondarValor(
        converterValorDigitado(resposta)
    );

    if (!Number.isFinite(novoValor) || novoValor <= 0) {
        mostrarMensagem(
            "Valor inválido. Digite um número maior que zero.",
            "erro"
        );
        return;
    }

    try {
        /* EDIÇÃO DE COMPRA NO CRÉDITO */

        if (tipo === "credito") {
            const cartao = obterCartoesFinora().find(
                registro => registro.id === item.cartaoId
            );

            if (!cartao) {
                mostrarMensagem(
                    "O cartão desta compra não foi encontrado.",
                    "erro"
                );
                return;
            }

            const limiteUtilizado = calcularLimiteUtilizado(
                item.cartaoId,
                item.id
            );

            const limiteDisponivel = arredondarValor(
                Number(cartao.limite) - limiteUtilizado
            );

            if (novoValor > limiteDisponivel) {
                mostrarMensagem(
                    `Valor não atualizado. Disponível no cartão: ${formatarMoeda(Math.max(0, limiteDisponivel))}.`,
                    "erro"
                );
                return;
            }

            const parcelas = Math.max(
                1,
                Number(item.parcelas) || 1
            );

            const fatorParcelamento =
                Number(item.valorOriginal) > 0
                    ? Number(item.totalParcelado) /
                        Number(item.valorOriginal)
                    : 1;

            const novoTotalParcelado = arredondarValor(
                novoValor * fatorParcelamento
            );

            const novoValorParcela = arredondarValor(
                novoTotalParcelado / parcelas
            );

            const compraAtualizada = {
                ...item,
                valorOriginal: novoValor,
                valorParcela: novoValorParcela,
                totalParcelado: novoTotalParcelado,
                formaPagamento: "credito",
                origem: item.origem || "despesas",
                categoria: normalizarTexto(
                    item.categoria || "SEM CATEGORIA"
                )
            };

            await salvarRegistro(
                COLECOES.compras,
                compraAtualizada,
                id
            );

            comprasCreditoFinora = comprasCreditoFinora.map(compra =>
                compra.id === id ? compraAtualizada : compra
            );

            movimentacoes.credito = movimentacoes.credito.map(compra =>
                compra.id === id ? compraAtualizada : compra
            );

            renderizarTabela("credito");
            atualizarTotais();
            notificarDebitosAtualizados();

            mostrarMensagem(
                `Compra atualizada. Parcela: ${formatarMoeda(novoValorParcela)}. Total parcelado: ${formatarMoeda(novoTotalParcelado)}.`,
                "sucesso"
            );

            return;
        }

        /* EDIÇÃO DE DÉBITO OU PIX */

        const debitoAtualizado = {
            ...item,
            valor: novoValor
        };

        await salvarRegistro(
            COLECOES.debitos,
            debitoAtualizado,
            id
        );

        debitosFinora = debitosFinora.map(debito =>
            debito.id === id ? debitoAtualizado : debito
        );

        movimentacoes[tipo] = movimentacoes[tipo].map(debito =>
            debito.id === id ? debitoAtualizado : debito
        );

        renderizarTabela(tipo);
        atualizarTotais();
        notificarDebitosAtualizados();

        mostrarMensagem(
            `Valor atualizado para ${formatarMoeda(novoValor)}.`,
            "sucesso"
        );

    } catch (erro) {
        console.error("Erro ao editar lançamento:", erro);

        mostrarMensagem(
            "Não foi possível atualizar o lançamento no Firestore.",
            "erro"
        );
    }
}

/* ========================================= */
/* EXCLUIR LANÇAMENTO */
/* ========================================= */

async function excluirLancamento(tipo, id) {
    if (!movimentacoes[tipo]) return;

    const item = movimentacoes[tipo].find(
        registro => registro.id === id
    );

    if (!item) {
        mostrarMensagem(
            "Não foi possível localizar esse lançamento.",
            "erro"
        );
        return;
    }

    if (tipo === "debito" && ehDespesaDeContaPagar(item)) {
        mostrarMensagem(
            "Esta despesa está vinculada a uma conta a pagar. Para excluí-la, acesse a página Contas a Pagar.",
            "erro"
        );
        return;
    }

    const confirmar = window.confirm(
        `Deseja realmente excluir "${item.descricao}"?`
    );

    if (!confirmar) return;

    try {
        if (tipo === "credito") {
            await excluirRegistro(
                COLECOES.compras,
                id
            );

            comprasCreditoFinora = comprasCreditoFinora.filter(
                compra => compra.id !== id
            );

        } else {
            await excluirRegistro(
                COLECOES.debitos,
                id
            );

            debitosFinora = debitosFinora.filter(
                debito => debito.id !== id
            );
        }

        movimentacoes[tipo] = movimentacoes[tipo].filter(
            registro => registro.id !== id
        );

        renderizarTabela(tipo);
        atualizarTotais();
        notificarDebitosAtualizados();

        mostrarMensagem(
            "Lançamento excluído com sucesso.",
            "sucesso"
        );

    } catch (erro) {
        console.error("Erro ao excluir lançamento:", erro);

        mostrarMensagem(
            "Não foi possível excluir o lançamento no Firestore.",
            "erro"
        );
    }
}

/* ========================================= */
/* EVENTOS DOS BOTÕES */
/* ========================================= */

document.addEventListener("click", evento => {
    const alvo = evento.target;

    if (!(alvo instanceof Element)) return;

    const botaoEditar = alvo.closest("[data-editar]");
    const botaoExcluir = alvo.closest("[data-excluir]");

    if (botaoEditar) {
        editarValor(
            botaoEditar.dataset.tipo,
            botaoEditar.dataset.editar
        );

        return;
    }

    if (botaoExcluir) {
        excluirLancamento(
            botaoExcluir.dataset.tipo,
            botaoExcluir.dataset.excluir
        );
    }
});

/* ========================================= */
/* SUGESTÃO AUTOMÁTICA DAS PARCELAS */
/* ========================================= */

function sugerirValorParcela() {
    if (
        !campoCreditoValor ||
        !campoParcelas ||
        !campoValorParcela
    ) {
        return;
    }

    const valorCompra = converterValorDigitado(
        campoCreditoValor.value
    );

    const quantidadeParcelas = Number(
        campoParcelas.value
    );

    const parcelasValidas =
        Number.isInteger(quantidadeParcelas) &&
        quantidadeParcelas >= 1 &&
        quantidadeParcelas <= 120;

    if (
        Number.isFinite(valorCompra) &&
        valorCompra > 0 &&
        parcelasValidas &&
        campoValorParcela.dataset.editado !== "sim"
    ) {
        campoValorParcela.value = (
            valorCompra / quantidadeParcelas
        ).toFixed(2);
    }
}

campoCreditoValor?.addEventListener(
    "input",
    sugerirValorParcela
);

campoParcelas?.addEventListener(
    "input",
    sugerirValorParcela
);

campoParcelas?.addEventListener(
    "change",
    sugerirValorParcela
);

campoCreditoValor?.addEventListener(
    "change",
    sugerirValorParcela
);

campoValorParcela?.addEventListener("input", () => {
    if (campoValorParcela.value.trim() === "") {
        campoValorParcela.dataset.editado = "";

        sugerirValorParcela();
        return;
    }

    campoValorParcela.dataset.editado = "sim";
});

/* ========================================= */
/* INICIALIZAÇÃO */
/* ========================================= */

async function iniciarDespesas() {
    formularios.forEach(formulario => {
        definirDatasHoje(formulario);
    });

    if (campoParcelas && !campoParcelas.value) {
        campoParcelas.value = "1";
    }

    await carregarDadosDespesas();
    sugerirValorParcela();
}

iniciarDespesas();