// Self-check for the country message templates.
//   node --experimental-strip-types scripts/check-messages.mjs
// Guards the one thing that must never break: editing one lead's message and
// pressing SET keeps the WORDING for the country but never freezes that lead's
// name, rating, reviews or category into everyone else's message.

import assert from "node:assert/strict";
import {
  DEFAULT_OPENERS,
  DEFAULT_TEMPLATES,
  renderTemplate,
  templateFor,
  templatize,
} from "../src/lib/messages.ts";

const gym = {
  name: "Steel Fitness Studio",
  rating: 4.9,
  reviewCount: 300,
  category: "gym",
  types: ["gym"],
  city: "Noida",
  country: "India",
};
const salon = {
  name: "A-looks Unisex Salon",
  rating: 4.7,
  reviewCount: 366,
  category: "salon",
  types: ["salon"],
  city: "Noida",
  country: "India",
};
// A Spanish lead whose review count equals the price in the template ("20 €").
const cafe20 = {
  name: "SIP LAB",
  rating: 4.9,
  reviewCount: 20,
  category: "café",
  types: ["cafe"],
  city: "Valencia",
  country: "Spain",
};

// 1. rendering puts each lead's own details in
const gymMsg = renderTemplate(DEFAULT_TEMPLATES.India, gym);
assert.ok(gymMsg.includes("Steel Fitness Studio"), "name");
assert.ok(gymMsg.includes("4.9⭐"), "rating");
assert.ok(gymMsg.includes("300 reviews"), "reviews");
assert.ok(gymMsg.includes("your gym"), "category");
assert.ok(!gymMsg.includes("{"), "no leftover placeholders");

// 2. SET after a price edit: the new price reaches the next lead, its own
//    details do NOT get replaced by the edited lead's.
const edited = gymMsg.replace("₹799", "₹999");
const tpl = templatize(edited, gym, DEFAULT_TEMPLATES.India);
const salonMsg = renderTemplate(tpl, salon);
assert.ok(salonMsg.includes("₹999"), "edited price carries over");
assert.ok(salonMsg.includes("A-looks Unisex Salon"), "next lead keeps its name");
assert.ok(!salonMsg.includes("Steel Fitness Studio"), "no name bleed");
assert.ok(salonMsg.includes("4.7⭐") && salonMsg.includes("366 reviews"), "own rating/reviews");
assert.ok(salonMsg.includes("your salon"), "own category");

// 3. the collision case: "20 €" is a literal, 20 is also this lead's review
//    count — the price must survive templatizing.
const spainMsg = renderTemplate(DEFAULT_TEMPLATES.Spain, cafe20);
assert.ok(spainMsg.includes("Precio: 20 €"), "price rendered");
const spainTpl = templatize(spainMsg, cafe20, DEFAULT_TEMPLATES.Spain);
assert.ok(spainTpl.includes("Precio: 20 €"), "price NOT turned into a placeholder");
assert.ok(spainTpl.includes("{reviews}"), "reviews still a placeholder");
const other = renderTemplate(spainTpl, { ...cafe20, name: "Bar Pepe", reviewCount: 88 });
assert.ok(other.includes("88 reseñas") && other.includes("Precio: 20 €"), "next Spanish lead");
assert.ok(!other.includes("SIP LAB"), "no name bleed (es)");

// 4. free-text edit with no starting template (AI-written base)
const naive = templatize("Hi Steel Fitness Studio, your 4.9 rating is great!", gym, null);
assert.ok(naive.includes("{name}") && naive.includes("{rating}"), "naive fallback");

// 5. overrides win over the built-in defaults
assert.equal(templateFor({ India: "custom" }, "India"), "custom");
assert.equal(templateFor({}, "India"), DEFAULT_TEMPLATES.India);
assert.equal(templateFor({}, "Nowhere"), null);

// 6. the openers are a second set of country templates: same placeholders, same
//    SET behaviour, and short enough to stay a first touch (no price, no demo).
const openerMsg = renderTemplate(DEFAULT_OPENERS.India, gym);
assert.ok(openerMsg.includes("Steel Fitness Studio") && openerMsg.includes("your gym"), "opener filled");
assert.ok(!openerMsg.includes("{"), "no leftover placeholders (opener)");
for (const [country, text] of Object.entries(DEFAULT_OPENERS)) {
  assert.ok(text.length < 260, `${country} opener stays short`);
  assert.ok(!/[₹$€]|R\$|MX\$/.test(text), `${country} opener carries no price`);
  assert.ok(text.trim().endsWith("?"), `${country} opener ends in a question`);
}
// the opener set is separate from the pitch set — SET on one must not touch the other
assert.equal(templateFor({ India: "custom opener" }, "India", DEFAULT_OPENERS), "custom opener");
assert.equal(templateFor({}, "India", DEFAULT_OPENERS), DEFAULT_OPENERS.India);
assert.notEqual(DEFAULT_OPENERS.India, DEFAULT_TEMPLATES.India);

console.log("messages: all checks passed");
