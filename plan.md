1. **Issue 1: Tracking Card Still Clipped**
   - In `style.css`, `.app-bar` has `padding-top: var(--safe-top);` and `height: var(--app-bar-h);`. If it does not have `box-sizing: content-box`, its total height will be `var(--app-bar-h) + var(--safe-top)`. No, actually if `box-sizing: border-box`, `padding-top` shrinks the content height. Wait! `box-sizing: border-box` is probably set. If it's `border-box`, height is just `var(--app-bar-h)`. If height is `60px`, `padding-top: 40px`, content height is `20px`. The height doesn't expand.
   - However, if the height *does* expand (because `box-sizing: content-box` is active for `.app-bar`), its total height is `60px + var(--safe-top)`.
   - Let's check `style.css` for `box-sizing`: it's likely `border-box`. But if the tracking card is still clipped, it's probably missing `var(--safe-top)` in its `margin-top`.
   - I will change `#trackOrderBanner`'s `margin-top` in both `style.css` and `mobile-fixes.css` to add `var(--safe-top)` or `env(safe-area-inset-top)`.
     `style.css`: `margin: calc(var(--app-bar-h) + var(--safe-top) + 0.5rem) 1rem 0.5rem;`
     `mobile-fixes.css`: `margin: calc(var(--app-bar-h) + var(--safe-top) + 0.75rem) 1rem 0.75rem;`
     Also for max-width breakpoints.
   - Furthermore, `scrollToTrackBanner` does: `navH = document.querySelector("nav")?.offsetHeight || 65`. Wait, `.app-bar` is a `<header>`, not `<nav>`! Ah! `<header class="app-bar" role="banner">`. `document.querySelector("nav")` will find the `<nav class="bottom-nav">` or `null`! The `offsetHeight` of `bottom-nav` might be `68px`.
   - Actually, wait. It should be subtracting the HEADER height!
     `const headerH = document.querySelector(".app-bar")?.offsetHeight || 65;`
     `window.scrollTo({ top: banner.getBoundingClientRect().top + window.scrollY - headerH - 8, behavior: "smooth" });`
     This `scrollTo` bug is likely why it's clipped after scrolling!

2. **Issue 2: Booking Bottom Sheet Closes While Scrolling**
   - In `index.html` (approx line 1421), remove the `touchstart`/`touchend` listeners on `sheet` that call `closeBookingSheet()`.

3. **Issue 3: Book Now Button Expands**
   - In `style.css` (approx line 616), remove `transform: translateY(-1px);` from `.offer-btn:hover`.
   - In `mobile-fixes.css`, look for any active state scaling for `.offer-btn` (none found).

4. **Issue 4: Time Slot Buttons Expand**
   - In `mobile-fixes.css` (approx line 815), remove `.time-slot-btn:active { transform: scale(0.97); }` or set it to `transform: none;`. Same for `:hover` if any.

5. **Issue 5: Continue Button Expands**
   - In `style.css` (approx line 1049), remove `transform: translateY(-1px);` from `.btn-next:hover`.

6. **Issue 6: Add Helper Option**
   - In `index.html`, I will MOVE the `<div class="field-group" id="helperCardGroup">` block from Step 2 to Step 4, immediately above `<div class="field-group"> <label class="field-label"><span class="field-icon">🏷️</span> Promo / Referral Code</label>`.

7. **Issue 7: Hide Furniture Prices**
   - In `script.js` (approx line 408), change:
     `<span class="fc-price-tag" style="${priceColor}">${priceLabel}</span>`
     to
     `<span class="fc-price-tag" style="display: none !important; ${priceColor}">${priceLabel}</span>`
   - In `script.js` (approx line 3306), injected CSS `.fc-price-tag{font-size:.64rem;color:#22c55e;font-weight:600;}` will be changed to add `display:none!important;`.
