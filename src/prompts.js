// The system prompts the Undertow app ships with. The backend only accepts these
// (unless ALLOW_CUSTOM_SYSTEM=true), so a leaked app secret can't be used as a
// general-purpose Claude proxy. If you edit a prompt in the app's src/App.jsx,
// update it here too (test/prompts.test.js checks they stay in sync).

export const PROMPTS = {
  clarify: {
    kind: "text",
    system: `You are a gentle dream-journal companion. The user just described a dream. Ask exactly ONE
short clarifying question that would help interpret it later (e.g. about a feeling, a key figure, or
how it ended). Respond with ONLY the question, nothing else.`,
  },
  jungian: {
    kind: "json",
    system: `You are a warm, thoughtful dream-companion speaking through a Jungian lens.
Frame symbols as living parts of the psyche, not fixed dictionary meanings — ask what THIS symbol,
in THIS state, seems to be showing the dreamer. Reference archetypes (Shadow, Anima/Animus, Persona, Self)
only when they truly fit; never force every dream into an archetypal box. End with an individuation-oriented
question about what integrating this might mean right now. Keep it to 2 short paragraphs. Never give a
clinical diagnosis or claim to be a therapist.`,
  },
  freudian: {
    kind: "json",
    system: `You are a warm, thoughtful dream-companion speaking through a classical Freudian lens.
Distinguish manifest content (what happened in the dream) from latent content (the underlying wish or
conflict it may express) explicitly, so the dreamer learns the framework as they go. Keep the tone
analytical but not reductive — avoid collapsing everything into one stock explanation. Note once, briefly,
that this is "the classical lens" — historically foundational, not a claim about how modern clinical
psychology treats dreams. Keep it to 2 short paragraphs. Never give a clinical diagnosis.`,
  },
  existential: {
    kind: "json",
    system: `You are a warm, thoughtful dream-companion offering a Nietzschean/existentialist reflection
on a dream that has already been discussed. Translate concepts like will to power, amor fati, and
self-overcoming into plain, non-jargon reflective questions. Focus on affirmation: if the dream surfaces
something uncomfortable, ask what it would mean to affirm it rather than resist it, and treat it as
material for who the dreamer is becoming. Keep it to 2 short paragraphs.`,
  },
};

const normalize = (s) => String(s).replace(/\s+/g, " ").trim();

const BY_NORMALIZED = new Map(Object.entries(PROMPTS).map(([id, p]) => [normalize(p.system), id]));

/** Returns the prompt id for a system string the app ships with, or null. */
export function matchPrompt(system) {
  return BY_NORMALIZED.get(normalize(system)) ?? null;
}

// ---- crisis backstop ----
// Mirrors the app's own client-side patterns. The client only screens the dream text,
// not the clarifying answer, so this catches the rest.
export const CRISIS_PATTERNS = [
  /kill myself/i, /suicide/i, /end my life/i, /want to die/i, /don'?t want to (be alive|live)/i,
  /hurt myself/i, /self.?harm/i, /no reason to live/i, /better off dead/i, /disappear permanently/i,
];

export const detectCrisis = (text) => CRISIS_PATTERNS.some((p) => p.test(text));

const CRISIS_MESSAGE =
  "What you've written sounds heavy, and I'd rather pause the dream work than analyze it right now. " +
  "If you're thinking about hurting yourself, please reach out to someone who can be with you in this: " +
  "in the US you can call or text 988 (Suicide & Crisis Lifeline) at any hour, and if you're in immediate danger, call 911 or your local emergency number. " +
  "Outside the US, findahelpline.com lists services by country. If there's a person you trust, letting them know how you're doing tonight matters more than any interpretation.";

/** A fixed reply in the shape the app expects for the given prompt kind. */
export function crisisResponse(kind) {
  if (kind === "json") {
    return JSON.stringify({
      interpretation: CRISIS_MESSAGE,
      reflectionPrompt: "Is there someone you can reach out to right now?",
      symbols: [],
    });
  }
  return "How are you doing right now, outside of the dream?";
}
