export function parseFbDate(dateText: string): Date | null {
    const now = new Date();
    const [numStr, unit] = dateText.split(' ').slice(0, 2);
    const num = parseInt(numStr);
  
    try {
      if (/ago/i.test(dateText)) {
        if (unit.startsWith('hr')) return new Date(now.getTime() - num * 60 * 60 * 1000);
        if (unit.startsWith('min')) return new Date(now.getTime() - num * 60 * 1000);
        if (unit.startsWith('day')) return new Date(now.getTime() - num * 24 * 60 * 60 * 1000);
      }
  
      if (/Yesterday/i.test(dateText)) {
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
      }
  
      const parsed = new Date(dateText);
      return isNaN(parsed.getTime()) ? null : parsed;
    } catch {
      return null;
    }
  }
  