import { StrictMode, useEffect, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { HttpQAStorage, QA } from "../../../src";
import type { QAStorage } from "../../../src/client/storage";
import type { QACommand } from "../../../src/domain/commands";
import type { QADocument } from "../../../src/domain/model";
import "./example.css";

function Example() {
  const [exampleStorage] = useState(() => new ExampleQAStorage());
  const [quantity, setQuantity] = useState(2);
  const [qaVisible, setQAVisible] = useState(true);
  const parameters = new URLSearchParams(location.search);
  useEffect(() => {
    const fallback = document.getElementById("context-fallback-target");
    if (fallback) fallback.style.display = parameters.has("picker") ? "block" : "none";
  }, [parameters.toString()]);
  return (
    <StrictMode>
      <main className="shop" data-testid="host-layout">
        <nav>
          <strong>Northstar</strong>
          <span>Home</span>
          <span>Shop</span>
          <span>Deals</span>
        </nav>
        <div className="shop-grid">
          <section>
            <p className="eyebrow">Deterministic example</p>
            <h1>Shopping cart</h1>
            <article className="product">
              <div className="product-image" aria-hidden="true">
                Q
              </div>
              <div>
                <strong>Lounge Chair</strong>
                <p>$249.00</p>
              </div>
              <div className="quantity">
                <button onClick={() => setQuantity((value) => Math.max(0, value - 1))}>−</button>
                <span data-testid="quantity-value">{quantity}</span>
                <button onClick={() => setQuantity((value) => value + 1)}>+</button>
              </div>
            </article>
          </section>
          <aside>
            <h2>Summary</h2>
            <p>
              Subtotal <strong>$249.00</strong>
            </p>
            <p>
              Shipping <strong>$19.00</strong>
            </p>
            <hr />
            <p>
              Total <strong>$268.00</strong>
            </p>
            <button className="checkout">Checkout</button>
          </aside>
        </div>
      </main>
      {parameters.has("picker") ? <PickerTargets /> : null}
      {parameters.has("protocol") ? <ProtocolControls storage={exampleStorage} /> : null}
      {parameters.has("layout") ? (
        <button onClick={() => setQAVisible(false)}>Unmount Qraft</button>
      ) : null}
      {import.meta.env.DEV &&
        qaVisible &&
        (parameters.has("protocol") ? <QA storage={exampleStorage} /> : <QA />)}
    </StrictMode>
  );
}

class ExampleQAStorage implements QAStorage {
  readonly #delegate = new HttpQAStorage();
  forceStale = false;
  getDocument(signal?: AbortSignal) {
    return this.#delegate.getDocument(signal);
  }
  subscribe(onChange: () => void) {
    return this.#delegate.subscribe(onChange);
  }
  execute(command: QACommand, baseRevision: string): Promise<QADocument> {
    const revision = this.forceStale ? "0".repeat(64) : baseRevision;
    this.forceStale = false;
    return this.#delegate.execute(command, revision);
  }
}

function ProtocolControls({ storage }: { storage: ExampleQAStorage }) {
  const [message, setMessage] = useState("Example filesystem controls ready.");
  const invoke = async (action: string) => {
    const response = await fetch(`/__qraft-example/${action}`, { method: "POST" });
    const result = (await response.json()) as { message: string };
    setMessage(result.message);
  };
  const failSourceOpen = async () => {
    await invoke("fail-open");
    const originalOpen = window.open;
    window.open = (...args) => {
      window.open = originalOpen;
      throw new Error(`Blocked example popup: ${String(args[0] ?? "")}`);
    };
  };
  return (
    <aside className="protocol-controls" aria-label="M3 example controls">
      <strong>M3 filesystem controls</strong>
      <button onClick={() => void invoke("external-edit")}>External edit</button>
      <button onClick={() => void invoke("delete")}>Delete QA file</button>
      <button onClick={() => void invoke("recreate")}>Recreate QA file</button>
      <button onClick={() => void invoke("fail-next")}>Fail next write</button>
      <button
        onClick={() => {
          storage.forceStale = true;
          setMessage("The next Qraft command will use a stale revision.");
        }}
      >
        Stale next command
      </button>
      <button onClick={() => void failSourceOpen()}>Fail next source open</button>
      <span role="status">{message}</span>
    </aside>
  );
}

function PickerTargets() {
  const shadowHost = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!shadowHost.current || shadowHost.current.shadowRoot) return;
    const shadow = shadowHost.current.attachShadow({ mode: "open" });
    const button = document.createElement("button");
    button.textContent = "Shadow quantity";
    button.dataset.testid = "shadow-quantity";
    shadow.append(button);
  }, []);
  return (
    <aside className="picker-targets" aria-label="Picker compatibility targets">
      <strong>Picker targets</strong>
      <div ref={shadowHost} />
      <iframe
        title="Same-origin picker target"
        srcDoc="<!doctype html><button data-testid='iframe-quantity'>Iframe quantity</button>"
      />
    </aside>
  );
}

const container = document.getElementById("root")!;
const applicationRoot =
  (import.meta.hot?.data.applicationRoot as Root | undefined) ?? createRoot(container);
if (import.meta.hot) import.meta.hot.data.applicationRoot = applicationRoot;
applicationRoot.render(<Example />);
