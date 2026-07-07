import fs from "node:fs/promises";
import path from "node:path";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const root = path.resolve("../..");
const outputPath = path.join(root, "customer-list", "Little_Pause_Pages_Email_索取名單.xlsx");

const workbook = Workbook.create();
const contacts = workbook.worksheets.add("客戶名單");
const daily = workbook.worksheets.add("每日統計");
const settings = workbook.worksheets.add("設定");

contacts.showGridLines = false;
daily.showGridLines = false;
settings.showGridLines = false;

contacts.getRange("A1:J1").values = [[
    "索取日期",
    "索取時間",
    "Email",
    "姓名",
    "來源",
    "主旨",
    "訊息備註",
    "PDF 是否已寄出",
    "Gmail 訊息 ID",
    "備註",
]];
contacts.getRange("A1:J1").format = {
    fill: "#4A9B8E",
    font: { bold: true, color: "#FFFFFF" },
};
contacts.getRange("A1:J20").format.borders = {
    preset: "inside",
    style: "thin",
    color: "#E7DED2",
};
contacts.getRange("A:A").setNumberFormat("yyyy-mm-dd");
contacts.getRange("B:B").setNumberFormat("hh:mm");
contacts.getRange("A:J").format.font = { name: "Aptos", size: 11 };
contacts.getRange("A1:J1").format.font = { name: "Aptos", size: 11, bold: true, color: "#FFFFFF" };
contacts.getRange("A:J").format.columnWidth = 16;
contacts.getRange("C:C").format.columnWidth = 30;
contacts.getRange("G:G").format.columnWidth = 38;
contacts.getRange("I:I").format.columnWidth = 26;
contacts.getRange("J:J").format.columnWidth = 28;
contacts.freezePanes.freezeRows(1);
contacts.tables.add("A1:J2", true, "CustomerList");

daily.getRange("A1:F1").values = [[
    "日期",
    "索取件數",
    "新增 Email 數",
    "重複 Email 數",
    "最後更新時間",
    "備註",
]];
daily.getRange("A1:F1").format = {
    fill: "#1B2B4A",
    font: { bold: true, color: "#FFFFFF" },
};
daily.getRange("A:F").format.font = { name: "Aptos", size: 11 };
daily.getRange("A:A").setNumberFormat("yyyy-mm-dd");
daily.getRange("E:E").setNumberFormat("yyyy-mm-dd hh:mm");
daily.getRange("A:F").format.columnWidth = 18;
daily.getRange("F:F").format.columnWidth = 38;
daily.freezePanes.freezeRows(1);
daily.tables.add("A1:F2", true, "DailySummary");

settings.getRange("A1:B1").values = [["Little Pause Pages Email 客戶名單", ""]];
settings.getRange("A1:B1").merge();
settings.getRange("A1:B1").format = {
    fill: "#F5F1E8",
    font: { bold: true, color: "#1B2B4A", size: 14 },
};
settings.getRange("A3:B8").values = [
    ["用途", "每日統計免費 PDF 索取者，作為未來新書通知與行銷名單來源。"],
    ["資料來源", "Gmail：Your Little Pause Pages free sample pack / Little Pause Pages free sample sent"],
    ["更新頻率", "每天自動統計前一天新增索取紀錄"],
    ["去重方式", "以 Email 為主要識別欄位"],
    ["注意", "正式群發前仍需確認收件者同意、退訂方式與隱私權政策"],
    ["建立日期", new Date()],
];
settings.getRange("A3:A8").format = {
    fill: "#4A9B8E",
    font: { bold: true, color: "#FFFFFF" },
};
settings.getRange("B3:B8").format = {
    fill: "#FFFFFF",
    font: { color: "#1B2B4A" },
};
settings.getRange("A:B").format.columnWidth = 22;
settings.getRange("B:B").format.columnWidth = 72;
settings.getRange("A3:B8").format.borders = {
    preset: "all",
    style: "thin",
    color: "#E7DED2",
};
settings.getRange("B8").setNumberFormat("yyyy-mm-dd");

const errors = await workbook.inspect({
    kind: "match",
    searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
    options: { useRegex: true, maxResults: 50 },
    maxChars: 2000,
});
console.log(errors.ndjson);

for (const sheetName of ["客戶名單", "每日統計", "設定"]) {
    const preview = await workbook.render({
        sheetName,
        autoCrop: "all",
        scale: 1,
        format: "png",
    });
    const previewPath = path.join(path.dirname(outputPath), `${sheetName}.png`);
    await fs.writeFile(previewPath, new Uint8Array(await preview.arrayBuffer()));
    console.log(previewPath);
}

await fs.mkdir(path.dirname(outputPath), { recursive: true });
const exported = await SpreadsheetFile.exportXlsx(workbook);
await exported.save(outputPath);
console.log(outputPath);
