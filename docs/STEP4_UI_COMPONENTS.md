# Step 4: UI Components & Pages

## Overview

**Step 4** builds the complete frontend for two separate applications:

1. **Ayaan Go** (Driver PWA) — Mobile-first driver application
2. **Ayaan Mobility** (Admin Dashboard) — Desktop admin interface

All components use:
- **React 19** with TypeScript
- **Next.js 16** (App Router)
- **Tailwind CSS 4** for styling
- **Lucide React** for icons
- **shadcn/ui** patterns (custom-built for this project)

---

## Architecture

```
src/
├── app/
│   ├── driver/                    # Ayaan Go (Driver PWA)
│   │   ├── layout.tsx
│   │   ├── page.tsx               # Driver dashboard
│   │   ├── duty-end/
│   │   │   └── page.tsx           # Duty submission form
│   │   ├── expense-claim/
│   │   │   └── page.tsx           # Toll/parking receipt upload
│   │   └── history/
│   │       └── page.tsx           # Previous duty logs
│   │
│   └── admin/                     # Ayaan Mobility (Admin Dashboard)
│       ├── layout.tsx
│       ├── page.tsx               # Admin dashboard
│       ├── duties/
│       │   ├── page.tsx           # Duty list
│       │   ├── [id]/
│       │   │   ├── page.tsx       # Duty detail + actions
│       │   │   └── approve/
│       │   │       └── page.tsx   # Approval modal
│       │   └── pending/
│       │       └── page.tsx       # Pending approvals
│       ├── analytics/
│       │   └── page.tsx           # Dashboard analytics
│       └── audit/
│           └── page.tsx           # Audit log viewer
│
├── components/
│   ├── shared/
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Input.tsx
│   │   ├── Modal.tsx
│   │   ├── Alert.tsx
│   │   └── Spinner.tsx
│   │
│   ├── driver/
│   │   ├── DutyEndForm.tsx
│   │   ├── OdometerPhotoCapture.tsx
│   │   ├── ExpenseClaimForm.tsx
│   │   └── DutyLogCard.tsx
│   │
│   └── admin/
│       ├── DutyList.tsx
│       ├── DutyDetailView.tsx
│       ├── ApprovalActions.tsx
│       ├── OverrideModal.tsx
│       └── AuditLogViewer.tsx
│
└── lib/
    ├── utils.ts                   # Helper functions
    └── formatter.ts               # Number, date formatting
```

---

## Components to Build

### **Shared Components** (Reusable across both apps)

These follow shadcn/ui patterns — simple, accessible, unstyled base components.

1. **Button.tsx** — Standard button with variants (solid, outline, ghost)
2. **Card.tsx** — Container for content sections
3. **Input.tsx** — Text input with label, error state
4. **Modal.tsx** — Dialog for overlays
5. **Alert.tsx** — Success, error, warning messages
6. **Spinner.tsx** — Loading indicator
7. **Badge.tsx** — Status labels (APPROVED, REJECTED, PENDING)

### **Driver Components** (Ayaan Go PWA)

1. **DutyEndForm.tsx**
   - Form to submit end-of-duty data
   - Inputs: endTime, endOdometer, endLocation, lunchClaimed, etc.
   - Displays real-time calculations as user enters km/time
   - Upload final odometer photo (Cloudinary)
   - Submit button with loading state
   - Auto-shows result: "Approved!" or "Pending admin review"

2. **OdometerPhotoCapture.tsx**
   - Mobile camera integration (using HTML5 `<input type="file" accept="image/*" capture="environment">`)
   - Photo preview before upload
   - Upload to Cloudinary or similar

3. **ExpenseClaimForm.tsx**
   - Add toll/parking claims
   - Upload receipt photo
   - List of pending/approved claims on current duty

4. **DutyLogCard.tsx**
   - Reusable card showing duty summary
   - Displays: date, km, hours, total bill, status badge
   - Status colors: green (APPROVED), yellow (PENDING), red (REJECTED)

