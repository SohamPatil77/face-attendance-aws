// Face matching: compares 128-d face descriptors with Euclidean distance.
// Two faces of the same person usually have distance < 0.5;
// different people are usually > 0.6.

export const THRESHOLD = Number(process.env.MATCH_THRESHOLD || 0.5);

export function euclidean(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

export function toConfidence(distance) {
  return Math.max(0, Math.min(100, Math.round((1 - distance) * 1000) / 10));
}

/**
 * Match every query descriptor against every registered student.
 * Uses a greedy one-to-one assignment so that the same student is never
 * matched to two different faces in the same photo.
 */
export function matchFaces(queryDescriptors, students, threshold = THRESHOLD) {
  const pairs = [];
  queryDescriptors.forEach((q, faceIndex) => {
    students.forEach((s) => {
      let best = Infinity;
      for (const d of s.descriptors) best = Math.min(best, euclidean(q, d));
      pairs.push({ faceIndex, student: s, distance: best });
    });
  });
  pairs.sort((a, b) => a.distance - b.distance);

  const usedFaces = new Set();
  const usedStudents = new Set();
  const results = queryDescriptors.map((_, faceIndex) => ({
    faceIndex,
    matched: false,
    label: 'Unknown',
    distance: null,
    confidence: 0,
  }));

  for (const p of pairs) {
    if (p.distance > threshold) break;
    const sid = String(p.student._id);
    if (usedFaces.has(p.faceIndex) || usedStudents.has(sid)) continue;
    usedFaces.add(p.faceIndex);
    usedStudents.add(sid);
    results[p.faceIndex] = {
      faceIndex: p.faceIndex,
      matched: true,
      studentId: sid,
      name: p.student.name,
      rollNo: p.student.rollNo,
      label: `${p.student.name} (${p.student.rollNo})`,
      distance: Math.round(p.distance * 1000) / 1000,
      confidence: toConfidence(p.distance),
    };
  }
  // For unknown faces, report the nearest distance for transparency.
  for (const r of results) {
    if (r.matched) continue;
    const nearest = pairs.find((p) => p.faceIndex === r.faceIndex);
    if (nearest) r.distance = Math.round(nearest.distance * 1000) / 1000;
  }
  return results;
}

export function isValidDescriptor(d) {
  return Array.isArray(d) && d.length === 128 && d.every((x) => typeof x === 'number' && Number.isFinite(x));
}
