export function validateNewPassword(password: string, confirmation: string): string | null {
  if (password.length < 6) return "New password must be at least 6 characters";
  if (password !== confirmation) return "Passwords do not match";
  return null;
}