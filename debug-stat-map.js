const url = process.argv[2] || 'https://coc.guide/troop/balloon';

function normalizeCellText(input = '') {
    const withImageLabels = String(input).replace(/<img\b[^>]*>/gi, (tag) => {
        const altMatch = tag.match(/alt=["']([^"']*)["']/i);
        const srcMatch = tag.match(/src=["']([^"']+)["']/i);
        const alt = altMatch?.[1]?.trim() || '';
        const src = srcMatch?.[1] || '';

        if (alt) return alt;
        const fileName = src.split('/').pop() || '';
        return fileName.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim();
    });

    return withImageLabels
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/\s+/g, ' ')
        .trim();
}

function extractTableCells(rowHtml) {
    const cells = [];
    const cellRegex = /<t[dh]([^>]*)>([\s\S]*?)<\/t[dh]>/g;
    let cellMatch;
    while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
        const attrs = cellMatch[1] || '';
        const classMatch = attrs.match(/class="([^"]+)"/);
        cells.push({
            text: normalizeCellText(cellMatch[2]),
            className: classMatch?.[1] || '',
        });
    }
    return cells;
}

function getTableHeaders(tableHtml) {
    const source = tableHtml.match(/<thead>([\s\S]*?)<\/thead>/i)?.[1] ?? tableHtml;
    return [...source.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)]
        .map((match) => normalizeCellText(match[1]))
        .filter((header) => header.length > 0);
}

function getBodyRows(tableHtml) {
    return [...tableHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)]
        .map((match) => match[1])
        .filter((row) => !/<th/i.test(row) && /<td/i.test(row));
}

function findStatTable(tableHtmls) {
    const candidates = tableHtmls
        .map((tableHtml) => ({ tableHtml, headers: getTableHeaders(tableHtml), bodyRows: getBodyRows(tableHtml) }))
        .filter(({ headers, bodyRows }) => {
            const hasLevelHeader = headers.some((header) => /^level$/i.test(header));
            const hasStatHeader = headers.some((header) => /damage|health|hitpoints|hp|elixir|xp|laboratory|lab/i.test(header));
            const hasRealBody = bodyRows.length > 1 && bodyRows.some((row) => extractTableCells(row).length >= 6);
            return hasLevelHeader && hasStatHeader && hasRealBody;
        })
        .sort((a, b) => b.bodyRows.length - a.bodyRows.length);

    return candidates[0] ?? null;
}

async function main() {
    const response = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    });
    const html = await response.text();
    const tables = [...html.matchAll(/<table[^>]*>([\s\S]*?)<\/table>/g)].map((match) => match[1]);
    const stat = findStatTable(tables);

    console.log('selected table found:', !!stat);
    if (!stat) return;

    console.log('headers:', JSON.stringify(stat.headers));
    console.log('rows:', stat.bodyRows.length);
    console.log('first row cells:', JSON.stringify(extractTableCells(stat.bodyRows[0])));
    console.log('second row cells:', JSON.stringify(extractTableCells(stat.bodyRows[1])));
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
