import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SearchableSelect } from "./SearchableSelect";

describe("SearchableSelect", () => {
  it("uses the branded icon control and exposes its listbox state", () => {
    render(<SearchableSelect
      ariaLabel="Planning for person"
      value="Jasper"
      options={[{ value: "Jasper", label: "Jasper (you)" }]}
      onChange={vi.fn()}
    />);

    const input = screen.getByRole("combobox", { name: "Planning for person" });
    const toggle = screen.getByRole("button", { name: "Show Planning for person options" });

    expect(input).toHaveAttribute("aria-haspopup", "listbox");
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle.querySelector("svg")).toBeInTheDocument();

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("listbox")).toBeInTheDocument();
  });
});
