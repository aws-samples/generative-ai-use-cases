const includeJa = (str: string) => {
  const regexPattern = new RegExp(
    /[\u30a0-\u30ff\u3040-\u309f\u3005-\u3006\u30e0-\u9fcf]+/
  );
  return regexPattern.test(str);
};

export { includeJa };
