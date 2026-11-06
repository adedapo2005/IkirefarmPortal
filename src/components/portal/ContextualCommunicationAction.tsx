"use client";

import React from "react";
import { MessageSquareText } from "lucide-react";
import { Btn, Chip } from "./Common";
import type { WorkspaceProps } from "./PortalExperience";
import { contextualDraftSummary, contextualUseCase, contextualWhatsAppState } from "@/lib/contextual-communications";

export default function ContextualCommunicationAction({
  person,
  detail,
  go,
  useCaseId,
  recordLabel,
  recordId,
}: Pick<WorkspaceProps,"person"|"detail"|"go"> & { useCaseId:string; recordLabel:string; recordId?:string }) {
  const useCase=contextualUseCase(useCaseId);
  if(!useCase) return null;
  const state=contextualWhatsAppState(person,useCase);
  if(!state.available) return null;
  return <Btn small onClick={()=>detail(contextualDraftSummary(useCase,recordLabel,recordId),<div className="stack"><div className="row wrap"><Chip tone="blue">WhatsApp</Chip><Chip>{useCase.defaultMode.replaceAll("_"," ")}</Chip></div><p><strong>{useCase.audience}</strong> communication is prepared through the shared Communications service, not sent directly from this module.</p><p>{state.reason}</p><div><strong>Useful for:</strong><ul>{useCase.examples.map(item=><li key={item}>{item}</li>)}</ul></div><p>Recipient permission/consent, provider readiness, template approval, locked business facts, audit and delivery state remain enforced centrally.</p><Btn onClick={()=>go("communication")}><MessageSquareText size={16}/>Open Communications</Btn></div>)}><MessageSquareText size={15}/>{useCase.label}</Btn>;
}