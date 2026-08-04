import { NextResponse } from 'next/server';

const backendUrl = () => process.env.PRINTED_GRAPHQL_URL?.replace(/\/+$/, '');

const SEARCHES = {
    word: {
        field: 'searchPrinted',
        query: `query Search($text: String!, $page: Int, $limit: Int, $sort: String, $start: String, $end: String) {
          searchPrinted(keyword: $text, page: $page, limit: $limit, sort: $sort, start_date: $start, end_date: $end) {
            data { _id title page_number document ocr_coordinates highlighted_content thumbnail date }
            total current_page last_page
          }
        }`,
    },
    phrase: {
        field: 'searchPrintedPhrase',
        query: `query SearchPhrase($text: String!, $page: Int, $limit: Int, $sort: String, $start: String, $end: String) {
          searchPrintedPhrase(keyword: $text, page: $page, limit: $limit, sort: $sort, start_date: $start, end_date: $end) {
            data { _id title page_number document ocr_coordinates highlighted_content thumbnail date }
            total current_page last_page
          }
        }`,
    },
};

const RESULTS_PER_PAGE = 10;
const SORT = 'ASC';
const TIMEOUT_MS = 20000;

// El backend pagina por offset y el costo crece con la profundidad. Medido contra él:
// page 1 y 50 -> 0,5s | page 200 -> 1,3s | page 1000 -> 5,3s | page 3000 -> pasa de 20s.
// De ahí la cota: 1000 es la última profundidad que responde, y son 10.000 resultados de
// alcance. Más arriba la consulta ya no termina, así que permitirlo sólo regala trabajo
// caro al backend. Para el abuso repetido hace falta rate limiting, no una cota.
const MAX_PAGE = 1000;
const MAX_KEYWORD_LENGTH = 200;

const isDate = (value) => value === null || /^\d{4}-\d{2}-\d{2}$/.test(value);

export async function POST(request) {
    const backend = backendUrl();
    const tokenId = process.env.PRINTED_TOKEN_ID;

    if (!backend || !tokenId) {
        console.error('Falta PRINTED_GRAPHQL_URL o PRINTED_TOKEN_ID en el entorno');
        return NextResponse.json({ error: 'Buscador mal configurado.' }, { status: 503 });
    }

    let payload;
    try {
        payload = await request.json();
    } catch {
        return NextResponse.json({ error: 'Cuerpo inválido.' }, { status: 400 });
    }

    const { mode, keyword, page = 1, start = null, end = null } = payload ?? {};
    const search = SEARCHES[mode];

    if (!search || typeof keyword !== 'string' || !keyword.trim()) {
        return NextResponse.json({ error: 'Parámetros incompletos.' }, { status: 400 });
    }

    if (keyword.length > MAX_KEYWORD_LENGTH) {
        return NextResponse.json({ error: 'La búsqueda es demasiado larga.' }, { status: 400 });
    }

    if (!Number.isInteger(page) || page < 1 || page > MAX_PAGE || !isDate(start) || !isDate(end)) {
        return NextResponse.json({ error: 'Parámetros inválidos.' }, { status: 400 });
    }

    try {
        const response = await fetch(backend, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                token_id: tokenId,
            },
            body: JSON.stringify({
                query: search.query,
                variables: { text: keyword, page, limit: RESULTS_PER_PAGE, sort: SORT, start, end },
            }),
            cache: 'no-store',
            signal: AbortSignal.timeout(TIMEOUT_MS),
        });

        // Los mensajes de error del backend se quedan en el log y nunca viajan al
        // navegador: un error de GraphQL puede traer nombres de tablas, rutas de archivos
        // o fragmentos de consulta. Al cliente va un texto fijo, distinto por caso para
        // que sirva de pista al dar soporte, pero sin detalles internos.
        if (!response.ok) {
            console.error(`El buscador respondió ${response.status}`);
            return NextResponse.json(
                { error: 'No se pudo consultar el buscador.' },
                { status: response.status },
            );
        }

        const json = await response.json().catch(() => null);

        if (json?.errors?.length) {
            console.error('El buscador devolvió errores', json.errors);
            return NextResponse.json(
                { error: 'La consulta fue rechazada por el buscador.' },
                { status: 502 },
            );
        }

        const result = json?.data?.[search.field];

        if (!result) {
            return NextResponse.json(
                { error: 'La respuesta del buscador no tiene el formato esperado.' },
                { status: 502 },
            );
        }

        return NextResponse.json({ result });
    } catch (error) {
        const timedOut = error.name === 'TimeoutError';
        console.error('Error al consultar el buscador:', error);
        return NextResponse.json(
            { error: timedOut ? 'El buscador tardó demasiado en responder.' : 'No se pudo consultar el buscador.' },
            { status: timedOut ? 504 : 502 },
        );
    }
}
