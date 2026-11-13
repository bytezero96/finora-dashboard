
/* ========================================= */
/* FINORA — ENTRADAS */
/* FIRESTORE */
/* CADASTRO, EDIÇÃO, EXCLUSÃO E HISTÓRICO */
/* ========================================= */

import {
    listarRegistros,
    salvarRegistro,
    excluirRegistro
} from "./finora-db.js";

(function () {
    "use strict";

    /* ========================================= */
    /* CONFIGURAÇÕES */
    /* ========================================= */

    const COLECAO_ENTRADAS = "entradas";

    const moeda = new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL"
    });

    const formulario = document.getElementById("formularioEntrada");

    if (!formulario) return;

    const elementos = {
        id: document.getElementById("entradaId"),
        descricao: document.getElementById("entradaDescricao"),
        categoria: document.getElementById("entradaCategoria"),
        valor: document.getElementById("entradaValor"),
        data: document.getElementById("entradaData"),
        forma: document.getElementById("entradaForma"),
        observacoes: document.getElementById("entradaObservacoes"),

        total: document.getElementById("totalEntradas"),
        mes: document.getElementById("entradasMes"),
        quantidade: document.getElementById("quantidadeEntradas"),

        lista: document.getElementById("listaEntradas"),
        estadoVazio: document.getElementById("estadoVazioEntradas"),

        busca: document.getElementById("filtroBuscaEntrada"),
        filtroCategoria: document.getElementById("filtroCategoriaEntrada"),
        filtroMes: document.getElementById("filtroMesEntrada"),

        mensagem: document.getElementById("mensagemEntrada"),
        tituloFormulario: document.getElementById("tituloFormularioEntrada"),
        textoBotao: document.getElementById("textoBotaoEntrada"),
        cancelarEdicao: document.getElementById("cancelarEdicaoEntrada")
    };

    let entradas = [];
    let salvando = false;

    /* ========================================= */
    /* FUNÇÕES AUXILIARES */
    /* ========================================= */

    function formatarMoeda(valor) {
        return moeda.format(Number(valor) || 0);
    }

    function dataHojeISO() {
        const hoje = new Date();
        const ano = hoje.getFullYear();
        const mes = String(hoje.getMonth() + 1).padStart(2, "0");
        const dia = String(hoje.getDate()).padStart(2, "0");

        return `${ano}-${mes}-${dia}`;
    }

    function formatarData(data) {
        if (!data) return "—";

        const partes = data.split("-");

        if (partes.length !== 3) return data;

        return `${partes[2]}/${partes[1]}/${partes[0]}`;
    }

    function obterMesAtual() {
        return dataHojeISO().slice(0, 7);
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

    function gerarId() {
        return (
            Date.now().toString() +
            Math.floor(Math.random() * 100000).toString()
        );
    }

    /* ========================================= */
    /* ARMAZENAMENTO — FIRESTORE */
    /* ========================================= */

    async function carregarEntradas() {
        try {
            const registros = await listarRegistros(COLECAO_ENTRADAS);

            entradas = registros.filter(item => {
                return (
                    item &&
                    typeof item.id === "string" &&
                    typeof item.descricao === "string" &&
                    typeof item.data === "string" &&
                    Number.isFinite(Number(item.valor)) &&
                    Number(item.valor) > 0
                );
            });

            atualizarPagina();

        } catch (erro) {
            console.error("Erro ao carregar entradas do Firestore:", erro);

            mostrarMensagem(
                "Não foi possível carregar as entradas. Verifique sua conexão e tente novamente.",
                "erro"
            );
        }
    }

    async function salvarEntradaFirestore(entrada) {
        await salvarRegistro(
            COLECAO_ENTRADAS,
            entrada,
            entrada.id
        );
    }

    /* ========================================= */
    /* AVISAR O RESTANTE DO FINORA */
    /* ========================================= */

    function notificarAtualizacao() {
        window.dispatchEvent(
            new CustomEvent("finora:atualizacao-financeira", {
                detail: {
                    tipo: "entrada",
                    entradas: entradas
                }
            })
        );

        if (typeof window.notificarAtualizacaoFinanceira === "function") {
            Promise.resolve(
                window.notificarAtualizacaoFinanceira()
            ).catch(erro => {
                console.error(
                    "Erro ao atualizar os dados financeiros:",
                    erro
                );
            });
        }
    }

    /* ========================================= */
    /* MENSAGENS */
    /* ========================================= */

    function mostrarMensagem(texto, tipo) {
        elementos.mensagem.textContent = texto;
        elementos.mensagem.className = `mensagem-entrada ${tipo}`;
        elementos.mensagem.hidden = false;
    }

    function limparMensagem() {
        elementos.mensagem.textContent = "";
        elementos.mensagem.hidden = true;
        elementos.mensagem.className = "mensagem-entrada";
    }

    /* ========================================= */
    /* INDICADORES */
    /* ========================================= */

    function atualizarIndicadores() {
        const total = entradas.reduce((soma, item) => {
            return soma + Number(item.valor);
        }, 0);

        const mesAtual = obterMesAtual();

        const totalMes = entradas
            .filter(item => item.data.slice(0, 7) === mesAtual)
            .reduce((soma, item) => {
                return soma + Number(item.valor);
            }, 0);

        elementos.total.textContent = formatarMoeda(total);
        elementos.mes.textContent = formatarMoeda(totalMes);
        elementos.quantidade.textContent = entradas.length;
    }

    /* ========================================= */
    /* FILTROS */
    /* ========================================= */

    function obterEntradasFiltradas() {
        const busca = elementos.busca.value
            .trim()
            .toLocaleLowerCase("pt-BR");

        const categoria = elementos.filtroCategoria.value;
        const mes = elementos.filtroMes.value;

        return entradas
            .filter(item => {
                const descricao = String(item.descricao || "");
                const categoriaItem = String(item.categoria || "");

                const correspondeBusca =
                    !busca ||
                    descricao.toLocaleLowerCase("pt-BR").includes(busca) ||
                    categoriaItem.toLocaleLowerCase("pt-BR").includes(busca);

                const correspondeCategoria =
                    !categoria || item.categoria === categoria;

                const correspondeMes =
                    !mes || item.data.slice(0, 7) === mes;

                return (
                    correspondeBusca &&
                    correspondeCategoria &&
                    correspondeMes
                );
            })
            .sort((a, b) => {
                return b.data.localeCompare(a.data);
            });
    }

    /* ========================================= */
    /* RENDERIZAR TABELA */
    /* ========================================= */

    function renderizarTabela() {
        const resultado = obterEntradasFiltradas();

        elementos.lista.innerHTML = "";

        if (resultado.length === 0) {
            elementos.estadoVazio.hidden = false;
            return;
        }

        elementos.estadoVazio.hidden = true;

        resultado.forEach(item => {
            const linha = document.createElement("tr");

            linha.innerHTML = `
                <td>
                    <span class="descricao-tabela-entrada">
                        ${escaparHTML(item.descricao)}
                    </span>
                </td>

                <td>
                    <span class="categoria-entrada">
                        ${escaparHTML(item.categoria)}
                    </span>
                </td>

                <td>${formatarData(item.data)}</td>

                <td>${escaparHTML(item.forma)}</td>

                <td class="valor-tabela-entrada">
                    ${formatarMoeda(item.valor)}
                </td>

                <td>
                    <div class="acoes-tabela-entrada">

                        <button
                            type="button"
                            class="botao-acao-entrada botao-editar-entrada"
                            data-editar="${escaparHTML(item.id)}"
                            title="Editar entrada"
                            aria-label="Editar ${escaparHTML(item.descricao)}"
                        >
                            <i class="fa-solid fa-pen"></i>
                        </button>

                        <button
                            type="button"
                            class="botao-acao-entrada botao-excluir-entrada"
                            data-excluir="${escaparHTML(item.id)}"
                            title="Excluir entrada"
                            aria-label="Excluir ${escaparHTML(item.descricao)}"
                        >
                            <i class="fa-solid fa-trash"></i>
                        </button>

                    </div>
                </td>
            `;

            elementos.lista.appendChild(linha);
        });
    }

    /* ========================================= */
    /* ATUALIZAR PÁGINA */
    /* ========================================= */

    function atualizarPagina() {
        atualizarIndicadores();
        renderizarTabela();
    }

    /* ========================================= */
    /* LIMPAR FORMULÁRIO */
    /* ========================================= */

    function limparFormulario() {
        formulario.reset();

        elementos.id.value = "";
        elementos.data.value = dataHojeISO();

        elementos.tituloFormulario.textContent = "Cadastrar entrada";
        elementos.textoBotao.textContent = "Registrar entrada";

        elementos.cancelarEdicao.hidden = true;

        limparMensagem();
    }

    /* ========================================= */
    /* CADASTRAR OU EDITAR */
    /* ========================================= */

    formulario.addEventListener("submit", async evento => {
        evento.preventDefault();

        if (salvando) return;

        limparMensagem();

        const id = elementos.id.value.trim();
        const descricao = elementos.descricao.value.trim();
        const categoria = elementos.categoria.value;
        const valor = Number(elementos.valor.value);
        const data = elementos.data.value;
        const forma = elementos.forma.value;
        const observacoes = elementos.observacoes.value.trim();

        if (!descricao) {
            mostrarMensagem("Informe a descrição da entrada.", "erro");
            elementos.descricao.focus();
            return;
        }

        if (!categoria) {
            mostrarMensagem("Selecione uma categoria.", "erro");
            elementos.categoria.focus();
            return;
        }

        if (!Number.isFinite(valor) || valor <= 0) {
            mostrarMensagem("Informe um valor válido maior que zero.", "erro");
            elementos.valor.focus();
            return;
        }

        if (!data) {
            mostrarMensagem("Informe a data do recebimento.", "erro");
            elementos.data.focus();
            return;
        }

        if (!forma) {
            mostrarMensagem("Selecione a forma de recebimento.", "erro");
            elementos.forma.focus();
            return;
        }

        const novaEntrada = {
            id: id || gerarId(),
            descricao,
            categoria,
            valor: Math.round(valor * 100) / 100,
            data,
            forma,
            observacoes
        };

        if (id) {
            const existe = entradas.some(item => item.id === id);

            if (!existe) {
                mostrarMensagem(
                    "Não foi possível localizar essa entrada.",
                    "erro"
                );
                return;
            }
        }

        salvando = true;

        try {
            await salvarEntradaFirestore(novaEntrada);

            if (id) {
                const indice = entradas.findIndex(item => item.id === id);
                entradas[indice] = novaEntrada;
            } else {
                entradas.push(novaEntrada);
            }

            atualizarPagina();
            notificarAtualizacao();

            limparFormulario();

            mostrarMensagem(
                id
                    ? "Entrada atualizada com sucesso."
                    : "Entrada registrada com sucesso.",
                "sucesso"
            );

        } catch (erro) {
            console.error("Erro ao salvar entrada:", erro);

            mostrarMensagem(
                "Não foi possível salvar a entrada no banco de dados. Tente novamente.",
                "erro"
            );

        } finally {
            salvando = false;
        }
    });

    /* ========================================= */
    /* EDITAR ENTRADA */
    /* ========================================= */

    function editarEntrada(id) {
        const entrada = entradas.find(item => item.id === id);

        if (!entrada) return;

        elementos.id.value = entrada.id;
        elementos.descricao.value = entrada.descricao;
        elementos.categoria.value = entrada.categoria;
        elementos.valor.value = Number(entrada.valor).toFixed(2);
        elementos.data.value = entrada.data;
        elementos.forma.value = entrada.forma;
        elementos.observacoes.value = entrada.observacoes || "";

        elementos.tituloFormulario.textContent = "Editar entrada";
        elementos.textoBotao.textContent = "Salvar alterações";

        elementos.cancelarEdicao.hidden = false;

        limparMensagem();

        elementos.descricao.focus();

        document.querySelector(".painel-entradas").scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    }

    /* ========================================= */
    /* EXCLUIR ENTRADA */
    /* ========================================= */

    async function excluirEntrada(id) {
        const entrada = entradas.find(item => item.id === id);

        if (!entrada || salvando) return;

        const confirmar = window.confirm(
            `Deseja realmente excluir a entrada "${entrada.descricao}"?`
        );

        if (!confirmar) return;

        salvando = true;

        try {
            await excluirRegistro(COLECAO_ENTRADAS, id);

            entradas = entradas.filter(item => item.id !== id);

            if (elementos.id.value === id) {
                limparFormulario();
            }

            atualizarPagina();
            notificarAtualizacao();

            mostrarMensagem(
                "Entrada excluída com sucesso.",
                "sucesso"
            );

        } catch (erro) {
            console.error("Erro ao excluir entrada:", erro);

            mostrarMensagem(
                "Não foi possível excluir a entrada. Tente novamente.",
                "erro"
            );

        } finally {
            salvando = false;
        }
    }

    /* ========================================= */
    /* AÇÕES DA TABELA */
    /* ========================================= */

    elementos.lista.addEventListener("click", evento => {
        const botaoEditar = evento.target.closest("[data-editar]");
        const botaoExcluir = evento.target.closest("[data-excluir]");

        if (botaoEditar) {
            editarEntrada(botaoEditar.dataset.editar);
            return;
        }

        if (botaoExcluir) {
            excluirEntrada(botaoExcluir.dataset.excluir);
        }
    });

    /* ========================================= */
    /* CANCELAR EDIÇÃO */
    /* ========================================= */

    elementos.cancelarEdicao.addEventListener("click", () => {
        limparFormulario();
    });

    /* ========================================= */
    /* EVENTOS DOS FILTROS */
    /* ========================================= */

    elementos.busca.addEventListener("input", renderizarTabela);

    elementos.filtroCategoria.addEventListener("change", renderizarTabela);

    elementos.filtroMes.addEventListener("change", renderizarTabela);

    document
        .getElementById("limparFiltrosEntrada")
        .addEventListener("click", () => {
            elementos.busca.value = "";
            elementos.filtroCategoria.value = "";
            elementos.filtroMes.value = "";

            renderizarTabela();
        });

    /* ========================================= */
    /* INICIALIZAÇÃO */
    /* ========================================= */

    elementos.data.value = dataHojeISO();

    carregarEntradas();

})();