"use client";

import React, { useState } from "react";
import {
  AlertTriangle,
  Building2,
  CalendarRange,
  MapPinned,
  Radar,
  Search,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from "lucide-react";
import { farmConfiguration } from "@/lib/review-metadata";
import { Btn, Chip, DataTable, Panel, SelectField } from "./Common";

const products = [
  "Live Chicken",
  "Fresh Eggs / Crate",
  "Pigs",
  "Goats",
  "Snails",
  "Chicken Feed",
  "Organic Manure",
];
const radii = ["10", "20", "30", "50", "70", "100", "200", "Custom"];
const relationships = ["Competitors", "Suppliers", "Buyers", "Partners"];

export default function MarketIntelligence() {
  const [product, setProduct] = useState(products[1]);
  const [radius, setRadius] = useState("50");
  const [custom, setCustom] = useState("75");
  const [relationship, setRelationship] = useState("Competitors");
  const [horizon, setHorizon] = useState("30 days");
  const [searched, setSearched] = useState(false);
  const distance = radius === "Custom" ? custom : radius;

  return (
    <section className="market-command">
      <header className="market-command-hero">
        <div>
          <span className="eyebrow"><Sparkles size={15} /> DAENEM MARKET INTELLIGENCE AI</span>
          <h2>Evidence before pricing.</h2>
          <p>Provider unavailable. This workspace will not invent a price, buyer, supplier, distance, contact, revenue effect or forecast.</p>
        </div>
        <div className="market-radius-orb" aria-label={`${distance} mile review radius`}>
          <Radar />
          <strong>{distance}</strong>
          <small>mile radius</small>
        </div>
      </header>

      <div className="market-controls">
        <SelectField label="Product" value={product} onChange={setProduct} options={products.map((value) => ({ value, label: value }))} />
        <SelectField label="Radius" value={radius} onChange={setRadius} options={radii.map((value) => ({ value, label: value === "Custom" ? value : `${value} miles` }))} />
        {radius === "Custom" && <label className="field">Custom miles<input type="number" min="1" max="1000" value={custom} onChange={(event) => setCustom(event.target.value)} /></label>}
        <SelectField label="Relationship" value={relationship} onChange={setRelationship} options={relationships.map((value) => ({ value, label: value }))} />
        <SelectField label="Forecast horizon" value={horizon} onChange={setHorizon} options={["7 days", "30 days", "90 days", "12 months"].map((value) => ({ value, label: value }))} />
        <Btn primary onClick={() => setSearched(true)}><Search size={16} /> Run evidence check</Btn>
      </div>

      <div className="market-body">
        <aside className="market-source-rail">
          <span className="eyebrow">AUTHORITATIVE SITE CONTEXT</span>
          <MapPinned size={27} />
          <strong>{farmConfiguration.name}</strong>
          <p>{farmConfiguration.address}</p>
          <small>Address is sourced from the canonical Farm configuration. Coordinates are not inferred.</small>
          <hr />
          {relationships.map((item) => (
            <button key={item} aria-pressed={relationship === item} onClick={() => setRelationship(item)}>
              {item === "Competitors" ? <Building2 /> : <UsersRound />}
              <span>{item}</span>
              <small>Discovery unavailable</small>
            </button>
          ))}
        </aside>

        <section className="market-evidence-stage">
          <div className="market-insufficient">
            <AlertTriangle />
            <span className="eyebrow">{searched ? "EVIDENCE CHECK COMPLETE" : "EVIDENCE NOT REQUESTED"}</span>
            <h2>INSUFFICIENT DATA</h2>
            <p>{searched ? `No verified ${product.toLowerCase()} observations were returned for the ${distance}-mile ${relationship.toLowerCase()} lens.` : "Run the design-fixture evidence check to inspect the honest empty result."}</p>
            <div className="market-evidence-facts">
              <span><small>Source</small><strong>Unavailable</strong></span>
              <span><small>Freshness</small><strong>Unavailable</strong></span>
              <span><small>Confidence</small><strong>Not assessed</strong></span>
              <span><small>Completeness</small><strong>0 verified fields</strong></span>
              <span><small>Observations</small><strong>0</strong></span>
              <span><small>Reason</small><strong>No connected evidence provider</strong></span>
            </div>
          </div>
          <Panel title="Price and recommendation boundary" description="Comparable units and dated sources are mandatory.">
            <DataTable headers={["Question", "Review result"]} rows={[
              ["Market low / high / average", "Withheld · no verified observations"],
              ["Daenem current price", "Authoritative pricing source required"],
              ["Recommended price", "Withheld"],
              ["Revenue / volume effect", "Not calculated"],
              ["Market gap / bundle proposal", "Not generated"],
            ]} />
          </Panel>
        </section>

        <aside className="market-forecast-rail">
          <CalendarRange size={25} />
          <span className="eyebrow">FORECAST HORIZONS</span>
          {["7 days", "30 days", "90 days", "12 months"].map((item) => (
            <button key={item} aria-pressed={horizon === item} onClick={() => setHorizon(item)}>
              <strong>{item}</strong>
              <small>Forecast withheld</small>
            </button>
          ))}
          <div className="market-report-state">
            <ShieldCheck />
            <strong>Daily Intelligence Report</strong>
            <p>Design ready. A report requires dated evidence, source citations, completeness and authorized distribution.</p>
            <Chip tone="amber">BACKEND + PROVIDER REQUIRED</Chip>
          </div>
        </aside>
      </div>
    </section>
  );
}