5. **DriverDashboard.tsx**
   - Shows current duty (in progress)
   - Quick links: Start Duty, End Duty, View History
   - Today's summary: total km, total earned
   - Next 7 days' upcoming shifts

### **Admin Components** (Ayaan Mobility Dashboard)

1. **DutyList.tsx**
   - Table of all duties (filterable, searchable, paginated)
   - Columns: date, driver, km, hours, bill, status, actions
   - Filter by: status (PENDING, APPROVED, REJECTED), date range, company
   - Search by: driver name, vehicle reg number
   - "Pending" badge count at top

2. **DutyDetailView.tsx**
   - Full duty log details in a sidebar or modal
   - Displays all calculations from Step 2
   - Shows warnings (if any) that triggered admin review
   - Before/after comparison (for overrides)

3. **ApprovalActions.tsx**
   - Inline or modal buttons for admin actions:
     - **Approve** — Simple approval with optional note
     - **Reject** — Requires reason text
     - **Override** — Opens override modal
   - Each action shows loading state, success toast

4. **OverrideModal.tsx**
   - Form to override individual fields
   - Inputs: newKm, newFuelBill, newOvertimeBill, newDinnerBill, etc.
   - Shows "before" and "after" live calculations
   - Admin edit note (required)
   - Submit button with loading state

5. **AuditLogViewer.tsx**
   - Table of all audit log entries
   - Columns: timestamp, admin, action, entity, old value, new value
   - Expandable rows to show full JSON diffs
   - Filter by: admin, action type, date range

6. **AdminDashboard.tsx**
   - Key metrics: total duties, pending approvals, total km, total revenue
   - Pending approvals list (quick view)
   - Recent overrides (compliance tracking)
   - Analytics trend chart (Recharts): km/day, revenue/day over last 30 days

---

## Detailed Component Examples

### **Driver: DutyEndForm.tsx**

```typescript
"use client";

import { useState } from "react";
import { useDutyLogMutation } from "@/hooks/useDutyLogMutation";
import type { SubmitDutyLogInput } from "@/actions/dutyLog";
import Button from "@/components/shared/Button";
import Input from "@/components/shared/Input";
import Alert from "@/components/shared/Alert";
import Spinner from "@/components/shared/Spinner";

interface DutyEndFormProps {
  dutyLogId: string;
  startOdometer: number;
  startTime: Date;
}

export default function DutyEndForm({ dutyLogId, startOdometer, startTime }: DutyEndFormProps) {
  const { submit, isLoading, error, success, data } = useDutyLogMutation();
  const [formData, setFormData] = useState({
    endTime: new Date(),
    endOdometer: startOdometer,
    endOdometerImg: "",
    endLocation: "",
    routeNotes: "",
    lunchClaimed: false,
  });

  // Calculate km in real-time
  const totalKm = formData.endOdometer - startOdometer;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await submit({
      dutyLogId,
      endTime: formData.endTime,
      endOdometer: formData.endOdometer,
      endOdometerImg: formData.endOdometerImg,
      endLocation: formData.endLocation,
      routeNotes: formData.routeNotes,
      lunchClaimed: formData.lunchClaimed,
    });
  };

  if (success && data) {
    return (
      <Alert variant="success">
        <h2>Duty Submitted Successfully!</h2>
        <p>Total Bill: ৳ {data.totalDailyBill}</p>
        {data.status === "APPROVED" && <p className="font-bold text-green-700">✓ Auto-Approved</p>}
        {data.status === "PENDING_APPROVAL" && <p className="text-yellow-700">Pending admin review</p>}
      </Alert>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-xl font-bold">End Duty</h2>

      {error && <Alert variant="error">{error}</Alert>}

      <Input
        label="End Time"
        type="datetime-local"
        value={formData.endTime.toISOString().slice(0, 16)}
        onChange={(e) => setFormData({ ...formData, endTime: new Date(e.target.value) })}
        required
      />

      <Input
        label="End Odometer (km)"
        type="number"
        step="0.1"
        value={formData.endOdometer}
        onChange={(e) => setFormData({ ...formData, endOdometer: parseFloat(e.target.value) })}
        required
      />

      <div className="p-3 bg-blue-50 rounded">
        <p className="text-sm font-semibold">Total Distance: {totalKm} km</p>
      </div>

      <Input
        label="End Odometer Photo"
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => {
          // Handle file upload to Cloudinary
          setFormData({ ...formData, endOdometerImg: e.target.value });
        }}
        required
      />

      <Input
        label="End Location"
        type="text"
        placeholder="e.g., Gulshan Office"
        value={formData.endLocation}
        onChange={(e) => setFormData({ ...formData, endLocation: e.target.value })}
      />

      <Input
        label="Route Notes"
        as="textarea"
        placeholder="Describe the route, stops, etc."
        value={formData.routeNotes}
        onChange={(e) => setFormData({ ...formData, routeNotes: e.target.value })}
      />

      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={formData.lunchClaimed}
          onChange={(e) => setFormData({ ...formData, lunchClaimed: e.target.checked })}
        />
        <span className="text-sm">Claim lunch allowance (৳ 200)</span>
      </label>

      <Button type="submit" disabled={isLoading} className="w-full">
        {isLoading ? <Spinner /> : "Submit Duty"}
      </Button>
    </form>
  );
}
```

