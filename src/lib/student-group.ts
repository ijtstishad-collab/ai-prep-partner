// Maps profile.student_group (UI text) → subjects.group_type keys to include.
// Every group also gets "general" (Bangla/English/ICT) so compulsory subjects always appear.

export type GroupKey = "science" | "business" | "humanities" | "general";

export function allowedGroupsFor(studentGroup: string | null | undefined): GroupKey[] {
  const g = (studentGroup ?? "").toLowerCase();
  if (g.startsWith("business")) return ["business", "general"];
  if (g.startsWith("human")) return ["humanities", "general"];
  if (g.startsWith("science")) return ["science", "general"];
  // Unknown / not yet onboarded → show everything
  return ["science", "business", "humanities", "general"];
}

// Fallback inference from subject name when DB has no group_type.
export function inferGroup(name: string): GroupKey {
  const n = name.toLowerCase();
  if (/(phys|chem|bio|higher math|stat)/.test(n)) return "science";
  if (/(account|business|finance|management|marketing|banking|insurance)/.test(n)) return "business";
  if (/(history|civic|logic|geog|sociology|islam|psych|econ)/.test(n)) return "humanities";
  return "general";
}

export function subjectMatchesGroup(
  subject: { name: string; group_type?: string | null },
  allowed: GroupKey[],
): boolean {
  const key = (subject.group_type as GroupKey | null | undefined) ?? inferGroup(subject.name);
  return allowed.includes(key);
}
