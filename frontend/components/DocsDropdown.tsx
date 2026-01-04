import { useNavigate } from "react-router-dom";
import { BookOpen, FileText, GitFork, ExternalLink } from "lucide-react";
import { Button } from "./ui/button";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "./ui/dropdown-menu";

export function DocsDropdown() {
  const navigate = useNavigate();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <BookOpen className="size-4" />
          Docs
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => navigate("/docs/install")}>
          <div className="flex items-center gap-2 w-full">
            <FileText className="size-4" />
            <span>Install in your repo</span>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate("/docs/reviewers")}>
          <div className="flex items-center gap-2 w-full">
            <BookOpen className="size-4" />
            <span>Reviewer guide</span>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => window.open("https://github.com/your-org/ai-gatekeeper/tree/main/examples/repo-b-template", "_blank")}>
          <div className="flex items-center gap-2 w-full">
            <GitFork className="size-4" />
            <span>Template repo</span>
            <ExternalLink className="size-3 ml-auto text-muted-foreground" />
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
