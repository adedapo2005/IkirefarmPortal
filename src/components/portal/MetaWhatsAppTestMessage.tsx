"use client";

import { useMemo, useState } from "react";
import { Clock3, LayoutTemplate, Send, ShieldCheck, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import LoggedTimestamp from "./LoggedTimestamp";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import styles from "./meta-provider-control-plane.module.css";
import { approvedSupportedUtilityTemplates, countApprovedWhatsAppTemplates, describeWhatsAppTestReadiness, supportedTemplateVariables } from "@/lib/whatsapp-test-form";

type TemplateRecord = Record<string, unknown>;
type TemplateSyncSummary = {
  completedAt: string | null;
  count: number | null;
  wabaId: string | null;
};

type Props = {
  templates: TemplateRecord[];
  messagingAvailable: boolean;
  selectedWabaId: string;
  templateSync: TemplateSyncSummary;
  onOpenTemplates: () => void;
  onSend: (input: Record<string, unknown>) => Promise<Record<string, unknown>>;
};



export default function MetaWhatsAppTestMessage({
  templates,
  messagingAvailable,
  selectedWabaId,
  templateSync,
  onOpenTemplates,
  onSend,
}: Props) {
  const [recipient, setRecipient] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [parameterValues, setParameterValues] = useState<Record<number, string>>({});
  const [consentConfirmed, setConsentConfirmed] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sending, setSending] = useState(false);

  const approvedTemplates = useMemo(() => approvedSupportedUtilityTemplates(templates), [templates]);
  const selectedTemplate = approvedTemplates.find((template) => String(template.id || "") === templateId);
  const parameterIndexes = selectedTemplate ? supportedTemplateVariables(selectedTemplate) || [] : [];
  const setupReady = approvedTemplates.length > 0;
  const approvedSummary = useMemo(() => countApprovedWhatsAppTemplates(templates), [templates]);
  const readiness = describeWhatsAppTestReadiness({
    messagingAvailable, selectedWabaId, selectedTemplate: selectedTemplate || null,
    recipient, parameterIndexes, parameterValues, consentConfirmed, sending,
  });
  const canReview = readiness.canReview;

  const inventoryMessage = templateSync.completedAt === null
    ? "FarmPortal has not synchronized this WABA's template inventory yet."
    : templateSync.count === 0
      ? "Meta returned 0 templates for the selected WABA. Create a Utility template, wait for approval, then synchronize once."
      : templates.length > 0 && approvedTemplates.length === 0
        ? "Templates were returned, but none is an approved, supported Utility template."
        : "An approved Utility template is ready for a controlled test.";

  async function sendTestMessage() {
    if (!canReview || !selectedTemplate) return;
    setSending(true);
    try {
      const result = await onSend({
        recipient: recipient.trim(),
        templateId: String(selectedTemplate.id),
        parameters: parameterIndexes.map((index) => parameterValues[index].trim()),
        consentConfirmed: true,
        confirmSend: true,
      });
      setConfirmOpen(false);
      setRecipient("");
      setParameterValues({});
      setConsentConfirmed(false);
      if (result.accepted === true && result.trackingRecorded === false) {
        toast.warning("Meta accepted the test message, but FarmPortal could not record its activity. Do not resend until the message is reconciled.");
      } else if (result.providerSubmissionStatus === "HELD") {
        toast.warning("Meta has HELD this message for quality assessment. It has not been confirmed Sent. Check Activity for a later status.");
      } else if (result.providerSubmissionStatus === "PAUSED") {
        toast.warning("Meta reports that this message is PAUSED. Do not retry until Meta releases the restriction.");
      } else {
        toast.success(result.accepted === true
          ? "Meta accepted the test message. Delivery is not yet confirmed; watch Activity for signed status updates."
          : "The test-send request completed; check the operation log for its status.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The test message could not be sent.");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <section className={`${styles.surface} ${styles.testMessageSurface}`} aria-labelledby="whatsapp-test-message-title" data-testid="whatsapp-test-message">
        <div className={styles.surfaceHeading}>
          <div>
            <span className={styles.eyebrow}>Controlled end-to-end check</span>
            <h2 id="whatsapp-test-message-title">WhatsApp test message</h2>
            <p>The complete test workflow stays visible here. Seven approved templates may include both Utility and Authentication types. This test safely uses approved Utility templates only. Complete every readiness step below to enable the review button; a separate final confirmation is required to send.</p>
          </div>
          <div className={`${styles.miniState} ${messagingAvailable ? styles.statusGood : styles.statusWarn}`}>
            {messagingAvailable ? "MESSAGING AVAILABLE" : "MESSAGING NOT READY"}
          </div>
        </div>

        <div className={styles.testReadinessGrid} aria-label="WhatsApp test readiness">
          <div>
            <span>Selected WABA</span>
            <strong>{selectedWabaId || "Not selected"}</strong>
          </div>
          <div>
            <span>All Approved Templates</span>
            <strong>{approvedSummary.total}</strong>
            <small>{approvedSummary.utility} Utility · {approvedSummary.authentication} Authentication</small>
          </div>
          <div>
            <span>Utility Templates Eligible For Test</span>
            <strong>{approvedTemplates.length}</strong>
            <small>Authentication Templates Use Secure Account Flows, Not This Test Form</small>
          </div>
          <div>
            <span>Last Meta template sync</span>
            <strong>{templateSync.completedAt ? <LoggedTimestamp value={templateSync.completedAt}/> : "Not synchronized yet"}</strong>
            {templateSync.count !== null && <small>Meta returned {templateSync.count} template{templateSync.count === 1 ? "" : "s"}</small>}
          </div>
        </div>

        {!setupReady && (
          <div className={styles.templateBlocker} role="status">
            <div>
              <TriangleAlert size={19} />
              <span>
                <strong>Test send is blocked at the template step.</strong>
                <small>{inventoryMessage}</small>
              </span>
            </div>
            <Button type="button" variant="outline" onClick={onOpenTemplates}>
              <LayoutTemplate size={16} /> Open guided template setup
            </Button>
          </div>
        )}

        <div className={styles.fieldGrid} aria-disabled={!setupReady}>
          <div className={styles.selectionRow}>
            <Label htmlFor="whatsapp-test-recipient">Test recipient number</Label>
            <Input
              id="whatsapp-test-recipient"
              type="tel"
              inputMode="tel"
              autoComplete="off"
              placeholder="+234 801 234 5678"
              value={recipient}
              onChange={(event) => setRecipient(event.target.value)}
              aria-describedby="whatsapp-test-recipient-help"
              disabled={!setupReady || !messagingAvailable}
            />
            <small id="whatsapp-test-recipient-help">Use a separate number you control or have permission to message. Include the country code.</small>
          </div>
          <div className={styles.selectionRow}>
            <Label htmlFor="whatsapp-test-template">Approved Utility template</Label>
            <select
              id="whatsapp-test-template"
              value={templateId}
              onChange={(event) => { setTemplateId(event.target.value); setParameterValues({}); }}
              disabled={!setupReady || !messagingAvailable}
            >
              <option value="">{setupReady ? "Choose an approved template" : "No approved Utility template available"}</option>
              {approvedTemplates.map((template) => (
                <option key={String(template.id)} value={String(template.id)}>
                  {String(template.name)} · {String(template.language)}
                </option>
              ))}
            </select>
          </div>
          {selectedTemplate && parameterIndexes.map((index) => (
            <div className={styles.selectionRow} key={index}>
              <Label htmlFor={`whatsapp-test-parameter-${index}`}>Template value {index}</Label>
              <Input
                id={`whatsapp-test-parameter-${index}`}
                value={parameterValues[index] || ""}
                maxLength={1024}
                onChange={(event) => setParameterValues((current) => ({ ...current, [index]: event.target.value }))}
                autoComplete="off"
              />
            </div>
          ))}
          <label className={`${styles.securityStrip} ${!setupReady ? styles.disabledControl : ""}`}>
            <input
              type="checkbox"
              checked={consentConfirmed}
              onChange={(event) => setConsentConfirmed(event.target.checked)}
              disabled={!setupReady || !messagingAvailable}
            />
            <ShieldCheck size={17} />
            <span>I confirm this recipient has agreed to receive a WhatsApp message, and I want to send this test now.</span>
          </label>
          <div className={styles.readinessPanel} data-testid="whatsapp-review-readiness" aria-label="Test Send Requirements">
            <div className={styles.readinessHeading}>
              <h3>Review Test Send Readiness</h3>
              <span>{readiness.remaining === 0 ? "All Requirements Ready" : readiness.remaining + " Requirement" + (readiness.remaining === 1 ? "" : "s") + " Remaining"}</span>
            </div>
            <ul className={styles.reviewGateList}>
              {readiness.checks.map((check) => (
                <li key={check.id} className={check.ready ? styles.reviewGateReady : styles.reviewGateNeeded}>
                  {check.ready ? <ShieldCheck size={18} aria-hidden="true" /> : <TriangleAlert size={18} aria-hidden="true" />}
                  <div><strong>{check.title}</strong><small>{check.detail}</small></div>
                  <span>{check.ready ? "Ready" : "Needed"}</span>
                </li>
              ))}
            </ul>
            <p id="whatsapp-review-status" role="status" aria-live="polite" data-testid="whatsapp-review-status">
              {sending
                ? "Test Send Submission In Progress."
                : readiness.remaining === 0
                  ? "All Requirements Are Ready. Review Test Send Is Enabled; Nothing Is Sent Until You Confirm Separately."
                  : "Complete The Items Marked Needed To Enable Review Test Send. No Message Has Been Sent."}
            </p>
          </div>
          <div className={styles.actionRow}>
            <Button type="button" onClick={() => setConfirmOpen(true)} disabled={!canReview} aria-describedby="whatsapp-review-status">
              <Send size={16} /> Review Test Send
            </Button>
            <span><Clock3 size={14} /> No Message Is Sent By Filling This Form. Final Confirmation Is Required.</span>
          </div>
        </div>
      </section>

      <Dialog open={confirmOpen} onOpenChange={(open) => { if (!sending) setConfirmOpen(open); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm one real test message</DialogTitle>
            <DialogDescription>
              This will send the approved template “{String(selectedTemplate?.name || "selected template")}” to {recipient.trim()}. Meta may charge for the message. The operation will be recorded with the recipient masked in FarmPortal’s audit log.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmOpen(false)} disabled={sending}>Cancel</Button>
            <Button type="button" onClick={() => void sendTestMessage()} disabled={!canReview || sending}>
              {sending ? "Sending…" : "Send one test message"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
