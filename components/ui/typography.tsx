import { cn } from "@/lib/utils";

type Preset = "heading1" | "heading2" | "heading3" | "body" | "body2" | "helper" | "helper2";

const presetClasses: Record<Preset, string> = {
  heading1: "font-nunito text-xl font-bold leading-8 md:text-2xl",
  heading2: "font-nunito text-base font-bold leading-6",
  heading3: "font-nunito text-sm font-bold leading-6",
  body: "font-nunito text-base font-semibold leading-5",
  body2: "font-nunito text-sm font-semibold leading-[18px]",
  helper: "font-nunito text-sm font-bold leading-5",
  helper2: "font-nunito text-xs font-bold leading-[15px]",
};

interface TypographyProps extends React.HTMLAttributes<HTMLElement> {
  preset?: Preset;
  as?: "h1" | "h2" | "h3" | "h4" | "p" | "span" | "label" | "div";
  color?: string;
}

export function Typography({
  preset = "body",
  as: Tag = "p",
  color,
  className,
  style,
  ...props
}: TypographyProps) {
  return <Tag className={cn(presetClasses[preset], className)} style={{ color, ...style }} {...props} />;
}
