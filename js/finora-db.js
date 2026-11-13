
/* ========================================= */
/* FINORA — CAMADA DE DADOS FIRESTORE */
/* ========================================= */

import { db, auth } from "./firebase-config.js";

import {
    collection,
    doc,
    getDocs,
    setDoc,
    deleteDoc,
    serverTimestamp,
    writeBatch
} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js";

/* ========================================= */
/* COLEÇÕES PERMITIDAS */
/* ========================================= */

const COLECOES_FINORA = [
    "debitos",
    "entradas",
    "cartoes",
    "compras_credito",
    "contas_pagar",
    "metas",
    "movimentacoes_metas",
    "planejamento",
    "investimentos",
    "movimentacoes_investimentos"
];

/* ========================================= */
/* AGUARDAR AUTENTICAÇÃO */
/* ========================================= */

let promessaUsuario = null;

export function aguardarUsuario() {

    if (auth.currentUser) {
        return Promise.resolve(auth.currentUser);
    }

    if (!promessaUsuario) {

        promessaUsuario = new Promise((resolve, reject) => {

            let cancelar = null;

            cancelar = onAuthStateChanged(
                auth,

                usuario => {

                    if (cancelar) {
                        cancelar();
                    }

                    promessaUsuario = null;

                    resolve(usuario);
                },

                erro => {

                    if (cancelar) {
                        cancelar();
                    }

                    promessaUsuario = null;

                    reject(erro);
                }
            );

        });

    }

    return promessaUsuario;
}

/* ========================================= */
/* PROTEÇÃO DAS PÁGINAS */
/* ========================================= */

export async function protegerPagina() {

    try {

        const usuario = await aguardarUsuario();

        if (!usuario) {
            window.location.replace("login.html");
            return null;
        }

        return usuario;

    } catch (erro) {

        console.error(
            "Erro ao verificar autenticação:",
            erro
        );

        window.location.replace("login.html");

        return null;
    }
}

/* ========================================= */
/* VALIDAÇÕES */
/* ========================================= */

function validarColecao(nomeColecao) {

    if (
        typeof nomeColecao !== "string" ||
        !COLECOES_FINORA.includes(nomeColecao)
    ) {
        throw new Error("Coleção não autorizada.");
    }
}

function validarId(id) {

    if (
        (typeof id !== "string" && typeof id !== "number") ||
        !String(id).trim()
    ) {
        throw new Error("ID do registro inválido.");
    }

    const identificador = String(id).trim();

    if (
        identificador.includes("/") ||
        identificador === "." ||
        identificador === ".."
    ) {
        throw new Error("ID do registro inválido.");
    }

    return identificador;
}

function validarDados(dados) {

    if (
        !dados ||
        typeof dados !== "object" ||
        Array.isArray(dados)
    ) {
        throw new Error(
            "Dados inválidos para salvar o registro."
        );
    }
}

/* ========================================= */
/* IDENTIFICAÇÃO DO USUÁRIO */
/* ========================================= */

function obterCaminhoUsuario(usuario, nomeColecao) {

    if (!usuario || !usuario.uid) {
        throw new Error("Usuário não autenticado.");
    }

    validarColecao(nomeColecao);

    return collection(
        db,
        "users",
        usuario.uid,
        nomeColecao
    );
}

async function obterCaminhoUsuarioAtual(nomeColecao) {

    const usuario = await aguardarUsuario();

    if (!usuario) {
        throw new Error("Usuário não autenticado.");
    }

    return {
        usuario,
        referencia: obterCaminhoUsuario(
            usuario,
            nomeColecao
        )
    };
}

/* ========================================= */
/* LISTAR REGISTROS */
/* ========================================= */

export async function listarRegistros(nomeColecao) {

    const { referencia } = await obterCaminhoUsuarioAtual(
        nomeColecao
    );

    const resultado = await getDocs(referencia);

    return resultado.docs.map(documento => ({
        ...documento.data(),
        id: documento.id
    }));
}

/* ========================================= */
/* SALVAR REGISTRO */
/* ========================================= */

export async function salvarRegistro(
    nomeColecao,
    dados,
    id = null
) {

    validarDados(dados);

    const { usuario, referencia } =
        await obterCaminhoUsuarioAtual(nomeColecao);

    const identificador = validarId(id || dados.id);

    const documento = doc(
        referencia,
        identificador
    );

    await setDoc(
        documento,
        {
            ...dados,
            id: identificador,
            atualizadoEm: serverTimestamp()
        },
        {
            merge: true
        }
    );

    return {
        id: identificador,
        usuarioId: usuario.uid
    };
}

/* ========================================= */
/* EXCLUIR REGISTRO */
/* ========================================= */

export async function excluirRegistro(
    nomeColecao,
    id
) {

    const identificador = validarId(id);

    const { referencia } = await obterCaminhoUsuarioAtual(
        nomeColecao
    );

    await deleteDoc(
        doc(referencia, identificador)
    );

    return true;
}

/* ========================================= */
/* OPERAÇÕES EM LOTE — FIRESTORE */
/* ========================================= */

export async function executarLote(operacoes) {

    if (
        !Array.isArray(operacoes) ||
        operacoes.length === 0
    ) {
        throw new Error(
            "Nenhuma operação foi informada."
        );
    }

    if (operacoes.length > 500) {
        throw new Error(
            "O lote ultrapassou o limite de 500 operações."
        );
    }

    const usuario = await aguardarUsuario();

    if (!usuario) {
        throw new Error("Usuário não autenticado.");
    }

    const lote = writeBatch(db);

    for (const operacao of operacoes) {

        if (
            !operacao ||
            typeof operacao !== "object" ||
            Array.isArray(operacao)
        ) {
            throw new Error("Operação inválida.");
        }

        const {
            tipo,
            colecao: nomeColecao,
            id
        } = operacao;

        const identificador = validarId(id);

        validarColecao(nomeColecao);

        // Utiliza o mesmo usuário autenticado no início do lote.
        const referencia = obterCaminhoUsuario(
            usuario,
            nomeColecao
        );

        const documento = doc(
            referencia,
            identificador
        );

        if (tipo === "salvar") {

            validarDados(operacao.dados);

            lote.set(
                documento,
                {
                    ...operacao.dados,
                    id: identificador,
                    atualizadoEm: serverTimestamp()
                },
                {
                    merge: true
                }
            );

        } else if (tipo === "excluir") {

            lote.delete(documento);

        } else {

            throw new Error(
                `Tipo de operação inválido: ${tipo}`
            );
        }
    }

    await lote.commit();

    return true;
}

/* ========================================= */
/* DISPONIBILIZAR USUÁRIO ATUAL */
/* ========================================= */

export async function obterUsuarioAtual() {
    return await aguardarUsuario();
}

/* ========================================= */
/* EXPORTAÇÕES */
/* ========================================= */

export { auth, db };
