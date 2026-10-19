// Fictional seed data for the public /demo page. Nothing here touches Convex.

export interface DemoMember {
  id: string;
  name: string;
  email: string;
  role: "owner" | "member";
  title: string;
}

export interface DemoFolder {
  id: string;
  name: string;
  parentFolderId?: string;
  assignedTo?: string;
  sharedWithFamily: boolean;
  sharedWith: string[];
  createdAt: number;
}

export interface DemoFile {
  id: string;
  name: string;
  url: string;
  type: string;
  size: number;
  createdAt: number;
  assignedTo?: string;
  folderId?: string;
  tags: string[];
  sharedWithFamily: boolean;
  sharedWith: string[];
  uploadedBy: string;
}

export interface DemoWorkspace {
  name: string;
  inviteCode: string;
}

export interface DemoState {
  workspace: DemoWorkspace;
  members: DemoMember[];
  folders: DemoFolder[];
  files: DemoFile[];
}

export const OWNER_ID = "m-eleanor";

const DAY = 24 * 60 * 60 * 1000;

const MIME = {
  pdf: "application/pdf",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv",
  jpg: "image/jpeg",
  png: "image/png",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
} as const;

type SeedFile = [
  name: string,
  size: number,
  daysAgo: number,
  assignedTo: string | undefined,
  folderId: string | undefined,
  tags: string[],
  sharing?: { family?: boolean; with?: string[] },
];

const SEED_FILES: SeedFile[] = [
  // Eleanor (owner / principal accountant)
  [
    "Client-Deadlines-Tracker.xlsx",
    20982,
    0,
    OWNER_ID,
    undefined,
    ["deadlines", "internal"],
    { with: ["m-marcus"] },
  ],
  [
    "Tax-Deadlines-2026-27.pdf",
    4830,
    12,
    OWNER_ID,
    undefined,
    ["deadlines", "guide"],
    { family: true },
  ],
  [
    "Engagement-Letter-Template.docx",
    1222,
    41,
    OWNER_ID,
    "f-templates",
    ["template"],
  ],
  [
    "HMRC-PAYE-Reminder-Okafor.pdf",
    3273,
    10,
    OWNER_ID,
    "f-hmrc",
    ["hmrc", "payroll", "okafor"],
  ],

  // Marcus (bookkeeper)
  ["Bookkeeping-Queue.xlsx", 17694, 1, "m-marcus", "f-queue", ["queue"]],
  [
    "Okafor-Bank-Statement-Sep-2026.csv",
    1004,
    2,
    "m-marcus",
    "f-queue",
    ["bank", "okafor", "to reconcile"],
  ],

  // Ade Okafor (client: limited company)
  [
    "Okafor-Engagement-Letter-2026.pdf",
    7386,
    44,
    "m-ade",
    "f-okafor",
    ["engagement", "signed"],
  ],
  [
    "Okafor-Draft-Accounts-FY2025-26.pdf",
    12039,
    3,
    "m-ade",
    "f-ok-accounts",
    ["accounts", "draft", "needs review"],
  ],
  [
    "Okafor-Trial-Balance-FY2025-26.xlsx",
    27657,
    3,
    "m-ade",
    "f-ok-accounts",
    ["accounts", "trial balance"],
  ],
  [
    "Okafor-Oven-Purchase-Invoice.jpg",
    123321,
    30,
    "m-ade",
    "f-ok-accounts",
    ["capital allowances", "receipt"],
  ],
  [
    "Okafor-VAT-Return-Q2-2026.pdf",
    5057,
    20,
    "m-ade",
    "f-ok-vat",
    ["vat", "submitted"],
  ],
  [
    "Okafor-Payroll-Oct-2026.xlsx",
    20610,
    1,
    "m-ade",
    "f-ok-payroll",
    ["payroll"],
  ],
  [
    "Payslip-Grace-Mensah-Oct-2026.pdf",
    5588,
    1,
    "m-ade",
    "f-ok-payroll",
    ["payroll", "payslip"],
  ],

  // Lena Fischer (client: sole trader)
  [
    "Fischer-Tax-Calculation-2025-26.pdf",
    5428,
    5,
    "m-lena",
    "f-lena",
    ["self assessment", "sa302"],
  ],
  [
    "Fischer-Income-Expenses-2025-26.xlsx",
    25128,
    8,
    "m-lena",
    "f-lena",
    ["self assessment", "bookkeeping"],
  ],
  [
    "Fischer-Invoice-FS-0042.pdf",
    4077,
    16,
    "m-lena",
    "f-lena",
    ["sales invoice"],
  ],
  ["Fischer-Mileage-Log-2026-27.csv", 422, 4, "m-lena", "f-lena", ["mileage"]],
  [
    "Receipt-Adobe-Creative-Cloud-Oct.png",
    48133,
    3,
    "m-lena",
    "f-lena-receipts",
    ["receipt", "software"],
  ],
  [
    "Receipt-LNER-Train-York.jpg",
    120315,
    3,
    "m-lena",
    "f-lena-receipts",
    ["receipt", "travel"],
  ],
  [
    "Receipt-Bean-and-Brew-Client-Meeting.jpg",
    124804,
    3,
    "m-lena",
    "f-lena-receipts",
    ["receipt", "subsistence"],
  ],

  // Sarah Whitfield (client: landlord)
  [
    "Whitfield-Rental-Ledger-2026-27.xlsx",
    21716,
    6,
    "m-sarah",
    "f-whit",
    ["rental", "ledger"],
    { with: ["m-marcus"] },
  ],
  [
    "Hartwell-Fee-Invoice-HA-1187.pdf",
    3320,
    4,
    "m-sarah",
    "f-whit",
    ["invoice", "unpaid"],
  ],
  [
    "Elm-Road-Tenancy-Agreement.pdf",
    3960,
    79,
    "m-sarah",
    "f-whit-elm",
    ["tenancy"],
  ],
  [
    "Elm-Road-Boiler-Invoice.jpg",
    170831,
    45,
    "m-sarah",
    "f-whit-elm",
    ["repairs", "receipt"],
  ],
  [
    "Elm-Road-Front-Exterior.jpg",
    97156,
    79,
    "m-sarah",
    "f-whit-elm",
    ["property", "photo"],
  ],

  // Firm-wide (unassigned)
  ["Client-Privacy-Notice.pdf", 3079, 120, undefined, "f-firm", ["policy"]],
];