### **Admin: OverrideModal.tsx**

```typescript
"use client";

import { useState } from "react";
import { useDutyLogMutation } from "@/hooks/useDutyLogMutation";
import type { AdminOverrideDutyLogInput } from "@/actions/dutyLog";
import type { DutyLog } from "@prisma/client";
import Modal from "@/components/shared/Modal";
import Input from "@/components/shared/Input";
import Button from "@/components/shared/Button";
import Alert from "@/components/shared/Alert";

interface OverrideModalProps {
  dutyLog: DutyLog;
  isOpen: boolean;
  onClose: () => void;
}

export default function OverrideModal({ dutyLog, isOpen, onClose }: OverrideModalProps) {
  const { override, isLoading, error, success } = useDutyLogMutation();
  const [overrides, setOverrides] = useState({
    newKm: dutyLog.totalKm,
    newFuelBill: dutyLog.fuelBill,
    newOvertimeBill: dutyLog.overtimeBill,
    newDinnerBill: dutyLog.dinnerBill,
    adminEditNote: "",
  });

  // Calculate new total
  const newTotal =
    overrides.newFuelBill +
    overrides.newOvertimeBill +
    overrides.newDinnerBill +
    dutyLog.lunchBill +
    dutyLog.tourAllowance +
    dutyLog.tollParkingBill;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await override({
      dutyLogId: dutyLog.id,
      newKm: overrides.newKm !== dutyLog.totalKm ? overrides.newKm : undefined,
      newFuelBill: overrides.newFuelBill !== dutyLog.fuelBill ? overrides.newFuelBill : undefined,
      newOvertimeBill:
        overrides.newOvertimeBill !== dutyLog.overtimeBill ? overrides.newOvertimeBill : undefined,
      newDinnerBill:
        overrides.newDinnerBill !== dutyLog.dinnerBill ? overrides.newDinnerBill : undefined,
      adminEditNote: overrides.adminEditNote,
      status: "EDITED_BY_ADMIN",
    });
    if (success) onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Override Duty Log">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <Alert variant="error">{error}</Alert>}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-bold text-gray-600">Original KM</p>
            <p className="text-lg font-bold">{dutyLog.totalKm}</p>
          </div>
          <div>
            <Input
              label="New KM"
              type="number"
              step="0.1"
              value={overrides.newKm}
              onChange={(e) => setOverrides({ ...overrides, newKm: parseFloat(e.target.value) })}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-bold text-gray-600">Original Fuel Bill</p>
            <p className="text-lg font-bold">৳ {dutyLog.fuelBill}</p>
          </div>
          <div>
            <Input
              label="New Fuel Bill"
              type="number"
              step="0.01"
              value={overrides.newFuelBill}
              onChange={(e) =>
                setOverrides({ ...overrides, newFuelBill: parseFloat(e.target.value) })
              }
            />
          </div>
        </div>

        <Input
          label="Admin Edit Note (Required)"
          as="textarea"
          placeholder="Why are you overriding? (e.g., GPS verified, odometer photo was blurry)"
          value={overrides.adminEditNote}
          onChange={(e) => setOverrides({ ...overrides, adminEditNote: e.target.value })}
          required
        />

        <div className="p-3 bg-blue-50 rounded">
          <p className="text-sm font-bold">New Total Bill: ৳ {newTotal.toFixed(2)}</p>
          <p className="text-xs text-gray-600">Change: ৳ {(newTotal - dutyLog.totalDailyBill).toFixed(2)}</p>
        </div>

        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading} className="flex-1">
            {isLoading ? "Overriding..." : "Apply Override"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
```

