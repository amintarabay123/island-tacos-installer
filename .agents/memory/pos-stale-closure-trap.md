---
name: POS stale-closure trap
description: Cart mutators reachable from memoized children must use functional setState, or they silently wipe state.
---

`ItemCard` in `artifacts/island-tacos/src/pages/pos.tsx` is wrapped in `React.memo` with a comparator that intentionally ignores `onClick` identity (the parent recreates `onClick={() => addItem(item)}` inline every render, and re-running memo every time defeats the performance fix). That means the memoized child keeps an OLD `onClick` closure — which closes over whatever `cart` was the last time the comparator let a render through.

**Rule:** any cart mutator reachable from a memoized component MUST use the functional form: `setCart(prev => …)`. Never read `cart` from the enclosing closure and pass it to `setCart`. The symptom of getting this wrong is "the new item replaces everything in the cart" — `setCart([...cart, newItem])` with a stale `cart=[]` produces `[newItem]`.

**Why:** seen 2026-05-25. Resuming a held ticket then tapping a menu item wiped the resumed lines because `pushToCart` did `setCart([...cart, newItem])` and the memoized ItemCard's onClick captured a `cart` snapshot from before the resume. The functional form sidesteps the closure entirely.

**How to apply:** if you add a new cart mutator, or wrap any cart-displaying component in `memo`, audit every mutator path for `setCart(cart.…)` / `setCart([...cart, …])` and convert to `setCart(prev => …)`. The same applies if any other piece of state is later memoized — `setX(prev => …)` is the default for anything that derives from the previous value.
