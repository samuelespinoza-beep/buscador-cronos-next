// El backend devuelve el fragmento del OCR con las coincidencias envueltas en <mark>.
// Antes ese HTML se inyectaba con dangerouslySetInnerHTML, lo que dejaba la seguridad de
// la página en manos de que el backend escapara el texto del documento. Acá se parte en
// segmentos y React escapa cada uno al renderizar: da igual qué venga en el contenido.

const MARK_PATTERN = /<mark>([\s\S]*?)<\/mark>/gi;

const NAMED_ENTITIES = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    nbsp: ' ',
};

// Si el backend sí escapa el texto, los segmentos llegan con entidades y hay que
// devolverlas a su carácter: renderizadas como texto plano se verían "&amp;" literal.
// Decodificar es seguro porque el resultado nunca vuelve a interpretarse como HTML.
const decodeEntities = (text) =>
    text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code) => {
        if (code[0] !== '#') {
            return NAMED_ENTITIES[code.toLowerCase()] ?? whole;
        }

        const codePoint = code[1].toLowerCase() === 'x'
            ? parseInt(code.slice(2), 16)
            : parseInt(code.slice(1), 10);

        return Number.isInteger(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff
            ? String.fromCodePoint(codePoint)
            : whole;
    });

/**
 * Parte el fragmento resaltado en segmentos de texto plano.
 * @returns {Array<{ text: string, mark: boolean }>}
 */
export function splitHighlights(html) {
    if (typeof html !== 'string' || html === '') return [];

    const segments = [];
    let cursor = 0;

    for (const match of html.matchAll(MARK_PATTERN)) {
        if (match.index > cursor) {
            segments.push({ text: decodeEntities(html.slice(cursor, match.index)), mark: false });
        }

        segments.push({ text: decodeEntities(match[1]), mark: true });
        cursor = match.index + match[0].length;
    }

    if (cursor < html.length) {
        segments.push({ text: decodeEntities(html.slice(cursor)), mark: false });
    }

    return segments;
}

/**
 * Solo el texto que venía resaltado, en orden de aparición.
 * @returns {string[]}
 */
export function extractMarks(html) {
    return splitHighlights(html)
        .filter(segment => segment.mark)
        .map(segment => segment.text);
}
