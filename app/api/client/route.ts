import { NextRequest, NextResponse } from "next/server";

// ── Config ─────────────────────────────────────────────────────────────
// Read secrets/IDs from the environment. The token lives ONLY here, on the
// server. It is never included in any response, so the browser never sees it.
const MONDAY_TOKEN = process.env.MONDAY_TOKEN;
const CLIENTS_BOARD_ID = process.env.CLIENTS_BOARD_ID ?? "5099721289";
const MONDAY_API = "https://api.monday.com/v2";

// Column IDs on the Clients board (from the board schema).
const COL = {
  companyId: "text_mm4yzbd2", // ח.פ / ע.מ  — the lookup key
  intakeStatus: "color_mm4yypb4", // סטטוס קליטה
  tasksRelation: "board_relation_mm4y5vxk", // link → משימות שוטפות
};

// Titles we look for on the Tasks board (matched by title so we don't need
// to hardcode task-board column IDs).
const TASK_TITLE = {
  status: "סטטוס",
  deadline: "דדליין",
  taskType: "סוג משימה",
};
const DONE_STATUS = "הוגש"; // tasks in this status are excluded ("open" = not submitted)

// ── Monday GraphQL helper ──────────────────────────────────────────────
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

// Pull a readable value out of a column_values array by column id.
function valueById(columnValues: any[], id: string): string {
  const cv = columnValues?.find((c) => c.id === id);
  return cv?.text ?? "";
}
// Pull a readable value by the column's human title.
function valueByTitle(columnValues: any[], title: string): string {
  const cv = columnValues?.find((c) => c.column?.title === title);
  return cv?.text ?? "";
}

// ── Route: GET /api/client?hp=512345678 ────────────────────────────────
export async function GET(req: NextRequest) {
  if (!MONDAY_TOKEN) {
    return NextResponse.json(
      { error: "server_misconfigured", message: "חסר מפתח גישה בשרת." },
      { status: 500 }
    );
  }

  const hp = req.nextUrl.searchParams.get("hp")?.trim();
  if (!hp) {
    return NextResponse.json(
      { error: "missing_hp", message: "יש להזין ח.פ / ע.מ." },
      { status: 400 }
    );
  }

  try {
    // Step 1 — find the client by ח.פ, read status + linked task IDs.
    const clientQuery = `
      query ($val: [String!]) {
        items_page_by_column_values(
          limit: 1,
          board_id: ${CLIENTS_BOARD_ID},
          columns: [{ column_id: "${COL.companyId}", column_values: $val }]
        ) {
          items {
            id
            name
            column_values {
              id
              text
              column { title }
              ... on BoardRelationValue { linked_item_ids }
            }
          }
        }
      }`;
    const clientData = await monday(clientQuery, { val: [hp] });
    const item = clientData?.items_page_by_column_values?.items?.[0];

    if (!item) {
      return NextResponse.json(
        { error: "not_found", message: "לא נמצא לקוח עם ח.פ זה." },
        { status: 404 }
      );
    }

    const columnValues = item.column_values ?? [];
    const intakeStatus = valueById(columnValues, COL.intakeStatus);
    const relation = columnValues.find((c: any) => c.id === COL.tasksRelation);
    const taskIds: string[] = relation?.linked_item_ids ?? [];

    // Step 2 — fetch the linked tasks (if any), label columns by title.
    let openTasks: Array<{
      id: string;
      name: string;
      type: string;
      deadline: string;
      status: string;
    }> = [];

    if (taskIds.length > 0) {
      const tasksQuery = `
        query ($ids: [ID!]) {
          items(ids: $ids) {
            id
            name
            column_values { id text column { title } }
          }
        }`;
      const tasksData = await monday(tasksQuery, { ids: taskIds });
      const tasks = tasksData?.items ?? [];
      openTasks = tasks
        .map((t: any) => ({
          id: t.id,
          name: t.name,
          type: valueByTitle(t.column_values, TASK_TITLE.taskType),
          deadline: valueByTitle(t.column_values, TASK_TITLE.deadline),
          status: valueByTitle(t.column_values, TASK_TITLE.status),
        }))
        // "open" = anything not yet submitted
        .filter((t: any) => t.status !== DONE_STATUS);
    }

    return NextResponse.json({
      client: {
        name: item.name,
        companyId: hp,
        status: intakeStatus || "—",
      },
      openTasks,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "monday_error", message: "אירעה שגיאה בשליפת הנתונים." },
      { status: 502 }
    );
  }
}
