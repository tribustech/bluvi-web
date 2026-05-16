import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-[2px] px-1.5 py-[2.5px] text-xs font-bold uppercase tracking-wider transition-colors",
  {
    variants: {
      variant: {
        default: "bg-indigo-5 text-white",
        secondary: "bg-indigo-1 text-indigo-7",
        destructive: "bg-red-5 text-white",
        outline: "border border-gray-2 bg-white text-gray-7",
        indigo: "bg-indigo-1 text-indigo-5",
        solidIndigo: "bg-indigo-5 text-white",
        green: "bg-green-2 text-green-7",
        gray: "bg-gray-1 text-gray-7",
        yellow: "bg-yellow-1 text-yellow-6",
        red: "bg-red-1 text-red-5",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
