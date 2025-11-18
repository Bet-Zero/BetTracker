import { BetResult } from '../types';

// This is the shape of the object after parsing and cleaning a row from the CSV
export interface ParsedCsvRow {
    date: string;
    site: string;
    sport: string;
    category?: string;
    type: string;
    name: string;
    over?: string; // Binary flag: "1" for Over, "0" for not Over
    under?: string; // Binary flag: "1" for Under, "0" for not Under
    line?: string;
    odds: number;
    bet: number;
    toWin: number;
    result: BetResult;
    net?: string;
    live?: string; // Binary flag: "1" for live bet, "0" or empty for not live
    tail?: string; // Binary flag: "1" if tailed, "0" or empty if not tailed
}

// This interface is a direct mapping of the expected CSV headers.
interface CsvRow {
  Date: string;
  Site: string;
  Sport: string;
  Category: string;
  Type: string;
  Name: string;
  Over: string; // Binary flag: "1" for Over, "0" for not Over
  Under: string; // Binary flag: "1" for Under, "0" for not Under
  Line: string;
  Odds: string;
  Bet: string;
  'To Win': string;
  Result: string;
  Net: string;
  Live: string; // Binary flag: "1" for live bet, "0" or empty for not live
  Tail: string; // Binary flag: "1" if tailed, "0" or empty if not tailed
}

export const parseCsv = (csvString: string): ParsedCsvRow[] => {
    const lines = csvString.replace(/\r/g, '').split('\n').filter(line => line.trim() !== '');
    if (lines.length < 2) {
        throw new Error("CSV must have a header row and at least one data row.");
    }

    const parseLine = (line: string): string[] => {
        const result: string[] = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                if (inQuotes && line[i + 1] === '"') {
                    current += '"';
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (char === ',' && !inQuotes) {
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        result.push(current.trim());
        return result;
    };

    const header = parseLine(lines[0]);
    const requiredHeaders = ['Date', 'Site', 'Sport', 'Category', 'Type', 'Name', 'Odds', 'Bet', 'To Win', 'Result'];
    const missingHeaders = requiredHeaders.filter(h => !header.includes(h));

    // Allow for flexibility if some optional columns are missing, but error on required ones.
    if (missingHeaders.length > 0) {
        throw new Error(`CSV is missing required headers: ${missingHeaders.join(', ')}. Please check the instructions.`);
    }

    const rows = lines.slice(1);

    const data = rows.map((rowString, rowIndex) => {
        const values = parseLine(rowString);
        const rowObject = header.reduce((obj, key, index) => {
            obj[key as keyof CsvRow] = values[index];
            return obj;
        }, {} as Partial<CsvRow>);

        const cleanString = (str: string | undefined) => (str || '').trim();

        const resultStr = cleanString(rowObject.Result).toLowerCase();
        let result: BetResult;
        if (resultStr.startsWith('won')) result = 'win';
        else if (resultStr.startsWith('lost')) result = 'loss';
        else if (resultStr.startsWith('push')) result = 'push';
        else result = 'pending';

        const parsedRow: ParsedCsvRow = {
            date: cleanString(rowObject.Date),
            site: cleanString(rowObject.Site),
            sport: cleanString(rowObject.Sport),
            category: cleanString(rowObject.Category) || undefined,
            type: cleanString(rowObject.Type),
            name: cleanString(rowObject.Name),
            over: cleanString(rowObject.Over) || undefined,
            under: cleanString(rowObject.Under) || undefined,
            line: cleanString(rowObject.Line),
            odds: parseFloat(cleanString(rowObject.Odds).replace('+', '')),
            bet: parseFloat(cleanString(rowObject.Bet).replace(/[\$,]/g, '')),
            toWin: parseFloat(cleanString(rowObject['To Win']).replace(/[\$,]/g, '')),
            result: result,
            net: cleanString(rowObject.Net) || undefined,
            live: cleanString(rowObject.Live) || undefined,
            tail: cleanString(rowObject.Tail) || undefined,
        };

        // Validate required numeric fields
        const numericErrors = [];
        if (isNaN(parsedRow.odds)) numericErrors.push('Odds');
        if (isNaN(parsedRow.bet)) numericErrors.push('Bet');
        if (isNaN(parsedRow.toWin)) numericErrors.push('To Win');
        if (numericErrors.length > 0) {
            throw new Error(`Row ${rowIndex + 2}: Invalid number format for ${numericErrors.join(', ')}.`);
        }
        
        return parsedRow;
    });

    return data;
};