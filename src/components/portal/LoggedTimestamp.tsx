import { loggedInstant, recordedDateOnly, recordedWallTime } from "@/lib/logged-instant";
import styles from "./LoggedTimestamp.module.css";

export default function LoggedTimestamp({ value }: { value: unknown }) {
  const time = loggedInstant(value);
  if (!time) {
    const date = recordedDateOnly(value);
    const wall = recordedWallTime(value);
    return <span className={styles.unavailable}>{date ? `${date} · Time not recorded` : wall ? `${wall} · Time zone unconfirmed` : "Recorded time unavailable or time zone unconfirmed"}</span>;
  }
  return <time className={styles.time} dateTime={time.iso}>
    <span>Nigeria Time: {time.nigeria}</span>
    <span>New York Time: {time.newYork}</span>
  </time>;
}
