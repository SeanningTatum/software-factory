export const writeLine = (level: string, line: Record<string, unknown>) => {
  const text = JSON.stringify(line);
  if (level === "Error" || level === "Fatal") console.error(text);
  else if (level === "Warn") console.warn(text);
  else console.log(text);
};
