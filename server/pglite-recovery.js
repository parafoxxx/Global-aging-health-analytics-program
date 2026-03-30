import fs from "node:fs";
import path from "node:path";

const PAGE_SIZE = 8192;

function align(offset, boundary) {
  return (offset + (boundary - 1)) & ~(boundary - 1);
}

function readVarlena(buffer, offset) {
  const firstByte = buffer[offset];
  if ((firstByte & 1) === 1) {
    const totalLength = firstByte >> 1;
    return {
      nextOffset: offset + totalLength,
      bodyStart: offset + 1,
      bodyEnd: offset + totalLength,
    };
  }

  const totalLength = buffer.readUInt32LE(offset) >> 2;
  return {
    nextOffset: offset + totalLength,
    bodyStart: offset + 4,
    bodyEnd: offset + totalLength,
  };
}

function tryReadVarlena(buffer, offset) {
  if (offset < 0 || offset >= buffer.length) {
    return null;
  }

  const firstByte = buffer[offset];
  if ((firstByte & 1) === 1) {
    const totalLength = firstByte >> 1;
    if (totalLength < 1 || offset + totalLength > buffer.length) {
      return null;
    }

    return {
      start: offset,
      nextOffset: offset + totalLength,
      bodyStart: offset + 1,
      bodyEnd: offset + totalLength,
    };
  }

  if (offset + 4 > buffer.length) {
    return null;
  }

  const totalLength = buffer.readUInt32LE(offset) >> 2;
  if (totalLength < 4 || offset + totalLength > buffer.length) {
    return null;
  }

  return {
    start: offset,
    nextOffset: offset + totalLength,
    bodyStart: offset + 4,
    bodyEnd: offset + totalLength,
  };
}

function readText(buffer, offset) {
  const field = readVarlena(buffer, offset);
  return {
    value: buffer.toString("utf8", field.bodyStart, field.bodyEnd),
    nextOffset: field.nextOffset,
  };
}

function parseNumericChunk(chunk) {
  let varlenaOffset = -1;
  let totalLength = 0;

  for (let index = 0; index <= chunk.length - 4; index += 1) {
    const candidate = chunk.readUInt32LE(index) >> 2;
    if (candidate >= 4 && index + candidate === chunk.length) {
      varlenaOffset = index;
      totalLength = candidate;
      break;
    }
  }

  if (varlenaOffset < 0) {
    throw new Error("Unable to locate numeric varlena payload");
  }

  const numeric = chunk.subarray(varlenaOffset + 4, varlenaOffset + totalLength);
  if (numeric.length < 4) {
    throw new Error("Numeric payload is too short");
  }

  const header = numeric.readUInt16LE(0);
  const isShort = (header & 0x8000) === 0x8000;
  if (!isShort) {
    throw new Error("Only short numeric values are supported in recovery mode");
  }

  const weightMagnitude = header & 0x003f;
  const weightSign = (header & 0x0040) === 0x0040 ? -1 : 1;
  const weight = weightMagnitude * weightSign;

  const digits = [];
  for (let index = 2; index < numeric.length; index += 2) {
    digits.push(numeric.readUInt16LE(index));
  }

  let value = 0;
  for (let index = 0; index < digits.length; index += 1) {
    value += digits[index] * 10000 ** (weight - index);
  }

  return value;
}

function parseJsonbObject(chunk) {
  if (chunk.length < 4) {
    return {};
  }

  const header = chunk.readUInt32LE(0);
  const isObject = (header & 0xf0000000) === 0x20000000;
  const count = header & 0x0fffffff;
  if (!isObject || count === 0) {
    return {};
  }

  const entries = [];
  let entryOffset = 4;
  for (let index = 0; index < count * 2; index += 1) {
    entries.push(chunk.readUInt32LE(entryOffset));
    entryOffset += 4;
  }

  let dataOffset = 4 + count * 2 * 4;
  const keys = [];
  for (let index = 0; index < count; index += 1) {
    const length = entries[index] & 0x0fffffff;
    keys.push(chunk.toString("utf8", dataOffset, dataOffset + length));
    dataOffset += length;
  }

  const result = {};
  for (let index = 0; index < count; index += 1) {
    const entry = entries[count + index];
    const type = entry & 0xf0000000;
    const length = entry & 0x0fffffff;
    const valueChunk = chunk.subarray(dataOffset, dataOffset + length);
    dataOffset += length;

    if (type === 0x10000000) {
      result[keys[index]] = parseNumericChunk(valueChunk);
    }
  }

  return result;
}

function readJsonbFieldSequence(buffer, startOffset, count) {
  const walk = (offset, remaining) => {
    if (remaining === 0) {
      return [];
    }

    const candidates = [];
    for (const candidateOffset of [offset, align(offset, 4)]) {
      if (candidates.some((item) => item.start === candidateOffset)) {
        continue;
      }

      const field = tryReadVarlena(buffer, candidateOffset);
      if (!field) {
        continue;
      }

      try {
        parseJsonbObject(buffer.subarray(field.bodyStart, field.bodyEnd));
        candidates.push(field);
      } catch {
        // Ignore invalid candidate and keep searching.
      }
    }

    for (const field of candidates) {
      const rest = walk(field.nextOffset, remaining - 1);
      if (rest) {
        return [field, ...rest];
      }
    }

    return null;
  };

  return walk(startOffset, count);
}

