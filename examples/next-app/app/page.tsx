"use client";

import { useState } from "react";

export default function Page() {
  const [quantity, setQuantity] = useState(2);
  return (
    <main style={{ padding: 48, fontFamily: "system-ui" }}>
      <h1>Next.js review</h1>
      <p>Use Qraft to review this running App Router page.</p>
      <button onClick={() => setQuantity((value) => value + 1)}>Increase quantity</button>
      <p>Quantity: {quantity}</p>
    </main>
  );
}
