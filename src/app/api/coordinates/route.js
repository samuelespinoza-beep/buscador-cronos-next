import { NextResponse } from 'next/server';

const backendUrl = () => process.env.PRINTED_REST_API_URL?.replace(/\/+$/, '');

const ENDPOINTS = {
    word: '/search/coordinates',
    phrase: '/search/coordinates-line',
};

const TIMEOUT_MS = 20000;

// El backend descarga la URL que le pasemos en ocr_coordinates, así que este endpoint es
// un relevo: sin filtro, cualquiera podría pedirle que busque en un host arbitrario. Hoy
// el backend también valida, pero eso es un control ajeno que podría relajarse.
// Es la misma validación que tenía el pdf-proxy antes de eliminarse.
// ".test" es un TLD reservado por el estándar, no puede apuntar a nada público.
const isAllowedHost = (hostname) =>
    hostname === 's3.amazonaws.com'
    || hostname.endsWith('.s3.amazonaws.com')
    || hostname.endsWith('.glr.pe')
    || hostname.endsWith('.glr.test');

const isAllowedUrl = (value) => {
    if (typeof value !== 'string') return false;

    let url;
    try {
        url = new URL(value);
    } catch {
        return false;
    }

    return (url.protocol === 'https:' || url.protocol === 'http:') && isAllowedHost(url.hostname);
};

export async function POST(request) {
    const backend = backendUrl();
    const apiKey = process.env.PRINTED_SEARCH_API_KEY;

    if (!backend || !apiKey) {
        console.error('Falta PRINTED_REST_API_URL o PRINTED_SEARCH_API_KEY en el entorno');
        return NextResponse.json({ error: 'Buscador mal configurado' }, { status: 503 });
    }

    let payload;
    try {
        payload = await request.json();
    } catch {
        return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 });
    }

    const { mode, ocr_coordinates: ocrCoordinates, keyword } = payload ?? {};
    const endpoint = ENDPOINTS[mode];

    if (!endpoint || !ocrCoordinates || !keyword) {
        return NextResponse.json({ error: 'Parámetros incompletos' }, { status: 400 });
    }

    if (!isAllowedUrl(ocrCoordinates)) {
        console.error('ocr_coordinates apunta a un host no permitido:', ocrCoordinates);
        return NextResponse.json({ error: 'Origen no permitido' }, { status: 400 });
    }

    try {
        const response = await fetch(`${backend}${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                'X-Api-Key': apiKey,
            },
            body: JSON.stringify({ ocr_coordinates: ocrCoordinates, keyword }),
            cache: 'no-store',
            signal: AbortSignal.timeout(TIMEOUT_MS),
        });

        const data = await response.json().catch(() => null);

        if (!response.ok) {
            console.error(`El buscador respondió ${response.status}`, data);
            return NextResponse.json(
                { error: 'No se pudieron obtener las coordenadas' },
                { status: response.status },
            );
        }

        return NextResponse.json(data);
    } catch (error) {
        const timedOut = error.name === 'TimeoutError';
        console.error('Error al consultar las coordenadas:', error);
        return NextResponse.json(
            { error: 'No se pudieron obtener las coordenadas' },
            { status: timedOut ? 504 : 502 },
        );
    }
}
