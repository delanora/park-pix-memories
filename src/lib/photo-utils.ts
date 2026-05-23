// Client-safe shared utilities for the photo app.

export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

/** Birthdate (YYYY-MM-DD) → DDMMYYYY string used as Auth password */
export function birthdateToPassword(birthdate: string): string {
  // Expect ISO yyyy-mm-dd
  const [y, m, d] = birthdate.split("-");
  if (!y || !m || !d) throw new Error("Data de nascimento inválida");
  return `${d}${m}${y}`;
}

export function phoneToEmail(phone: string): string {
  return `phone_${normalizePhone(phone)}@parque.local`;
}

export function formatPriceBRL(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}
