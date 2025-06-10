    export function parseFbDate(dateText: string): Date | null {
    try {
        const now = new Date();
        const lower = dateText.toLowerCase();

        if (lower.includes('ago')) {
        const [numStr, unit] = dateText.split(' ').slice(0, 2);
        const num = parseInt(numStr);

        if (unit.startsWith('hr')) return new Date(now.getTime() - num * 3600000);
        if (unit.startsWith('min')) return new Date(now.getTime() - num * 60000);
        if (unit.startsWith('day')) return new Date(now.getTime() - num * 86400000);
        }

        if (lower.includes('yesterday')) {
        return new Date(now.getTime() - 86400000);
        }

        const parsed = new Date(dateText);
        return isNaN(parsed.getTime()) ? null : parsed;
    } catch {
        return null;
    }
}