const url = process.argv[2] || 'https://coc.guide/troop/balloon';

function normalizeCellText(input) {
    const withImageLabels = String(input || '').replace(/<img\b[^>]*>/gi, (tag) => {
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

function parseThClass(cls) {
    const m = cls.match(/th-(\d+)/);
    return m ? Number.parseInt(m[1], 10) : null;
}

function parseNumeric(value) {
    const match = String(value || '').match(/-?\d[\d,]*/);
    return match ? Number.parseInt(match[0].replace(/,/g, ''), 10) : 0;
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
            className: classMatch?.[1] ?? '',
        });
    }

    return cells;
}

async function main() {
    const response = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
    });
    const html = await response.text();

    const tableMatches = [...html.matchAll(/<table[^>]*>([\s\S]*?)<\/table>/g)].map((match) => match[1]);
    const statTableMatch = tableMatches.find((tableHtml) => {
        const source = tableHtml.match(/<thead>([\s\S]*?)<\/thead>/i)?.[1] ?? tableHtml;
        const headers = [...source.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)]
            .map((match) => normalizeCellText(match[1]))
            .filter(Boolean);

        return headers.some((header) => /^level$/i.test(header))
            && headers.some((header) => /damage|health|hitpoints|hp|elixir|xp|laboratory/i.test(header));
    });

    const infoTableMatch = html.match(/class="info-table"[\s\S]*?<\/table>/i);

    console.log('URL:', url);
    console.log('info-table present:', !!infoTableMatch);
    console.log('tables found:', tableMatches.length);

    if (infoTableMatch) {
        const source = infoTableMatch[0].match(/<thead>([\s\S]*?)<\/thead>/i)?.[1] ?? infoTableMatch[0];
        const infoHeaders = [...source.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)]
            .map((match) => normalizeCellText(match[1]))
            .filter(Boolean);
        const infoRows = [...infoTableMatch[0].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)]
            .map((match) => match[1])
            .filter((row) => !/<th/i.test(row));
        console.log('\nINFO TABLE HEADERS:');
        console.log(JSON.stringify(infoHeaders));
        console.log('\nINFO TABLE ROWS:');
        infoRows.forEach((row, idx) => {
            const cells = extractTableCells(row).map((cell) => cell.text);
            console.log(idx, JSON.stringify(cells));
        });
    }

    console.log('\nLEVEL PARSE TEST:');
    const levels = [];
    if (statTableMatch) {
        const source = statTableMatch.match(/<thead>([\s\S]*?)<\/thead>/i)?.[1] ?? statTableMatch;
        const headers = [...source.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)]
            .map((match) => normalizeCellText(match[1]))
            .filter(Boolean);
        const rows = [...statTableMatch.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)]
            .map((match) => match[1])
            .filter((row) => !/<th/i.test(row));

        const levelIndex = headers.findIndex((header) => /level/i.test(header));
        const dpsIndex = headers.findIndex((header) => /damage per second/i.test(header));
        const damagePerHitIndex = headers.findIndex((header) => /damage per hit/i.test(header));
        const hitpointsIndex = headers.findIndex((header) => /hitpoints/i.test(header));
        const upgradeCostIndex = headers.findIndex((header) => /elixir|upgrade/i.test(header));
        const upgradeTimeIndex = headers.findIndex((header) => /clock|time/i.test(header));
        const xpIndex = headers.findIndex((header) => /xp/i.test(header));
        const labIndex = headers.findIndex((header) => /laboratory/i.test(header));

        rows.forEach((row) => {
            const cells = extractTableCells(row).map((cell) => cell.text);
            if (!cells.length) return;

            const level = parseNumeric(cells[levelIndex >= 0 ? levelIndex : 0]);
            if (!level) return;

            levels.push({
                level,
                dps: parseNumeric(cells[dpsIndex >= 0 ? dpsIndex : 1]),
                damagePerHit: parseNumeric(cells[damagePerHitIndex >= 0 ? damagePerHitIndex : 2]),
                hitpoints: parseNumeric(cells[hitpointsIndex >= 0 ? hitpointsIndex : 4]),
                upgradeCost: cells[upgradeCostIndex >= 0 ? upgradeCostIndex : 5] || '',
                upgradeTime: cells[upgradeTimeIndex >= 0 ? upgradeTimeIndex : 6] || '',
                xp: parseNumeric(cells[xpIndex >= 0 ? xpIndex : 7]),
                labLevel: parseNumeric(cells[labIndex >= 0 ? labIndex : 8]) || null,
                thRequired: parseThClass(cells[labIndex >= 0 ? labIndex : 8] || ''),
            });
        });
    }

    console.log('parsed levels count:', levels.length);
    console.log(JSON.stringify(levels.slice(0, 3), null, 2));
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
