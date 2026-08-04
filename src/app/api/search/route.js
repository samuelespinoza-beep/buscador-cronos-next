import { NextResponse } from 'next/server';

// Reenvía las búsquedas al GraphQL de cronos-printed agregando el token del lado del
// servidor. Antes la página lo llamaba directo con NEXT_PUBLIC_TOKEN_ID, y ese prefijo
// hace que Next escriba el valor dentro del bundle: quedaba legible con Ver código
// fuente. Acá el token nunca sale del servidor.

const isProd = process.env.NODE_ENV === 'production';

const BACKEND_URL = (process.env.PRINTED_GRAPHQL_URL
    || (isProd ? 'https://cronosprintedapi.glr.pe/graphql' : 'http://cronosprintedapi.glr.test/graphql')
).replace(/\/+$/, '');

// El cliente manda un modo, no una query: así no puede pedirle al backend nada que no
// esté declarado acá. Cada modo trae el nombre del campo con el que responde GraphQL.
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

// Lo que llega de un <input type="date">: vacío o YYYY-MM-DD.
const isDate = (value) => value === null || /^\d{4}-\d{2}-\d{2}$/.test(value);

export async function POST(request) {
    const tokenId = process.env.PRINTED_TOKEN_ID;

    if (!tokenId) {
        console.error('Falta PRINTED_TOKEN_ID en el entorno');
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

    if (!Number.isInteger(page) || page < 1 || !isDate(start) || !isDate(end)) {
        return NextResponse.json({ error: 'Parámetros inválidos.' }, { status: 400 });
    }

    try {
        const response = await fetch(BACKEND_URL, {
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

        if (!response.ok) {
            console.error(`El buscador respondió ${response.status}`);
            return NextResponse.json(
                { error: `El buscador respondió ${response.status}.` },
                { status: response.status },
            );
        }

        const json = await response.json().catch(() => null);

        // GraphQL contesta 200 aunque la query falle: el detalle viene en "errors".
        if (json?.errors?.length) {
            console.error('El buscador devolvió errores', json.errors);
            return NextResponse.json(
                { error: json.errors[0]?.message || 'La consulta fue rechazada por el buscador.' },
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
