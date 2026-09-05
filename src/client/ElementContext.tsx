import type { ElementReference } from "../domain/model";

export function ElementContext({ element }: { element: ElementReference }) {
  return (
    <>
      <strong>{element.component ?? element.context?.tag ?? "Selected element"}</strong>
      {element.source ? (
        <code>
          {element.source}
          {element.line ? `:${element.line}` : ""}
          {element.column ? `:${element.column}` : ""}
        </code>
      ) : (
        <small>Source unavailable; use the identifying context below.</small>
      )}
      <details>
        <summary>Element context</summary>
        <dl>
          {element.route ? (
            <>
              <dt>Route</dt>
              <dd>{element.route}</dd>
            </>
          ) : null}
          {element.selector ? (
            <>
              <dt>Selector</dt>
              <dd>
                <code>{element.selector}</code>
              </dd>
            </>
          ) : null}
          {element.context ? (
            <>
              <dt>Tag</dt>
              <dd>{element.context.tag}</dd>
              <dt>Attributes</dt>
              <dd>
                <code>{JSON.stringify(element.context.attributes)}</code>
              </dd>
              {element.context.text ? (
                <>
                  <dt>Text</dt>
                  <dd>{element.context.text}</dd>
                </>
              ) : null}
              <dt>Ancestors</dt>
              <dd>
                <code>{element.context.ancestors.join(" → ")}</code>
              </dd>
              {element.context.sourceTrail?.length ? (
                <>
                  <dt>Source trail</dt>
                  <dd>
                    <ol>
                      {element.context.sourceTrail.map((frame, index) => (
                        <li key={index}>
                          {frame.component ? <strong>{frame.component}</strong> : null}
                          <code>
                            {frame.source}
                            {frame.line ? `:${frame.line}` : ""}
                            {frame.column ? `:${frame.column}` : ""}
                          </code>
                        </li>
                      ))}
                    </ol>
                  </dd>
                </>
              ) : null}
            </>
          ) : null}
        </dl>
      </details>
    </>
  );
}
