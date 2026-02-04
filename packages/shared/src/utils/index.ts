// Common utilities shared between web and api
export const formatDate = (date: Date): string => {
  return date.toISOString();
};

export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};
