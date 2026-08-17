// Country outreach templates for the local-language WhatsApp message.
//
// One fixed message per country, filled from the lead's own data — instead of a
// freshly invented text per lead. Editing a lead's message and pressing SET
// saves the edit back as that country's template (the lead's own values are
// turned back into placeholders first), so every later lead from that country
// inherits the wording with its own name, rating and reviews.

export const PLACEHOLDERS = ["{name}", "{rating}", "{reviews}", "{category}", "{city}"] as const;

/** Defaults. Sumit's own Spain text is the reference; the others mirror it. */
export const DEFAULT_TEMPLATES: Record<string, string> = {
  Spain: `¡Hola, equipo de {name}! 👋 Soy Sumit, Software Developer.

He visto vuestro {category} y vuestra increíble valoración de {rating}⭐ con {reviews} reseñas. ✨ Me encanta el concepto de {name}.

He notado que aún no tenéis una página web. Puedo crear una web moderna y elegante para mostrar vuestro {category}, vuestro menú y vuestro ambiente, y ayudar a que más personas os encuentren y contacten con vosotros.

Precio: 20 € — pago único, después de entregar la web.

También os he adjuntado una demo para que podáis ver cómo podría quedar. 😊`,

  Mexico: `¡Hola, equipo de {name}! 👋 Soy Sumit, Software Developer.

Vi su {category} y su excelente calificación de {rating}⭐ con {reviews} reseñas. 📸 Noté que todavía no cuentan con una página web.

Puedo crearles una página web profesional para mostrar sus servicios de {category} y ayudar a que más personas los encuentren y se pongan en contacto con ustedes.

Precio: MX$450 — pago único, pagar después de que la página web sea entregada.

También les adjunto una demo para que puedan ver cómo podría quedar. 😊`,

  Brazil: `Olá, equipe da {name}! 👋 Sou Sumit, Software Developer.

Vi a {name} e percebi que vocês ainda não têm um site. Posso criar um site profissional para mostrar os serviços de {category}, o atendimento e o contato, ajudando mais pessoas a encontrarem e entrarem em contato com vocês.

Preço: R$ 99 — pagamento único, pagar depois que o site for entregue.

Também anexei uma demonstração para você ver como poderia ficar. 😊`,

  "United States": `Hi {name} team! 👋 I'm Sumit, a Software Developer.

I came across your business and noticed you have a strong presence on social media but don't have an official website yet. I can create a professional website to showcase your equipment, products, and services, helping more {city} customers find and contact you online.

Price: $30 — one-time payment, pay after the website is delivered.

I've also attached a demo for you so you can see how it could look. 😊`,

  India: `Hi {name} team! 👋 I'm Sumit, a Software Developer.

I came across your {category} and was really impressed by your {rating}⭐ rating with {reviews} reviews. 💪 I noticed you don't have a website yet.

I can create a modern website to showcase your {category}, your services, your offers and your reviews, and help more people discover and contact you.

Price: ₹799 — one-time payment, pay after the website is delivered.

I've also attached a demo for you so you can see how it could look. 😊`,
};

export type TemplateLead = {
  name: string;
  rating: number | null;
  reviewCount: number | null;
  category: string | null;
  types: string[] | null;
  city: string | null;
  country: string | null;
};

function values(lead: TemplateLead): Record<string, string> {
  const category =
    (lead.category && lead.category !== "any" ? lead.category : null) ??
    lead.types?.find((t) => t && t !== "any") ??
    "business";
  return {
    "{name}": lead.name,
    "{rating}": lead.rating != null ? String(lead.rating) : "",
    "{reviews}": lead.reviewCount != null ? String(lead.reviewCount) : "",
    "{category}": category,
    "{city}": lead.city ?? "",
  };
}

/** Template → the message for this lead. */
export function renderTemplate(tpl: string, lead: TemplateLead): string {
  let out = tpl;
  for (const [token, v] of Object.entries(values(lead))) {
    out = out.split(token).join(v);
  }
  // A lead with no rating/reviews would leave "⭐ con  reseñas" — drop those
  // sentences' leftovers rather than shipping blanks.
  return out.replace(/[ \t]{2,}/g, " ");
}

/**
 * An edited message → a template: this lead's values become placeholders again,
 * so the wording and the price carry over to the country while every other lead
 * still gets its own name, rating, reviews and category.
 *
 * When the edit started from an existing template we know exactly WHICH
 * occurrence of a value came from a placeholder, so a literal that happens to
 * equal one of them is left alone: Spain's "Precio: 20 €" survives even for a
 * lead with 20 reviews. Without a template (AI-written base) we fall back to
 * replacing the name everywhere and the first occurrence of each other value.
 */
export function templatize(text: string, lead: TemplateLead, fromTemplate?: string | null): string {
  const vals = Object.entries(values(lead)).filter(([, v]) => v.length >= 2);
  if (!fromTemplate) {
    let out = text;
    const byLength = [...vals].sort((a, b) => b[1].length - a[1].length);
    for (const [token, v] of byLength) {
      out = token === "{name}" ? out.split(v).join(token) : replaceNth(out, v, 1, token);
    }
    return out;
  }

  // Walk the template, tracking for each placeholder which occurrence of its
  // value it produces in the rendered text; then swap that same occurrence in
  // the edited text back to the placeholder.
  const map = new Map<string, string>(vals);
  const targets: { token: string; value: string; nth: number }[] = [];
  let rendered = "";
  let i = 0;
  while (i < fromTemplate.length) {
    const token = vals.map(([t]) => t).find((t) => fromTemplate.startsWith(t, i));
    if (token) {
      const v = map.get(token)!;
      targets.push({ token, value: v, nth: countOccurrences(rendered, v) + 1 });
      rendered += v;
      i += token.length;
    } else {
      rendered += fromTemplate[i];
      i += 1;
    }
  }

  // Later occurrences first: replacing an early one shifts nothing that way.
  let out = text;
  for (const t of [...targets].sort((a, b) => b.nth - a.nth)) {
    out = replaceNth(out, t.value, t.nth, t.token);
  }
  return out;
}

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  let n = 0;
  let from = 0;
  for (;;) {
    const at = haystack.indexOf(needle, from);
    if (at === -1) return n;
    n += 1;
    from = at + needle.length;
  }
}

/** Replace the nth (1-based) occurrence of `needle`; a no-op if it isn't there. */
function replaceNth(haystack: string, needle: string, nth: number, replacement: string): string {
  if (!needle) return haystack;
  let from = 0;
  for (let seen = 0; ; seen++) {
    const at = haystack.indexOf(needle, from);
    if (at === -1) return haystack;
    if (seen + 1 === nth) {
      return haystack.slice(0, at) + replacement + haystack.slice(at + needle.length);
    }
    from = at + needle.length;
  }
}

/** The template for a country, or null when that country has none. */
export function templateFor(
  templates: Record<string, string>,
  country: string | null | undefined,
): string | null {
  if (!country) return null;
  return templates[country] ?? DEFAULT_TEMPLATES[country] ?? null;
}
