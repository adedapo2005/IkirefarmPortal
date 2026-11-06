"use client";

import React, { useMemo, useRef, useState } from "react";
import { RotateCcw, Sparkles } from "lucide-react";

const CORRECTIONS: Record<string, string> = {
  teh: "the",
  recieve: "receive",
  recieved: "received",
  seperate: "separate",
  seperated: "separated",
  occured: "occurred",
  occuring: "occurring",
  adress: "address",
  availble: "available",
  definately: "definitely",
  enviroment: "environment",
  goverment: "government",
  maintanance: "maintenance",
  neccessary: "necessary",
  recieveing: "receiving",
  responsibile: "responsible",
  sucessful: "successful",
  tommorow: "tomorrow",
};

const WORDS = [
  "approved", "available", "complete", "confirm", "delivery", "employee",
  "evidence", "farm", "inventory", "message", "operations", "order",
  "please", "procurement", "record", "request", "review", "schedule",
  "supplier", "training", "update", "verified",
];

const NEXT_WORDS: Record<string, string[]> = {
  please: ["review", "confirm"],
  farm: ["operations", "record"],
  inventory: ["review", "record"],
  purchase: ["request", "order"],
  procurement: ["request", "review"],
  employee: ["record", "profile"],
  customer: ["order", "update"],
  supplier: ["delivery", "update"],
  delivery: ["update", "schedule"],
  request: ["review", "approval"],
  review: ["required", "complete"],
  thank: ["you"],
  we: ["will", "have"],
};

type BaseProps = {
  value: string;
  onValueChange: (value: string) => void;
  autoCorrect?: boolean;
  predictive?: boolean;
  suggestions?: string[];
  label?: string;
  description?: string;
  state?: "default" | "error" | "success";
  className?: string;
  disabled?: boolean;
};

type SmartInputProps = BaseProps & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "className" | "disabled" | "autoCorrect" | "type">;
type SmartTextareaProps = BaseProps & Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "onChange" | "className" | "disabled" | "autoCorrect">;

function preserveCase(source: string, replacement: string) {
  if (source === source.toUpperCase()) return replacement.toUpperCase();
  if (source[0] === source[0]?.toUpperCase()) return replacement[0]?.toUpperCase() + replacement.slice(1);
  return replacement;
}

function correctCompletedWord(value: string) {
  const match = value.match(/([A-Za-z]+)([\s.,!?;:])$/);
  if (!match) return null;
  const original = match[1];
  const replacement = CORRECTIONS[original.toLowerCase()];
  if (!replacement || replacement === original.toLowerCase()) return null;
  const corrected = value.slice(0, match.index) + preserveCase(original, replacement) + match[2];
  return { corrected, original, replacement: preserveCase(original, replacement) };
}

function suggestionsFor(value: string, custom: string[]) {
  const fragment = value.match(/([A-Za-z]+)$/)?.[1]?.toLowerCase() || "";
  if (fragment.length >= 2) {
    return [...custom, ...WORDS]
      .filter((word, index, all) => all.indexOf(word) === index)
      .filter((word) => word.toLowerCase().startsWith(fragment) && word.toLowerCase() !== fragment)
      .slice(0, 4);
  }

  const prior = value.trimEnd().split(/\s+/).at(-1)?.replace(/[^A-Za-z]/g, "").toLowerCase() || "";
  return (NEXT_WORDS[prior] || []).slice(0, 4);
}

function insertSuggestion(value: string, suggestion: string) {
  const fragmentMatch = value.match(/([A-Za-z]+)$/);
  if (fragmentMatch) return value.slice(0, -fragmentMatch[1].length) + suggestion + " ";
  return value + (value && !/\s$/.test(value) ? " " : "") + suggestion + " ";
}

function useSmartText({
  value,
  onValueChange,
  autoCorrect = true,
  predictive = true,
  suggestions = [],
}: Pick<BaseProps, "value" | "onValueChange" | "autoCorrect" | "predictive" | "suggestions">) {
  const composing = useRef(false);
  const [lastCorrection, setLastCorrection] = useState<{ before: string; after: string; label: string } | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const predicted = useMemo(
    () => predictive && !dismissed ? suggestionsFor(value, suggestions) : [],
    [predictive, dismissed, suggestions, value],
  );

  const change = (raw: string) => {
    setDismissed(false);
    if (autoCorrect && !composing.current) {
      const result = correctCompletedWord(raw);
      if (result) {
        setLastCorrection({
          before: raw,
          after: result.corrected,
          label: `${result.original} → ${result.replacement}`,
        });
        onValueChange(result.corrected);
        return;
      }
    }
    onValueChange(raw);
  };

  const accept = (suggestion: string) => {
    onValueChange(insertSuggestion(value, suggestion));
    setDismissed(false);
  };

  const undo = () => {
    if (!lastCorrection || value !== lastCorrection.after) return;
    onValueChange(lastCorrection.before);
    setLastCorrection(null);
  };

  return {
    predicted,
    lastCorrection: lastCorrection && value === lastCorrection.after ? lastCorrection : null,
    change,
    accept,
    undo,
    dismiss: () => setDismissed(true),
    startComposition: () => { composing.current = true; },
    endComposition: (raw: string) => { composing.current = false; change(raw); },
  };
}

