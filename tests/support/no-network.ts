const forbidden = (what: string) => () => {
  throw new Error(`Network access is forbidden in tests: ${what}`);
};
globalThis.fetch = forbidden("fetch") as unknown as typeof fetch;
Object.defineProperty(globalThis, "XMLHttpRequest", { value: forbidden("XMLHttpRequest") });
