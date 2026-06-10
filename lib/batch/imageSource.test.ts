import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { collectImageSources, zipImageSources, ZipReadError } from "./imageSource";

function zipFile(entries: Record<string, string>, name = "labels.zip"): File {
  const data = zipSync(
    Object.fromEntries(
      Object.entries(entries).map(([path, content]) => [path, strToU8(content)]),
    ),
  );
  return new File([data], name, { type: "application/zip" });
}

const image = (name: string, type = "image/png") =>
  new File(["png-bytes"], name, { type });

describe("zipImageSources", () => {
  it("lists image entries by bare filename and inflates them on demand", async () => {
    const zip = zipFile({
      "batch/front.png": "front-bytes",
      "batch/back.jpg": "back-bytes",
    });
    const sources = await zipImageSources(zip);

    expect(sources.map((s) => s.name).sort()).toEqual(["back.jpg", "front.png"]);

    const front = sources.find((s) => s.name === "front.png")!;
    const file = await front.getFile();
    expect(file.name).toBe("front.png");
    expect(file.type).toBe("image/png");
    expect(await file.text()).toBe("front-bytes");
  });

  it("skips directories, macOS junk, hidden files, and non-images", async () => {
    const zip = zipFile({
      "labels/front.png": "front",
      "labels/notes.txt": "not an image",
      "__MACOSX/labels/._front.png": "resource fork",
      "labels/.DS_Store": "junk",
    });
    const sources = await zipImageSources(zip);

    expect(sources.map((s) => s.name)).toEqual(["front.png"]);
  });

  it("throws ZipReadError for a corrupt zip", async () => {
    const broken = new File(["definitely not a zip"], "broken.zip", {
      type: "application/zip",
    });
    await expect(zipImageSources(broken)).rejects.toThrow(ZipReadError);
  });
});

describe("collectImageSources", () => {
  it("merges loose images and zip contents; later picks win on collisions", async () => {
    const { sources, ignored } = await collectImageSources([
      image("front.png"),
      zipFile({ "front.png": "from-zip", "back.png": "back" }),
    ]);

    expect(ignored).toEqual([]);
    expect([...sources.keys()].sort()).toEqual(["back.png", "front.png"]);
    // The zip came second, so its front.png replaced the loose file.
    expect(await (await sources.get("front.png")!.getFile()).text()).toBe("from-zip");
  });

  it("reports files that are neither images nor zips", async () => {
    const { sources, ignored } = await collectImageSources([
      image("front.png"),
      new File(["a,b,c"], "extra.csv", { type: "text/csv" }),
    ]);

    expect([...sources.keys()]).toEqual(["front.png"]);
    expect(ignored).toEqual(["extra.csv"]);
  });
});
