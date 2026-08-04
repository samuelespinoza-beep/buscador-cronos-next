import { NextResponse } from 'next/server';

// Reenvía la búsqueda de coordenadas a cronos-printed agregando la API key. Corre en
// el servidor a propósito: así la key nunca llega al navegador (una env con prefijo
// NEXT_PUBLIC_ queda inlineada en el bundle y la puede leer cualquiera).

const isProd = process.env.NODE_ENV === 'production';

const BACKEND_URL = (process.env.PRINTED_REST_API_URL
    || (isProd ? 'https://cronosprinted.glr.pe/api' : 'http://cronosprinted.glr.test/api')
).replace(/\/+$/, '');

// El modo se traduce acá contra una lista fija: el cliente no elige el path del backend.
const ENDPOINTS = {
    word: '/search/coordinates',
    phrase: '/search/coordinates-line',
};

const TIMEOUT_MS = 20000;

export async function POST(request) {
    const apiKey = process.env.PRINTED_SEARCH_API_KEY;

    if (!apiKey) {
        console.error('Falta PRINTED_SEARCH_API_KEY en el entorno');
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

    try {
        const response = await fetch(`${BACKEND_URL}${endpoint}`, {
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
