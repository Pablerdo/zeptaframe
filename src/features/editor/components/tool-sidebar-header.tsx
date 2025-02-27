import { cn } from "@/lib/utils";

interface ToolSidebarHeaderProps {
  title: string;
  description?: string;
};

export const ToolSidebarHeader = ({
  title,
  description,
}: ToolSidebarHeaderProps) => {
  return (
    <div className="flex flex-col p-5 border-b">
      <h2 className="font-semibold text-lg text-foreground">
        {title}
      </h2>
      <p className="text-sm text-muted-foreground mt-1">
        {description}
      </p>
    </div>
  );
};
