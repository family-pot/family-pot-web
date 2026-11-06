import { isCountryCode } from "./countries";

export const NAME_MAX_LENGTH = 100;
export const NOTES_MAX_LENGTH = 500;

/**
 * Validates recipient fields and returns field-keyed messages (empty when
 * valid). Shared by the form (client validation) and the data sources, so the
 * UI and the data layer report the same errors.
 */
export function validateRecipientInput(input: {
  name?: string;
  country?: string;
  notes?: string;
}): Record<string, string> {
  const errors: Record<string, string> = {};

  const name = input.name?.trim() ?? "";
  if (name === "") {
    errors.name = "Name is required.";
  } else if (name.length > NAME_MAX_LENGTH) {
    errors.name = `Name must be at most ${NAME_MAX_LENGTH} characters.`;
  }

  if (!input.country) {
    errors.country = "Select a country.";
  } else if (!isCountryCode(input.country)) {
    errors.country = "Select a valid country.";
  }

  if ((input.notes?.length ?? 0) > NOTES_MAX_LENGTH) {
    errors.notes = `Notes must be at most ${NOTES_MAX_LENGTH} characters.`;
  }

  return errors;
}
