import type { Metadata } from "next"

import { ProcurementView } from "@/components/procurement/procurement-view"

export const metadata: Metadata = {
  title: "Procurement · SpendIQ",
}

export default function ProcurementPage() {
  return <ProcurementView />
}