function mimeFor(name: string): string {
  const ext = name.slice(name.lastIndexOf(".") + 1) as keyof typeof MIME;
  return MIME[ext] ?? "application/octet-stream";
}

export function createSeedState(now = Date.now()): DemoState {
  const folder = (
    id: string,
    name: string,
    daysAgo: number,
    opts: Partial<
      Pick<
        DemoFolder,
        "parentFolderId" | "assignedTo" | "sharedWithFamily" | "sharedWith"
      >
    > = {},
  ): DemoFolder => ({
    id,
    name,
    createdAt: now - daysAgo * DAY,
    sharedWithFamily: opts.sharedWithFamily ?? false,
    sharedWith: opts.sharedWith ?? [],
    parentFolderId: opts.parentFolderId,
    assignedTo: opts.assignedTo,
  });

  return {
    workspace: { name: "Hartwell Accounting", inviteCode: "HWA7K2" },
    members: [
      {
        id: OWNER_ID,
        name: "Eleanor Hartwell",
        email: "eleanor@hartwell-accounting.example",
        role: "owner",
        title: "Principal accountant",
      },
      {
        id: "m-marcus",
        name: "Marcus Reid",
        email: "marcus@hartwell-accounting.example",
        role: "member",
        title: "Bookkeeper (staff)",
      },
      {
        id: "m-ade",
        name: "Ade Okafor",
        email: "ade@okaforsbakery.example",
        role: "member",
        title: "Client: Okafor's Bakery Ltd",
      },
      {
        id: "m-lena",
        name: "Lena Fischer",
        email: "lena@fischer.studio.example",
        role: "member",
        title: "Client: freelance designer",
      },
      {
        id: "m-sarah",
        name: "Sarah Whitfield",
        email: "sarah.whitfield@example.com",
        role: "member",
        title: "Client: landlord",
      },
    ],
    folders: [
      folder("f-admin", "Practice Admin", 300, { assignedTo: OWNER_ID }),
      folder("f-templates", "Templates", 300, {
        assignedTo: OWNER_ID,
        parentFolderId: "f-admin",
      }),
      folder("f-hmrc", "HMRC Correspondence", 280, {
        assignedTo: OWNER_ID,
        sharedWith: ["m-marcus"],
      }),
      folder("f-queue", "Bookkeeping Queue", 200, { assignedTo: "m-marcus" }),
      folder("f-okafor", "Okafor's Bakery Ltd", 400, {
        assignedTo: "m-ade",
        sharedWith: ["m-marcus"],
      }),
      folder("f-ok-accounts", "FY2025-26 Accounts", 120, {
        assignedTo: "m-ade",
        parentFolderId: "f-okafor",
        sharedWith: ["m-marcus"],
      }),
      folder("f-ok-vat", "VAT Returns", 400, {
        assignedTo: "m-ade",
        parentFolderId: "f-okafor",
        sharedWith: ["m-marcus"],
      }),
      folder("f-ok-payroll", "Payroll", 400, {
        assignedTo: "m-ade",
        parentFolderId: "f-okafor",
        sharedWith: ["m-marcus"],
      }),
      folder("f-lena", "Fischer Studio", 250, { assignedTo: "m-lena" }),
      folder("f-lena-receipts", "Receipts 2026-27", 190, {
        assignedTo: "m-lena",
        parentFolderId: "f-lena",
      }),
      folder("f-whit", "Whitfield Rentals", 500, {
        assignedTo: "m-sarah",
        sharedWith: ["m-marcus"],
      }),
      folder("f-whit-elm", "14 Elm Road", 500, {
        assignedTo: "m-sarah",
        parentFolderId: "f-whit",
        sharedWith: ["m-marcus"],
      }),
      folder("f-firm", "Firm Resources", 365, { sharedWithFamily: true }),
    ],
    files: SEED_FILES.map(
      ([name, size, daysAgo, assignedTo, folderId, tags, sharing], index) => ({
        id: `file-${index}`,
        name,
        url: `/demo/files/${name}`,
        type: mimeFor(name),
        size,
        // Stagger within the day so "Today" items keep a stable order
        createdAt: now - daysAgo * DAY - index * 60_000,
        assignedTo,
        folderId,
        tags,
        sharedWithFamily: sharing?.family ?? false,
        sharedWith: sharing?.with ?? [],
        uploadedBy: OWNER_ID,
      }),
    ),
  };
}
