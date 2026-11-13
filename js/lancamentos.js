
/* ========================================= */
/* FINORA — LANÇAMENTOS */
/* HISTÓRICO E CONTROLE DE MOVIMENTAÇÕES */
/* INTEGRAÇÃO COM FIRESTORE */
/* PIX, DÉBITO, CRÉDITO, ENTRADAS E INVESTIMENTOS */
/* EXPORTAÇÃO PDF E EXCEL */
/* ========================================= */

import { listarRegistros } from "./finora-db.js";

(function () {
    "use strict";

    /* ========================================= */
    /* CONFIGURAÇÕES */
    /* ========================================= */

    const COLECOES = {
        debitos: "debitos",
        credito: "compras_credito",
        investimentos: "investimentos",
        entradas: "entradas"
    };

    const LOGO_FINORA =
        "https://i.ibb.co/PG1HH81v/9777b8a0a5e87-42d6-9e72-ed4aed67afef-1.png";

    const moeda = new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL"
    });

    let lancamentos = [];

    let dadosFinanceiros = {
        debitos: [],
        compras: [],
        investimentos: [],
        entradas: []
    };

    let carregandoDados = false;
    let atualizacaoPendente = false;

    /* ========================================= */
    /* ELEMENTOS */
    /* ========================================= */

    const elementos = {
        receitas: document.getElementById("totalReceitas"),
        despesas: document.getElementById("totalDespesas"),
        saldo: document.getElementById("saldoLancamentos"),

        dataAtual: document.getElementById("dataAtualLancamentos"),

        busca: document.getElementById("buscaLancamentos"),
        periodo: document.getElementById("filtroPeriodoLancamento"),
        tipo: document.getElementById("filtroTipoLancamento"),
        categoria: document.getElementById("filtroCategoriaLancamento"),

        dataInicio: document.getElementById("dataInicioLancamento"),
        dataFim: document.getElementById("dataFimLancamento"),
        periodoPersonalizado: document.getElementById("periodoPersonalizado"),
        aplicarPeriodo: document.getElementById("aplicarFiltroLancamento"),

        tabela: document.getElementById("listaLancamentos"),
        quantidade: document.getElementById("quantidadeLancamentos"),
        estadoVazio: document.getElementById("estadoVazioLancamentos")
    };

    /* ========================================= */
    /* UTILITÁRIOS */
    /* ========================================= */

    function formatarMoeda(valor) {
        return moeda.format(Number(valor) || 0);
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

    function formatarData(data) {
        if (!data || typeof data !== "string") {
            return "-";
        }

        const partes = data.substring(0, 10).split("-");

        if (partes.length !== 3) {
            return "-";
        }

        return `${partes[2]}/${partes[1]}/${partes[0]}`;
    }

    function obterDataLocal() {
        const hoje = new Date();

        return [
            hoje.getFullYear(),
            String(hoje.getMonth() + 1).padStart(2, "0"),
            String(hoje.getDate()).padStart(2, "0")
        ].join("-");
    }

    /* ========================================= */
    /* DATA ATUAL NO CABEÇALHO */
    /* ========================================= */

    function atualizarDataAtual() {
        if (!elementos.dataAtual) return;

        const hoje = new Date();

        elementos.dataAtual.textContent =
            new Intl.DateTimeFormat("pt-BR", {
                weekday: "long",
                day: "2-digit",
                month: "long",
                year: "numeric"
            }).format(hoje);
    }

    /* ========================================= */
    /* VALIDAÇÃO DOS DADOS */
    /* ========================================= */

    function validarDebito(item) {
        return (
            item &&
            typeof item.data === "string" &&
            Number.isFinite(Number(item.valor)) &&
            Number(item.valor) > 0
        );
    }

    function validarCompraCredito(item) {
        return (
            item &&
            typeof item.id === "string" &&
            typeof item.cartaoId === "string" &&
            Number.isFinite(Number(item.valorOriginal ?? item.valorParcela)) &&
            Number(item.valorOriginal ?? item.valorParcela) > 0
        );
    }

    function validarInvestimento(item) {
        return (
            item &&
            typeof item.data === "string" &&
            Number.isFinite(Number(item.valor)) &&
            Number(item.valor) > 0
        );
    }

    function validarEntrada(item) {
        return (
            item &&
            typeof item.id === "string" &&
            typeof item.descricao === "string" &&
            typeof item.data === "string" &&
            Number.isFinite(Number(item.valor)) &&
            Number(item.valor) > 0
        );
    }

    /* ========================================= */
    /* LEITURA DOS DADOS DO FIRESTORE */
    /* ========================================= */

    async function carregarDadosFinanceiros() {
        const [
            debitos,
            compras,
            investimentos,
            entradas
        ] = await Promise.all([
            listarRegistros(COLECOES.debitos),
            listarRegistros(COLECOES.credito),
            listarRegistros(COLECOES.investimentos),
            listarRegistros(COLECOES.entradas)
        ]);

        dadosFinanceiros = {
            debitos: debitos.filter(validarDebito),
            compras: compras.filter(validarCompraCredito),
            investimentos: investimentos.filter(validarInvestimento),
            entradas: entradas.filter(validarEntrada)
        };
    }

    function obterDebitos() {
        return dadosFinanceiros.debitos;
    }

    function obterComprasCredito() {
        return dadosFinanceiros.compras;
    }

    function obterInvestimentos() {
        return dadosFinanceiros.investimentos;
    }

    function obterEntradas() {
        return dadosFinanceiros.entradas;
    }

    /* ========================================= */
    /* CONVERSÃO PARA HISTÓRICO */
    /* ========================================= */

    function converterDebito(debito) {
        const origemConta =
            debito.origem === "conta_pagar" ||
            Boolean(debito.contaId);

        const formaPagamento =
            String(debito.formaPagamento || "debito").toLowerCase();

        let forma = "Débito";
        let origem = "debito";
        let origemTexto = "Despesa";

        if (formaPagamento === "pix") {
            forma = "PIX";
            origem = "pix";
            origemTexto = "Pagamento via PIX";
        }

        if (origemConta) {
            forma = "Débito";
            origem = "conta_pagar";
            origemTexto = "Conta a pagar";
        }

        return {
            id: debito.id,
            descricao: debito.descricao || "Despesa",
            categoria: debito.categoria || "Não categorizada",
            data: debito.data,
            valor: Number(debito.valor),
            tipo: "despesa",
            forma,
            origem,
            origemTexto,
            protegido: origemConta
        };
    }

    function converterCompraCredito(compra) {
        const nomeCartao =
            compra.cartao ||
            compra.nomeCartao ||
            "Cartão não identificado";

        return {
            id: compra.id,
            descricao: compra.descricao || "Compra no cartão",
            categoria: compra.categoria || "Cartão de crédito",
            data: compra.data || "",
            valor: Number(
                compra.valorOriginal ??
                compra.valorParcela ??
                0
            ),
            tipo: "despesa",
            forma: `Crédito — ${nomeCartao}`,
            origem: "credito",
            origemTexto: "Cartão de crédito",
            cartaoId: compra.cartaoId,
            cartao: nomeCartao,
            protegido: false
        };
    }

    function converterInvestimento(investimento) {
        return {
            id: investimento.id,
            descricao: investimento.descricao || "Investimento",
            categoria: investimento.categoria || "Investimentos",
            data: investimento.data,
            valor: Number(investimento.valor),
            tipo: "investimento",
            forma: "Investimento",
            origem: "investimento",
            origemTexto: "Aplicação financeira",
            protegido: false
        };
    }

    /* ========================================= */
    /* CONVERSÃO DAS ENTRADAS PARA RECEITAS */
    /* ========================================= */

    function converterEntrada(entrada) {
        return {
            id: entrada.id,
            descricao: entrada.descricao || "Recebimento",
            categoria: entrada.categoria || "Receitas",
            data: entrada.data,
            valor: Number(entrada.valor),
            tipo: "receita",
            forma: entrada.forma || "Recebimento",
            origem: "entrada",
            origemTexto: "Entrada registrada",
            protegido: false
        };
    }

    /* ========================================= */
    /* MONTAGEM DO HISTÓRICO */
    /* ========================================= */

    function obterLancamentos() {
        const debitos = obterDebitos().map(converterDebito);
        const compras = obterComprasCredito().map(converterCompraCredito);
        const investimentos = obterInvestimentos().map(converterInvestimento);
        const entradas = obterEntradas().map(converterEntrada);

        const todos = [
            ...entradas,
            ...debitos,
            ...compras,
            ...investimentos
        ];

        return todos
            .filter(item => item.data)
            .sort((a, b) => b.data.localeCompare(a.data));
    }

    /* ========================================= */
    /* INDICADORES FINANCEIROS */
    /* ========================================= */

    function atualizarIndicadores(registros) {
        const receitas = registros
            .filter(item => item.tipo === "receita")
            .reduce((total, item) => total + item.valor, 0);

        const despesas = registros
            .filter(item => item.tipo === "despesa")
            .reduce((total, item) => total + item.valor, 0);

        const saldo = receitas - despesas;

        if (elementos.receitas) {
            elementos.receitas.textContent = formatarMoeda(receitas);
        }

        if (elementos.despesas) {
            elementos.despesas.textContent = formatarMoeda(despesas);
        }

        if (elementos.saldo) {
            elementos.saldo.textContent = formatarMoeda(saldo);

            elementos.saldo.classList.toggle(
                "saldo-negativo",
                saldo < 0
            );

            elementos.saldo.classList.toggle(
                "saldo-positivo",
                saldo >= 0
            );
        }
    }

    /* ========================================= */
    /* FILTROS */
    /* ========================================= */

    function obterRegistrosFiltrados() {
        const busca = elementos.busca?.value
            .trim()
            .toLocaleLowerCase("pt-BR") || "";

        const tipo = elementos.tipo?.value || "todos";
        const categoria = elementos.categoria?.value || "todas";
        const periodo = elementos.periodo?.value || "todos";

        let inicio = "";
        let fim = "";

        const hoje = obterDataLocal();

        if (periodo === "mes") {
            inicio = hoje.substring(0, 7);
        }

        if (periodo === "mes-anterior") {
            const anterior = new Date();
            anterior.setDate(1);
            anterior.setMonth(anterior.getMonth() - 1);

            inicio = [
                anterior.getFullYear(),
                String(anterior.getMonth() + 1).padStart(2, "0")
            ].join("-");
        }

        if (periodo === "personalizado") {
            inicio = elementos.dataInicio?.value || "";
            fim = elementos.dataFim?.value || "";
        }

        return lancamentos.filter(item => {
            const texto = [
                item.descricao,
                item.categoria,
                item.forma,
                item.origemTexto,
                item.cartao || ""
            ].join(" ").toLocaleLowerCase("pt-BR");

            const correspondeBusca = texto.includes(busca);

            const correspondeTipo =
                tipo === "todos" || item.tipo === tipo;

            const correspondeCategoria =
                categoria === "todas" ||
                item.categoria === categoria;

            let correspondePeriodo = true;

            if (
                periodo === "mes" ||
                periodo === "mes-anterior"
            ) {
                correspondePeriodo =
                    item.data.substring(0, 7) === inicio;
            }

            if (periodo === "personalizado") {
                correspondePeriodo =
                    (!inicio || item.data >= inicio) &&
                    (!fim || item.data <= fim);
            }

            return (
                correspondeBusca &&
                correspondeTipo &&
                correspondeCategoria &&
                correspondePeriodo
            );
        });
    }

    /* ========================================= */
    /* CATEGORIAS DINÂMICAS */
    /* ========================================= */

    function atualizarCategorias() {
        if (!elementos.categoria) return;

        const selecionada = elementos.categoria.value;

        const categorias = [
            ...new Set(
                lancamentos
                    .map(item => item.categoria)
                    .filter(Boolean)
            )
        ].sort((a, b) => a.localeCompare(b, "pt-BR"));

        elementos.categoria.innerHTML =
            '<option value="todas">Todas as categorias</option>';

        categorias.forEach(categoria => {
            const opcao = document.createElement("option");

            opcao.value = categoria;
            opcao.textContent = categoria;

            elementos.categoria.appendChild(opcao);
        });

        if (categorias.includes(selecionada)) {
            elementos.categoria.value = selecionada;
        }
    }

    /* ========================================= */
    /* RENDERIZAÇÃO DA TABELA */
    /* ========================================= */

    function renderizarTabela(registros) {
        if (!elementos.tabela) return;

        elementos.tabela.innerHTML = "";

        if (elementos.quantidade) {
            elementos.quantidade.textContent =
                `${registros.length} ${
                    registros.length === 1
                        ? "lançamento"
                        : "lançamentos"
                }`;
        }

        if (elementos.estadoVazio) {
            elementos.estadoVazio.hidden = registros.length > 0;
        }

        if (registros.length === 0) {
            return;
        }

        elementos.tabela.innerHTML = registros.map(item => {
            const classeTipo =
                item.tipo === "receita"
                    ? "receita"
                    : item.tipo === "investimento"
                        ? "investimento"
                        : "despesa";

            const sinal = item.tipo === "receita" ? "+" : "-";

            const tipoTexto =
                item.tipo === "receita"
                    ? "Receita"
                    : item.tipo === "investimento"
                        ? "Investimento"
                        : "Despesa";

            const acao = item.protegido
                ? `
                    <span class="origem-protegida"
                        title="Gerencie esta movimentação em Contas a Pagar">
                        <i class="fa-solid fa-lock"></i>
                        Gerenciar em Contas a Pagar
                    </span>
                `
                : `
                    <span class="origem-lancamento">
                        ${escaparTexto(item.origemTexto)}
                    </span>
                `;

            return `
                <tr>
                    <td>${formatarData(item.data)}</td>

                    <td>
                        <strong>
                            ${escaparTexto(item.descricao)}
                        </strong>
                    </td>

                    <td>
                        ${escaparTexto(item.categoria)}
                    </td>

                    <td>
                        <span class="tipo-lancamento ${classeTipo}">
                            ${tipoTexto}
                        </span>
                    </td>

                    <td>${escaparTexto(item.forma)}</td>

                    <td class="valor-lancamento ${classeTipo}">
                        ${sinal} ${formatarMoeda(item.valor)}
                    </td>

                    <td>${acao}</td>
                </tr>
            `;
        }).join("");
    }

    /* ========================================= */
    /* EXPORTAÇÃO — DADOS E TOTAIS */
    /* ========================================= */

    function calcularTotaisExportacao(registros) {
        return registros.reduce((totais, item) => {
            if (item.tipo === "receita") {
                totais.receitas += item.valor;
            }

            if (item.tipo === "despesa") {
                totais.despesas += item.valor;
            }

            if (item.tipo === "investimento") {
                totais.investimentos += item.valor;
            }

            return totais;
        }, {
            receitas: 0,
            despesas: 0,
            investimentos: 0
        });
    }

    function obterNomeTipo(item) {
        if (item.tipo === "receita") return "Receita";
        if (item.tipo === "investimento") return "Investimento";

        return "Despesa";
    }

    /* ========================================= */
    /* EXPORTAÇÃO — EXCELJS */
    /* ========================================= */

    const CORES_EXCEL = {
        verde: "FF0F766E",
        verdeEscuro: "FF115E59",
        verdeClaro: "FFE8F5F2",
        texto: "FF243447",
        textoSecundario: "FF64748B",
        borda: "FFE2E8F0",
        fundo: "FFF8FAFC",
        branco: "FFFFFFFF",
        receita: "FF16865B",
        receitaFundo: "FFE8F5EE",
        despesa: "FFDC5252",
        despesaFundo: "FFFDECEC",
        investimento: "FF6475C7",
        investimentoFundo: "FFEEF0FF"
    };

    /* ========================================= */
    /* CARREGAR EXCELJS */
    /* ========================================= */

    function carregarBibliotecaExcelJS() {
        return new Promise((resolve, reject) => {
            if (window.ExcelJS) {
                resolve();
                return;
            }

            let script = document.querySelector(
                'script[data-finora-exceljs="true"]'
            );

            if (script) {
                script.addEventListener("load", () => {
                    window.ExcelJS
                        ? resolve()
                        : reject(new Error("ExcelJS não foi carregado."));
                }, { once: true });

                script.addEventListener("error", () => {
                    reject(new Error("Falha ao carregar ExcelJS."));
                }, { once: true });

                return;
            }

            script = document.createElement("script");

            script.src =
                "https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js";

            script.dataset.finoraExceljs = "true";

            script.onload = () => {
                if (window.ExcelJS) {
                    resolve();
                } else {
                    reject(new Error("ExcelJS não foi disponibilizado."));
                }
            };

            script.onerror = () => {
                reject(new Error("Não foi possível carregar ExcelJS."));
            };

            document.head.appendChild(script);
        });
    }

    /* ========================================= */
    /* CARREGAR LOGO PARA O EXCEL */
    /* ========================================= */

    async function carregarLogoExcel(workbook) {
        try {
            const resposta = await fetch(LOGO_FINORA, {
                mode: "cors",
                cache: "no-cache"
            });

            if (!resposta.ok) {
                throw new Error("Não foi possível acessar a logo.");
            }

            const blob = await resposta.blob();

            const imagemBase64 = await new Promise((resolve, reject) => {
                const leitor = new FileReader();

                leitor.onload = () => resolve(leitor.result);
                leitor.onerror = reject;

                leitor.readAsDataURL(blob);
            });

            const tipo = blob.type || "image/png";

            const extensao = tipo.includes("jpeg")
                ? "jpeg"
                : "png";

            return workbook.addImage({
                base64: imagemBase64,
                extension: extensao
            });

        } catch (erro) {
            console.warn(
                "A logo não pôde ser incorporada ao Excel:",
                erro
            );

            return null;
        }
    }

    /* ========================================= */
    /* UTILITÁRIOS EXCEL */
    /* ========================================= */

    function converterDataExcel(data) {
        if (!data || typeof data !== "string") {
            return null;
        }

        const partes = data.substring(0, 10).split("-");

        if (partes.length !== 3) {
            return null;
        }

        const ano = Number(partes[0]);
        const mes = Number(partes[1]);
        const dia = Number(partes[2]);

        if (!ano || !mes || !dia) {
            return null;
        }

        return new Date(ano, mes - 1, dia);
    }

    function estilizarCabecalhoExcel(row) {
        row.height = 28;

        row.eachCell({ includeEmpty: true }, cell => {
            cell.font = {
                name: "Aptos",
                size: 10,
                bold: true,
                color: { argb: CORES_EXCEL.branco }
            };

            cell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: CORES_EXCEL.verde }
            };

            cell.alignment = {
                vertical: "middle",
                horizontal: "left"
            };

            cell.border = {
                bottom: {
                    style: "medium",
                    color: { argb: CORES_EXCEL.verdeEscuro }
                }
            };
        });
    }

    function criarTituloSecaoExcel(
        worksheet,
        linha,
        ultimaColuna,
        texto
    ) {
        worksheet.mergeCells(
            linha,
            1,
            linha,
            ultimaColuna
        );

        const celula = worksheet.getCell(linha, 1);

        celula.value = texto;

        celula.font = {
            name: "Aptos",
            size: 12,
            bold: true,
            color: { argb: CORES_EXCEL.texto }
        };

        celula.alignment = {
            vertical: "middle"
        };

        celula.border = {
            bottom: {
                style: "medium",
                color: { argb: CORES_EXCEL.verde }
            }
        };

        worksheet.getRow(linha).height = 27;
    }

    function criarIndicadorExcel(
        worksheet,
        colunaInicial,
        colunaFinal,
        linha,
        titulo,
        valor,
        corTexto,
        corFundo
    ) {
        worksheet.mergeCells(
            linha,
            colunaInicial,
            linha,
            colunaFinal
        );

        worksheet.mergeCells(
            linha + 1,
            colunaInicial,
            linha + 2,
            colunaFinal
        );

        const tituloCell = worksheet.getCell(
            linha,
            colunaInicial
        );

        const valorCell = worksheet.getCell(
            linha + 1,
            colunaInicial
        );

        tituloCell.value = titulo;

        tituloCell.font = {
            name: "Aptos",
            size: 10,
            bold: true,
            color: { argb: CORES_EXCEL.textoSecundario }
        };

        tituloCell.alignment = {
            vertical: "middle",
            horizontal: "left",
            indent: 1
        };

        valorCell.value = valor;

        valorCell.font = {
            name: "Aptos Display",
            size: 16,
            bold: true,
            color: { argb: corTexto }
        };

        valorCell.numFmt =
            '"R$" #,##0.00;[Red]-"R$" #,##0.00';

        valorCell.alignment = {
            vertical: "middle",
            horizontal: "left",
            indent: 1
        };

        for (
            let linhaAtual = linha;
            linhaAtual <= linha + 2;
            linhaAtual++
        ) {
            for (
                let coluna = colunaInicial;
                coluna <= colunaFinal;
                coluna++
            ) {
                const celula = worksheet.getCell(
                    linhaAtual,
                    coluna
                );

                celula.fill = {
                    type: "pattern",
                    pattern: "solid",
                    fgColor: { argb: corFundo }
                };

                celula.border = {
                    top: {
                        style: "thin",
                        color: { argb: CORES_EXCEL.borda }
                    },
                    bottom: {
                        style: "thin",
                        color: { argb: CORES_EXCEL.borda }
                    },
                    left: {
                        style: "thin",
                        color: { argb: CORES_EXCEL.borda }
                    },
                    right: {
                        style: "thin",
                        color: { argb: CORES_EXCEL.borda }
                    }
                };
            }
        }

        worksheet.getRow(linha).height = 22;
        worksheet.getRow(linha + 1).height = 23;
        worksheet.getRow(linha + 2).height = 17;
    }

    /* ========================================= */
    /* CABEÇALHO DO RELATÓRIO EXCEL */
    /* ========================================= */

    function montarCabecalhoRelatorioExcel(
        worksheet,
        imagemId
    ) {
        worksheet.mergeCells("B1:G1");
        worksheet.mergeCells("B2:G2");
        worksheet.mergeCells("B3:G3");

        worksheet.getRow(1).height = 30;
        worksheet.getRow(2).height = 25;
        worksheet.getRow(3).height = 23;
        worksheet.getRow(4).height = 12;

        for (let linha = 1; linha <= 4; linha++) {
            for (let coluna = 1; coluna <= 7; coluna++) {
                worksheet.getCell(linha, coluna).fill = {
                    type: "pattern",
                    pattern: "solid",
                    fgColor: { argb: CORES_EXCEL.branco }
                };
            }
        }

        worksheet.getCell("B1").value = "FINORA";

        worksheet.getCell("B1").font = {
            name: "Aptos Display",
            size: 23,
            bold: true,
            color: { argb: CORES_EXCEL.verde }
        };

        worksheet.getCell("B1").alignment = {
            vertical: "middle",
            horizontal: "left"
        };

        worksheet.getCell("B2").value =
            "Relatório de movimentações financeiras";

        worksheet.getCell("B2").font = {
            name: "Aptos",
            size: 10,
            color: { argb: CORES_EXCEL.textoSecundario }
        };

        worksheet.getCell("B2").alignment = {
            vertical: "middle",
            horizontal: "left"
        };

        worksheet.getCell("B3").value =
            `Gerado em ${new Date().toLocaleString("pt-BR")}`;

        worksheet.getCell("B3").font = {
            name: "Aptos",
            size: 9,
            color: { argb: CORES_EXCEL.textoSecundario }
        };

        worksheet.getCell("B3").alignment = {
            vertical: "middle",
            horizontal: "left"
        };

        if (imagemId !== null) {
            worksheet.addImage(imagemId, {
                tl: {
                    col: 0.02,
                    row: 0.02
                },
                ext: {
                    width: 100,
                    height: 78
                }
            });

        } else {
            worksheet.getCell("A1").value = "FINORA";

            worksheet.getCell("A1").font = {
                name: "Aptos Display",
                size: 11,
                bold: true,
                color: { argb: CORES_EXCEL.verde }
            };

            worksheet.getCell("A1").alignment = {
                vertical: "middle",
                horizontal: "center"
            };
        }

        for (let coluna = 1; coluna <= 7; coluna++) {
            worksheet.getCell(4, coluna).border = {
                bottom: {
                    style: "medium",
                    color: { argb: CORES_EXCEL.verde }
                }
            };
        }
    }

    /* ========================================= */
    /* ESTILIZAÇÃO DAS LINHAS DO HISTÓRICO EXCEL */
    /* ========================================= */

    function estilizarLinhaHistoricoExcel(
        linha,
        item,
        indice
    ) {
        linha.height = 24;

        const corFundo = indice % 2 === 0
            ? CORES_EXCEL.branco
            : CORES_EXCEL.fundo;

        linha.eachCell({ includeEmpty: true }, cell => {
            cell.font = {
                name: "Aptos",
                size: 9,
                color: { argb: CORES_EXCEL.texto }
            };

            cell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: corFundo }
            };

            cell.alignment = {
                vertical: "middle"
            };

            cell.border = {
                bottom: {
                    style: "thin",
                    color: { argb: CORES_EXCEL.borda }
                }
            };
        });

        const celulaData = linha.getCell(1);

        if (celulaData.value instanceof Date) {
            celulaData.numFmt = "dd/mm/yyyy";

            celulaData.alignment = {
                horizontal: "center",
                vertical: "middle"
            };
        }

        const celulaTipo = linha.getCell(4);

        let corTipo = CORES_EXCEL.despesa;
        let fundoTipo = CORES_EXCEL.despesaFundo;

        if (item.tipo === "receita") {
            corTipo = CORES_EXCEL.receita;
            fundoTipo = CORES_EXCEL.receitaFundo;

        } else if (item.tipo === "investimento") {
            corTipo = CORES_EXCEL.investimento;
            fundoTipo = CORES_EXCEL.investimentoFundo;
        }

        celulaTipo.font = {
            name: "Aptos",
            size: 9,
            bold: true,
            color: { argb: corTipo }
        };

        celulaTipo.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: fundoTipo }
        };

        const celulaValor = linha.getCell(6);

        celulaValor.numFmt =
            '"R$" #,##0.00;[Red]-"R$" #,##0.00';

        celulaValor.alignment = {
            horizontal: "right",
            vertical: "middle"
        };

        celulaValor.font = {
            name: "Aptos",
            size: 9,
            bold: true,
            color: { argb: corTipo }
        };
    }

    /* ========================================= */
    /* RELATÓRIO EXCEL */
    /* RESUMO + HISTÓRICO NA MESMA ABA */
    /* ========================================= */

    function criarPlanilhaResumoExcel(
        workbook,
        registros,
        totais,
        imagemId
    ) {
        const worksheet = workbook.addWorksheet("Relatório", {
            properties: {
                tabColor: {
                    argb: CORES_EXCEL.verde
                }
            },

            views: [
                {
                    showGridLines: false
                }
            ],

            pageSetup: {
                paperSize: 9,
                orientation: "landscape",
                fitToPage: true,
                fitToWidth: 1,
                fitToHeight: 0,

                margins: {
                    left: 0.25,
                    right: 0.25,
                    top: 0.4,
                    bottom: 0.4,
                    header: 0.2,
                    footer: 0.2
                }
            }
        });

        worksheet.columns = [
            { width: 13 },
            { width: 30 },
            { width: 23 },
            { width: 17 },
            { width: 29 },
            { width: 19 },
            { width: 25 }
        ];

        montarCabecalhoRelatorioExcel(
            worksheet,
            imagemId
        );

        criarTituloSecaoExcel(
            worksheet,
            6,
            7,
            "Resumo financeiro"
        );

        const saldo = totais.receitas - totais.despesas;

        criarIndicadorExcel(
            worksheet,
            1,
            2,
            8,
            "RECEITAS",
            totais.receitas,
            CORES_EXCEL.receita,
            CORES_EXCEL.receitaFundo
        );

        criarIndicadorExcel(
            worksheet,
            3,
            4,
            8,
            "DESPESAS",
            totais.despesas,
            CORES_EXCEL.despesa,
            CORES_EXCEL.despesaFundo
        );

        criarIndicadorExcel(
            worksheet,
            5,
            6,
            8,
            "INVESTIMENTOS",
            totais.investimentos,
            CORES_EXCEL.investimento,
            CORES_EXCEL.investimentoFundo
        );

        criarIndicadorExcel(
            worksheet,
            7,
            7,
            8,
            "SALDO",
            saldo,
            saldo >= 0
                ? CORES_EXCEL.verde
                : CORES_EXCEL.despesa,
            CORES_EXCEL.verdeClaro
        );

        criarTituloSecaoExcel(
            worksheet,
            12,
            7,
            "Histórico de lançamentos"
        );

        worksheet.mergeCells("A13:G13");

        worksheet.getCell("A13").value =
            `${registros.length} lançamento(s) incluído(s) neste relatório`;

        worksheet.getCell("A13").font = {
            name: "Aptos",
            size: 9,
            italic: true,
            color: { argb: CORES_EXCEL.textoSecundario }
        };

        worksheet.getCell("A13").alignment = {
            vertical: "middle"
        };

        worksheet.getRow(13).height = 21;

        const cabecalho = worksheet.addRow([
            "Data",
            "Descrição",
            "Categoria",
            "Tipo",
            "Forma de pagamento",
            "Valor (R$)",
            "Origem"
        ]);

        estilizarCabecalhoExcel(cabecalho);

        const linhasHistorico = registros.map(item => [
            converterDataExcel(item.data) || formatarData(item.data),
            item.descricao || "Sem descrição",
            item.categoria || "Não categorizada",
            obterNomeTipo(item),
            item.forma || "-",
            Number(item.valor) || 0,
            item.origemTexto || "-"
        ]);

        worksheet.addRows(linhasHistorico);

        const primeiraLinhaDados = 15;

        registros.forEach((item, indice) => {
            const numeroLinha = primeiraLinhaDados + indice;
            const linha = worksheet.getRow(numeroLinha);

            estilizarLinhaHistoricoExcel(
                linha,
                item,
                indice
            );
        });

        const ultimaLinhaDados =
            primeiraLinhaDados + registros.length - 1;

        if (registros.length > 0) {
            worksheet.autoFilter = {
                from: "A14",
                to: `G${ultimaLinhaDados}`
            };
        }

        const linhaRodape = Math.max(
            ultimaLinhaDados + 2,
            16
        );

        worksheet.mergeCells(
            `A${linhaRodape}:G${linhaRodape}`
        );

        worksheet.getCell(`A${linhaRodape}`).value =
            "FINORA — Controle de Finanças";

        worksheet.getCell(`A${linhaRodape}`).font = {
            name: "Aptos",
            size: 9,
            bold: true,
            color: { argb: CORES_EXCEL.verde }
        };

        worksheet.getCell(`A${linhaRodape}`).alignment = {
            horizontal: "right"
        };

        worksheet.views = [
            {
                state: "frozen",
                ySplit: 14,
                showGridLines: false
            }
        ];

        worksheet.pageSetup.printArea =
            `A1:G${linhaRodape}`;

        worksheet.pageSetup.printTitleRows = "14:14";

        return worksheet;
    }

    /* ========================================= */
    /* GERAR ARQUIVO EXCEL */
    /* ========================================= */

    async function exportarExcel() {
        const registros = obterRegistrosFiltrados();

        if (!registros.length) {
            alert("Não existem lançamentos para exportar.");
            return;
        }

        const botao = document.getElementById("exportarExcel");

        try {
            if (botao) {
                botao.disabled = true;

                botao.innerHTML =
                    '<i class="fa-solid fa-spinner fa-spin"></i> Preparando...';
            }

            await carregarBibliotecaExcelJS();

            const totais = calcularTotaisExportacao(registros);

            const workbook = new window.ExcelJS.Workbook();

            workbook.creator = "Finora";
            workbook.lastModifiedBy = "Finora";
            workbook.created = new Date();
            workbook.modified = new Date();

            workbook.subject =
                "Relatório de movimentações financeiras";

            workbook.title =
                "Relatório Financeiro Finora";

            workbook.company = "Finora";

            workbook.properties.date1904 = false;

            const imagemId = await carregarLogoExcel(workbook);

            criarPlanilhaResumoExcel(
                workbook,
                registros,
                totais,
                imagemId
            );

            const buffer = await workbook.xlsx.writeBuffer();

            const arquivo = new Blob(
                [buffer],
                {
                    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                }
            );

            const url = URL.createObjectURL(arquivo);

            const link = document.createElement("a");

            link.href = url;

            link.download =
                `Finora_Relatorio_${obterDataLocal()}.xlsx`;

            document.body.appendChild(link);

            link.click();

            document.body.removeChild(link);

            setTimeout(() => {
                URL.revokeObjectURL(url);
            }, 1500);

        } catch (erro) {
            console.error("Erro ao exportar Excel:", erro);

            alert(
                "Não foi possível gerar o Excel. Verifique sua conexão e tente novamente."
            );

        } finally {
            if (botao) {
                botao.disabled = false;

                botao.innerHTML =
                    '<i class="fa-solid fa-file-excel"></i> Exportar Excel';
            }
        }
    }

    /* ========================================= */
    /* EXPORTAÇÃO — PDF */
    /* ========================================= */

    function exportarPDF() {
        const registros = obterRegistrosFiltrados();

        if (!registros.length) {
            alert("Não existem lançamentos para exportar.");
            return;
        }

        const totais = calcularTotaisExportacao(registros);

        const linhas = registros.map(item => {
            const tipo = obterNomeTipo(item);
            const sinal = item.tipo === "receita" ? "+" : "-";

            return `
                <tr>
                    <td>${escaparTexto(formatarData(item.data))}</td>
                    <td class="descricao">
                        ${escaparTexto(item.descricao)}
                    </td>
                    <td>${escaparTexto(item.categoria)}</td>
                    <td>
                        <span class="tipo tipo-${item.tipo}">
                            ${tipo}
                        </span>
                    </td>
                    <td>${escaparTexto(item.forma)}</td>
                    <td class="valor">
                        ${sinal} ${escaparTexto(formatarMoeda(item.valor))}
                    </td>
                </tr>
            `;
        }).join("");

        const janela = window.open("", "_blank");

        if (!janela) {
            alert(
                "O navegador bloqueou a abertura do relatório. Permita pop-ups para este site e tente novamente."
            );

            return;
        }

        janela.document.write(`
            <!DOCTYPE html>
            <html lang="pt-BR">

            <head>
                <meta charset="UTF-8">

                <meta
                    name="viewport"
                    content="width=device-width, initial-scale=1.0"
                >

                <title>Relatório Financeiro — Finora</title>

                <style>
                    * {
                        box-sizing: border-box;
                    }

                    body {
                        margin: 0;
                        padding: 38px;
                        background: #ffffff;
                        color: #243447;
                        font-family: Arial, Helvetica, sans-serif;
                        font-size: 12px;
                    }

                    .cabecalho {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        gap: 20px;
                        padding-bottom: 24px;
                        border-bottom: 2px solid #0f766e;
                        margin-bottom: 28px;
                    }

                    .identidade {
                        display: flex;
                        flex-direction: column;
                        align-items: flex-start;
                    }

                    .marca {
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        gap: 0;
                        width: 150px;
                        margin: 0;
                        padding: 0;
                    }

                    .marca img {
                        display: block;
                        width: 115px;
                        height: 75px;
                        object-fit: contain;
                        object-position: center;
                        margin: 0 0 -24px;
                        padding: 0;
                    }

                    .marca-nome {
                        display: block;
                        color: #0f766e;
                        font-size: 23px;
                        font-weight: 800;
                        letter-spacing: 2px;
                        line-height: 1;
                        text-align: center;
                        margin: 0;
                        padding: 0;
                    }

                    .subtitulo {
                        margin-top: 10px;
                        color: #64748b;
                        font-size: 12px;
                    }

                    .geracao {
                        text-align: right;
                        color: #64748b;
                        font-size: 11px;
                        line-height: 1.7;
                    }

                    .geracao strong {
                        color: #334155;
                        font-size: 12px;
                    }

                    .secao-titulo {
                        display: flex;
                        align-items: center;
                        gap: 9px;
                        margin: 28px 0 14px;
                        color: #1e293b;
                        font-size: 15px;
                        font-weight: 700;
                    }

                    .secao-titulo::before {
                        content: "";
                        width: 4px;
                        height: 17px;
                        background: #0f766e;
                        border-radius: 4px;
                    }

                    .indicadores {
                        display: grid;
                        grid-template-columns: repeat(4, 1fr);
                        gap: 12px;
                    }

                    .indicador {
                        padding: 16px 13px;
                        border: 1px solid #e2e8f0;
                        border-radius: 9px;
                        background: #f8fafc;
                    }

                    .indicador span {
                        display: block;
                        color: #64748b;
                        font-size: 10px;
                        margin-bottom: 9px;
                    }

                    .indicador strong {
                        display: block;
                        color: #1e293b;
                        font-size: 14px;
                        white-space: nowrap;
                    }

                    .indicador.receitas strong {
                        color: #16865b;
                    }

                    .indicador.despesas strong {
                        color: #dc5252;
                    }

                    .indicador.investimentos strong {
                        color: #6475c7;
                    }

                    .indicador.saldo strong {
                        color: #0f766e;
                    }

                    .tabela-container {
                        width: 100%;
                    }

                    table {
                        width: 100%;
                        border-collapse: collapse;
                        font-size: 10px;
                    }

                    thead {
                        display: table-header-group;
                        background: #0f766e;
                        color: #ffffff;
                    }

                    th {
                        padding: 12px 9px;
                        font-size: 10px;
                        font-weight: 700;
                        text-align: left;
                        white-space: nowrap;
                    }

                    td {
                        padding: 11px 9px;
                        border-bottom: 1px solid #e8edf2;
                        color: #475569;
                        vertical-align: middle;
                    }

                    tbody tr:nth-child(even) {
                        background: #f8fafc;
                    }

                    tbody tr {
                        page-break-inside: avoid;
                    }

                    .descricao {
                        color: #1e293b;
                        font-weight: 600;
                    }

                    .tipo {
                        display: inline-block;
                        padding: 5px 8px;
                        border-radius: 5px;
                        font-size: 9px;
                        font-weight: 700;
                        white-space: nowrap;
                    }

                    .tipo-receita {
                        background: #dcfce7;
                        color: #15803d;
                    }

                    .tipo-despesa {
                        background: #fee2e2;
                        color: #b91c1c;
                    }

                    .tipo-investimento {
                        background: #e0e7ff;
                        color: #4338ca;
                    }

                    .valor {
                        text-align: right;
                        white-space: nowrap;
                        font-weight: 700;
                        color: #1e293b;
                    }

                    .rodape {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        gap: 12px;
                        margin-top: 28px;
                        padding-top: 13px;
                        border-top: 1px solid #e2e8f0;
                        color: #94a3b8;
                        font-size: 10px;
                    }

                    .rodape strong {
                        color: #0f766e;
                        letter-spacing: 1px;
                    }

                    .acoes {
                        margin-bottom: 22px;
                        text-align: right;
                    }

                    .acoes button {
                        padding: 11px 18px;
                        border: none;
                        border-radius: 7px;
                        background: #0f766e;
                        color: #ffffff;
                        font-size: 12px;
                        font-weight: 700;
                        cursor: pointer;
                    }

                    @page {
                        size: A4 landscape;
                        margin: 12mm;
                    }

                    @media print {
                        body {
                            padding: 0;
                        }

                        .acoes {
                            display: none;
                        }

                        .cabecalho,
                        .indicadores {
                            page-break-inside: avoid;
                        }

                        tr {
                            page-break-inside: avoid;
                        }

                        thead {
                            display: table-header-group;
                        }

                        * {
                            -webkit-print-color-adjust: exact;
                            print-color-adjust: exact;
                        }
                    }

                    @media screen and (max-width: 700px) {
                        body {
                            padding: 16px;
                        }

                        .cabecalho {
                            align-items: flex-start;
                        }

                        .indicadores {
                            grid-template-columns: repeat(2, 1fr);
                        }

                        .tabela-container {
                            overflow-x: auto;
                        }

                        table {
                            font-size: 9px;
                        }

                        th,
                        td {
                            padding: 6px 4px;
                        }
                    }
                </style>
            </head>

            <body>

                <div class="acoes">
                    <button onclick="window.print()">
                        Imprimir / Salvar em PDF
                    </button>
                </div>

                <header class="cabecalho">

                    <div class="identidade">

                        <div class="marca">

                            <img
                                src="${LOGO_FINORA}"
                                alt="Logo Finora"
                                onerror="this.style.display='none';"
                            >

                            <strong class="marca-nome">
                                FINORA
                            </strong>

                        </div>

                        <div class="subtitulo">
                            Relatório de movimentações financeiras
                        </div>

                    </div>

                    <div class="geracao">
                        <strong>RELATÓRIO FINANCEIRO</strong><br>
                        Gerado em ${new Date().toLocaleString("pt-BR")}<br>
                        ${registros.length} lançamento(s)
                    </div>

                </header>

                <h2 class="secao-titulo">
                    Resumo financeiro
                </h2>

                <section class="indicadores">

                    <div class="indicador receitas">
                        <span>Receitas</span>
                        <strong>
                            ${formatarMoeda(totais.receitas)}
                        </strong>
                    </div>

                    <div class="indicador despesas">
                        <span>Despesas</span>
                        <strong>
                            ${formatarMoeda(totais.despesas)}
                        </strong>
                    </div>

                    <div class="indicador investimentos">
                        <span>Investimentos</span>
                        <strong>
                            ${formatarMoeda(totais.investimentos)}
                        </strong>
                    </div>

                    <div class="indicador saldo">
                        <span>Saldo (receitas - despesas)</span>
                        <strong>
                            ${formatarMoeda(totais.receitas - totais.despesas)}
                        </strong>
                    </div>

                </section>

                <h2 class="secao-titulo">
                    Histórico de lançamentos
                </h2>

                <div class="tabela-container">

                    <table>

                        <thead>
                            <tr>
                                <th>Data</th>
                                <th>Descrição</th>
                                <th>Categoria</th>
                                <th>Tipo</th>
                                <th>Forma de pagamento</th>
                                <th style="text-align: right;">
                                    Valor
                                </th>
                            </tr>
                        </thead>

                        <tbody>
                            ${linhas}
                        </tbody>

                    </table>

                </div>

                <footer class="rodape">

                    <span>
                        <strong>FINORA</strong>
                        — Controle de Finanças
                    </span>

                    <span>
                        Documento gerado eletronicamente
                    </span>

                </footer>

            </body>
            </html>
        `);

        janela.document.close();
    }

    /* ========================================= */
    /* CONFIGURAÇÃO DOS BOTÕES DE EXPORTAÇÃO */
    /* ========================================= */

    function configurarExportacao() {
        if (!elementos.tabela) return;

        if (document.getElementById("finoraExportacoes")) {
            return;
        }

        const container = document.createElement("div");

        container.id = "finoraExportacoes";

        container.innerHTML = `
            <div class="finora-exportacoes-info">

                <strong>Exportar lançamentos</strong>

                <span>
                    Os arquivos respeitam os filtros aplicados.
                </span>

            </div>

            <div class="finora-exportacoes-botoes">

                <button type="button" id="exportarPDF">
                    <i class="fa-solid fa-file-pdf"></i>
                    Exportar PDF
                </button>

                <button type="button" id="exportarExcel">
                    <i class="fa-solid fa-file-excel"></i>
                    Exportar Excel
                </button>

            </div>
        `;

        const tabelaContainer =
            elementos.tabela.closest(".tabela-lancamentos-container") ||
            elementos.tabela.parentElement;

        if (!tabelaContainer || !tabelaContainer.parentElement) {
            console.error(
                "Não foi possível localizar o container da tabela."
            );

            return;
        }

        tabelaContainer.parentElement.insertBefore(
            container,
            tabelaContainer
        );

        const estilo = document.createElement("style");

        estilo.textContent = `
            #finoraExportacoes {
                display: flex;
                justify-content: space-between;
                align-items: center;
                gap: 18px;
                flex-wrap: wrap;
                padding: 16px 18px;
                margin: 0 0 16px;
                background: #ffffff;
                border: 1px solid #e8edf2;
                border-radius: 12px;
            }

            .finora-exportacoes-info {
                display: flex;
                flex-direction: column;
                gap: 5px;
            }

            .finora-exportacoes-info strong {
                color: #172033;
                font-size: 14px;
            }

            .finora-exportacoes-info span {
                color: #8490a3;
                font-size: 12px;
            }

            .finora-exportacoes-botoes {
                display: flex;
                align-items: center;
                gap: 9px;
                flex-wrap: wrap;
            }

            .finora-exportacoes-botoes button {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
                padding: 10px 14px;
                border: 1px solid #e2e8f0;
                border-radius: 8px;
                background: #ffffff;
                color: #334155;
                font-size: 12px;
                font-weight: 700;
                cursor: pointer;
                transition: .2s ease;
            }

            .finora-exportacoes-botoes button:hover {
                background: #f8fafc;
                border-color: #cbd5e1;
                transform: translateY(-1px);
            }

            #exportarPDF i {
                color: #e05252;
            }

            #exportarExcel i {
                color: #16865b;
            }

            .finora-exportacoes-botoes button:disabled {
                opacity: .6;
                cursor: wait;
                transform: none;
            }

            @media (max-width: 600px) {
                #finoraExportacoes {
                    align-items: stretch;
                    flex-direction: column;
                }

                .finora-exportacoes-botoes {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                }

                .finora-exportacoes-botoes button {
                    padding: 11px 8px;
                }
            }
        `;

        document.head.appendChild(estilo);

        document.getElementById("exportarPDF")
            .addEventListener("click", exportarPDF);

        document.getElementById("exportarExcel")
            .addEventListener("click", exportarExcel);
    }

    /* ========================================= */
    /* ATUALIZAÇÃO DA PÁGINA */
    /* ========================================= */

    function atualizarPagina() {
        lancamentos = obterLancamentos();

        atualizarCategorias();

        const registros = obterRegistrosFiltrados();

        atualizarIndicadores(registros);
        renderizarTabela(registros);
    }

    /* ========================================= */
    /* RECARREGAR DADOS DO FIRESTORE */
    /* ========================================= */

    async function recarregarDados() {
        if (carregandoDados) {
            atualizacaoPendente = true;
            return;
        }

        carregandoDados = true;

        try {
            do {
                atualizacaoPendente = false;

                await carregarDadosFinanceiros();

                atualizarPagina();

            } while (atualizacaoPendente);

        } catch (erro) {
            console.error(
                "Erro ao carregar os lançamentos do Firestore:",
                erro
            );

            if (elementos.tabela) {
                elementos.tabela.innerHTML = `
                    <tr>
                        <td colspan="7" class="carregando-lancamentos">
                            Não foi possível carregar as movimentações.
                            Atualize a página e tente novamente.
                        </td>
                    </tr>
                `;
            }

        } finally {
            carregandoDados = false;
        }
    }

    /* ========================================= */
    /* EVENTOS DOS FILTROS */
    /* ========================================= */

    function configurarFiltros() {
        [
            elementos.busca,
            elementos.periodo,
            elementos.tipo,
            elementos.categoria
        ].forEach(campo => {
            if (!campo) return;

            campo.addEventListener("input", atualizarPagina);
            campo.addEventListener("change", atualizarPagina);
        });

        if (elementos.periodo) {
            elementos.periodo.addEventListener("change", () => {
                const personalizado =
                    elementos.periodo.value === "personalizado";

                if (elementos.periodoPersonalizado) {
                    elementos.periodoPersonalizado.hidden =
                        !personalizado;
                }

                atualizarPagina();
            });
        }

        if (elementos.aplicarPeriodo) {
            elementos.aplicarPeriodo.addEventListener(
                "click",
                atualizarPagina
            );
        }

        if (elementos.dataInicio) {
            elementos.dataInicio.addEventListener(
                "change",
                atualizarPagina
            );
        }

        if (elementos.dataFim) {
            elementos.dataFim.addEventListener(
                "change",
                atualizarPagina
            );
        }
    }

    /* ========================================= */
    /* ATUALIZAÇÃO ENTRE PÁGINAS */
    /* ========================================= */

    window.addEventListener(
        "finora:debitos-atualizados",
        recarregarDados
    );

    window.addEventListener(
        "finora:atualizacao-financeira",
        recarregarDados
    );

    window.addEventListener("pageshow", recarregarDados);

    window.addEventListener("focus", recarregarDados);

    /* ========================================= */
    /* INICIALIZAÇÃO */
    /* ========================================= */

    async function iniciar() {
        atualizarDataAtual();

        configurarFiltros();

        configurarExportacao();

        if (elementos.periodoPersonalizado) {
            elementos.periodoPersonalizado.hidden =
                elementos.periodo?.value !== "personalizado";
        }

        await recarregarDados();
    }

    iniciar();

})();