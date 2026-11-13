
/* ========================================= */
/* FINORA — RELATÓRIOS FINANCEIROS */
/* FIRESTORE */
/* FILTROS, INDICADORES, GRÁFICOS E EXPORTAÇÃO */
/* ========================================= */

import { listarRegistros } from "./finora-db.js";

(function () {
    "use strict";

    /* ========================================= */
    /* COLEÇÕES FIRESTORE */
    /* ========================================= */

    const COLECOES = {
        entradas: "entradas",
        debitos: "debitos",
        credito: "compras_credito"
    };

    /* ========================================= */
    /* ELEMENTOS */
    /* ========================================= */

    const elementos = {
        periodo: document.getElementById("filtroPeriodo"),
        dataInicial: document.getElementById("dataInicial"),
        dataFinal: document.getElementById("dataFinal"),

        containerDataInicial: document.getElementById(
            "filtroDataInicialContainer"
        ),

        containerDataFinal: document.getElementById(
            "filtroDataFinalContainer"
        ),

        btnAplicar: document.getElementById("btnAplicarFiltros"),

        totalReceitas: document.getElementById(
            "relatorioTotalReceitas"
        ),

        totalDespesas: document.getElementById(
            "relatorioTotalDespesas"
        ),

        saldo: document.getElementById("relatorioSaldo"),

        taxaEconomia: document.getElementById(
            "relatorioTaxaEconomia"
        ),

        grafico: document.getElementById(
            "graficoComparativoMensal"
        ),

        categorias: document.getElementById(
            "relatorioDespesasCategoria"
        ),

        tabela: document.getElementById(
            "listaDetalhamentoRelatorio"
        ),

        btnPDF: document.getElementById("btnExportarPDF"),
        btnExcel: document.getElementById("btnExportarExcel"),

        mensagem: document.getElementById("mensagemRelatorios")
    };

    /* ========================================= */
    /* ESTADO */
    /* ========================================= */

    let movimentacoes = [];
    let movimentacoesFiltradas = [];

    let dadosResumo = {
        receitas: 0,
        despesas: 0,
        saldo: 0,
        taxaEconomia: 0
    };

    let periodoAplicado = {
        inicio: null,
        fim: null,
        descricao: ""
    };

    let graficoMensal = null;
    let mensagemTimeout = null;
    let carregando = false;

    /* ========================================= */
    /* UTILITÁRIOS */
    /* ========================================= */

    function formatarMoeda(valor) {
        const numero = Number(valor);

        return (Number.isFinite(numero) ? numero : 0)
            .toLocaleString("pt-BR", {
                style: "currency",
                currency: "BRL"
            });
    }

    function arredondarValor(valor) {
        return Math.round(
            (Number(valor) + Number.EPSILON) * 100
        ) / 100;
    }

    function dataHojeISO() {
        const hoje = new Date();

        return [
            hoje.getFullYear(),
            String(hoje.getMonth() + 1).padStart(2, "0"),
            String(hoje.getDate()).padStart(2, "0")
        ].join("-");
    }

    function formatarData(data) {
        if (!data || !/^\d{4}-\d{2}-\d{2}$/.test(data)) {
            return "—";
        }

        const [ano, mes, dia] = data.split("-");

        return `${dia}/${mes}/${ano}`;
    }

    function converterDataISO(data) {
        if (
            typeof data !== "string" ||
            !/^\d{4}-\d{2}-\d{2}$/.test(data)
        ) {
            return null;
        }

        const [ano, mes, dia] = data.split("-").map(Number);

        const dataConvertida = new Date(
            ano,
            mes - 1,
            dia
        );

        if (
            dataConvertida.getFullYear() !== ano ||
            dataConvertida.getMonth() !== mes - 1 ||
            dataConvertida.getDate() !== dia
        ) {
            return null;
        }

        return dataConvertida;
    }

    function primeiroDiaDoMes(data) {
        return new Date(
            data.getFullYear(),
            data.getMonth(),
            1
        );
    }

    function ultimoDiaISO(data) {
        return [
            data.getFullYear(),
            String(data.getMonth() + 1).padStart(2, "0"),
            String(data.getDate()).padStart(2, "0")
        ].join("-");
    }

    function primeiroDiaISO(data) {
        return [
            data.getFullYear(),
            String(data.getMonth() + 1).padStart(2, "0"),
            "01"
        ].join("-");
    }

    function adicionarMeses(data, quantidade) {
        return new Date(
            data.getFullYear(),
            data.getMonth() + quantidade,
            1
        );
    }

    function nomeMes(data) {
        return data.toLocaleDateString("pt-BR", {
            month: "short",
            year: "2-digit"
        }).replace(".", "");
    }

    function escaparCSV(valor) {
        return `"${String(valor ?? "").replace(/"/g, '""')}"`;
    }

    /* ========================================= */
    /* MENSAGENS */
    /* ========================================= */

    function mostrarMensagem(texto, tipo = "sucesso") {
        if (!elementos.mensagem) {
            return;
        }

        clearTimeout(mensagemTimeout);

        elementos.mensagem.textContent = texto;
        elementos.mensagem.className =
            `mensagem-relatorios ${tipo}`;

        mensagemTimeout = setTimeout(() => {
            elementos.mensagem.textContent = "";
            elementos.mensagem.className =
                "mensagem-relatorios";
        }, 4500);
    }

    /* ========================================= */
    /* VALIDAÇÃO DOS REGISTROS */
    /* ========================================= */

    function registroValido(item, campoValor = "valor") {
        return (
            item &&
            typeof item.id === "string" &&
            typeof item.data === "string" &&
            Number.isFinite(Number(item[campoValor])) &&
            Number(item[campoValor]) > 0 &&
            converterDataISO(item.data)
        );
    }

    /* ========================================= */
    /* LEITURA DAS ENTRADAS — FIRESTORE */
    /* ========================================= */

    function obterEntradas(registros) {
        return registros
            .filter(item => registroValido(item))
            .map(item => ({
                id: `entrada-${item.id}`,
                data: item.data,
                descricao: item.descricao || "Entrada",
                categoria: item.categoria || "OUTROS",
                tipo: "receita",
                origem: "Entrada",
                forma: item.forma || "Não informada",
                valor: arredondarValor(item.valor)
            }));
    }

    /* ========================================= */
    /* LEITURA DOS DÉBITOS E PIX — FIRESTORE */
    /* ========================================= */

    function obterDespesasDebitoPix(registros) {
        return registros
            .filter(item => registroValido(item))
            .map(item => {
                const ehContaPagar =
                    item.origem === "conta_pagar" ||
                    Boolean(item.contaId);

                let forma = item.formaPagamento || "debito";

                const origem = ehContaPagar
                    ? "Conta a pagar"
                    : "Despesas";

                if (forma === "pix") {
                    forma = "pix";
                } else if (ehContaPagar) {
                    forma = "conta_pagar";
                } else {
                    forma = "debito";
                }

                return {
                    id: `despesa-${item.id}`,
                    data: item.data,
                    descricao: item.descricao || "Despesa",
                    categoria: item.categoria || "OUTROS",
                    tipo: "despesa",
                    origem,
                    forma,
                    valor: arredondarValor(item.valor)
                };
            });
    }

    /* ========================================= */
    /* LEITURA DAS COMPRAS NO CRÉDITO — FIRESTORE */
    /* ========================================= */

    function obterDespesasCredito(registros) {
        return registros
            .filter(compra => registroValido(compra, "valorOriginal"))
            .map(compra => ({
                id: `credito-${compra.id}`,
                data: compra.data,
                descricao: compra.descricao || "Compra no crédito",
                categoria: compra.categoria || "CRÉDITO",
                tipo: "despesa",
                origem: "Despesas",
                forma: "credito",
                valor: arredondarValor(compra.valorOriginal)
            }));
    }

    /* ========================================= */
    /* CONSOLIDAR MOVIMENTAÇÕES — FIRESTORE */
    /* ========================================= */

    async function carregarMovimentacoes() {
        const [
            registrosEntradas,
            registrosDebitos,
            registrosCredito
        ] = await Promise.all([
            listarRegistros(COLECOES.entradas),
            listarRegistros(COLECOES.debitos),
            listarRegistros(COLECOES.credito)
        ]);

        const entradas = obterEntradas(registrosEntradas);

        const despesasDebitoPix =
            obterDespesasDebitoPix(registrosDebitos);

        const despesasCredito =
            obterDespesasCredito(registrosCredito);

        movimentacoes = [
            ...entradas,
            ...despesasDebitoPix,
            ...despesasCredito
        ].sort((a, b) => {
            return b.data.localeCompare(a.data);
        });

        return movimentacoes;
    }

    /* ========================================= */
    /* CÁLCULO DO PERÍODO */
    /* ========================================= */

    function obterPeriodoSelecionado() {
        const hoje = converterDataISO(dataHojeISO());
        const hojeISO = dataHojeISO();

        const opcao = elementos.periodo.value;

        let inicio;
        let fim = hojeISO;
        let descricao = "";

        if (opcao === "mes_atual") {
            inicio = primeiroDiaISO(hoje);
            descricao = "Mês atual";

        } else if (opcao === "mes_anterior") {
            const mesAnterior = adicionarMeses(
                primeiroDiaDoMes(hoje),
                -1
            );

            const ultimoDia = new Date(
                mesAnterior.getFullYear(),
                mesAnterior.getMonth() + 1,
                0
            );

            inicio = primeiroDiaISO(mesAnterior);
            fim = ultimoDiaISO(ultimoDia);

            descricao = "Mês anterior";

        } else if (opcao === "ultimos_3_meses") {
            const dataInicial = adicionarMeses(
                primeiroDiaDoMes(hoje),
                -2
            );

            inicio = primeiroDiaISO(dataInicial);
            descricao = "Últimos 3 meses";

        } else if (opcao === "ultimos_6_meses") {
            const dataInicial = adicionarMeses(
                primeiroDiaDoMes(hoje),
                -5
            );

            inicio = primeiroDiaISO(dataInicial);
            descricao = "Últimos 6 meses";

        } else if (opcao === "ano_atual") {
            inicio = `${hoje.getFullYear()}-01-01`;
            descricao = "Ano atual";

        } else if (opcao === "personalizado") {
            inicio = elementos.dataInicial.value;
            fim = elementos.dataFinal.value;
            descricao = "Período personalizado";

        } else if (opcao === "todo_periodo") {
            const datas = movimentacoes
                .map(item => item.data)
                .filter(Boolean)
                .sort();

            inicio = datas.length
                ? datas[0]
                : hojeISO;

            descricao = "Todo o período";
        }

        return {
            inicio,
            fim,
            descricao
        };
    }

    /* ========================================= */
    /* FILTROS */
    /* ========================================= */

    function atualizarVisibilidadeDatas() {
        const personalizado =
            elementos.periodo.value === "personalizado";

        elementos.containerDataInicial.hidden =
            !personalizado;

        elementos.containerDataFinal.hidden =
            !personalizado;
    }

    function validarPeriodo(periodo) {
        if (!periodo.inicio || !periodo.fim) {
            mostrarMensagem(
                "Informe a data inicial e a data final.",
                "erro"
            );

            return false;
        }

        if (
            !converterDataISO(periodo.inicio) ||
            !converterDataISO(periodo.fim)
        ) {
            mostrarMensagem(
                "Informe um período com datas válidas.",
                "erro"
            );

            return false;
        }

        if (periodo.inicio > periodo.fim) {
            mostrarMensagem(
                "A data inicial não pode ser posterior à data final.",
                "erro"
            );

            return false;
        }

        return true;
    }

    async function aplicarFiltros() {
        if (carregando) {
            return;
        }

        carregando = true;

        try {
            await carregarMovimentacoes();

            const periodo = obterPeriodoSelecionado();

            if (!validarPeriodo(periodo)) {
                return;
            }

            periodoAplicado = periodo;

            movimentacoesFiltradas = movimentacoes.filter(item => {
                return (
                    item.data >= periodo.inicio &&
                    item.data <= periodo.fim
                );
            });

            atualizarResumo();
            renderizarGrafico();
            renderizarCategorias();
            renderizarDetalhamento();

        } catch (erro) {
            console.error(
                "Erro ao carregar relatório do Firestore:",
                erro
            );

            mostrarMensagem(
                "Não foi possível carregar os dados do relatório. Verifique sua conexão e tente novamente.",
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
        const receitas = movimentacoesFiltradas
            .filter(item => item.tipo === "receita")
            .reduce((total, item) => total + item.valor, 0);

        const despesas = movimentacoesFiltradas
            .filter(item => item.tipo === "despesa")
            .reduce((total, item) => total + item.valor, 0);

        const saldo = arredondarValor(receitas - despesas);

        const taxaEconomia = receitas > 0
            ? (saldo / receitas) * 100
            : 0;

        dadosResumo = {
            receitas: arredondarValor(receitas),
            despesas: arredondarValor(despesas),
            saldo,
            taxaEconomia
        };

        elementos.totalReceitas.textContent =
            formatarMoeda(receitas);

        elementos.totalDespesas.textContent =
            formatarMoeda(despesas);

        elementos.saldo.textContent =
            formatarMoeda(saldo);

        elementos.saldo.style.color =
            saldo >= 0 ? "#0F766E" : "#DC5757";

        elementos.taxaEconomia.textContent =
            `${taxaEconomia.toLocaleString("pt-BR", {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1
            })}%`;

        elementos.taxaEconomia.style.color =
            taxaEconomia >= 0 ? "#0F766E" : "#DC5757";
    }

    /* ========================================= */
    /* COMPARATIVO MENSAL */
    /* ========================================= */

    function obterDadosMensais() {
        const inicio = converterDataISO(
            periodoAplicado.inicio
        );

        const fim = converterDataISO(
            periodoAplicado.fim
        );

        if (!inicio || !fim) {
            return [];
        }

        let cursor = primeiroDiaDoMes(inicio);
        const ultimoMes = primeiroDiaDoMes(fim);

        const meses = [];

        while (cursor <= ultimoMes) {
            const chave =
                `${cursor.getFullYear()}-${String(
                    cursor.getMonth() + 1
                ).padStart(2, "0")}`;

            const itensMes = movimentacoesFiltradas.filter(
                item => item.data.substring(0, 7) === chave
            );

            const receitas = itensMes
                .filter(item => item.tipo === "receita")
                .reduce((total, item) => total + item.valor, 0);

            const despesas = itensMes
                .filter(item => item.tipo === "despesa")
                .reduce((total, item) => total + item.valor, 0);

            meses.push({
                chave,
                nome: nomeMes(cursor),
                receitas: arredondarValor(receitas),
                despesas: arredondarValor(despesas),
                saldo: arredondarValor(receitas - despesas)
            });

            cursor = adicionarMeses(cursor, 1);
        }

        return meses.slice(-24);
    }

    function renderizarGrafico() {
        if (!elementos.grafico) {
            return;
        }

        elementos.grafico.replaceChildren();

        if (typeof Chart === "undefined") {
            const aviso = document.createElement("p");

            aviso.className = "estado-vazio-relatorio";
            aviso.textContent =
                "Não foi possível carregar a biblioteca do gráfico.";

            elementos.grafico.appendChild(aviso);

            return;
        }

        const meses = obterDadosMensais();

        if (!meses.length) {
            const aviso = document.createElement("p");

            aviso.className = "estado-vazio-relatorio";
            aviso.textContent =
                "Não há dados disponíveis para o período selecionado.";

            elementos.grafico.appendChild(aviso);

            if (graficoMensal) {
                graficoMensal.destroy();
                graficoMensal = null;
            }

            return;
        }

        const canvas = document.createElement("canvas");

        canvas.setAttribute(
            "aria-label",
            "Comparativo mensal de receitas, despesas e saldo"
        );

        elementos.grafico.appendChild(canvas);

        if (graficoMensal) {
            graficoMensal.destroy();
            graficoMensal = null;
        }

        graficoMensal = new Chart(canvas, {
            type: "bar",

            data: {
                labels: meses.map(item => item.nome),

                datasets: [
                    {
                        label: "Receitas",
                        data: meses.map(item => item.receitas),
                        backgroundColor: "#0F766E",
                        borderRadius: 5,
                        maxBarThickness: 35
                    },
                    {
                        label: "Despesas",
                        data: meses.map(item => item.despesas),
                        backgroundColor: "#D97757",
                        borderRadius: 5,
                        maxBarThickness: 35
                    },
                    {
                        label: "Saldo",
                        data: meses.map(item => item.saldo),
                        type: "line",
                        borderColor: "#2563EB",
                        backgroundColor: "#2563EB",
                        borderWidth: 2,
                        pointRadius: 3,
                        pointHoverRadius: 5,
                        tension: 0.3
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
                        position: "bottom",

                        labels: {
                            usePointStyle: true,
                            boxWidth: 8,
                            padding: 20,
                            color: "#64748B",
                            font: {
                                size: 11
                            }
                        }
                    },

                    tooltip: {
                        callbacks: {
                            label: contexto => {
                                return (
                                    `${contexto.dataset.label}: ` +
                                    formatarMoeda(contexto.raw)
                                );
                            }
                        }
                    }
                },

                scales: {
                    x: {
                        grid: {
                            display: false
                        },

                        ticks: {
                            color: "#64748B",
                            font: {
                                size: 10
                            }
                        }
                    },

                    y: {
                        beginAtZero: true,

                        grid: {
                            color: "#F1F5F9"
                        },

                        ticks: {
                            color: "#64748B",

                            callback: valor => {
                                return Number(valor).toLocaleString(
                                    "pt-BR",
                                    {
                                        notation: "compact",
                                        maximumFractionDigits: 1
                                    }
                                );
                            }
                        }
                    }
                }
            }
        });
    }

    /* ========================================= */
    /* DESPESAS POR CATEGORIA */
    /* ========================================= */

    function renderizarCategorias() {
        elementos.categorias.replaceChildren();

        const despesas = movimentacoesFiltradas.filter(
            item => item.tipo === "despesa"
        );

        if (!despesas.length) {
            const aviso = document.createElement("p");

            aviso.className = "estado-vazio-relatorio";
            aviso.textContent =
                "Nenhuma despesa encontrada no período.";

            elementos.categorias.appendChild(aviso);

            return;
        }

        const agrupadas = {};

        despesas.forEach(item => {
            const categoria = String(
                item.categoria || "OUTROS"
            ).trim().toLocaleUpperCase("pt-BR");

            agrupadas[categoria] =
                (agrupadas[categoria] || 0) + item.valor;
        });

        const lista = Object.entries(agrupadas)
            .map(([categoria, valor]) => ({
                categoria,
                valor: arredondarValor(valor)
            }))
            .sort((a, b) => b.valor - a.valor);

        const totalDespesas = lista.reduce(
            (total, item) => total + item.valor,
            0
        );

        lista.forEach(item => {
            const percentual = totalDespesas > 0
                ? (item.valor / totalDespesas) * 100
                : 0;

            const bloco = document.createElement("div");

            bloco.className = "item-categoria-relatorio";

            const cabecalho = document.createElement("div");

            cabecalho.className =
                "cabecalho-categoria-relatorio";

            const nome = document.createElement("span");

            nome.className = "nome-categoria-relatorio";
            nome.textContent = item.categoria;

            const valor = document.createElement("strong");

            valor.className = "valor-categoria-relatorio";
            valor.textContent = formatarMoeda(item.valor);

            cabecalho.append(nome, valor);

            const detalhes = document.createElement("div");

            detalhes.className =
                "detalhes-categoria-relatorio";

            const percentualTexto = document.createElement("span");

            percentualTexto.textContent =
                `${percentual.toLocaleString("pt-BR", {
                    maximumFractionDigits: 1
                })}% das despesas`;

            const barra = document.createElement("div");

            barra.className = "barra-categoria-relatorio";

            const progresso = document.createElement("span");

            progresso.className =
                "progresso-categoria-relatorio";

            progresso.style.width = `${percentual}%`;

            barra.appendChild(progresso);
            detalhes.appendChild(percentualTexto);

            bloco.append(
                cabecalho,
                detalhes,
                barra
            );

            elementos.categorias.appendChild(bloco);
        });
    }

    /* ========================================= */
    /* DETALHAMENTO DAS MOVIMENTAÇÕES */
    /* ========================================= */

    function renderizarDetalhamento() {
        elementos.tabela.replaceChildren();

        if (!movimentacoesFiltradas.length) {
            const linha = document.createElement("tr");
            const celula = document.createElement("td");

            celula.colSpan = 5;
            celula.className = "estado-vazio-relatorio";
            celula.textContent =
                "Nenhuma movimentação encontrada no período.";

            linha.appendChild(celula);
            elementos.tabela.appendChild(linha);

            return;
        }

        movimentacoesFiltradas.forEach(item => {
            const linha = document.createElement("tr");

            const data = document.createElement("td");
            data.textContent = formatarData(item.data);

            const descricao = document.createElement("td");
            descricao.textContent = item.descricao;

            const categoria = document.createElement("td");
            categoria.textContent = item.categoria;

            const tipo = document.createElement("td");

            tipo.className =
                "tipo-movimentacao-relatorio";

            tipo.textContent = item.tipo === "receita"
                ? "Receita"
                : item.forma === "credito"
                    ? "Crédito"
                    : item.forma === "pix"
                        ? "Pix"
                        : item.forma === "conta_pagar"
                            ? "Conta paga"
                            : "Débito";

            const valor = document.createElement("td");

            valor.textContent = formatarMoeda(item.valor);

            valor.className = item.tipo === "receita"
                ? "valor-positivo-relatorio"
                : "valor-negativo-relatorio";

            linha.append(
                data,
                descricao,
                categoria,
                tipo,
                valor
            );

            elementos.tabela.appendChild(linha);
        });
    }

    /* ========================================= */
    /* DADOS PARA EXPORTAÇÃO */
    /* ========================================= */

    function obterDadosExportacao() {
        return movimentacoesFiltradas.map(item => ({
            Data: formatarData(item.data),
            Descrição: item.descricao,
            Categoria: item.categoria,
            Tipo: item.tipo === "receita"
                ? "Receita"
                : "Despesa",
            Forma: item.forma,
            Origem: item.origem,
            Valor: item.valor
        }));
    }

    function obterNomeArquivo() {
        return `finora-relatorio-${dataHojeISO()}`;
    }

    /* ========================================= */
    /* EXPORTAÇÃO EXCEL */
    /* ========================================= */

    function exportarExcel() {
        if (typeof XLSX === "undefined") {
            mostrarMensagem(
                "A biblioteca de Excel não foi carregada. Verifique sua conexão e atualize a página.",
                "erro"
            );

            return;
        }

        const dadosMovimentacoes = obterDadosExportacao();

        const dadosResumoExcel = [
            {
                Indicador: "Total de receitas",
                Valor: dadosResumo.receitas
            },
            {
                Indicador: "Total de despesas",
                Valor: dadosResumo.despesas
            },
            {
                Indicador: "Saldo do período",
                Valor: dadosResumo.saldo
            },
            {
                Indicador: "Taxa de economia",
                Valor: `${dadosResumo.taxaEconomia.toFixed(2)}%`
            },
            {
                Indicador: "Período",
                Valor: periodoAplicado.descricao
            },
            {
                Indicador: "Data inicial",
                Valor: formatarData(periodoAplicado.inicio)
            },
            {
                Indicador: "Data final",
                Valor: formatarData(periodoAplicado.fim)
            }
        ];

        const categorias = {};

        movimentacoesFiltradas
            .filter(item => item.tipo === "despesa")
            .forEach(item => {
                categorias[item.categoria] =
                    (categorias[item.categoria] || 0) +
                    item.valor;
            });

        const dadosCategorias = Object.entries(categorias)
            .map(([categoria, valor]) => ({
                Categoria: categoria,
                Total: arredondarValor(valor)
            }))
            .sort((a, b) => b.Total - a.Total);

        const meses = obterDadosMensais().map(item => ({
            Mês: item.nome,
            Receitas: item.receitas,
            Despesas: item.despesas,
            Saldo: item.saldo
        }));

        const planilha = XLSX.utils.book_new();

        const abaResumo = XLSX.utils.json_to_sheet(
            dadosResumoExcel
        );

        const abaMovimentacoes = XLSX.utils.json_to_sheet(
            dadosMovimentacoes
        );

        const abaCategorias = XLSX.utils.json_to_sheet(
            dadosCategorias
        );

        const abaMensal = XLSX.utils.json_to_sheet(meses);

        XLSX.utils.book_append_sheet(
            planilha,
            abaResumo,
            "Resumo"
        );

        XLSX.utils.book_append_sheet(
            planilha,
            abaMovimentacoes,
            "Movimentações"
        );

        XLSX.utils.book_append_sheet(
            planilha,
            abaCategorias,
            "Categorias"
        );

        XLSX.utils.book_append_sheet(
            planilha,
            abaMensal,
            "Comparativo mensal"
        );

        abaResumo["!cols"] = [
            { wch: 25 },
            { wch: 25 }
        ];

        abaMovimentacoes["!cols"] = [
            { wch: 15 },
            { wch: 35 },
            { wch: 22 },
            { wch: 15 },
            { wch: 18 },
            { wch: 20 },
            { wch: 16 }
        ];

        XLSX.writeFile(
            planilha,
            `${obterNomeArquivo()}.xlsx`
        );

        mostrarMensagem(
            "Relatório Excel gerado com sucesso."
        );
    }

    /* ========================================= */
    /* EXPORTAÇÃO PDF */
    /* ========================================= */

    function exportarPDF() {
        const bibliotecaPDF = window.jspdf;

        if (
            !bibliotecaPDF ||
            typeof bibliotecaPDF.jsPDF !== "function"
        ) {
            mostrarMensagem(
                "A biblioteca de PDF não foi carregada. Verifique sua conexão e atualize a página.",
                "erro"
            );

            return;
        }

        const documento = new bibliotecaPDF.jsPDF({
            orientation: "landscape",
            unit: "mm",
            format: "a4"
        });

        if (typeof documento.autoTable !== "function") {
            mostrarMensagem(
                "A extensão de tabelas do PDF não foi carregada.",
                "erro"
            );

            return;
        }

        documento.setFont("helvetica", "bold");
        documento.setFontSize(20);
        documento.setTextColor(11, 19, 43);

        documento.text(
            "FINORA — RELATÓRIO FINANCEIRO",
            14,
            18
        );

        documento.setFont("helvetica", "normal");
        documento.setFontSize(10);
        documento.setTextColor(100, 116, 139);

        documento.text(
            `Período: ${periodoAplicado.descricao}`,
            14,
            26
        );

        documento.text(
            `${formatarData(periodoAplicado.inicio)} até ${formatarData(periodoAplicado.fim)}`,
            14,
            32
        );

        documento.setFontSize(11);
        documento.setTextColor(15, 23, 42);

        documento.text(
            `Receitas: ${formatarMoeda(dadosResumo.receitas)}`,
            14,
            44
        );

        documento.text(
            `Despesas: ${formatarMoeda(dadosResumo.despesas)}`,
            100,
            44
        );

        documento.text(
            `Saldo: ${formatarMoeda(dadosResumo.saldo)}`,
            190,
            44
        );

        documento.text(
            `Economia: ${dadosResumo.taxaEconomia.toFixed(1)}%`,
            280,
            44
        );

        const linhas = movimentacoesFiltradas.map(item => [
            formatarData(item.data),
            item.descricao,
            item.categoria,
            item.tipo === "receita"
                ? "Receita"
                : "Despesa",
            item.forma,
            formatarMoeda(item.valor)
        ]);

        documento.autoTable({
            startY: 53,

            head: [[
                "Data",
                "Descrição",
                "Categoria",
                "Tipo",
                "Forma",
                "Valor"
            ]],

            body: linhas,

            theme: "grid",

            styles: {
                font: "helvetica",
                fontSize: 8,
                cellPadding: 3,
                textColor: [51, 65, 85]
            },

            headStyles: {
                fillColor: [11, 19, 43],
                textColor: [255, 255, 255],
                fontStyle: "bold"
            },

            alternateRowStyles: {
                fillColor: [248, 250, 252]
            },

            columnStyles: {
                0: { cellWidth: 25 },
                1: { cellWidth: 65 },
                2: { cellWidth: 38 },
                3: { cellWidth: 25 },
                4: { cellWidth: 28 },
                5: { cellWidth: 32 }
            },

            margin: {
                left: 14,
                right: 14
            }
        });

        const totalPaginas =
            documento.internal.getNumberOfPages();

        for (let pagina = 1; pagina <= totalPaginas; pagina++) {
            documento.setPage(pagina);

            documento.setFontSize(8);
            documento.setTextColor(148, 163, 184);

            documento.text(
                `Finora — Página ${pagina} de ${totalPaginas}`,
                280,
                200,
                { align: "right" }
            );
        }

        documento.save(
            `${obterNomeArquivo()}.pdf`
        );

        mostrarMensagem(
            "Relatório PDF gerado com sucesso."
        );
    }

    /* ========================================= */
    /* EVENTOS */
    /* ========================================= */

    function configurarEventos() {
        elementos.periodo.addEventListener(
            "change",
            atualizarVisibilidadeDatas
        );

        elementos.btnAplicar.addEventListener(
            "click",
            () => aplicarFiltros()
        );

        elementos.dataInicial.addEventListener(
            "change",
            () => {
                if (
                    elementos.dataFinal.value &&
                    elementos.dataInicial.value >
                    elementos.dataFinal.value
                ) {
                    elementos.dataFinal.value =
                        elementos.dataInicial.value;
                }

                elementos.dataFinal.min =
                    elementos.dataInicial.value;
            }
        );

        elementos.btnExcel.addEventListener(
            "click",
            exportarExcel
        );

        elementos.btnPDF.addEventListener(
            "click",
            exportarPDF
        );

        window.addEventListener(
            "finora:debitos-atualizados",
            () => aplicarFiltros()
        );

        window.addEventListener(
            "finora:atualizacao-financeira",
            () => aplicarFiltros()
        );
    }

    /* ========================================= */
    /* INICIALIZAÇÃO */
    /* ========================================= */

    async function iniciar() {
        elementos.dataInicial.max = dataHojeISO();
        elementos.dataFinal.max = dataHojeISO();

        configurarEventos();

        atualizarVisibilidadeDatas();

        await aplicarFiltros();
    }

    iniciar();

})();