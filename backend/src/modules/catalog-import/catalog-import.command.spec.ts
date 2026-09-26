import { CATALOG_IMPORT_EXIT_CODE, runCatalogImportCommand } from "./catalog-import.command";

describe("catalog import command", () => {
  it("emits a stable redacted report when the input path is missing", async () => {
    const write = jest.spyOn(process.stdout, "write").mockImplementation(() => true);
    try {
      await expect(runCatalogImportCommand("")).resolves.toBe(CATALOG_IMPORT_EXIT_CODE.REPORT_FAILURE);
      expect(write).toHaveBeenCalledWith(expect.stringContaining('"code":"MISSING_INPUT"'));
      expect(write).not.toHaveBeenCalledWith(expect.stringContaining("DATABASE_URL"));
    } finally {
      write.mockRestore();
    }
  });
});