function readHeapTuples(filePath) {
  const relation = fs.readFileSync(filePath);
  const tuples = [];

  for (let pageStart = 0; pageStart < relation.length; pageStart += PAGE_SIZE) {
    const page = relation.subarray(pageStart, pageStart + PAGE_SIZE);
    const lower = page.readUInt16LE(12);
    const itemCount = Math.max(0, (lower - 24) / 4);

    for (let index = 0; index < itemCount; index += 1) {
      const raw = page.readUInt32LE(24 + index * 4);
      const tupleOffset = raw & 0x7fff;
      const tupleFlags = (raw >> 15) & 0x3;
      const tupleLength = (raw >> 17) & 0x7fff;

      if (tupleFlags !== 1 || tupleLength === 0) {
        continue;
      }

      tuples.push(page.subarray(tupleOffset, tupleOffset + tupleLength));
    }
  }

  return tuples;
}

function parseCountryTuple(tuple) {
  let offset = tuple[22];

  offset = align(offset, 8);
  offset += 8; // id

  const countryField = readText(tuple, offset);
  offset = countryField.nextOffset;

  offset = align(offset, 4);
  const total_count = tuple.readInt32LE(offset);
  offset += 4;

  const frail_count = tuple.readInt32LE(offset);
  offset += 4;

  const non_frail_count = tuple.readInt32LE(offset);
  offset += 4;

  offset = align(offset, 8);
  const frail_percentage = tuple.readDoubleLE(offset);
  offset += 8;

  offset = align(offset, 8);
  const avg_age = tuple.readDoubleLE(offset);
  offset += 8;

  offset = align(offset, 4);
  const female_count = tuple.readInt32LE(offset);
  offset += 4;

  const male_count = tuple.readInt32LE(offset);
  offset += 4;

  offset = align(offset, 8);
  const female_percentage = tuple.readDoubleLE(offset);
  offset += 8;

  offset = align(offset, 8);
  const male_percentage = tuple.readDoubleLE(offset);
  offset += 8;

  offset = align(offset, 4);
  const comorbidity_yes = tuple.readInt32LE(offset);
  offset += 4;

  const comorbidity_no = tuple.readInt32LE(offset);
  offset += 4;

  offset = align(offset, 8);
  const comorbidity_percentage = tuple.readDoubleLE(offset);
  offset += 8;

  const jsonbFields = readJsonbFieldSequence(tuple, offset, 4);
  if (!jsonbFields) {
    throw new Error("Unable to locate jsonb country distributions in tuple");
  }

  const [ageGroupsField, healthRatingsField, maritalStatusField, marriageAgeField] = jsonbFields;

  return {
    country: countryField.value,
    total_count,
    frail_count,
    non_frail_count,
    frail_percentage,
    avg_age,
    female_count,
    male_count,
    female_percentage,
    male_percentage,
    comorbidity_yes,
    comorbidity_no,
    comorbidity_percentage,
    age_groups: parseJsonbObject(tuple.subarray(ageGroupsField.bodyStart, ageGroupsField.bodyEnd)),
    health_ratings: parseJsonbObject(tuple.subarray(healthRatingsField.bodyStart, healthRatingsField.bodyEnd)),
    marital_status: parseJsonbObject(tuple.subarray(maritalStatusField.bodyStart, maritalStatusField.bodyEnd)),
    marriage_age_categories: parseJsonbObject(tuple.subarray(marriageAgeField.bodyStart, marriageAgeField.bodyEnd)),
  };
}

function parseFactorTuple(tuple) {
  let offset = tuple[22];

  const countryField = readText(tuple, offset);
  offset = countryField.nextOffset;

  offset = align(offset, 2);
  const rank = tuple.readInt16LE(offset);
  offset += 2;

  const factorField = readText(tuple, offset);
  offset = factorField.nextOffset;

  offset = align(offset, 8);
  const score = tuple.readDoubleLE(offset);
  offset += 8;

  offset = align(offset, 8);
  const accuracy = tuple.readDoubleLE(offset);

  return {
    country: countryField.value,
    rank,
    name: factorField.value,
    score,
    accuracy,
  };
}

function normalizeCountryKey(country) {
  return String(country ?? "").trim().toLowerCase();
}

export function loadBrokenPgliteRecovery(rootDir = "./.data/pglite") {
  const countriesPath = path.resolve(rootDir, "base", "1", "20193");
  const factorsPath = path.resolve(rootDir, "base", "1", "28384");

  if (!fs.existsSync(countriesPath) || !fs.existsSync(factorsPath)) {
    return null;
  }

  const countries = readHeapTuples(countriesPath)
    .map(parseCountryTuple)
    .filter((row) => row.country)
    .sort((a, b) => a.country.localeCompare(b.country));

  const factorRows = readHeapTuples(factorsPath)
    .map(parseFactorTuple)
    .filter((row) => row.country && row.name);

  if (countries.length === 0 || factorRows.length === 0) {
    return null;
  }

  const countriesByKey = new Map(countries.map((row) => [normalizeCountryKey(row.country), row]));
  const factorsByKey = new Map();

  for (const row of factorRows) {
    const key = normalizeCountryKey(row.country);
    const existing = factorsByKey.get(key) ?? {
      country: row.country,
      accuracy: row.accuracy,
      factors: [],
    };

    existing.accuracy = row.accuracy;
    existing.factors.push({
      rank: Number(row.rank),
      name: row.name,
      score: Number(row.score),
    });
    factorsByKey.set(key, existing);
  }

  for (const value of factorsByKey.values()) {
    value.factors.sort((a, b) => a.rank - b.rank);
  }

  return {
    countries,
    countriesByKey,
    factorsByKey,
  };
}