function SmartChrome({
  children,
  predicted,
  accept,
  undo,
  lastCorrection,
  state = "default",
  label,
  labelId,
  controlId,
  description,
  suggestionsId,
}: {
  children: React.ReactNode;
  predicted: string[];
  accept: (suggestion: string) => void;
  undo: () => void;
  lastCorrection: { label: string } | null;
  state?: BaseProps["state"];
  label?: string;
  labelId?: string;
  controlId?: string;
  description?: string;
  suggestionsId?: string;
}) {
  return (
    <div className="smart-input-shell" data-smart-state={state}>
      {label && <label className="smart-input-label" id={labelId} htmlFor={controlId}>{label}</label>}
      {children}
      {description && <small className="smart-input-description">{description}</small>}
      {(predicted.length > 0 || lastCorrection) && (
        <div className="smart-input-assist" aria-live="polite">
          {predicted.length > 0 && (
            <div id={suggestionsId} className="smart-input-suggestions" role="listbox" aria-label="Typing suggestions">
              <span className="smart-input-assist-label"><Sparkles size={13} /> Suggestions</span>
              {predicted.map((suggestion) => (
                <button type="button" role="option" aria-selected="false" key={suggestion} onMouseDown={(event) => event.preventDefault()} onClick={() => accept(suggestion)}>
                  {suggestion}
                </button>
              ))}
            </div>
          )}
          {lastCorrection && (
            <button type="button" className="smart-input-undo" onClick={undo}>
              <RotateCcw size={13} /> Undo {lastCorrection.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function SmartInput({
  value,
  onValueChange,
  autoCorrect = true,
  predictive = true,
  suggestions = [],
  label,
  description,
  state = "default",
  className = "",
  disabled,
  onKeyDown,
  ...props
}: SmartInputProps) {
  const smart = useSmartText({ value, onValueChange, autoCorrect, predictive, suggestions });
  const controlId = React.useId();
  const labelId = label ? `${controlId}-label` : undefined;
  const suggestionsId = `${controlId}-suggestions`;
  const derivedState = props["aria-invalid"] === true || props["aria-invalid"] === "true" ? "error" : state;
  return (
    <SmartChrome {...smart} state={derivedState} label={label} labelId={labelId} controlId={controlId} description={description} suggestionsId={suggestionsId}>
      <input
        {...props}
        id={props.id ?? controlId}
        type="text"
        value={value}
        disabled={disabled}
        aria-labelledby={props["aria-label"] ? undefined : labelId}
        aria-autocomplete={smart.predicted.length ? "list" : "none"}
        aria-controls={smart.predicted.length ? suggestionsId : undefined}
        data-smart-input="enabled"
        className={`smart-input-control ${className}`}
        autoCapitalize={props.autoCapitalize ?? "sentences"}
        spellCheck={props.spellCheck ?? true}
        onCompositionStart={smart.startComposition}
        onCompositionEnd={(event) => smart.endComposition(event.currentTarget.value)}
        onChange={(event) => smart.change(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Tab" && smart.predicted[0]) {
            event.preventDefault();
            smart.accept(smart.predicted[0]);
          } else if (event.key === "Escape") {
            smart.dismiss();
          }
          onKeyDown?.(event);
        }}
      />
    </SmartChrome>
  );
}

export function SmartTextarea({
  value,
  onValueChange,
  autoCorrect = true,
  predictive = true,
  suggestions = [],
  label,
  description,
  state = "default",
  className = "",
  disabled,
  onKeyDown,
  ...props
}: SmartTextareaProps) {
  const smart = useSmartText({ value, onValueChange, autoCorrect, predictive, suggestions });
  const controlId = React.useId();
  const labelId = label ? `${controlId}-label` : undefined;
  const suggestionsId = `${controlId}-suggestions`;
  const derivedState = props["aria-invalid"] === true || props["aria-invalid"] === "true" ? "error" : state;
  return (
    <SmartChrome {...smart} state={derivedState} label={label} labelId={labelId} controlId={controlId} description={description} suggestionsId={suggestionsId}>
      <textarea
        {...props}
        id={props.id ?? controlId}
        value={value}
        disabled={disabled}
        aria-labelledby={props["aria-label"] ? undefined : labelId}
        aria-autocomplete={smart.predicted.length ? "list" : "none"}
        aria-controls={smart.predicted.length ? suggestionsId : undefined}
        data-smart-input="enabled"
        className={`smart-input-control smart-input-textarea ${className}`}
        autoCapitalize={props.autoCapitalize ?? "sentences"}
        spellCheck={props.spellCheck ?? true}
        onCompositionStart={smart.startComposition}
        onCompositionEnd={(event) => smart.endComposition(event.currentTarget.value)}
        onChange={(event) => smart.change(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Tab" && smart.predicted[0]) {
            event.preventDefault();
            smart.accept(smart.predicted[0]);
          } else if (event.key === "Escape") {
            smart.dismiss();
          }
          onKeyDown?.(event);
        }}
      />
    </SmartChrome>
  );
}

export const SMART_INPUT_SENSITIVE_TYPES = [
  "password", "email", "tel", "url", "number", "date", "datetime-local", "time", "file",
] as const;
