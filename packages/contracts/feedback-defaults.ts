export const DEFAULT_FEEDBACK_BLOCKS = [
  { id: "default-title", type: "title", label: "Title", required: true },
  { id: "default-description", type: "description", label: "Description", required: true },
  { id: "default-reporter", type: "reporter", label: "Submitted by", required: true },
  { id: "default-contact-email", type: "contact_email", label: "Contact email (optional)", required: false },
  { id: "default-category", type: "category", label: "Category", required: false },
  { id: "default-element-picker", type: "element_picker", required: false },
  { id: "default-metadata", type: "metadata", required: false },
  { id: "default-console-logs", type: "console_logs", required: false },
] as const;
