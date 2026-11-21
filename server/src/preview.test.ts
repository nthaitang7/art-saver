import { describe, expect, it } from "vitest";
import { assertPublicHttpUrl } from "./preview";

describe("assertPublicHttpUrl", () => {
  it("rejects non-http schemes", async () => {
    await expect(assertPublicHttpUrl("file:///etc/passwd")).rejects.toThrow();
    await expect(assertPublicHttpUrl("data:text/plain,hi")).rejects.toThrow();
    await expect(assertPublicHttpUrl("ftp://example.com/a.png")).rejects.toThrow();
  });

  it("rejects malformed links", async () => {
    await expect(assertPublicHttpUrl("not a link")).rejects.toThrow();
  });

  it("rejects loopback and local hosts", async () => {
    await expect(assertPublicHttpUrl("http://localhost/a.png")).rejects.toThrow();
    await expect(assertPublicHttpUrl("http://127.0.0.1/a.png")).rejects.toThrow();
    await expect(assertPublicHttpUrl("http://10.0.0.5/a.png")).rejects.toThrow();
    await expect(assertPublicHttpUrl("http://192.168.1.10/a.png")).rejects.toThrow();
    await expect(assertPublicHttpUrl("http://169.254.169.254/latest/meta-data")).rejects.toThrow();
    await expect(assertPublicHttpUrl("http://[::1]/a.png")).rejects.toThrow();
  });

  it("allows public literal addresses", async () => {
    const url = await assertPublicHttpUrl("https://93.184.216.34/a.png");
    expect(url.hostname).toBe("93.184.216.34");
  });
});