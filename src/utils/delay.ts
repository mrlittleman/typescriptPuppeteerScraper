export const randomDelay = async (min: number, max: number) => {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    return new Promise(res => setTimeout(res, delay));
  };
  