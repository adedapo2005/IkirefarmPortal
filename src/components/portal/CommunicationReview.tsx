"use client";
import React from "react";
export default function CommunicationReview() {
  const links = [
    ["Communication Center", "communication"],
    ["Customer timeline / profile", "customers"],
    ["Email / WhatsApp / AI Composer", "communication"],
    ["Invoice / payment / delivery context", "customers"],
    ["Customer Appreciation template", "comm-templates"],
    ["Thank You / Delivery / Re-engagement automation", "comm-automation"],
    ["Campaigns & opt-out", "comm-campaigns"],
    ["Feedback", "comm-feedback"],
    ["Complaints", "comm-complaints"],
    ["Provider & support settings", "comm-settings"],
    ["Communication analytics", "comm-analytics"],
  ];
  return (
    <section className="mt">
      <h2 className="mt">Customer Communication review</h2>
      <p className="mt">
        All records are fictional. Provider connection, AI generation and real
        delivery are unavailable. Use Review state to inspect loading, empty,
        error and offline surfaces.
      </p>
      <div className="review-page-grid mt">
        {links.map(([label, id]) => (
          <a
            className="review-page"
            href={`/review/app?persona=owner&theme=dock#/${id}`}
            key={label}
          >
            <h3>{label}</h3>
            <p>Open authorized sample workflow →</p>
          </a>
        ))}
        <a
          className="review-page"
          href="/review/frame?width=390&height=844&page=communication&persona=owner&theme=dock"
        >
          <h3>Mobile conversation workflow</h3>
          <p>Customer list → conversation → composer sheet</p>
        </a>
      </div>
    </section>
  );
}
