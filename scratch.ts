import { buildProjectArchive, parseProjectArchive } from "./src/lib/project-content.ts";
async function test() {
  const archive = await buildProjectArchive("hello world");
  const parsed = await parseProjectArchive(archive.archiveBytes.buffer);
  console.log("Parsed content:", parsed.content);
}
test().catch(console.error);
