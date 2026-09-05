import type { QADocument } from "../domain/model";

export const previewDocument: QADocument = {
  title: "Checkout QA",
  revision: "preview",
  diagnostics: [],
  sections: [
    {
      id: "preview-authentication",
      title: "Authentication",
      tasks: [
        { id: "preview-login", title: "Login", checked: true, status: "completed", notes: [] },
        { id: "preview-session", title: "Expired session", checked: false, status: "open", notes: [] },
      ],
    },
    {
      id: "preview-cart",
      title: "Cart",
      tasks: [
        {
          id: "preview-quantity",
          title: "Change quantity",
          checked: false,
          notes: [{ id: "preview-note", body: "Check both keyboard and pointer controls.", element: null }],
          status: "open",
        },
        { id: "preview-remove", title: "Remove product", checked: false, status: "open", notes: [] },
      ],
    },
  ],
};
