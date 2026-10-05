const PERSONS = [
  { id: "yo", label: "yo" },
  { id: "tu", label: "tú" },
  { id: "el", label: "él / ella / usted" },
  { id: "nosotros", label: "nosotros" },
  { id: "ellos", label: "ellos / ustedes" },
];

const IRREGULAR = {
  ser: ["soy", "eres", "es", "somos", "son"],
  ir: ["voy", "vas", "va", "vamos", "van"],
  estar: ["estoy", "estás", "está", "estamos", "están"],
  haber: ["he", "has", "ha", "hemos", "han"],
  tener: ["tengo", "tienes", "tiene", "tenemos", "tienen"],
  hacer: ["hago", "haces", "hace", "hacemos", "hacen"],
  poder: ["puedo", "puedes", "puede", "podemos", "pueden"],
  decir: ["digo", "dices", "dice", "decimos", "dicen"],
  ver: ["veo", "ves", "ve", "vemos", "ven"],
  dar: ["doy", "das", "da", "damos", "dan"],
  saber: ["sé", "sabes", "sabe", "sabemos", "saben"],
  querer: ["quiero", "quieres", "quiere", "queremos", "quieren"],
  poner: ["pongo", "pones", "pone", "ponemos", "ponen"],
  venir: ["vengo", "vienes", "viene", "venimos", "vienen"],
  salir: ["salgo", "sales", "sale", "salimos", "salen"],
  oír: ["oigo", "oyes", "oye", "oímos", "oyen"],
  oir: ["oigo", "oyes", "oye", "oímos", "oyen"],
  caer: ["caigo", "caes", "cae", "caemos", "caen"],
  traer: ["traigo", "traes", "trae", "traemos", "traen"],
  conocer: ["conozco", "conoces", "conoce", "conocemos", "conocen"],
  parecer: ["parezco", "pareces", "parece", "parecemos", "parecen"],
  traducir: ["traduzco", "traduces", "traduce", "traducimos", "traducen"],
  conducir: ["conduzco", "conduces", "conduce", "conducimos", "conducen"],
  seguir: ["sigo", "sigues", "sigue", "seguimos", "siguen"],
  conseguir: ["consigo", "consigues", "consigue", "conseguimos", "consiguen"],
  reír: ["río", "ríes", "ríe", "reímos", "ríen"],
  reir: ["río", "ríes", "ríe", "reímos", "ríen"],
  sonreír: ["sonrío", "sonríes", "sonríe", "sonreímos", "sonríen"],
};

const STEM_IE = new Set([
  "pensar",
  "cerrar",
  "empezar",
  "comenzar",
  "entender",
  "perder",
  "querer",
  "preferir",
  "mentir",
  "sentir",
  "sentar",
  "despertar",
  "nevar",
  "helar",
  "acertar",
  "confesar",
  "defender",
  "encender",
]);

const STEM_UE = new Set([
  "volver",
  "dormir",
  "almorzar",
  "encontrar",
  "costar",
  "contar",
  "mostrar",
  "recordar",
  "soñar",
  "volar",
  "morder",
  "mover",
  "doler",
  "llover",
  "morir",
  "poder",
]);

const STEM_I = new Set([
  "pedir",
  "servir",
  "repetir",
  "medir",
  "competir",
  "reír",
  "sonreír",
  "seguir",
  "conseguir",
  "vestir",
  "elegir",
  "freír",
]);

function nfc(value) {
  return String(value || "").normalize("NFC").trim().toLowerCase();
}

function changeLast(stem, from, to) {
  const idx = stem.toLowerCase().lastIndexOf(from);
  if (idx < 0) {
    return stem;
  }
  return stem.slice(0, idx) + to + stem.slice(idx + from.length);
}

function stemChange(lemma, kind) {
  const ending = lemma.slice(-2);
  const stem = lemma.slice(0, -2);
  if (kind === "ie") {
    if (stem.includes("e") || stem.includes("é")) {
      return changeLast(stem.replace("é", "e"), "e", "ie") + ending;
    }
  }
  if (kind === "ue") {
    if (stem.includes("o") || stem.includes("ó")) {
      return changeLast(stem.replace("ó", "o"), "o", "ue") + ending;
    }
    if (stem.includes("u")) {
      return changeLast(stem, "u", "ue") + ending;
    }
  }
  if (kind === "i") {
    return changeLast(stem.replace("é", "e"), "e", "i") + ending;
  }
  return lemma;
}

function regularEndings(ending) {
  if (ending === "ar") {
    return ["o", "as", "a", "amos", "an"];
  }
  if (ending === "er") {
    return ["o", "es", "e", "emos", "en"];
  }
  if (ending === "ir") {
    return ["o", "es", "e", "imos", "en"];
  }
  return null;
}

function applyStem(lemma, personIndex, kind) {
  const ending = lemma.slice(-2);
  const endings = regularEndings(ending);
  if (!endings) {
    return lemma;
  }
  const unchanged = personIndex === 3;
  const formLemma = unchanged ? lemma : stemChange(lemma, kind);
  const stem = formLemma.slice(0, -2);
  return stem + endings[personIndex];
}

export function conjugatePresent(lemma) {
  const key = nfc(lemma);
  const irregular = IRREGULAR[key];
  let forms;
  let pattern = "regular";

  if (irregular) {
    forms = irregular;
    pattern = "irregular";
  } else {
    const ending = key.slice(-2);
    const endings = regularEndings(ending);
    if (!endings) {
      return {
        lemma: key,
        pattern: "unknown",
        persons: PERSONS.map((person) => ({
          id: person.id,
          label: person.label,
          form: "—",
        })),
      };
    }
    let kind = null;
    if (STEM_IE.has(key)) {
      kind = "ie";
    } else if (STEM_UE.has(key)) {
      kind = "ue";
    } else if (STEM_I.has(key)) {
      kind = "i";
    }
    if (kind) {
      pattern = "stem-" + kind;
      forms = PERSONS.map((_, index) => applyStem(key, index, kind));
    } else {
      const stem = key.slice(0, -2);
      forms = endings.map((suffix) => stem + suffix);
    }
  }

  return {
    lemma: key,
    pattern: pattern,
    persons: PERSONS.map((person, index) => ({
      id: person.id,
      label: person.label,
      form: forms[index],
    })),
  };
}
