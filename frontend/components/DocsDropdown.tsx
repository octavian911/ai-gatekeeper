import { useNavigate } from "react-router-dom";
import { BookOpen, FileText, GitFork, ExternalLink } from "lucide-react";
import { Button } from "./ui/button";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "./ui/dropdown-menu";
import { LINKS } from "@/lib/constants";

const TEMPLATE_REPO_URL = LINKS.templateRepo;

export function DocsDropdown() {
  const navigate = useNavigate();

  const isValidGitHubUrl = TEMPLATE_REPO_URL.startsWith("https://github.com/");
  const isTemplateRepoConfigured = TEMPLATE_REPO_URL && isValidGitHubUrl;

  if (!isValidGitHubUrl && TEMPLATE_REPO_URL) {
    console.warn("Template repo URL is not a valid GitHub URL:", TEMPLATE_REPO_URL);
  }

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
        {isTemplateRepoConfigured ? (
          <DropdownMenuItem asChild>
            <a href={TEMPLATE_REPO_URL} target="_blank" rel="noreferrer" className="flex items-center gap-2 w-full">
              <GitFork className="size-4" />
              <span>Template repo</span>
              <ExternalLink className="size-3 ml-auto text-muted-foreground" />
            </a>
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem disabled>
            <div className="flex items-center gap-2 w-full">
              <GitFork className="size-4" />
              <span>Template repo (coming soon)</span>
            </div>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
