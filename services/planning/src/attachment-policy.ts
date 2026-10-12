export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

export function safeAttachmentFilename(
  value: unknown,
  contentTypes: Readonly<Record<string, string>>,
): string | null {
  if (typeof value !== "string") return null;
  const base = value.trim().split(/[/\\]/).pop() ?? "";
  const hasControlCharacter = [...base].some((character) => character.charCodeAt(0) <= 0x1f);
  if (!base || base.length > 200 || hasControlCharacter) return null;
  const lower = base.toLowerCase();
  return Object.keys(contentTypes).some((extension) => lower.endsWith(extension)) ? base : null;
}

export function attachmentContentType(
  filename: string,
  contentTypes: Readonly<Record<string, string>>,
): string {
  const lower = filename.toLowerCase();
  const extension = Object.keys(contentTypes).find((candidate) => lower.endsWith(candidate));
  return extension ? contentTypes[extension] : "application/octet-stream";
}
