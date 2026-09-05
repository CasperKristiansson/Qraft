# Checkout QA

## Cart <!-- qraft:id=section_11111111-1111-4111-8111-111111111111 -->

- [X] Change quantity <!-- qraft:id=task_22222222-2222-4222-8222-222222222222 -->
  - Note: Preserve a useful note. <!-- qraft:id=note_33333333-3333-4333-8333-333333333333 -->
  - [ ] Alignment jumps. <!-- qraft:id=finding_44444444-4444-4444-8444-444444444444 -->
    - Component: `QuantitySelector`
    - Source: `src/QuantitySelector.tsx:87:5`
    - Route: `/checkout?ignored=yes`
    - Selector: `.cart .quantity`
