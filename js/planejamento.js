/* ========================================= */
/* FINORA — PLANEJAMENTO FINANCEIRO */
/* ORÇAMENTOS, DESPESAS E CONTROLE MENSAL */
/* INTEGRAÇÃO COM FIRESTORE */
/* ========================================= */

import {
    listarRegistros,
    salvarRegistro,
    excluirRegistro
} from "./finora-db.js";

(function () {
    "use strict";

    /* ========================================= */
    /* CONFIGURAÇÕES FIRESTORE */
    /* ========================================= */

    const COLECOES = {
        orcamentos: "planejamento",
        debitos: "debitos",
        entradas: "entradas",
        comprasCredito: "compras_credito"
    };

    let orcamentosFinora = [];
    let debitosFinora = [];
    let entradasFinora = [];
    let comprasCreditoFinora = [];

    let carregamentoEmAndamento = false;
    let operacaoEmAndamento = false;

    /* ========================================= */
    /* ELEMENTOS DA PÁGINA */
    /* ========================================= */

    const elementos = {
        mes: document.getElementById("mesPlanejamento"),

        receitaPrevista: document.getElementById("receitaPrevista"),
        despesasPlanejadas: document.getElementById("despesasPlanejadas"),
        saldoPlanejado: document.getElementById("saldoPlanejado"),
        percentualUtilizado: document.getElementById("percentualUtilizado"),

        valorUtilizado: document.getElementById("valorUtilizado"),
        orcamentoDisponivel: document.getElementById("orcamentoDisponivel"),
        despesasRealizadas: document.getElementById("despesasRealizadas"),
        progressoTexto: document.getElementById("progressoTexto"),
        barraOrcamento: document.getElementById("barraOrcamento"),
        avisoOrcamento: document.getElementById("avisoOrcamento"),

        abrirFormulario: document.getElementById("abrirFormularioOrcamento"),
        formularioContainer: document.getElementById("formularioOrcamentoContainer"),
        formulario: document.getElementById("formularioOrcamento"),

        id: document.getElementById("orcamentoId"),
        categoria: document.getElementById("categoriaOrcamento"),
        valor: document.getElementById("valorOrcamento"),
        descricao: document.getElementById("descricaoOrcamento"),

        tituloFormulario: document.getElementById("tituloFormularioOrcamento"),
        fecharFormulario: document.getElementById("fecharFormularioOrcamento"),
        cancelarFormulario: document.getElementById("cancelarFormularioOrcamento"),
        salvarFormulario: document.getElementById("salvarOrcamento"),

        lista: document.getElementById("listaOrcamentos"),
        tabela: document.getElementById("tabelaPlanejamento")
    };

    /* ========================================= */
    /* FUNÇÕES GERAIS */
    /* ========================================= */

    function gerarId() {
        return "orcamento_" + Date.now() + "_" +
            Math.random().toString(36).substring(2, 9);
    }

    function formatarMoeda(valor) {
        return Number(valor || 0).toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL"
        });
    }

    function converterNumero(valor) {
        if (typeof valor === "number") {
            return Number.isFinite(valor) ? valor : 0;
        }

        if (typeof valor !== "string") {
            return 0;
        }

        let numero = valor.trim();

        if (!numero) {
            return 0;
        }

        numero = numero
            .replace(/[R$\s]/g, "")
            .replace(/\./g, "")
            .replace(",", ".");

        const resultado = Number(numero);

        return Number.isFinite(resultado) ? resultado : 0;
    }

    function obterMesAtual() {
        const agora = new Date();

        return [
            agora.getFullYear(),
            String(agora.getMonth() + 1).padStart(2, "0")
        ].join("-");
    }

    function obterMesRegistro(data) {
        if (!data || typeof data !== "string") {
            return "";
        }

        const correspondencia = data.match(/^(\d{4})-(\d{2})/);

        if (!correspondencia) {
            return "";
        }

        return correspondencia[1] + "-" + correspondencia[2];
    }

    function obterMesSelecionado() {
        return elementos.mes?.value || obterMesAtual();
    }

    function escaparHTML(valor) {
        return String(valor ?? "").replace(/[&<>"']/g, caractere => {
            const entidades = {
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#039;"
            };

            return entidades[caractere];
        });
    }

    function normalizarTexto(texto) {
        return String(texto || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .trim();
    }

    /* ========================================= */
    /* CARREGAMENTO DOS DADOS DO FIRESTORE */
    /* ========================================= */

    async function carregarDadosPlanejamento() {
        if (carregamentoEmAndamento) {
            return;
        }

        carregamentoEmAndamento = true;

        try {
            const [
                orcamentos,
                debitos,
                entradas,
                comprasCredito
            ] = await Promise.all([
                listarRegistros(COLECOES.orcamentos),
                listarRegistros(COLECOES.debitos),
                listarRegistros(COLECOES.entradas),
                listarRegistros(COLECOES.comprasCredito)
            ]);

            orcamentosFinora = Array.isArray(orcamentos)
                ? orcamentos.filter(item =>
                    item &&
                    item.id &&
                    item.mes &&
                    item.categoria &&
                    converterNumero(item.valor) > 0
                )
                : [];

            debitosFinora = Array.isArray(debitos)
                ? debitos.filter(item =>
                    item &&
                    obterMesRegistro(item.data) &&
                    converterNumero(item.valor) > 0
                )
                : [];

            entradasFinora = Array.isArray(entradas)
                ? entradas.filter(item =>
                    item &&
                    obterMesRegistro(item.data) &&
                    converterNumero(item.valor) > 0
                )
                : [];

            comprasCreditoFinora = Array.isArray(comprasCredito)
                ? comprasCredito.filter(item =>
                    item &&
                    item.id &&
                    item.data &&
                    converterNumero(item.valorOriginal) > 0
                )
                : [];

        } catch (erro) {
            console.error(
                "Erro ao carregar os dados do planejamento:",
                erro
            );

            alert(
                "Não foi possível carregar os dados do planejamento. Verifique sua conexão e tente novamente."
            );

        } finally {
            carregamentoEmAndamento = false;
        }
    }

    /* ========================================= */
    /* ORÇAMENTOS SALVOS */
    /* ========================================= */

    function obterTodosOrcamentos() {
        return [...orcamentosFinora];
    }

    function obterOrcamentosDoMes() {
        const mes = obterMesSelecionado();

        return obterTodosOrcamentos().filter(item =>
            item.mes === mes
        );
    }

    /* ========================================= */
    /* RECEITAS RECEBIDAS */
    /* ========================================= */

    function obterEntradasDoMes() {
        const mes = obterMesSelecionado();

        return entradasFinora.filter(item =>
            item &&
            obterMesRegistro(item.data) === mes &&
            converterNumero(item.valor) > 0
        );
    }

    function calcularTotalEntradas() {
        return obterEntradasDoMes().reduce((total, item) => {
            return total + converterNumero(item.valor);
        }, 0);
    }

    /* ========================================= */
    /* DÉBITO, PIX E CONTAS A PAGAR */
    /* ========================================= */

    function obterDebitosDoMes() {
        const mes = obterMesSelecionado();

        return debitosFinora.filter(item =>
            item &&
            obterMesRegistro(item.data) === mes &&
            converterNumero(item.valor) > 0
        );
    }

    /* ========================================= */
    /* COMPRAS PARCELADAS NO CRÉDITO */
    /* ========================================= */

    function obterComprasCredito() {
        return comprasCreditoFinora.filter(item =>
            item &&
            item.id &&
            item.data &&
            converterNumero(item.valorOriginal) > 0
        );
    }

    /*
     * Calcula o valor mensal de cada parcela.
     *
     * Prioridade:
     * 1. valorParcela salvo na compra;
     * 2. totalParcelado dividido pela quantidade;
     * 3. valorOriginal dividido pela quantidade.
     */

    function obterValorParcela(compra) {
        const quantidade = Math.max(
            1,
            Math.floor(converterNumero(compra.parcelas) || 1)
        );

        const valorSalvo = converterNumero(compra.valorParcela);

        if (valorSalvo > 0) {
            return valorSalvo;
        }

        const totalParcelado = converterNumero(compra.totalParcelado);

        if (totalParcelado > 0) {
            return totalParcelado / quantidade;
        }

        const valorOriginal = converterNumero(compra.valorOriginal);

        return valorOriginal / quantidade;
    }

    /*
     * Distribui as parcelas pelos meses.
     *
     * Exemplo:
     * Compra em agosto, 3 parcelas:
     * Agosto: parcela 1
     * Setembro: parcela 2
     * Outubro: parcela 3
     *
     * O planejamento considera o mês da compra como
     * referência inicial, pois ainda não existe uma
     * programação individual das faturas.
     */

    function obterDespesasCreditoDoMes() {
        const mesSelecionado = obterMesSelecionado();
        const compras = obterComprasCredito();

        const [anoSelecionado, mesSelecionadoNumero] =
            mesSelecionado.split("-").map(Number);

        const dataSelecionada = new Date(
            anoSelecionado,
            mesSelecionadoNumero - 1,
            1
        );

        return compras.reduce((resultado, compra) => {
            const mesCompra = obterMesRegistro(compra.data);

            if (!mesCompra) {
                return resultado;
            }

            const [anoCompra, mesCompraNumero] =
                mesCompra.split("-").map(Number);

            const quantidade = Math.max(
                1,
                Math.floor(converterNumero(compra.parcelas) || 1)
            );

            const dataCompra = new Date(
                anoCompra,
                mesCompraNumero - 1,
                1
            );

            const diferencaMeses =
                (dataSelecionada.getFullYear() - dataCompra.getFullYear()) * 12 +
                (dataSelecionada.getMonth() - dataCompra.getMonth());

            if (
                diferencaMeses < 0 ||
                diferencaMeses >= quantidade
            ) {
                return resultado;
            }

            const valorParcela = obterValorParcela(compra);

            if (valorParcela <= 0) {
                return resultado;
            }

            resultado.push({
                id: compra.id,
                descricao: compra.descricao || compra.cartao || "Compra no crédito",
                categoria: compra.categoria || "Cartão de crédito",
                data: compra.data,
                valor: valorParcela,
                origem: "credito",
                numeroParcela: diferencaMeses + 1,
                totalParcelas: quantidade
            });

            return resultado;
        }, []);
    }

    /* ========================================= */
    /* CATEGORIAS DAS DESPESAS */
    /* ========================================= */

    function obterCategoriaRegistro(item) {
        const categoriaInformada =
            item.categoria ||
            item.categoriaNome ||
            item.nomeCategoria ||
            item.tipoCategoria;

        if (categoriaInformada) {
            return String(categoriaInformada).trim();
        }

        const descricao = normalizarTexto(
            item.descricao ||
            item.nome ||
            item.estabelecimento ||
            ""
        );

        const categorias = [
            {
                nome: "Moradia",
                palavras: [
                    "aluguel", "condominio", "iptu",
                    "imovel", "moradia"
                ]
            },
            {
                nome: "Alimentação",
                palavras: [
                    "mercado", "supermercado", "restaurante",
                    "lanche", "comida", "padaria", "ifood"
                ]
            },
            {
                nome: "Transporte",
                palavras: [
                    "uber", "99", "combustivel", "gasolina",
                    "onibus", "metro", "transporte"
                ]
            },
            {
                nome: "Saúde",
                palavras: [
                    "farmacia", "medico", "consulta",
                    "hospital", "saude", "exame"
                ]
            },
            {
                nome: "Educação",
                palavras: [
                    "curso", "faculdade", "escola",
                    "livro", "educacao"
                ]
            },
            {
                nome: "Lazer",
                palavras: [
                    "cinema", "show", "viagem",
                    "jogo", "lazer", "entretenimento"
                ]
            },
            {
                nome: "Compras",
                palavras: [
                    "roupa", "tenis", "sapato",
                    "eletronico", "compra"
                ]
            },
            {
                nome: "Assinaturas",
                palavras: [
                    "netflix", "spotify", "youtube",
                    "assinatura", "streaming"
                ]
            },
            {
                nome: "Contas",
                palavras: [
                    "energia", "luz", "agua",
                    "internet", "telefone", "gas"
                ]
            }
        ];

        for (const categoria of categorias) {
            if (
                categoria.palavras.some(palavra =>
                    descricao.includes(palavra)
                )
            ) {
                return categoria.nome;
            }
        }

        return "Outros";
    }

    /* ========================================= */
    /* DESPESAS DO MÊS */
    /* ========================================= */

    function obterDespesasDoMes() {
        const debitos = obterDebitosDoMes().map(item => ({
            ...item,
            categoria: obterCategoriaRegistro(item),
            valor: converterNumero(item.valor),
            origem: "debito"
        }));

        const credito = obterDespesasCreditoDoMes();

        return [...debitos, ...credito];
    }

    function obterDespesasPorCategoria() {
        const despesas = obterDespesasDoMes();
        const agrupadas = {};

        despesas.forEach(item => {
            const categoria = item.categoria || "Outros";

            if (!agrupadas[categoria]) {
                agrupadas[categoria] = 0;
            }

            agrupadas[categoria] += converterNumero(item.valor);
        });

        return agrupadas;
    }

    function calcularTotalDespesasRealizadas() {
        return obterDespesasDoMes().reduce((total, item) => {
            return total + converterNumero(item.valor);
        }, 0);
    }

    /* ========================================= */
    /* RESUMO DO PLANEJAMENTO */
    /* ========================================= */

    function calcularResumo() {
        const orcamentos = obterOrcamentosDoMes();

        const totalPlanejado = orcamentos.reduce((total, item) => {
            return total + converterNumero(item.valor);
        }, 0);

        const totalRealizado = calcularTotalDespesasRealizadas();
        const totalReceitas = calcularTotalEntradas();

        const saldo = totalReceitas - totalPlanejado;
        const disponivel = totalPlanejado - totalRealizado;

        const percentual = totalPlanejado > 0
            ? (totalRealizado / totalPlanejado) * 100
            : 0;

        return {
            totalPlanejado,
            totalRealizado,
            totalReceitas,
            saldo,
            disponivel,
            percentual
        };
    }

    /* ========================================= */
    /* ATUALIZAÇÃO DOS INDICADORES */
    /* ========================================= */

    function atualizarIndicadores() {
        const resumo = calcularResumo();

        if (elementos.receitaPrevista) {
            elementos.receitaPrevista.textContent =
                formatarMoeda(resumo.totalReceitas);
        }

        if (elementos.despesasPlanejadas) {
            elementos.despesasPlanejadas.textContent =
                formatarMoeda(resumo.totalPlanejado);
        }

        if (elementos.saldoPlanejado) {
            elementos.saldoPlanejado.textContent =
                formatarMoeda(resumo.saldo);
        }

        if (elementos.percentualUtilizado) {
            elementos.percentualUtilizado.textContent =
                resumo.percentual.toFixed(1).replace(".", ",") + "%";
        }

        if (elementos.valorUtilizado) {
            elementos.valorUtilizado.textContent =
                formatarMoeda(resumo.totalRealizado);
        }

        if (elementos.orcamentoDisponivel) {
            elementos.orcamentoDisponivel.textContent =
                formatarMoeda(resumo.disponivel);
        }

        if (elementos.despesasRealizadas) {
            elementos.despesasRealizadas.textContent =
                formatarMoeda(resumo.totalRealizado);
        }

        if (elementos.progressoTexto) {
            elementos.progressoTexto.textContent =
                resumo.percentual.toFixed(1).replace(".", ",") + "% utilizado";
        }

        if (elementos.barraOrcamento) {
            const percentualVisual = Math.min(
                Math.max(resumo.percentual, 0),
                100
            );

            elementos.barraOrcamento.style.width =
                percentualVisual + "%";

            elementos.barraOrcamento.classList.remove(
                "alerta",
                "excedido"
            );

            if (resumo.percentual > 100) {
                elementos.barraOrcamento.classList.add("excedido");
            } else if (resumo.percentual >= 80) {
                elementos.barraOrcamento.classList.add("alerta");
            }
        }

        if (elementos.avisoOrcamento) {
            elementos.avisoOrcamento.classList.remove(
                "alerta",
                "excedido"
            );

            if (resumo.totalPlanejado <= 0) {
                elementos.avisoOrcamento.textContent =
                    "Cadastre seus orçamentos para acompanhar os gastos do mês.";
            } else if (resumo.percentual > 100) {
                elementos.avisoOrcamento.textContent =
                    "Atenção: suas despesas ultrapassaram o orçamento planejado.";

                elementos.avisoOrcamento.classList.add("excedido");
            } else if (resumo.percentual >= 80) {
                elementos.avisoOrcamento.textContent =
                    "Atenção: você já utilizou boa parte do orçamento mensal.";

                elementos.avisoOrcamento.classList.add("alerta");
            } else {
                elementos.avisoOrcamento.textContent =
                    "Seus gastos estão dentro do orçamento planejado.";
            }
        }
    }

    /* ========================================= */
    /* ÍCONES DAS CATEGORIAS */
    /* ========================================= */

    function obterIconeCategoria(categoria) {
        const nome = normalizarTexto(categoria);

        const icones = {
            "moradia": "fa-house",
            "alimentacao": "fa-utensils",
            "transporte": "fa-car",
            "saude": "fa-heart-pulse",
            "educacao": "fa-graduation-cap",
            "lazer": "fa-gamepad",
            "compras": "fa-bag-shopping",
            "assinaturas": "fa-repeat",
            "contas": "fa-file-invoice",
            "cartao de credito": "fa-credit-card",
            "outros": "fa-layer-group"
        };

        return icones[nome] || "fa-wallet";
    }

    /* ========================================= */
    /* SITUAÇÃO DO ORÇAMENTO */
    /* ========================================= */

    function obterSituacao(percentual) {
        if (percentual > 100) {
            return {
                texto: "Excedido",
                classe: "excedido"
            };
        }

        if (percentual >= 80) {
            return {
                texto: "Atenção",
                classe: "alerta"
            };
        }

        return {
            texto: "Dentro do limite",
            classe: "normal"
        };
    }

    /* ========================================= */
    /* RENDERIZAÇÃO DA LISTA DE ORÇAMENTOS */
    /* ========================================= */

    function renderizarOrcamentos() {
        if (!elementos.lista) {
            return;
        }

        const orcamentos = obterOrcamentosDoMes();
        const despesasPorCategoria = obterDespesasPorCategoria();

        if (orcamentos.length === 0) {
            elementos.lista.innerHTML = `
                <div class="planejamento-vazio">
                    <i class="fa-solid fa-chart-pie"></i>
                    <p>Nenhum orçamento cadastrado para este mês.</p>
                    <span>Adicione um orçamento para começar seu planejamento.</span>
                </div>
            `;

            return;
        }

        elementos.lista.innerHTML = orcamentos.map(orcamento => {
            const categoria = orcamento.categoria;
            const planejado = converterNumero(orcamento.valor);
            const realizado = despesasPorCategoria[categoria] || 0;
            const disponivel = planejado - realizado;

            const percentual = planejado > 0
                ? (realizado / planejado) * 100
                : 0;

            const icone = obterIconeCategoria(categoria);

            return `
                <article class="planejamento-item">

                    <div class="planejamento-item-principal">

                        <div class="planejamento-item-icone">
                            <i class="fa-solid ${icone}"></i>
                        </div>

                        <div class="planejamento-item-texto">
                            <strong>${escaparHTML(categoria)}</strong>
                            <span>${escaparHTML(orcamento.descricao || "Orçamento mensal")}</span>
                        </div>

                    </div>

                    <div class="planejamento-item-valores">

                        <div class="planejamento-item-valor">
                            <span>Planejado</span>
                            <strong>${formatarMoeda(planejado)}</strong>
                        </div>

                        <div class="planejamento-item-valor">
                            <span>Realizado</span>
                            <strong>${formatarMoeda(realizado)}</strong>
                        </div>

                        <div class="planejamento-item-valor">
                            <span>Disponível</span>
                            <strong class="${disponivel < 0 ? "planejamento-valor-negativo" : "planejamento-valor-positivo"}">
                                ${formatarMoeda(disponivel)}
                            </strong>
                        </div>

                    </div>

                    <div class="planejamento-item-acoes">

                        <button
                            type="button"
                            class="planejamento-acao editar"
                            data-acao="editar"
                            data-id="${escaparHTML(orcamento.id)}"
                            aria-label="Editar orçamento"
                            title="Editar orçamento"
                        >
                            <i class="fa-solid fa-pen"></i>
                        </button>

                        <button
                            type="button"
                            class="planejamento-acao excluir"
                            data-acao="excluir"
                            data-id="${escaparHTML(orcamento.id)}"
                            aria-label="Excluir orçamento"
                            title="Excluir orçamento"
                        >
                            <i class="fa-solid fa-trash"></i>
                        </button>

                    </div>

                </article>
            `;
        }).join("");
    }

    /* ========================================= */
    /* RENDERIZAÇÃO DA TABELA */
    /* ========================================= */

    function renderizarTabela() {
        if (!elementos.tabela) {
            return;
        }

        const orcamentos = obterOrcamentosDoMes();
        const despesasPorCategoria = obterDespesasPorCategoria();

        if (orcamentos.length === 0) {
            elementos.tabela.innerHTML = `
                <tr>
                    <td colspan="6" class="planejamento-tabela-vazia">
                        Nenhum dado disponível para este mês.
                    </td>
                </tr>
            `;

            return;
        }

        elementos.tabela.innerHTML = orcamentos.map(orcamento => {
            const categoria = orcamento.categoria;
            const planejado = converterNumero(orcamento.valor);
            const realizado = despesasPorCategoria[categoria] || 0;

            const diferenca = planejado - realizado;

            const percentual = planejado > 0
                ? (realizado / planejado) * 100
                : 0;

            const situacao = obterSituacao(percentual);

            return `
                <tr>

                    <td>${escaparHTML(categoria)}</td>

                    <td>${formatarMoeda(planejado)}</td>

                    <td>${formatarMoeda(realizado)}</td>

                    <td class="${diferenca < 0 ? "planejamento-valor-negativo" : "planejamento-valor-positivo"}">
                        ${formatarMoeda(diferenca)}
                    </td>

                    <td>
                        ${percentual.toFixed(1).replace(".", ",")}%
                    </td>

                    <td>
                        <span class="planejamento-situacao ${situacao.classe}">
                            ${situacao.texto}
                        </span>
                    </td>

                </tr>
            `;
        }).join("");
    }

    /* ========================================= */
    /* FORMULÁRIO DE ORÇAMENTO */
    /* ========================================= */

    function abrirFormularioOrcamento(orcamento = null) {
        if (!elementos.formularioContainer) {
            return;
        }

        elementos.formularioContainer.hidden = false;

        if (elementos.formulario) {
            elementos.formulario.reset();
        }

        if (elementos.id) {
            elementos.id.value = "";
        }

        if (elementos.tituloFormulario) {
            elementos.tituloFormulario.textContent =
                orcamento ? "Editar orçamento" : "Novo orçamento";
        }

        if (orcamento) {
            if (elementos.id) {
                elementos.id.value = orcamento.id;
            }

            if (elementos.categoria) {
                elementos.categoria.value = orcamento.categoria;
            }

            if (elementos.valor) {
                elementos.valor.value = converterNumero(orcamento.valor)
                    .toFixed(2);
            }

            if (elementos.descricao) {
                elementos.descricao.value = orcamento.descricao || "";
            }
        }

        elementos.formularioContainer.scrollIntoView({
            behavior: "smooth",
            block: "nearest"
        });
    }

    function fecharFormularioOrcamento() {
        if (elementos.formularioContainer) {
            elementos.formularioContainer.hidden = true;
        }

        if (elementos.formulario) {
            elementos.formulario.reset();
        }

        if (elementos.id) {
            elementos.id.value = "";
        }

        if (elementos.tituloFormulario) {
            elementos.tituloFormulario.textContent = "Novo orçamento";
        }
    }

    /* ========================================= */
    /* SALVAR ORÇAMENTO NO FIRESTORE */
    /* ========================================= */

    async function salvarOrcamento(evento) {
        if (evento) {
            evento.preventDefault();
        }

        if (operacaoEmAndamento) {
            return;
        }

        if (!elementos.categoria || !elementos.valor) {
            return;
        }

        const categoria = elementos.categoria.value.trim();
        const valor = converterNumero(elementos.valor.value);
        const descricao = elementos.descricao
            ? elementos.descricao.value.trim()
            : "";

        const idAtual = elementos.id?.value || "";

        if (!categoria) {
            alert("Selecione uma categoria para o orçamento.");
            elementos.categoria.focus();
            return;
        }

        if (valor <= 0) {
            alert("Informe um valor válido para o orçamento.");
            elementos.valor.focus();
            return;
        }

        const orcamentos = obterTodosOrcamentos();

        let orcamento;
        let id;

        if (idAtual) {
            const indice = orcamentos.findIndex(item =>
                item.id === idAtual
            );

            if (indice === -1) {
                alert("Não foi possível localizar este orçamento.");
                return;
            }

            const categoriaDuplicada = orcamentos.some(item =>
                item.id !== idAtual &&
                item.mes === obterMesSelecionado() &&
                normalizarTexto(item.categoria) === normalizarTexto(categoria)
            );

            if (categoriaDuplicada) {
                alert("Já existe um orçamento cadastrado para esta categoria neste mês.");
                return;
            }

            orcamento = {
                ...orcamentos[indice],
                categoria,
                valor,
                descricao,
                mes: obterMesSelecionado()
            };

            id = idAtual;

        } else {
            const categoriaDuplicada = orcamentos.some(item =>
                item.mes === obterMesSelecionado() &&
                normalizarTexto(item.categoria) === normalizarTexto(categoria)
            );

            if (categoriaDuplicada) {
                alert("Já existe um orçamento cadastrado para esta categoria neste mês.");
                return;
            }

            id = gerarId();

            orcamento = {
                id,
                mes: obterMesSelecionado(),
                categoria,
                valor,
                descricao,
                criadoEm: new Date().toISOString()
            };
        }

        operacaoEmAndamento = true;

        if (elementos.salvarFormulario) {
            elementos.salvarFormulario.disabled = true;
        }

        try {
            /* CORREÇÃO:
             * salvarRegistro recebe:
             * 1º nome da coleção
             * 2º objeto com os dados
             * 3º identificador do registro
             */

            await salvarRegistro(
                COLECOES.orcamentos,
                orcamento,
                id
            );

            const indiceAtual = orcamentosFinora.findIndex(item =>
                item.id === id
            );

            if (indiceAtual >= 0) {
                orcamentosFinora[indiceAtual] = orcamento;
            } else {
                orcamentosFinora.push(orcamento);
            }

            fecharFormularioOrcamento();
            atualizarPlanejamento();

        } catch (erro) {
            console.error("Erro ao salvar orçamento:", erro);

            alert(
                "Não foi possível salvar o orçamento. Verifique sua conexão e tente novamente."
            );

        } finally {
            operacaoEmAndamento = false;

            if (elementos.salvarFormulario) {
                elementos.salvarFormulario.disabled = false;
            }
        }
    }

    /* ========================================= */
    /* EDITAR ORÇAMENTO */
    /* ========================================= */

    function editarOrcamento(id) {
        const orcamento = obterTodosOrcamentos().find(item =>
            item.id === id
        );

        if (!orcamento) {
            return;
        }

        abrirFormularioOrcamento(orcamento);
    }

    /* ========================================= */
    /* EXCLUIR ORÇAMENTO DO FIRESTORE */
    /* ========================================= */

    async function excluirOrcamento(id) {
        if (operacaoEmAndamento) {
            return;
        }

        const orcamento = obterTodosOrcamentos().find(item =>
            item.id === id
        );

        if (!orcamento) {
            return;
        }

        const confirmar = confirm(
            `Deseja realmente excluir o orçamento de ${orcamento.categoria}?`
        );

        if (!confirmar) {
            return;
        }

        operacaoEmAndamento = true;

        try {
            await excluirRegistro(
                COLECOES.orcamentos,
                id
            );

            orcamentosFinora = orcamentosFinora.filter(item =>
                item.id !== id
            );

            atualizarPlanejamento();

        } catch (erro) {
            console.error("Erro ao excluir orçamento:", erro);

            alert(
                "Não foi possível excluir o orçamento. Tente novamente."
            );

        } finally {
            operacaoEmAndamento = false;
        }
    }

    /* ========================================= */
    /* EVENTOS DA LISTA */
    /* ========================================= */

    function configurarEventosLista() {
        if (!elementos.lista) {
            return;
        }

        elementos.lista.addEventListener("click", evento => {
            const botao = evento.target.closest("button[data-acao]");

            if (!botao) {
                return;
            }

            const acao = botao.dataset.acao;
            const id = botao.dataset.id;

            if (!id) {
                return;
            }

            if (acao === "editar") {
                editarOrcamento(id);
            }

            if (acao === "excluir") {
                excluirOrcamento(id);
            }
        });
    }

    /* ========================================= */
    /* ATUALIZAÇÃO GERAL */
    /* ========================================= */

    function atualizarPlanejamento() {
        atualizarIndicadores();
        renderizarOrcamentos();
        renderizarTabela();
    }

    /* ========================================= */
    /* RECARREGAMENTO DOS DADOS */
    /* ========================================= */

    async function recarregarPlanejamento() {
        await carregarDadosPlanejamento();
        atualizarPlanejamento();
    }

    /* ========================================= */
    /* CONFIGURAÇÃO DOS EVENTOS */
    /* ========================================= */

    function configurarEventos() {
        elementos.abrirFormulario?.addEventListener("click", () => {
            abrirFormularioOrcamento();
        });

        elementos.fecharFormulario?.addEventListener("click", () => {
            fecharFormularioOrcamento();
        });

        elementos.cancelarFormulario?.addEventListener("click", () => {
            fecharFormularioOrcamento();
        });

        elementos.formulario?.addEventListener("submit", salvarOrcamento);

        elementos.mes?.addEventListener("change", () => {
            fecharFormularioOrcamento();
            atualizarPlanejamento();
        });

        configurarEventosLista();

        window.addEventListener("pageshow", recarregarPlanejamento);

        window.addEventListener(
            "finora:debitos-atualizados",
            recarregarPlanejamento
        );

        window.addEventListener(
            "finora:atualizacao-financeira",
            recarregarPlanejamento
        );
    }

    /* ========================================= */
    /* INICIALIZAÇÃO */
    /* ========================================= */

    async function iniciarPlanejamento() {
        if (elementos.mes && !elementos.mes.value) {
            elementos.mes.value = obterMesAtual();
        }

        configurarEventos();

        await recarregarPlanejamento();
    }

    if (document.readyState === "loading") {
        document.addEventListener(
            "DOMContentLoaded",
            iniciarPlanejamento,
            { once: true }
        );
    } else {
        iniciarPlanejamento();
    }

})();