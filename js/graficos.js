
/* ========================================= */
/* FINORA — GRÁFICOS */
/* ANÁLISE FINANCEIRA */
/* INTEGRAÇÃO COM FIRESTORE */
/* ========================================= */

import { listarRegistros } from "./finora-db.js";

/* ========================================= */
/* INICIALIZAÇÃO */
/* ========================================= */

(function () {
    "use strict";

    const seletorPeriodo = document.getElementById("periodoGraficos");

    if (!seletorPeriodo) {
        return;
    }

    const moeda = new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL"
    });

    const moedaCompacta = new Intl.NumberFormat("pt-BR", {
        notation: "compact",
        maximumFractionDigits: 1
    });

    const mesesAbreviados = [
        "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
        "Jul", "Ago", "Set", "Out", "Nov", "Dez"
    ];

    const graficosCriados = {};
    const elementoMensagem = document.getElementById("mensagemGraficos");

    let entradasFinora = [];
    let debitosFinora = [];
    let comprasCreditoFinora = [];

    let carregamentoEmAndamento = false;
    let recargaSolicitada = false;

    /* ========================================= */
    /* CORES DAS CATEGORIAS */
    /* ========================================= */

    const coresCategorias = {
        alimentacao: "#F59E0B",
        alimentação: "#F59E0B",
        mercado: "#D97706",
        supermercado: "#D97706",
        lazer: "#8B5CF6",
        transporte: "#3B82F6",
        moradia: "#10B981",
        casa: "#10B981",
        saude: "#EF4444",
        saúde: "#EF4444",
        farmacia: "#DC2626",
        farmácia: "#DC2626",
        educacao: "#6366F1",
        educação: "#6366F1",
        estudos: "#6366F1",
        compras: "#EC4899",
        vestuario: "#DB2777",
        vestuário: "#DB2777",
        contas: "#64748B",
        "contas fixas": "#64748B",
        assinatura: "#14B8A6",
        assinaturas: "#14B8A6",
        tecnologia: "#0EA5E9",
        viagem: "#F97316",
        viagens: "#F97316",
        pets: "#A855F7",
        animais: "#A855F7",
        salario: "#059669",
        salário: "#059669",
        outros: "#94A3B8",
        "sem categoria": "#94A3B8"
    };

    const paletaAlternativa = [
        "#0F766E",
        "#2563EB",
        "#D946EF",
        "#EA580C",
        "#65A30D",
        "#475569",
        "#0891B2",
        "#9333EA",
        "#CA8A04",
        "#E11D48"
    ];

    /* ========================================= */
    /* FUNÇÕES AUXILIARES */
    /* ========================================= */

    function normalizarTexto(texto) {
        return String(texto || "")
            .trim()
            .toLocaleLowerCase("pt-BR")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "");
    }

    function obterCorCategoria(categoria, indice) {
        const nome = normalizarTexto(categoria);

        if (coresCategorias[nome]) {
            return coresCategorias[nome];
        }

        if (nome.includes("aliment") || nome.includes("refeicao")) {
            return "#F59E0B";
        }

        if (nome.includes("lazer") || nome.includes("entretenimento")) {
            return "#8B5CF6";
        }

        if (nome.includes("transport") || nome.includes("combustivel")) {
            return "#3B82F6";
        }

        if (nome.includes("moradia") || nome.includes("aluguel")) {
            return "#10B981";
        }

        if (nome.includes("saude") || nome.includes("medic")) {
            return "#EF4444";
        }

        if (nome.includes("educ") || nome.includes("curso")) {
            return "#6366F1";
        }

        if (nome.includes("compra") || nome.includes("roupa")) {
            return "#EC4899";
        }

        if (nome.includes("conta") || nome.includes("internet")) {
            return "#64748B";
        }

        let hash = 0;

        for (let i = 0; i < nome.length; i++) {
            hash = ((hash << 5) - hash) + nome.charCodeAt(i);
            hash |= 0;
        }

        return paletaAlternativa[
            Math.abs(hash) % paletaAlternativa.length
        ];
    }

    function formatarMoeda(valor) {
        return moeda.format(Number(valor) || 0);
    }

    function mostrarMensagem(texto) {
        if (!elementoMensagem) {
            return;
        }

        elementoMensagem.textContent = texto;
        elementoMensagem.hidden = !texto;
    }

    function dataValida(data) {
        if (
            typeof data !== "string" ||
            !/^\d{4}-\d{2}-\d{2}$/.test(data)
        ) {
            return false;
        }

        const partes = data.split("-").map(Number);

        const dataVerificada = new Date(
            partes[0],
            partes[1] - 1,
            partes[2]
        );

        return dataVerificada.getFullYear() === partes[0] &&
            dataVerificada.getMonth() === partes[1] - 1 &&
            dataVerificada.getDate() === partes[2];
    }

    function chaveMes(data) {
        if (typeof data !== "string") {
            return "";
        }

        const correspondencia = data.match(/^(\d{4})-(\d{2})/);

        if (!correspondencia) {
            return "";
        }

        const numeroMes = Number(correspondencia[2]);

        if (numeroMes < 1 || numeroMes > 12) {
            return "";
        }

        return correspondencia[1] + "-" + correspondencia[2];
    }

    /* ========================================= */
    /* VALIDAÇÃO DOS REGISTROS */
    /* ========================================= */

    function validarDespesas(lista) {
        if (!Array.isArray(lista)) {
            return [];
        }

        return lista.filter(function (item) {
            return item &&
                dataValida(item.data) &&
                Number.isFinite(Number(item.valor)) &&
                Number(item.valor) > 0;
        });
    }

    function validarEntradas(lista) {
        if (!Array.isArray(lista)) {
            return [];
        }

        return lista.filter(function (item) {
            return item &&
                dataValida(item.data) &&
                Number.isFinite(Number(item.valor)) &&
                Number(item.valor) > 0;
        });
    }

    /* ========================================= */
    /* CARREGAMENTO DO FIRESTORE */
    /* ========================================= */

    async function carregarDadosGraficos() {
        if (carregamentoEmAndamento) {
            recargaSolicitada = true;
            return;
        }

        carregamentoEmAndamento = true;

        try {
            const resultados = await Promise.all([
                listarRegistros("entradas"),
                listarRegistros("debitos"),
                listarRegistros("compras_credito")
            ]);

            entradasFinora = validarEntradas(resultados[0]);

            debitosFinora = validarDespesas(resultados[1]);

            comprasCreditoFinora = resultados[2];

            atualizarGraficos();

        } catch (erro) {
            console.error(
                "Erro ao carregar os dados dos gráficos:",
                erro
            );

            mostrarMensagem(
                "Não foi possível carregar os dados financeiros. " +
                "Verifique sua conexão e tente novamente."
            );

        } finally {
            carregamentoEmAndamento = false;

            if (recargaSolicitada) {
                recargaSolicitada = false;
                carregarDadosGraficos();
            }
        }
    }

    /* ========================================= */
    /* LEITURA DAS COMPRAS NO CRÉDITO */
    /* ========================================= */

    function lerComprasCredito() {
        if (!Array.isArray(comprasCreditoFinora)) {
            return [];
        }

        return comprasCreditoFinora.map(function (compra) {
            if (!compra) {
                return null;
            }

            /*
             * Para compras parceladas, utiliza o valor total
             * da compra, e não apenas o valor da parcela.
             */

            const valor =
                Number(compra.totalParcelado) ||
                Number(compra.valorOriginal) ||
                Number(compra.valorParcela) ||
                0;

            return {
                id: compra.id,
                descricao: compra.descricao || "",
                data: compra.data || "",
                categoria: String(
                    compra.categoria ||
                    compra.nomeCategoria ||
                    compra.tipoCategoria ||
                    "SEM CATEGORIA"
                ).trim(),
                valor: valor,
                formaPagamento: "credito",
                origem: compra.origem || "despesas",
                tipo: "despesa"
            };

        }).filter(function (compra) {
            return compra &&
                dataValida(compra.data) &&
                Number.isFinite(compra.valor) &&
                compra.valor > 0;
        });
    }

    /* ========================================= */
    /* UNIFICAÇÃO DAS DESPESAS */
    /* ========================================= */

    function lerDespesas() {
        const debitos = debitosFinora;
        const comprasCredito = lerComprasCredito();

        return debitos.concat(comprasCredito);
    }

    /* ========================================= */
    /* PERÍODOS */
    /* ========================================= */

    function obterMeses(periodo) {
        const hoje = new Date();
        const meses = [];

        for (
            let deslocamento = periodo - 1;
            deslocamento >= 0;
            deslocamento--
        ) {
            const data = new Date(
                hoje.getFullYear(),
                hoje.getMonth() - deslocamento,
                1
            );

            const ano = data.getFullYear();
            const mes = String(data.getMonth() + 1).padStart(2, "0");

            meses.push({
                chave: ano + "-" + mes,
                rotulo:
                    mesesAbreviados[data.getMonth()] +
                    "/" +
                    String(ano).slice(-2)
            });
        }

        return meses;
    }

    function obterDespesasDoMes(despesas, chave) {
        return despesas.reduce(function (total, item) {
            return chaveMes(item.data) === chave
                ? total + Number(item.valor)
                : total;
        }, 0);
    }

    function obterEntradasDoMes(entradas, chave) {
        return entradas.reduce(function (total, item) {
            return chaveMes(item.data) === chave
                ? total + Number(item.valor)
                : total;
        }, 0);
    }

    function obterRegistrosNoPeriodo(registros, meses) {
        const chaves = new Set(
            meses.map(function (mes) {
                return mes.chave;
            })
        );

        return registros.filter(function (item) {
            return dataValida(item.data) &&
                chaves.has(chaveMes(item.data));
        });
    }

    /* ========================================= */
    /* DADOS MENSAIS REAIS */
    /* ========================================= */

    function montarDadosMensais(meses, entradas, despesas) {
        return meses.map(function (mes) {
            const receitas = obterEntradasDoMes(
                entradas,
                mes.chave
            );

            const totalDespesas = obterDespesasDoMes(
                despesas,
                mes.chave
            );

            const possuiMovimentacao =
                receitas > 0 || totalDespesas > 0;

            if (!possuiMovimentacao) {
                return {
                    chave: mes.chave,
                    rotulo: mes.rotulo,
                    receitas: null,
                    despesas: null,
                    saldo: null,
                    taxaEconomia: null
                };
            }

            const saldo = receitas - totalDespesas;

            return {
                chave: mes.chave,
                rotulo: mes.rotulo,
                receitas: receitas,
                despesas: totalDespesas,
                saldo: saldo,
                taxaEconomia: receitas > 0
                    ? (saldo / receitas) * 100
                    : null
            };
        });
    }

    /* ========================================= */
    /* CATEGORIAS */
    /* ========================================= */

    function obterCategoria(item) {
        if (!item) {
            return "";
        }

        return String(
            item.categoria ||
            item.nomeCategoria ||
            item.tipoCategoria ||
            "SEM CATEGORIA"
        ).trim();
    }

    function agruparPorCategoria(registros) {
        const agrupamento = {};

        registros.forEach(function (item) {
            const categoria = obterCategoria(item);

            if (!categoria) {
                return;
            }

            agrupamento[categoria] =
                (agrupamento[categoria] || 0) +
                Number(item.valor);
        });

        return agrupamento;
    }

    function ordenarCategorias(agrupamento) {
        return Object.entries(agrupamento)
            .sort(function (a, b) {
                return b[1] - a[1];
            });
    }

    /* ========================================= */
    /* GERENCIAMENTO DOS GRÁFICOS */
    /* ========================================= */

    function destruirGrafico(id) {
        if (graficosCriados[id]) {
            graficosCriados[id].destroy();
            delete graficosCriados[id];
        }
    }

    function obterContexto(id) {
        const canvas = document.getElementById(id);

        if (!canvas || typeof Chart === "undefined") {
            return null;
        }

        return canvas.getContext("2d");
    }

    function criarGrafico(id, configuracao) {
        const contexto = obterContexto(id);

        if (!contexto) {
            return false;
        }

        destruirGrafico(id);

        graficosCriados[id] = new Chart(
            contexto,
            configuracao
        );

        return true;
    }

    function mostrarEstadoVazio(canvasId, mensagemId, mostrar) {
        const canvas = document.getElementById(canvasId);
        const mensagem = document.getElementById(mensagemId);

        if (canvas) {
            canvas.hidden = mostrar;
        }

        if (mensagem) {
            mensagem.hidden = !mostrar;
        }

        if (mostrar) {
            destruirGrafico(canvasId);
        }
    }

    /* ========================================= */
    /* OPÇÕES VISUAIS */
    /* ========================================= */

    function opcoesEixos(valorEmMoeda) {
        return {
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
                        color: "#4B5563",
                        usePointStyle: true,
                        pointStyle: "circle",
                        boxWidth: 8,
                        boxHeight: 8,
                        padding: 16,

                        font: {
                            family: "Arial",
                            size: 11
                        }
                    }
                },

                tooltip: {
                    backgroundColor: "#111827",
                    titleColor: "#FFFFFF",
                    bodyColor: "#F9FAFB",
                    padding: 11,
                    cornerRadius: 5,
                    displayColors: true,

                    callbacks: {
                        label: function (contexto) {
                            const valor = contexto.parsed.y;

                            if (
                                valor === null ||
                                valor === undefined
                            ) {
                                return contexto.dataset.label + ": sem dados";
                            }

                            if (valorEmMoeda) {
                                return contexto.dataset.label +
                                    ": " +
                                    formatarMoeda(valor);
                            }

                            return contexto.dataset.label +
                                ": " +
                                Number(valor).toLocaleString("pt-BR", {
                                    maximumFractionDigits: 1
                                }) +
                                "%";
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
                        color: "#6B7280",

                        font: {
                            family: "Arial",
                            size: 10
                        }
                    },

                    border: {
                        color: "#E5E7EB"
                    }
                },

                y: {
                    beginAtZero: true,

                    grid: {
                        color: "#F3F4F6"
                    },

                    ticks: {
                        color: "#6B7280",

                        font: {
                            family: "Arial",
                            size: 10
                        },

                        callback: function (valor) {
                            if (!valorEmMoeda) {
                                return valor + "%";
                            }

                            return moedaCompacta.format(valor);
                        }
                    },

                    border: {
                        display: false
                    }
                }
            }
        };
    }

    /* ========================================= */
    /* GRÁFICO 1 — RECEITAS X DESPESAS */
    /* ========================================= */

    function renderizarReceitasDespesas(dadosMensais) {
        const temDados = dadosMensais.some(function (mes) {
            return mes.receitas !== null ||
                mes.despesas !== null;
        });

        mostrarEstadoVazio(
            "graficoReceitasDespesas",
            "estadoVazioReceitasDespesas",
            !temDados
        );

        if (!temDados) {
            return;
        }

        criarGrafico("graficoReceitasDespesas", {
            type: "bar",

            data: {
                labels: dadosMensais.map(function (mes) {
                    return mes.rotulo;
                }),

                datasets: [
                    {
                        label: "Receitas",

                        data: dadosMensais.map(function (mes) {
                            return mes.receitas;
                        }),

                        backgroundColor: "#0F766E",
                        borderRadius: 3,
                        borderSkipped: false,
                        maxBarThickness: 30
                    },

                    {
                        label: "Despesas",

                        data: dadosMensais.map(function (mes) {
                            return mes.despesas;
                        }),

                        backgroundColor: "#F59E0B",
                        borderRadius: 3,
                        borderSkipped: false,
                        maxBarThickness: 30
                    }
                ]
            },

            options: Object.assign(
                {},
                opcoesEixos(true),

                {
                    datasets: {
                        bar: {
                            categoryPercentage: 0.72,
                            barPercentage: 0.82
                        }
                    }
                }
            )
        });
    }

    /* ========================================= */
    /* GRÁFICO 2 — RESULTADO MENSAL */
    /* ========================================= */

    function renderizarSaldo(dadosMensais) {
        const temDados = dadosMensais.some(function (mes) {
            return mes.saldo !== null;
        });

        mostrarEstadoVazio(
            "graficoEvolucaoSaldo",
            "estadoVazioSaldo",
            !temDados
        );

        if (!temDados) {
            return;
        }

        criarGrafico("graficoEvolucaoSaldo", {
            type: "line",

            data: {
                labels: dadosMensais.map(function (mes) {
                    return mes.rotulo;
                }),

                datasets: [{
                    label: "Saldo mensal",

                    data: dadosMensais.map(function (mes) {
                        return mes.saldo;
                    }),

                    borderColor: "#0F766E",
                    backgroundColor: "rgba(15, 118, 110, 0.08)",
                    fill: true,
                    tension: 0.2,
                    spanGaps: false,
                    borderWidth: 2,
                    pointRadius: 3,
                    pointHoverRadius: 5,
                    pointBackgroundColor: "#0F766E",
                    pointBorderColor: "#FFFFFF",
                    pointBorderWidth: 1
                }]
            },

            options: opcoesEixos(true)
        });
    }

    /* ========================================= */
    /* GRÁFICO 3 — TAXA DE ECONOMIA */
    /* ========================================= */

    function renderizarTaxaEconomia(dadosMensais) {
        const temDados = dadosMensais.some(function (mes) {
            return mes.taxaEconomia !== null;
        });

        mostrarEstadoVazio(
            "graficoTaxaEconomia",
            "estadoVazioTaxa",
            !temDados
        );

        if (!temDados) {
            return;
        }

        criarGrafico("graficoTaxaEconomia", {
            type: "line",

            data: {
                labels: dadosMensais.map(function (mes) {
                    return mes.rotulo;
                }),

                datasets: [{
                    label: "Taxa de economia",

                    data: dadosMensais.map(function (mes) {
                        return mes.taxaEconomia;
                    }),

                    borderColor: "#6366F1",
                    backgroundColor: "rgba(99, 102, 241, 0.08)",
                    fill: true,
                    tension: 0.2,
                    spanGaps: false,
                    borderWidth: 2,
                    pointRadius: 3,
                    pointHoverRadius: 5,
                    pointBackgroundColor: "#6366F1",
                    pointBorderColor: "#FFFFFF",
                    pointBorderWidth: 1
                }]
            },

            options: opcoesEixos(false)
        });
    }

    /* ========================================= */
    /* GRÁFICO 4 — DESPESAS POR CATEGORIA */
    /* ========================================= */

    const pluginCentroRosca = {
        id: "finoraCentroRosca",

        afterDraw: function (grafico) {
            if (grafico.config.type !== "doughnut") {
                return;
            }

            const dataset = grafico.data.datasets[0];

            if (!dataset || !dataset.data.length) {
                return;
            }

            const total = dataset.data.reduce(function (soma, valor) {
                return soma + (Number(valor) || 0);
            }, 0);

            const area = grafico.chartArea;

            if (!area) {
                return;
            }

            const ctx = grafico.ctx;
            const centroX = (area.left + area.right) / 2;
            const centroY = (area.top + area.bottom) / 2;

            ctx.save();

            ctx.textAlign = "center";
            ctx.textBaseline = "middle";

            ctx.fillStyle = "#6B7280";
            ctx.font = "12px Arial";

            ctx.fillText(
                "Total de gastos",
                centroX,
                centroY - 10
            );

            ctx.fillStyle = "#111827";
            ctx.font = "bold 15px Arial";

            ctx.fillText(
                moedaCompacta.format(total),
                centroX,
                centroY + 11
            );

            ctx.restore();
        }
    };

    function renderizarCategorias(registros) {
        const categorias = ordenarCategorias(
            agruparPorCategoria(registros)
        );

        const temDados = categorias.length > 0;

        mostrarEstadoVazio(
            "graficoDespesasCategoria",
            "estadoVazioCategoria",
            !temDados
        );

        if (!temDados) {
            return;
        }

        const total = categorias.reduce(function (soma, item) {
            return soma + item[1];
        }, 0);

        criarGrafico("graficoDespesasCategoria", {
            type: "doughnut",

            data: {
                labels: categorias.map(function (item) {
                    return item[0];
                }),

                datasets: [{
                    data: categorias.map(function (item) {
                        return item[1];
                    }),

                    backgroundColor: categorias.map(function (item, indice) {
                        return obterCorCategoria(item[0], indice);
                    }),

                    borderColor: "#FFFFFF",
                    borderWidth: 3,
                    hoverOffset: 5,
                    spacing: 1
                }]
            },

            plugins: [pluginCentroRosca],

            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: "67%",

                layout: {
                    padding: 8
                },

                plugins: {
                    legend: {
                        position: "bottom",

                        labels: {
                            color: "#4B5563",
                            usePointStyle: true,
                            pointStyle: "circle",
                            boxWidth: 8,
                            boxHeight: 8,
                            padding: 13,

                            font: {
                                family: "Arial",
                                size: 11
                            }
                        }
                    },

                    tooltip: {
                        backgroundColor: "#111827",
                        titleColor: "#FFFFFF",
                        bodyColor: "#F9FAFB",
                        padding: 11,
                        cornerRadius: 5,

                        callbacks: {
                            label: function (contexto) {
                                const valor = Number(contexto.parsed) || 0;

                                const percentual = total > 0
                                    ? (valor / total) * 100
                                    : 0;

                                return contexto.label +
                                    ": " +
                                    formatarMoeda(valor) +
                                    " (" +
                                    percentual.toLocaleString("pt-BR", {
                                        maximumFractionDigits: 1
                                    }) +
                                    "%)";
                            }
                        }
                    }
                }
            }
        });
    }

    /* ========================================= */
    /* GRÁFICO 5 — EVOLUÇÃO POR CATEGORIA */
    /* ========================================= */

    function renderizarEvolucaoCategorias(registros, meses) {
        const agrupamentoPorMes = {};
        const totaisPorCategoria = {};

        registros.forEach(function (item) {
            const categoria = obterCategoria(item);
            const mes = chaveMes(item.data);

            if (!categoria || !mes) {
                return;
            }

            if (!agrupamentoPorMes[mes]) {
                agrupamentoPorMes[mes] = {};
            }

            agrupamentoPorMes[mes][categoria] =
                (agrupamentoPorMes[mes][categoria] || 0) +
                Number(item.valor);

            totaisPorCategoria[categoria] =
                (totaisPorCategoria[categoria] || 0) +
                Number(item.valor);
        });

        const categoriasOrdenadas = Object.keys(totaisPorCategoria)
            .sort(function (a, b) {
                return totaisPorCategoria[b] - totaisPorCategoria[a];
            })
            .slice(0, 6);

        const mesesComDados = meses.filter(function (mes) {
            return categoriasOrdenadas.some(function (categoria) {
                return agrupamentoPorMes[mes.chave] &&
                    agrupamentoPorMes[mes.chave][categoria] > 0;
            });
        });

        const temDados =
            categoriasOrdenadas.length > 0 &&
            mesesComDados.length > 1;

        mostrarEstadoVazio(
            "graficoEvolucaoCategorias",
            "estadoVazioEvolucaoCategorias",
            !temDados
        );

        if (!temDados) {
            return;
        }

        criarGrafico("graficoEvolucaoCategorias", {
            type: "line",

            data: {
                labels: meses.map(function (mes) {
                    return mes.rotulo;
                }),

                datasets: categoriasOrdenadas.map(function (categoria, indice) {
                    return {
                        label: categoria,

                        data: meses.map(function (mes) {
                            const valores = agrupamentoPorMes[mes.chave];

                            return valores && valores[categoria] !== undefined
                                ? valores[categoria]
                                : 0;
                        }),

                        borderColor: obterCorCategoria(categoria, indice),
                        backgroundColor: obterCorCategoria(categoria, indice),
                        tension: 0.2,
                        borderWidth: 2,
                        pointRadius: 2,
                        pointHoverRadius: 4,
                        pointBorderWidth: 1,
                        pointBorderColor: "#FFFFFF",
                        spanGaps: false
                    };
                })
            },

            options: opcoesEixos(true)
        });
    }

    /* ========================================= */
    /* GRÁFICO 6 — DESPESAS POR DIA */
    /* ========================================= */

    function renderizarDespesasDia(registros) {
        const totaisPorDia = {};

        registros.forEach(function (item) {
            if (
                !dataValida(item.data) ||
                !Number.isFinite(Number(item.valor))
            ) {
                return;
            }

            totaisPorDia[item.data] =
                (totaisPorDia[item.data] || 0) +
                Number(item.valor);
        });

        const dias = Object.keys(totaisPorDia).sort();

        mostrarEstadoVazio(
            "graficoDespesasDia",
            "estadoVazioDia",
            dias.length === 0
        );

        if (dias.length === 0) {
            return;
        }

        const rotulos = dias.map(function (data) {
            const partes = data.split("-");

            return partes.length === 3
                ? partes[2] + "/" + partes[1]
                : data;
        });

        criarGrafico("graficoDespesasDia", {
            type: "bar",

            data: {
                labels: rotulos,

                datasets: [{
                    label: "Despesas registradas",

                    data: dias.map(function (dia) {
                        return totaisPorDia[dia];
                    }),

                    backgroundColor: "#0F766E",
                    borderRadius: 3,
                    borderSkipped: false,
                    maxBarThickness: 22
                }]
            },

            options: opcoesEixos(true)
        });
    }

    /* ========================================= */
    /* ATUALIZAÇÃO GERAL */
    /* ========================================= */

    function atualizarGraficos() {
        if (typeof Chart === "undefined") {
            mostrarMensagem(
                "Não foi possível carregar os gráficos. " +
                "Verifique sua conexão com a internet e atualize a página."
            );

            return;
        }

        mostrarMensagem("");

        const periodo = [3, 6, 12].includes(Number(seletorPeriodo.value))
            ? Number(seletorPeriodo.value)
            : 3;

        const meses = obterMeses(periodo);

        const despesas = lerDespesas();

        const dadosMensais = montarDadosMensais(
            meses,
            entradasFinora,
            despesas
        );

        const registrosPeriodo = obterRegistrosNoPeriodo(
            despesas,
            meses
        );

        const entradasPeriodo = obterRegistrosNoPeriodo(
            entradasFinora,
            meses
        );

        const temMovimentacao =
            entradasPeriodo.length > 0 ||
            registrosPeriodo.length > 0;

        if (!temMovimentacao) {
            mostrarMensagem(
                "Ainda não há dados financeiros disponíveis para o período. " +
                "Os gráficos serão preenchidos conforme seus lançamentos."
            );
        }

        renderizarReceitasDespesas(dadosMensais);
        renderizarSaldo(dadosMensais);
        renderizarTaxaEconomia(dadosMensais);
        renderizarCategorias(registrosPeriodo);
        renderizarEvolucaoCategorias(registrosPeriodo, meses);
        renderizarDespesasDia(registrosPeriodo);
    }

    /* ========================================= */
    /* EVENTOS */
    /* ========================================= */

    seletorPeriodo.addEventListener(
        "change",
        atualizarGraficos
    );

    window.addEventListener(
        "finora:debitos-atualizados",
        carregarDadosGraficos
    );

    window.addEventListener(
        "finora:atualizacao-financeira",
        carregarDadosGraficos
    );

    window.addEventListener(
        "pageshow",
        carregarDadosGraficos
    );

    /* ========================================= */
    /* INICIALIZAÇÃO */
    /* ========================================= */

    carregarDadosGraficos();

})();