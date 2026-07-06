import { NextRequest, NextResponse } from "next/server";

// ── Config ─────────────────────────────────────────────────────────────
// Token lives ONLY here. It is never included in any response.
const MONDAY_TOKEN = process.env.MONDAY_TOKEN;
const CLIENTS_BOARD_ID = process.env.CLIENTS_BOARD_ID ?? "5099721289";
const MONDAY_API = "https://api.monday.com/v2";

const INTAKE_STATUS_COL = "color_mm4yypb4";
const CONFIRMED_LABEL = "התקבלו מסמכים";

// ── Monday GraphQL helper (same pattern as /api/client) ────────────────
async function monday(query: string, variables: Record<string, unknown>) {
  const res = await fetch(MONDAY_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: MONDAY_TOKEN as string,
      "API-Version": "2024-01",
    },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });
  const json = await res.json();
  if (json.errors) {
    throw new Error(json.errors?.[0]?.message ?? "Monday API error");
  }
  return json.data;
}

// ── Route: POST /api/confirm ────────────────────────────────────────────
// Body: { itemId: string }   — the Monday item ID (NOT the ח.פ)
export async function POST(req: NextRequest) {
  if (!MONDAY_TOKEN) {
    return NextResponse.json(
      { error: "server_misconfigured", message: "חסר מפתח גישה בשרת." },
      { status: 500 }
    );
  }

  let itemId: string;
  try {
    const body = await req.json();
    itemId = String(body?.itemId ?? "").trim();
  } catch {
    return NextResponse.json(
      { error: "bad_request", message: "בקשה לא תקינה." },
      { status: 400 }
    );
  }

  if (!itemId) {
    return NextResponse.json(
      { error: "missing_item_id", message: "חסר מזהה פריט." },
      { status: 400 }
    );
  }

  try {
    const mutation = `
      mutation ($itemId: ID!, $value: String!) {
        change_simple_column_value(
          board_id: ${CLIENTS_BOARD_ID},
          item_id: $itemId,
          column_id: "${INTAKE_STATUS_COL}",
          value: $value
        ) { id }
      }`;
    await monday(mutation, { itemId, value: CONFIRMED_LABEL });

    return NextResponse.json({ ok: true, status: CONFIRMED_LABEL });
  } catch {
    return NextResponse.json(
      { error: "monday_error", message: "אירעה שגיאה בעדכון הסטטוס." },
      { status: 502 }
    );
  }
}
