import { Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudMoon, CloudOff, CloudRain, CloudSnow, CloudSun, Moon, Sun } from "lucide-react";

export default function WeatherSymbol({
  code,
  day = true,
  size = 28,
}: {
  code?: string | number;
  day?: boolean;
  size?: number;
}) {
  const key = String(code || "").toLowerCase();
  const Icon =
    !key || key === "unknown"
      ? CloudOff
      : /storm|thunder/.test(key)
        ? CloudLightning
        : /snow|ice/.test(key)
          ? CloudSnow
          : /drizzle/.test(key)
            ? CloudDrizzle
            : /rain|shower/.test(key)
              ? CloudRain
              : /fog|mist|haze/.test(key)
                ? CloudFog
                : /partly|mostly|mainly/.test(key)
                  ? day
                    ? CloudSun
                    : CloudMoon
                  : /^clear|sunny|1000/.test(key)
                    ? day
                      ? Sun
                      : Moon
                    : Cloud;

  return <Icon size={size} strokeWidth={1.65} aria-hidden="true" />;
}
