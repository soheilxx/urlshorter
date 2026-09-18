import Image from "next/image";
import type { CardsPrize } from "@/lib/cards-giveaway-config";
import { cn } from "@/lib/utils";

/**
 * Produkt-Bühne eines Cards-Gewinns mit ECHTEM Produktbild:
 * - holografischer Kartenrahmen in der Franchise-Farbwelt, Lichtscheibe,
 * - bei Cases zwei versetzte „Geister“-Kopien hinter der Box (Stapel = mehrere
 *   Boxen) plus Umfangs-Badge („1 Case = 12 Boxes“), bei Displays nur Badge,
 * - Bildunterschrift benennt, was die Abbildung zeigt (Box aus dem Case).
 * Bildquellen und Herkunft: docs/cards-kampagne.md.
 */
export function ProductShowcase({
  prize,
  size = "panel",
  priority = false,
  className,
  showCaption = true,
  sizes,
}: {
  prize: CardsPrize;
  size?: "hero" | "panel" | "mini";
  priority?: boolean;
  className?: string;
  showCaption?: boolean;
  /** next/image sizes-Attribut passend zur Platzierung */
  sizes?: string;
}) {
  const image = prize.image;
  if (!image) return null;
  const isCase = prize.form === "case";
  const imgSizes =
    sizes ??
    (size === "hero"
      ? "(min-width: 1024px) 520px, 80vw"
      : size === "mini"
        ? "(min-width: 1024px) 220px, 45vw"
        : "(min-width: 1024px) 320px, 70vw");

  return (
    <figure className={cn("cd-show", `cd-show--${prize.world}`, `cd-show--${size}`, className)}>
      <div className="cd-show-frame">
        <div className="cd-show-glow" aria-hidden="true" />
        <div className="cd-show-tex" aria-hidden="true" />
        <div className="cd-show-stage">
          {isCase ? (
            <>
              <div className="cd-ghost cd-ghost--2" aria-hidden="true">
                <Image src={image.src} alt="" fill sizes={imgSizes} className="object-contain" />
              </div>
              <div className="cd-ghost cd-ghost--1" aria-hidden="true">
                <Image src={image.src} alt="" fill sizes={imgSizes} className="object-contain" />
              </div>
            </>
          ) : null}
          <div className="cd-show-img">
            <Image
              src={image.src}
              alt={image.alt}
              fill
              priority={priority}
              sizes={imgSizes}
              className="object-contain drop-shadow-[0_24px_40px_rgba(0,0,0,0.65)]"
            />
          </div>
        </div>
        {prize.badge ? (
          <span
            className={cn(
              "cd-show-badge",
              isCase ? "cd-show-badge--case" : "cd-show-badge--display",
            )}
          >
            {isCase ? (
              <span className="cd-show-badge-count" aria-hidden="true">
                ×12
              </span>
            ) : null}
            {prize.badge}
          </span>
        ) : null}
        {prize.main ? <span className="cd-show-rarity">Hauptgewinn</span> : null}
      </div>
      {showCaption ? <figcaption className="cd-show-caption">{image.caption}</figcaption> : null}
    </figure>
  );
}
