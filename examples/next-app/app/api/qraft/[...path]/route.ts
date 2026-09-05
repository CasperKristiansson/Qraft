import { createQraftRoute } from "@qraft/qa/next";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const qraft = createQraftRoute({ endpoint: "/api/qraft", file: "./QA.md" });
export const GET = qraft.GET;
export const POST = qraft.POST;
