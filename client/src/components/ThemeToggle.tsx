import { useState } from "react";
import { getTheme, toggleTheme } from "../lib/theme";
import { MoonIcon, SunIcon } from "./icons";
import { Button } from "./ui/button";

export function ThemeToggle() {
  const [theme, setThemeState] = useState(getTheme());

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      onClick={() => setThemeState(toggleTheme())}
    >
      {theme === "dark" ? <SunIcon className="h-5 w-5" /> : <MoonIcon className="h-5 w-5" />}
    </Button>
  );
}