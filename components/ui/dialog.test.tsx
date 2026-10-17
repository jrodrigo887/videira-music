// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Dialog } from "./dialog";

afterEach(() => {
  cleanup();
  document.body.style.overflow = "";
});

describe("Dialog", () => {
  it("exposes dialog semantics on the panel", () => {
    render(
      <Dialog open title="Título" onClose={() => {}}>
        <p>Corpo</p>
      </Dialog>,
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    const labelledBy = dialog.getAttribute("aria-labelledby");
    expect(labelledBy).toBeTruthy();
    expect(document.getElementById(labelledBy!)).toHaveTextContent("Título");
  });

  it("locks body scroll and focuses the panel when opened", () => {
    document.body.style.overflow = "scroll";
    render(
      <Dialog open title="Título" onClose={() => {}}>
        <p>Corpo</p>
      </Dialog>,
    );
    expect(document.body.style.overflow).toBe("hidden");
    expect(screen.getByRole("dialog")).toHaveFocus();
  });

  it("calls onClose once when Escape is pressed", () => {
    const onClose = vi.fn();
    render(
      <Dialog open title="Título" onClose={onClose}>
        <p>Corpo</p>
      </Dialog>,
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes on overlay click when closeOnOverlay is true", () => {
    const onClose = vi.fn();
    const { container } = render(
      <Dialog open title="Título" onClose={onClose} closeOnOverlay>
        <p>Corpo</p>
      </Dialog>,
    );
    fireEvent.click(container.firstElementChild!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not close on overlay click when closeOnOverlay is false", () => {
    const onClose = vi.fn();
    const { container } = render(
      <Dialog open title="Título" onClose={onClose} closeOnOverlay={false}>
        <p>Corpo</p>
      </Dialog>,
    );
    fireEvent.click(container.firstElementChild!);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("restores overflow and focus when closed", () => {
    const trigger = document.createElement("button");
    trigger.textContent = "Abrir";
    document.body.append(trigger);
    trigger.focus();
    document.body.style.overflow = "auto";

    const { rerender } = render(
      <Dialog open title="Título" onClose={() => {}}>
        <p>Corpo</p>
      </Dialog>,
    );

    rerender(
      <Dialog open={false} title="Título" onClose={() => {}}>
        <p>Corpo</p>
      </Dialog>,
    );

    expect(document.body.style.overflow).toBe("auto");
    expect(trigger).toHaveFocus();
    trigger.remove();
  });

  it("closes without error when there was no focused element", () => {
    (document.activeElement as HTMLElement | null)?.blur?.();
    const { rerender } = render(
      <Dialog open title="Título" onClose={() => {}}>
        <p>Corpo</p>
      </Dialog>,
    );
    expect(() =>
      rerender(
        <Dialog open={false} title="Título" onClose={() => {}}>
          <p>Corpo</p>
        </Dialog>,
      ),
    ).not.toThrow();
  });
});
