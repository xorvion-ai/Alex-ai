// Self-check for the country message templates.
//   node --experimental-strip-types scripts/check-messages.mjs
// Guards the one thing that must never break: editing one lead's message and
// pressing SET keeps the WORDING for the country but never freezes that lead's
// name, rating, reviews or category into everyone else's message.

import assert from "node:assert/strict";
import {
  DEFAULT_TEMPLATES,
  friendlyName,
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

// 6. the Portugal bug: a lead called "Casa do Fumo, Unipessoal Lda." had its
//    message edited to the short "Casa do Fumo" before SET. SET looked only for
//    the full legal name, missed it, and saved "Casa do Fumo" into the country
//    template — so every Portuguese lead was greeted as Casa do Fumo.
assert.equal(friendlyName("Casa do Fumo, Unipessoal Lda."), "Casa do Fumo");
assert.equal(friendlyName("Pastelería Madrid S.A. de C.V."), "Pastelería Madrid");
assert.equal(friendlyName("Aroma de Mel - Papelaria, Unipessoal Lda"), "Aroma de Mel - Papelaria");
assert.equal(friendlyName("Santos & Filhas Lda"), "Santos & Filhas");
assert.equal(friendlyName("Flores de Maria"), "Flores de Maria", "a real 'de' is kept");
assert.equal(friendlyName("Kids"), "Kids");

const fumo = { name: "Casa do Fumo, Unipessoal Lda.", rating: null, reviewCount: null, category: "gift shop", types: [], city: "Lisboa", country: "Portugal" };
const crisalia = { ...fumo, name: "Papelaria Crisália" };
const ptBase = "Olá, equipa da {name}! 👋 Sou o Sumit.\n\nPreço: 70 € — pagamento único.";
// edited with the SHORT name, exactly as it happened
const ptEdited = "Olá, equipa da Casa do Fumo! 👋 Sou o Sumit.\n\nPreço: 70 € — pagamento único.";
const ptTpl = templatize(ptEdited, fumo, ptBase);
assert.ok(ptTpl.includes("{name}"), "the short name became {name}");
assert.ok(!ptTpl.includes("Casa do Fumo"), "no business name left in the template");
assert.ok(renderTemplate(ptTpl, crisalia).includes("equipa da Papelaria Crisália"), "the next lead gets its own name");
// and with the FULL name, it still works
assert.ok(!templatize(ptEdited.replace("Casa do Fumo", fumo.name), fumo, ptBase).includes("Casa do Fumo"));
// the greeting uses the friendly name, not the legal one
assert.ok(renderTemplate(ptBase, fumo).includes("equipa da Casa do Fumo!"), "rendered without 'Unipessoal Lda.'");

console.log("messages: all checks passed");
