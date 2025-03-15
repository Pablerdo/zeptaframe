
export const precisionReplacer = (key: string, value: any) => {
  if ((key === 'scaleX' || key === 'scaleY') && typeof value === 'number') {
    return value.toString();
  }
  return value;
};

export const precisionReviver = (key: string, value: any) => {
  if ((key === 'scaleX' || key === 'scaleY') && typeof value === 'string') {
    return parseFloat(value);
  }
  return value;
};