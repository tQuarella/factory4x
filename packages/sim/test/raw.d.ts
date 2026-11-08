/** Vite's `?raw` import (the text of a file), used by data.test.ts to read DESIGN.md without Node APIs. */
declare module '*?raw' {
  const text: string;
  export default text;
}
