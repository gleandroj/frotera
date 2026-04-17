import { assertChecklistUploadMime } from "./checklist-upload.mime";

describe("assertChecklistUploadMime", () => {
  it("accepts png for signature purpose", () => {
    expect(() => assertChecklistUploadMime("signature", "image/png")).not.toThrow();
  });

  it("rejects jpeg for signature purpose", () => {
    expect(() => assertChecklistUploadMime("signature", "image/jpeg")).toThrow();
  });

  it("rejects executable-like mime for file purpose", () => {
    expect(() => assertChecklistUploadMime("file", "application/x-msdownload")).toThrow();
  });
});
