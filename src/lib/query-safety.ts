export type DestructiveReason = "drop" | "truncate" | "delete_no_where" | "update_no_where"

export interface DestructiveWarning {
  reason: DestructiveReason
  title: string
  message: string
}

const WARNINGS: Record<DestructiveReason, Omit<DestructiveWarning, "reason">> = {
  drop: {
    title: "DROP statement detected",
    message: "This will permanently destroy a database object. It cannot be undone.",
  },
  truncate: {
    title: "TRUNCATE statement detected",
    message: "This will delete every row in the table instantly. It cannot be undone.",
  },
  delete_no_where: {
    title: "DELETE without WHERE",
    message: "This DELETE has no WHERE clause — it will remove every row in the table.",
  },
  update_no_where: {
    title: "UPDATE without WHERE",
    message: "This UPDATE has no WHERE clause — it will overwrite every row in the table.",
  },
}

export function detectDestructive(sql: string): DestructiveWarning | null {
  // Strip single-line comments, then trim
  const stripped = sql.replace(/--[^\n]*/g, "").trim()

  if (/^\s*DROP\s+/i.test(stripped)) {
    return { reason: "drop", ...WARNINGS.drop }
  }

  if (/^\s*TRUNCATE\b/i.test(stripped)) {
    return { reason: "truncate", ...WARNINGS.truncate }
  }

  if (/^\s*DELETE\s+/i.test(stripped) && !/\bWHERE\b/i.test(stripped)) {
    return { reason: "delete_no_where", ...WARNINGS.delete_no_where }
  }

  if (/^\s*UPDATE\s+/i.test(stripped) && !/\bWHERE\b/i.test(stripped)) {
    return { reason: "update_no_where", ...WARNINGS.update_no_where }
  }

  return null
}
