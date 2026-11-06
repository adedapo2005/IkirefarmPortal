import { reviewMetadata } from "@/lib/review-metadata";
import LoggedTimestamp from "./LoggedTimestamp";

export default function ReviewRevision() {
  const receipt = reviewMetadata.lastVerifiedSiteReceipt;
  return (
    <>
      <section className="review-revision" aria-label="Canonical review metadata">
        <span className="eyebrow">DAENEM FARMS · PRIVATE REVIEW</span>
        <dl>
          <div>
            <dt>Current review candidate</dt>
            <dd>{reviewMetadata.reviewRevision}</dd>
          </div>
          <div>
            <dt>Source revision</dt>
            <dd>{reviewMetadata.sourceRevision}</dd>
          </div>
          <div>
            <dt>Content revision updated</dt>
            <dd><LoggedTimestamp value={reviewMetadata.contentRevisionUpdatedUtc}/></dd>
          </div>
          <div>
            <dt>Last verified Site receipt</dt>
            <dd>{receipt.reviewRevision} · <LoggedTimestamp value={receipt.publishedAtUtc}/></dd>
          </div>
          <div>
            <dt>Sites identity</dt>
            <dd>
              Version {receipt.siteVersion} · {receipt.deploymentId}
            </dd>
          </div>
          <div>
            <dt>ZIP revision</dt>
            <dd>{reviewMetadata.zipRevision}</dd>
          </div>
        </dl>
        <p>
          One canonical configuration supplies Sign-In and Review Hub. Static
          Site code cannot read its own current deployment receipt, so the
          content revision and last receipt known to this build are intentionally
          separate. Neither value changes on page refresh.
        </p>
      </section>
      <section
        className="publication-history"
        aria-labelledby="publication-history-title"
      >
        <div>
          <span className="eyebrow">VERIFIED RECEIPTS ONLY</span>
          <h2 id="publication-history-title">Publication history</h2>
        </div>
        <div className="publication-history-list">
          {reviewMetadata.publicationHistory.map((entry) => (
            <article key={entry.deploymentId}>
              <strong>{entry.reviewRevision}</strong>
              <LoggedTimestamp value={entry.publishedAtUtc}/>
              <small>Source {entry.sourceCommit}</small>
              <small>
                Site version {entry.siteVersion} · {entry.deploymentId}
              </small>
              <p>{entry.scope}</p>
              <small>ZIP: {entry.zipStatus}</small>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
