/**
 * Patrón editorial cíclico (bloques de 4):
 * 1 → 100% | 2 → 50%+50% | 3 → 50%+50% + 100% | 4 → 25%×4
 * 5+ → filas completas de 4, luego el resto repite el patrón.
 */

/**
 * @param {number} index - índice 0-based en el total
 * @param {number} total
 * @returns {{ span: 1|2|4, featured: boolean }}
 */
export function getCardPlacement(index, total) {
    if (total <= 0 || index < 0 || index >= total) {
        return { span: 4, featured: false };
    }

    if (total <= 4) {
        return placementInSegment(index, total);
    }

    const fullRowsCount = Math.floor(total / 4) * 4;
    if (index < fullRowsCount) {
        return { span: 1, featured: false };
    }

    const segmentIndex = index - fullRowsCount;
    const segmentSize = total % 4;
    return placementInSegment(segmentIndex, segmentSize);
}

/**
 * @param {number} index - dentro del segmento (0..segmentSize-1)
 * @param {number} segmentSize - 1..4
 */
function placementInSegment(index, segmentSize) {
    switch (segmentSize) {
        case 1:
            return { span: 4, featured: true };
        case 2:
            return { span: 2, featured: false };
        case 3:
            return { span: index < 2 ? 2 : 4, featured: false };
        case 4:
        default:
            return { span: 1, featured: false };
    }
}

/** Para depuración / data-attribute en el contenedor */
export function getGridPatternLabel(total) {
    if (total <= 4) return `segment-${total}`;
    const r = total % 4;
    const rows = Math.floor(total / 4);
    return r === 0 ? `rows-${rows}` : `rows-${rows}-plus-${r}`;
}
