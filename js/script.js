
/* ========================================= */
/* FINORA — SCRIPT PRINCIPAL */
/* FIRESTORE */
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
    debitos: "debitos",
    cartoes: "cartoes",
    compras: "compras_credito",
    entradas: "entradas"
};

/* ========================================= */
/* DADOS EM MEMÓRIA */
/* ========================================= */

let debitosFinora = [];
let entradasFinora = [];
let cartoesFinora = [];
let comprasCreditoFinora = [];

let dadosCarregados = false;
let carregamentoEmAndamento = null;

/* ========================================= */
/* UTILITÁRIOS */
/* ========================================= */

function formatarMoeda(valor) {
    return Number(valor || 0).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL"
    });
}

function gerarIdFinora() {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/* ========================================= */
/* DADOS COMPARTILHADOS */
/* ========================================= */

function obterDebitosFinora() {
    return debitosFinora.filter(item =>
        item &&
        typeof item.data === "string" &&
        Number.isFinite(Number(item.valor)) &&
        Number(item.valor) > 0
    );
}

function obterEntradasFinora() {
    return entradasFinora.filter(item =>
        item &&
        typeof item.id === "string" &&
        typeof item.data === "string" &&
        typeof item.descricao === "string" &&
        Number.isFinite(Number(item.valor)) &&
        Number(item.valor) > 0
    );
}

function obterCartoesFinora() {
    return cartoesFinora.filter(item =>
        item &&
        typeof item.id === "string" &&
        typeof item.nome === "string" &&
        Number.isFinite(Number(item.limite))
    );
}

function obterComprasCreditoFinora() {
    return comprasCreditoFinora.filter(item =>
        item &&
        typeof item.id === "string" &&
        typeof item.cartaoId === "string" &&
        Number.isFinite(Number(item.valorOriginal))
    );
}

/* ========================================= */
/* CARREGAR DADOS DO FIRESTORE */
/* ========================================= */

async function carregarDadosFinora() {

    if (carregamentoEmAndamento) {
        return carregamentoEmAndamento;
    }

    carregamentoEmAndamento = (async () => {

        const [
            debitos,
            entradas,
            cartoes,
            compras
        ] = await Promise.all([
            listarRegistros(COLECOES.debitos),
            listarRegistros(COLECOES.entradas),
            listarRegistros(COLECOES.cartoes),
            listarRegistros(COLECOES.compras)
        ]);

        debitosFinora = debitos;
        entradasFinora = entradas;
        cartoesFinora = cartoes;
        comprasCreditoFinora = compras;

        dadosCarregados = true;

        return true;

    })();

    try {
        return await carregamentoEmAndamento;

    } finally {
        carregamentoEmAndamento = null;
    }
}

/* ========================================= */
/* LIMITES DOS CARTÕES */
/* ========================================= */

function calcularLimiteUtilizado(cartaoId) {

    return obterComprasCreditoFinora()
        .filter(compra => compra.cartaoId === cartaoId)
        .reduce((total, compra) => {
            return total + Number(compra.valorOriginal);
        }, 0);
}

function obterLimitesCartao(cartao) {

    const limiteTotal = Number(cartao.limite);
    const utilizado = calcularLimiteUtilizado(cartao.id);

    return {
        limiteTotal,
        utilizado,
        disponivel: Math.max(0, limiteTotal - utilizado)
    };
}

/* ========================================= */
/* MENSAGENS */
/* ========================================= */

function mostrarMensagemNaPagina(texto, tipo = "erro") {

    let mensagem = document.getElementById("mensagemCartao");

    if (!mensagem) {

        mensagem = document.createElement("div");
        mensagem.id = "mensagemCartao";

        mensagem.setAttribute("role", "status");
        mensagem.setAttribute("aria-live", "polite");

        const formulario = document.getElementById("formularioCartao");

        if (formulario?.parentNode) {
            formulario.parentNode.insertBefore(mensagem, formulario);
        } else {
            document.body.prepend(mensagem);
        }
    }

    mensagem.textContent = texto;

    mensagem.style.cssText = `
        display: block;
        padding: 12px 15px;
        margin: 12px 0;
        border-radius: 8px;
        font-size: 14px;
        background: ${tipo === "sucesso" ? "#dcfce7" : "#fee2e2"};
        color: ${tipo === "sucesso" ? "#166534" : "#991b1b"};
        border: 1px solid ${tipo === "sucesso" ? "#86efac" : "#fecaca"};
    `;
}

/* ========================================= */
/* RESUMO FINANCEIRO */
/* ========================================= */

const valorReceitas = document.getElementById("valorReceitas");
const valorDespesas = document.getElementById("valorDespesas");
const valorSaldo = document.getElementById("valorSaldo");

const comparacaoReceitas = document.getElementById("comparacaoReceitas");
const comparacaoDespesas = document.getElementById("comparacaoDespesas");
const comparacaoSaldo = document.getElementById("comparacaoSaldo");

function calcularVariacao(atual, anterior) {

    if (anterior === 0) return null;

    return ((atual - anterior) / Math.abs(anterior)) * 100;
}

function mostrarComparacao(elemento, atual, anterior, tipo) {

    if (!elemento) return;

    const variacao = calcularVariacao(atual, anterior);

    elemento.replaceChildren();

    if (variacao === null) {

        elemento.textContent = "Sem comparação disponível";
        elemento.className = "comparacao neutra";

        return;
    }

    const classe = variacao === 0
        ? "neutra"
        : tipo === "despesas"
            ? variacao < 0 ? "positiva" : "negativa"
            : variacao > 0 ? "positiva" : "negativa";

    const seta = variacao === 0
        ? "→"
        : variacao > 0 ? "↑" : "↓";

    const elementoSeta = document.createElement("span");
    elementoSeta.className = "seta";
    elementoSeta.textContent = seta;

    const percentual = document.createElement("span");
    percentual.className = "percentual";
    percentual.textContent = `${Math.abs(variacao).toFixed(1)}%`;

    const texto = document.createElement("span");
    texto.className = "texto-comparacao";

    texto.textContent = variacao === 0
        ? "sem alteração"
        : "em relação ao mês anterior";

    elemento.append(elementoSeta, percentual, texto);
    elemento.className = `comparacao ${classe}`;
}

/* ========================================= */
/* SOMAS MENSAIS */
/* ========================================= */

function somarEntradasDoMes(chaveMes) {

    return obterEntradasFinora()
        .filter(item => item.data.startsWith(chaveMes))
        .reduce((total, item) => {
            return total + Number(item.valor);
        }, 0);
}

function somarDebitosDoMes(chaveMes) {

    return obterDebitosFinora()
        .filter(item => item.data.startsWith(chaveMes))
        .reduce((total, item) => {
            return total + Number(item.valor);
        }, 0);
}

/* ========================================= */
/* ATUALIZAR RESUMO */
/* ========================================= */

function atualizarResumo() {

    if (!valorReceitas || !valorDespesas || !valorSaldo) {
        return;
    }

    const hoje = new Date();

    const anoAtual = hoje.getFullYear();
    const mesAtual = String(hoje.getMonth() + 1).padStart(2, "0");

    const mesAnteriorData = new Date(
        anoAtual,
        hoje.getMonth() - 1,
        1
    );

    const anoAnterior = mesAnteriorData.getFullYear();

    const mesAnterior = String(
        mesAnteriorData.getMonth() + 1
    ).padStart(2, "0");

    const chaveAtual = `${anoAtual}-${mesAtual}`;
    const chaveAnterior = `${anoAnterior}-${mesAnterior}`;

    const atual = {
        receitas: somarEntradasDoMes(chaveAtual),
        despesas: somarDebitosDoMes(chaveAtual)
    };

    atual.saldo = atual.receitas - atual.despesas;

    const anterior = {
        receitas: somarEntradasDoMes(chaveAnterior),
        despesas: somarDebitosDoMes(chaveAnterior)
    };

    anterior.saldo = anterior.receitas - anterior.despesas;

    valorReceitas.textContent = formatarMoeda(atual.receitas);
    valorDespesas.textContent = formatarMoeda(atual.despesas);
    valorSaldo.textContent = formatarMoeda(atual.saldo);

    mostrarComparacao(
        comparacaoReceitas,
        atual.receitas,
        anterior.receitas,
        "receitas"
    );

    mostrarComparacao(
        comparacaoDespesas,
        atual.despesas,
        anterior.despesas,
        "despesas"
    );

    mostrarComparacao(
        comparacaoSaldo,
        atual.saldo,
        anterior.saldo,
        "saldo"
    );
}

/* ========================================= */
/* GRÁFICO */
/* ========================================= */

function obterDadosGrafico() {

    const mapa = new Map();

    function obterRegistro(data) {

        if (!mapa.has(data)) {

            mapa.set(data, {
                data,
                receitas: 0,
                despesas: 0
            });
        }

        return mapa.get(data);
    }

    obterDebitosFinora().forEach(debito => {

        const registro = obterRegistro(debito.data);

        registro.despesas += Number(debito.valor);
    });

    obterEntradasFinora().forEach(entrada => {

        const registro = obterRegistro(entrada.data);

        registro.receitas += Number(entrada.valor);
    });

    return Array.from(mapa.values())
        .sort((a, b) => a.data.localeCompare(b.data));
}

function formatarDataGrafico(dataISO) {

    const [ano, mes, dia] = dataISO.split("-");

    return `${dia}/${mes}`;
}

const canvas = document.getElementById("graficoFinanceiro");

let graficoFinanceiro = null;
let dadosGrafico = [];

function atualizarGrafico(registros) {

    if (!graficoFinanceiro) return;

    graficoFinanceiro.data.labels = registros.map(item =>
        formatarDataGrafico(item.data)
    );

    graficoFinanceiro.data.datasets[0].data = registros.map(item =>
        item.receitas
    );

    graficoFinanceiro.data.datasets[1].data = registros.map(item =>
        item.despesas
    );

    graficoFinanceiro.update();
}

if (canvas && typeof Chart !== "undefined") {

    graficoFinanceiro = new Chart(canvas.getContext("2d"), {

        type: "line",

        data: {
            labels: [],

            datasets: [
                {
                    label: "Receitas",
                    data: [],
                    borderColor: "#14B8A6",
                    backgroundColor: "rgba(20,184,166,0.08)",
                    tension: 0.35,
                    fill: true,
                    pointRadius: 3
                },
                {
                    label: "Despesas",
                    data: [],
                    borderColor: "#E11D48",
                    backgroundColor: "rgba(225,29,72,0.05)",
                    tension: 0.35,
                    fill: true,
                    pointRadius: 3
                }
            ]
        },

        options: {
            responsive: true,
            maintainAspectRatio: false,

            interaction: {
                mode: "index",
                intersect: false
            },

            plugins: {
                legend: {
                    display: true,
                    position: "top"
                }
            },

            scales: {
                y: {
                    beginAtZero: true,

                    ticks: {
                        callback: valor => formatarMoeda(valor)
                    }
                }
            }
        }
    });
}

/* ========================================= */
/* ATUALIZAÇÃO FINANCEIRA GLOBAL */
/* ========================================= */

async function notificarAtualizacaoFinanceira() {

    try {

        await carregarDadosFinora();

        atualizarResumo();

        dadosGrafico = obterDadosGrafico();

        atualizarGrafico(dadosGrafico);

        renderizarCartoes();

    } catch (erro) {

        console.error(
            "Erro ao atualizar os dados financeiros:",
            erro
        );
    }
}

/* ========================================= */
/* DISPONIBILIZAR FUNÇÕES GLOBAIS */
/* ========================================= */

window.formatarMoeda = formatarMoeda;
window.gerarIdFinora = gerarIdFinora;

window.obterDebitosFinora = obterDebitosFinora;
window.obterEntradasFinora = obterEntradasFinora;
window.obterCartoesFinora = obterCartoesFinora;
window.obterComprasCreditoFinora = obterComprasCreditoFinora;

window.obterLimitesCartao = obterLimitesCartao;
window.calcularLimiteUtilizado = calcularLimiteUtilizado;

window.notificarAtualizacaoFinanceira = notificarAtualizacaoFinanceira;

/* ========================================= */
/* EVENTOS FINANCEIROS */
/* ========================================= */

window.addEventListener(
    "finora:debitos-atualizados",
    notificarAtualizacaoFinanceira
);

window.addEventListener(
    "finora:atualizacao-financeira",
    notificarAtualizacaoFinanceira
);

window.addEventListener("pageshow", () => {
    if (dadosCarregados) {
        notificarAtualizacaoFinanceira();
    }
});

/* ========================================= */
/* FILTRO DE PERÍODO */
/* ========================================= */

const tipoPeriodo = document.getElementById("tipoPeriodo");
const dataInicio = document.getElementById("dataInicio");
const dataFim = document.getElementById("dataFim");
const aplicarPeriodo = document.getElementById("aplicarPeriodo");

function dataISOParaLocal(valor) {

    const [ano, mes, dia] = valor.split("-").map(Number);

    return new Date(ano, mes - 1, dia);
}

function dataLocalParaISO(data) {

    return [
        data.getFullYear(),
        String(data.getMonth() + 1).padStart(2, "0"),
        String(data.getDate()).padStart(2, "0")
    ].join("-");
}

/* ========================================= */
/* INTERVALOS DO CALENDÁRIO */
/* ========================================= */

function obterIntervaloMesAtual() {

    const hoje = new Date();

    const inicio = new Date(
        hoje.getFullYear(),
        hoje.getMonth(),
        1
    );

    const fim = new Date(
        hoje.getFullYear(),
        hoje.getMonth() + 1,
        0
    );

    return {
        inicio: dataLocalParaISO(inicio),
        fim: dataLocalParaISO(fim)
    };
}

function obterIntervaloSemanaAtual() {

    const hoje = new Date();

    const inicio = new Date(
        hoje.getFullYear(),
        hoje.getMonth(),
        hoje.getDate()
    );

    const diaSemana = inicio.getDay();

    const deslocamento = diaSemana === 0
        ? -6
        : 1 - diaSemana;

    inicio.setDate(inicio.getDate() + deslocamento);

    const fim = new Date(inicio);

    fim.setDate(fim.getDate() + 6);

    return {
        inicio: dataLocalParaISO(inicio),
        fim: dataLocalParaISO(fim)
    };
}

/* ========================================= */
/* ATUALIZAR CAMPOS DO PERÍODO */
/* ========================================= */

function atualizarCamposPeriodo() {

    if (!tipoPeriodo || !dataInicio || !dataFim) return;

    const personalizado = tipoPeriodo.value === "personalizado";

    dataInicio.disabled = !personalizado;
    dataFim.disabled = !personalizado;
}

if (tipoPeriodo && dataInicio && dataFim) {

    tipoPeriodo.addEventListener("change", atualizarCamposPeriodo);

    atualizarCamposPeriodo();
}

/* ========================================= */
/* APLICAR FILTRO */
/* ========================================= */

function aplicarFiltroPeriodo() {

    if (!tipoPeriodo) return;

    dadosGrafico = obterDadosGrafico();

    let inicio;
    let fim;

    if (tipoPeriodo.value === "mes") {

        const intervalo = obterIntervaloMesAtual();

        inicio = intervalo.inicio;
        fim = intervalo.fim;
    }

    else if (tipoPeriodo.value === "semana") {

        const intervalo = obterIntervaloSemanaAtual();

        inicio = intervalo.inicio;
        fim = intervalo.fim;
    }

    else if (tipoPeriodo.value === "personalizado") {

        if (!dataInicio?.value || !dataFim?.value) {

            mostrarMensagemNaPagina(
                "Selecione a data inicial e a data final."
            );

            return;
        }

        if (dataInicio.value > dataFim.value) {

            mostrarMensagemNaPagina(
                "A data inicial não pode ser posterior à data final."
            );

            return;
        }

        inicio = dataInicio.value;
        fim = dataFim.value;
    }

    else {
        return;
    }

    const registros = dadosGrafico.filter(item =>
        item.data >= inicio && item.data <= fim
    );

    if (!registros.length) {

        atualizarGrafico([]);

        mostrarMensagemNaPagina(
            "Não existem dados para o período selecionado.",
            "erro"
        );

        return;
    }

    atualizarGrafico(registros);
}

if (aplicarPeriodo) {

    aplicarPeriodo.addEventListener("click", aplicarFiltroPeriodo);
}

/* ========================================= */
/* CARTÕES */
/* ========================================= */

const abrirFormulario = document.getElementById("abrirFormulario");
const formularioCartao = document.getElementById("formularioCartao");
const salvarCartao = document.getElementById("salvarCartao");
const areaCartoes = document.querySelector(".area-cartoes");

const nomeCartao = document.getElementById("nomeCartao");
const bandeiraCartao = document.getElementById("bandeiraCartao");
const limiteCartao = document.getElementById("limiteCartao");
const fechamentoCartao = document.getElementById("fechamentoCartao");
const vencimentoCartao = document.getElementById("vencimentoCartao");

let cartaoEmEdicaoId = null;

function limparFormularioCartao() {

    if (nomeCartao) nomeCartao.value = "";
    if (bandeiraCartao) bandeiraCartao.value = "";
    if (limiteCartao) limiteCartao.value = "";
    if (fechamentoCartao) fechamentoCartao.value = "";
    if (vencimentoCartao) vencimentoCartao.value = "";
}

function fecharFormularioCartao() {

    if (formularioCartao) {
        formularioCartao.style.display = "none";
    }

    limparFormularioCartao();

    cartaoEmEdicaoId = null;

    if (salvarCartao) {
        salvarCartao.textContent = "Salvar cartão";
    }
}

function atualizarVisualCartao(elemento, cartao) {

    const limites = obterLimitesCartao(cartao);

    elemento.querySelector(".nome-cartao").textContent = cartao.nome;

    elemento.querySelector(".bandeira-cartao").textContent =
        cartao.bandeira;

    elemento.querySelector(".limite-total").textContent =
        formatarMoeda(limites.limiteTotal);

    elemento.querySelector(".limite-disponivel").textContent =
        formatarMoeda(limites.disponivel);

    elemento.querySelector(".valor-utilizado").textContent =
        formatarMoeda(limites.utilizado);

    elemento.querySelector(".dia-fechamento").textContent =
        `dia ${cartao.fechamento}`;

    elemento.querySelector(".dia-vencimento").textContent =
        `dia ${cartao.vencimento}`;
}

function criarCartaoVisual(cartao) {

    const elemento = document.createElement("article");

    elemento.className = "cartao-cadastrado";
    elemento.dataset.cartaoId = cartao.id;

    elemento.innerHTML = `
        <div class="cartao-frente">
            <div class="cartao-topo">
                <div class="marca-finora">
                    <img
                        src="https://i.ibb.co/PG1HH81v/9777b8a0a5e87-42d6-9e72-ed4aed67afef-1.png"
                        alt="Logo Finora"
                    >
                </div>
            </div>

            <div class="chip">
                <span></span>
                <span></span>
                <span></span>
            </div>

            <div class="numero-cartao">XXXX XXXX XXXX XXXX</div>

            <div class="cartao-rodape">
                <div class="titular-cartao">
                    <small class="nome-cartao"></small>
                    <strong>HENRIQUE LUZÓRIO</strong>
                </div>

                <div class="bandeira-cartao"></div>
            </div>
        </div>

        <div class="dados-cartao-info">
            <p>
                <strong>Limite total:</strong>
                <span class="limite-total"></span>
            </p>

            <p>
                <strong>Limite disponível:</strong>
                <span class="limite-disponivel"></span>
            </p>

            <p>
                <strong>Utilizado:</strong>
                <span class="valor-utilizado"></span>
            </p>

            <p>
                <strong>Fechamento:</strong>
                <span class="dia-fechamento"></span>
            </p>

            <p>
                <strong>Vencimento:</strong>
                <span class="dia-vencimento"></span>
            </p>

            <div class="acoes-cartao">
                <button type="button" class="botao-editar-cartao">
                    Editar cartão
                </button>

                <button type="button" class="botao-excluir-cartao">
                    Excluir cartão
                </button>
            </div>
        </div>
    `;

    elemento.querySelector(".botao-editar-cartao")
        .addEventListener("click", () => {

            cartaoEmEdicaoId = cartao.id;

            nomeCartao.value = cartao.nome;
            bandeiraCartao.value = cartao.bandeira;
            limiteCartao.value = cartao.limite;
            fechamentoCartao.value = cartao.fechamento;
            vencimentoCartao.value = cartao.vencimento;

            salvarCartao.textContent = "Salvar alterações";

            formularioCartao.style.display = "block";

            formularioCartao.scrollIntoView({
                behavior: "smooth",
                block: "center"
            });
        });

    elemento.querySelector(".botao-excluir-cartao")
        .addEventListener("click", async () => {

            const comprasVinculadas = obterComprasCreditoFinora()
                .filter(compra => compra.cartaoId === cartao.id);

            if (comprasVinculadas.length > 0) {

                mostrarMensagemNaPagina(
                    `Não é possível excluir ${cartao.nome}: existem ${comprasVinculadas.length} compra(s) vinculada(s). Exclua essas compras primeiro.`
                );

                return;
            }

            if (!confirm(`Deseja realmente excluir o cartão "${cartao.nome}"?`)) {
                return;
            }

            try {

                await excluirRegistro(
                    COLECOES.cartoes,
                    cartao.id
                );

                cartoesFinora = cartoesFinora.filter(item =>
                    item.id !== cartao.id
                );

                if (cartaoEmEdicaoId === cartao.id) {
                    fecharFormularioCartao();
                }

                renderizarCartoes();

                mostrarMensagemNaPagina(
                    "Cartão excluído com sucesso.",
                    "sucesso"
                );

            } catch (erro) {

                console.error("Erro ao excluir cartão:", erro);

                mostrarMensagemNaPagina(
                    "Não foi possível excluir o cartão. Tente novamente."
                );
            }
        });

    atualizarVisualCartao(elemento, cartao);

    return elemento;
}

function renderizarCartoes() {

    if (!areaCartoes) return;

    areaCartoes.replaceChildren();

    const cartoes = obterCartoesFinora();

    if (!cartoes.length) {

        const aviso = document.createElement("p");

        aviso.className = "mensagem-cartoes-vazios";
        aviso.textContent = "Você ainda não cadastrou cartões.";

        areaCartoes.appendChild(aviso);

        return;
    }

    cartoes.forEach(cartao => {
        areaCartoes.appendChild(criarCartaoVisual(cartao));
    });
}

/* ========================================= */
/* ABRIR E FECHAR FORMULÁRIO */
/* ========================================= */

if (abrirFormulario && formularioCartao) {

    abrirFormulario.addEventListener("click", () => {

        if (formularioCartao.style.display === "block") {
            fecharFormularioCartao();
        } else {
            formularioCartao.style.display = "block";
        }
    });
}

/* ========================================= */
/* SALVAR CARTÃO NO FIRESTORE */
/* ========================================= */

if (salvarCartao) {

    salvarCartao.addEventListener("click", async () => {

        const nome = nomeCartao.value.trim();
        const bandeira = bandeiraCartao.value;
        const limite = Number(limiteCartao.value);
        const fechamento = Number(fechamentoCartao.value);
        const vencimento = Number(vencimentoCartao.value);

        if (
            !nome ||
            !bandeira ||
            limiteCartao.value.trim() === "" ||
            !Number.isFinite(limite) ||
            limite <= 0 ||
            !Number.isInteger(fechamento) ||
            fechamento < 1 ||
            fechamento > 31 ||
            !Number.isInteger(vencimento) ||
            vencimento < 1 ||
            vencimento > 31
        ) {

            mostrarMensagemNaPagina(
                "Preencha os campos corretamente. O limite deve ser maior que zero e os dias devem estar entre 1 e 31."
            );

            return;
        }

        const cartoes = obterCartoesFinora();

        const nomeDuplicado = cartoes.some(item =>
            item.id !== cartaoEmEdicaoId &&
            item.nome.trim().toLocaleLowerCase("pt-BR") ===
                nome.toLocaleLowerCase("pt-BR")
        );

        if (nomeDuplicado) {

            mostrarMensagemNaPagina(
                "Já existe um cartão com esse nome. Escolha outro nome."
            );

            return;
        }

        let cartao;

        if (cartaoEmEdicaoId) {

            const existente = cartoes.find(item =>
                item.id === cartaoEmEdicaoId
            );

            if (!existente) {

                mostrarMensagemNaPagina(
                    "Não foi possível localizar o cartão."
                );

                return;
            }

            const utilizado = calcularLimiteUtilizado(cartaoEmEdicaoId);

            if (limite < utilizado) {

                mostrarMensagemNaPagina(
                    `O novo limite não pode ser menor que o valor utilizado (${formatarMoeda(utilizado)}).`
                );

                return;
            }

            cartao = {
                ...existente,
                nome,
                bandeira,
                limite,
                fechamento,
                vencimento
            };

        } else {

            cartao = {
                id: gerarIdFinora(),
                nome,
                bandeira,
                limite,
                fechamento,
                vencimento
            };
        }

        try {

            await salvarRegistro(
                COLECOES.cartoes,
                cartao,
                cartao.id
            );

            if (cartaoEmEdicaoId) {

                cartoesFinora = cartoesFinora.map(item =>
                    item.id === cartao.id ? cartao : item
                );

            } else {

                cartoesFinora = [
                    ...cartoesFinora,
                    cartao
                ];
            }

            fecharFormularioCartao();

            renderizarCartoes();

            mostrarMensagemNaPagina(
                "Cartão salvo com sucesso.",
                "sucesso"
            );

        } catch (erro) {

            console.error("Erro ao salvar cartão:", erro);

            mostrarMensagemNaPagina(
                "Não foi possível salvar o cartão. Verifique sua conexão e tente novamente."
            );
        }
    });
}

/* ========================================= */
/* INICIALIZAÇÃO */
/* ========================================= */

async function iniciarScriptFinora() {

    try {

        await carregarDadosFinora();

        atualizarResumo();

        dadosGrafico = obterDadosGrafico();

        atualizarGrafico(dadosGrafico);

        renderizarCartoes();

        return true;

    } catch (erro) {

        console.error(
            "Erro ao carregar os dados do Finora:",
            erro
        );

        mostrarMensagemNaPagina(
            "Não foi possível carregar seus dados financeiros. Atualize a página ou tente novamente."
        );

        return false;
    }
}

/*
    Disponibiliza a inicialização para o index.html.

    Assim, a página pode aguardar o carregamento dos dados
    reais antes de revelar o dashboard.
*/

window.finoraInicializado = iniciarScriptFinora();