---

## Styling Strategy

**Tailwind CSS 4** with custom color scheme:

```css
/* Primary colors (Ayaan Green) */
--color-primary: #10b981       /* Success, approval */
--color-primary-dark: #059669

/* Status colors */
--color-approved: #10b981      /* Green */
--color-pending: #f59e0b       /* Amber */
--color-rejected: #ef4444      /* Red */
--color-warning: #f59e0b       /* Amber */

/* Neutral */
--color-gray-50: #f9fafb
--color-gray-900: #111827
```

All components use:
- Rounded corners: `rounded-lg` (8px)
- Shadows: `shadow-sm` for cards, `shadow-md` for modals
- Spacing: Tailwind's 4px grid (p-2, p-4, p-6, etc.)
- Typography: System fonts with -tracking-tight for headings

---

## File List for Step 4

### Shared Components (7 files)
```
src/components/shared/
├── Button.tsx           (variant: solid, outline, ghost, disabled)
├── Card.tsx             (basic container)
├── Input.tsx            (text, email, password, number, textarea)
├── Modal.tsx            (dialog overlay)
├── Alert.tsx            (success, error, warning, info)
├── Spinner.tsx          (loading indicator)
└── Badge.tsx            (status badges)
```

### Driver Components (5 files)
```
src/components/driver/
├── DutyEndForm.tsx       (main submission form)
├── OdometerPhotoCapture.tsx
├── ExpenseClaimForm.tsx
├── DutyLogCard.tsx       (reusable card)
└── DriverDashboard.tsx   (dashboard overview)
```

### Admin Components (6 files)
```
src/components/admin/
├── DutyList.tsx          (table + filters)
├── DutyDetailView.tsx    (side panel)
├── ApprovalActions.tsx   (approve/reject/override buttons)
├── OverrideModal.tsx     (override form)
├── AuditLogViewer.tsx    (audit table)
└── AdminDashboard.tsx    (metrics + overview)
```

### Driver Pages (4 files)
```
src/app/driver/
├── layout.tsx            (shared layout, nav)
├── page.tsx              (dashboard)
├── duty-end/page.tsx     (end duty form)
├── expense-claim/page.tsx (claim form)
└── history/page.tsx      (past duties)
```

### Admin Pages (4 files)
```
src/app/admin/
├── layout.tsx            (shared layout, nav)
├── page.tsx              (dashboard)
├── duties/page.tsx       (duty list)
├── duties/[id]/page.tsx  (duty detail + actions)
├── duties/pending/page.tsx (pending only)
├── analytics/page.tsx    (charts & metrics)
└── audit/page.tsx        (audit log viewer)
```

### Utilities (2 files)
```
src/lib/
├── utils.ts              (cn, classname helpers)
└── formatter.ts          (format currency, date, duration)
```

**Total: 24 files, ~3000 lines of code**

---

## Ready to Start?

I can now create all Step 4 files. Confirm and I'll deliver:

✅ All shared UI components  
✅ Driver PWA pages & components  
✅ Admin Dashboard pages & components  
✅ Utility functions & formatters  
✅ Full TypeScript types  
✅ Responsive design (mobile-first)  
✅ Accessible markup (ARIA labels, etc.)  
✅ Error handling & loading states  

**Confirm to proceed: Type "YES" or "start"**
