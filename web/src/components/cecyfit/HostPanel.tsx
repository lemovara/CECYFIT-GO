"use client";

import { useRouter } from "next/navigation";
import { useContext } from "react";
import { HostDemoContext } from "@/lib/auth/AuthGate";
import { ProfessionalChat } from "@/lib/patients/ProfessionalChat";
import { PatientWorkspace } from "@/lib/patients/PatientWorkspace";
import { ProfessionalOverview } from "@/lib/patients/ProfessionalOverview";
import { DemoClientList, DemoRegister, hostScreens } from "./host";
import { hostHref, type HostScreenId } from "./hostRoutes";
import { HostNavigationContext, HostPatientContext, HostPreviewContext } from "./ui";

export function HostPanel({ screenId, patientId }: {
  screenId: HostScreenId;
  patientId?: string;
}) {
  const router = useRouter();
  const demo = useContext(HostDemoContext);
  const screen = hostScreens.find(({ id }) => id === screenId);
  const overview = !demo && (screenId === "H1" || screenId === "H6");
  const content = demo && screenId === "H2" ? <DemoClientList />
    : demo && screenId === "H2a" ? <DemoRegister />
    : !demo && screenId === "H8" ? <ProfessionalChat />
    : overview ? <ProfessionalOverview tracking={screenId === "H6"} />
    : patientId && !demo ? <PatientWorkspace key={`${patientId}:${screenId}`} {...{ patientId, screenId }} />
    : screen?.el;
  const preview = Boolean(demo || (!patientId && !overview && screenId !== "H2" && screenId !== "H2a" && screenId !== "H8"));

  return (
    <HostPreviewContext.Provider value={preview}>
    <HostPatientContext.Provider value={demo ? undefined : patientId}>
      <HostNavigationContext.Provider value={(id) => router.push(hostHref(id, patientId))}>
        <div className="h-dvh min-h-0 w-full overflow-hidden bg-[#f3f6fc] text-[#1b2a4a]">
          {content}
        </div>
      </HostNavigationContext.Provider>
    </HostPatientContext.Provider>
    </HostPreviewContext.Provider>
  );
}
