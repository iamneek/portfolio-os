"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { useRouter } from "next/navigation";
import type { PortfolioData } from "@/lib/types";
import styles from "./desktop-shell.module.css";

type WindowId = "files" | "terminal";

type WindowDefinition = {
  id: WindowId;
  title: string;
};

type WindowState = {
  isOpen: boolean;
  minimized: boolean;
  maximized: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  z: number;
  restore: null | {
    x: number;
    y: number;
    width: number;
    height: number;
  };
};

const windows: WindowDefinition[] = [
  { id: "files", title: "File Manager" },
  { id: "terminal", title: "Terminal" },
];

const defaultGeometry: Record<WindowId, Omit<WindowState, "isOpen" | "minimized" | "maximized" | "z" | "restore">> = {
  files: { x: 180, y: 92, width: 660, height: 450 },
  terminal: { x: 320, y: 132, width: 620, height: 420 },
};

const defaultIconPositions: Record<WindowId, IconPosition> = {
  files: { x: 18, y: 90 },
  terminal: { x: 18, y: 188 },
};

type DesktopShellProps = {
  data: PortfolioData;
};

type SelectionState = {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
};

type IconPosition = {
  x: number;
  y: number;
};

type ResizeDirection = "se" | "sw";

type ContextMenuState = {
  x: number;
  y: number;
};

type TaskIconMenuState = {
  id: WindowId;
  x: number;
  y: number;
};

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function getTopVisibleWindowId(states: Record<WindowId, WindowState>): WindowId | null {
  const visibleIds = windows
    .map((item) => item.id)
    .filter((id) => states[id].isOpen && !states[id].minimized)
    .sort((a, b) => states[b].z - states[a].z);

  return visibleIds[0] ?? null;
}

export function DesktopShell({ data }: DesktopShellProps) {
  const router = useRouter();
  const desktopRef = useRef<HTMLDivElement | null>(null);
  const zRef = useRef(10);
  const [windowStates, setWindowStates] = useState<Record<WindowId, WindowState>>(() => {
    return windows.reduce<Record<WindowId, WindowState>>((acc, windowItem) => {
      acc[windowItem.id] = {
        ...defaultGeometry[windowItem.id],
        isOpen: false,
        minimized: false,
        maximized: false,
        z: 0,
        restore: null,
      };

      return acc;
    }, {} as Record<WindowId, WindowState>);
  });

  const [clock, setClock] = useState({
    time: "--:--",
    date: "--/--/----",
  });

  const dragRef = useRef<null | { id: WindowId; pointerX: number; pointerY: number; originX: number; originY: number }>(
    null,
  );
  const resizeRef = useRef<
    null | {
      id: WindowId;
      pointerX: number;
      pointerY: number;
      x: number;
      y: number;
      width: number;
      height: number;
      direction: ResizeDirection;
    }
  >(null);
  const shortcutRefs = useRef<Record<WindowId, HTMLButtonElement | null>>({ files: null, terminal: null });
  const iconDragRef = useRef<null | { id: WindowId; pointerX: number; pointerY: number; startX: number; startY: number }>(null);
  const [selectedIcons, setSelectedIcons] = useState<WindowId[]>([]);
  const [iconPositions, setIconPositions] = useState<Record<WindowId, IconPosition>>(defaultIconPositions);
  const [selection, setSelection] = useState<SelectionState | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [taskIconMenu, setTaskIconMenu] = useState<TaskIconMenuState | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [draggingIconId, setDraggingIconId] = useState<WindowId | null>(null);
  const topWindowId = useMemo(() => getTopVisibleWindowId(windowStates), [windowStates]);

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setClock({
        time: now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
        date: now.toLocaleDateString([], { day: "2-digit", month: "2-digit", year: "numeric" }),
      });
    };

    updateClock();
    const timer = window.setInterval(updateClock, 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    function onPointerMove(event: PointerEvent) {
      if (!iconDragRef.current) {
        return;
      }

      const drag = iconDragRef.current;
      const desktopRect = desktopRef.current?.getBoundingClientRect();
      const iconElement = shortcutRefs.current[drag.id];

      const iconWidth = iconElement?.offsetWidth ?? 98;
      const iconHeight = iconElement?.offsetHeight ?? 86;
      const minX = 6;
      const minY = 8;
      const maxX = desktopRect ? Math.max(minX, desktopRect.width - iconWidth - 6) : window.innerWidth - iconWidth - 6;
      const maxY = desktopRect
        ? Math.max(minY, desktopRect.height - iconHeight - 56)
        : window.innerHeight - iconHeight - 56;

      const deltaX = event.clientX - drag.pointerX;
      const deltaY = event.clientY - drag.pointerY;
      const nextX = Math.min(maxX, Math.max(minX, drag.startX + deltaX));
      const nextY = Math.min(maxY, Math.max(minY, drag.startY + deltaY));

      setIconPositions((current) => ({
        ...current,
        [drag.id]: {
          x: nextX,
          y: nextY,
        },
      }));
    }

    function onPointerUp() {
      iconDragRef.current = null;
      setDraggingIconId(null);
    }

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, []);

  useEffect(() => {
    function finishSelection() {
      setSelection((current) => {
        if (!current) {
          return null;
        }

        const left = Math.min(current.startX, current.currentX);
        const right = Math.max(current.startX, current.currentX);
        const top = Math.min(current.startY, current.currentY);
        const bottom = Math.max(current.startY, current.currentY);

        const hits = windows
          .map((windowItem) => {
            const element = shortcutRefs.current[windowItem.id];
            if (!element) {
              return null;
            }

            const rect = element.getBoundingClientRect();
            const intersects = rect.left < right && rect.right > left && rect.top < bottom && rect.bottom > top;
            return intersects ? windowItem.id : null;
          })
          .filter((id): id is WindowId => Boolean(id));

        setSelectedIcons(hits);
        return null;
      });
    }

    function onPointerMove(event: PointerEvent) {
      setSelection((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          currentX: event.clientX,
          currentY: event.clientY,
        };
      });
    }

    function onPointerUp() {
      finishSelection();
    }

    function onPointerCancel() {
      finishSelection();
    }

    function onWindowBlur() {
      setSelection(null);
    }

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerCancel);
    window.addEventListener("blur", onWindowBlur);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerCancel);
      window.removeEventListener("blur", onWindowBlur);
    };
  }, []);

  useEffect(() => {
    function onEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setContextMenu(null);
        setTaskIconMenu(null);
      }
    }

    function onGlobalPointerDown() {
      setContextMenu(null);
      setTaskIconMenu(null);
    }

    window.addEventListener("keydown", onEscape);
    window.addEventListener("pointerdown", onGlobalPointerDown);

    return () => {
      window.removeEventListener("keydown", onEscape);
      window.removeEventListener("pointerdown", onGlobalPointerDown);
    };
  }, []);

  useEffect(() => {
    function onPointerMove(event: PointerEvent) {
      if (dragRef.current) {
        const drag = dragRef.current;
        const deltaX = event.clientX - drag.pointerX;
        const deltaY = event.clientY - drag.pointerY;

        setWindowStates((current) => {
          const state = current[drag.id];
          if (!state.isOpen || state.maximized || state.minimized) {
            return current;
          }

          return {
            ...current,
            [drag.id]: {
              ...state,
              x: Math.max(8, drag.originX + deltaX),
              y: Math.max(8, drag.originY + deltaY),
            },
          };
        });
      }

      if (resizeRef.current) {
        const resize = resizeRef.current;
        const deltaX = event.clientX - resize.pointerX;
        const deltaY = event.clientY - resize.pointerY;
        const minWidth = 350;
        const minHeight = 250;

        setWindowStates((current) => {
          const state = current[resize.id];
          if (!state.isOpen || state.maximized || state.minimized) {
            return current;
          }

          let nextX = resize.x;
          let nextY = resize.y;
          let nextWidth = resize.width;
          let nextHeight = resize.height;

          if (resize.direction.includes("e")) {
            nextWidth = Math.max(minWidth, resize.width + deltaX);
          }

          if (resize.direction.includes("s")) {
            nextHeight = Math.max(minHeight, resize.height + deltaY);
          }

          if (resize.direction.includes("w")) {
            const candidateWidth = resize.width - deltaX;
            if (candidateWidth >= minWidth) {
              nextWidth = candidateWidth;
              nextX = resize.x + deltaX;
            } else {
              nextWidth = minWidth;
              nextX = resize.x + (resize.width - minWidth);
            }
          }

          if (resize.direction.includes("n")) {
            const candidateHeight = resize.height - deltaY;
            if (candidateHeight >= minHeight) {
              nextHeight = candidateHeight;
              nextY = resize.y + deltaY;
            } else {
              nextHeight = minHeight;
              nextY = resize.y + (resize.height - minHeight);
            }
          }

          nextX = Math.max(8, nextX);
          nextY = Math.max(8, nextY);

          return {
            ...current,
            [resize.id]: {
              ...state,
              x: nextX,
              y: nextY,
              width: nextWidth,
              height: nextHeight,
            },
          };
        });
      }
    }

    function onPointerUp() {
      dragRef.current = null;
      resizeRef.current = null;
    }

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, []);

  function nextZ() {
    zRef.current += 1;
    return zRef.current;
  }

  function focusWindow(id: WindowId) {
    setWindowStates((current) => {
      const state = current[id];
      if (!state.isOpen || state.minimized) {
        return current;
      }

      return {
        ...current,
        [id]: {
          ...state,
          z: nextZ(),
        },
      };
    });
  }

  function openWindow(id: WindowId) {
    setWindowStates((current) => {
      const state = current[id];
      return {
        ...current,
        [id]: {
          ...state,
          isOpen: true,
          minimized: false,
          z: nextZ(),
        },
      };
    });
  }

  function closeWindow(id: WindowId) {
    setWindowStates((current) => {
      const state = current[id];
      return {
        ...current,
        [id]: {
          ...state,
          isOpen: false,
          minimized: false,
          maximized: false,
          restore: null,
          ...defaultGeometry[id],
        },
      };
    });
  }

  function minimizeWindow(id: WindowId) {
    setWindowStates((current) => {
      const state = current[id];
      if (!state.isOpen) {
        return current;
      }

      return {
        ...current,
        [id]: {
          ...state,
          minimized: true,
        },
      };
    });
  }

  function toggleMaximizeWindow(id: WindowId) {
    setWindowStates((current) => {
      const state = current[id];
      if (!state.isOpen || state.minimized) {
        return current;
      }

      if (!state.maximized) {
        return {
          ...current,
          [id]: {
            ...state,
            maximized: true,
            x: 8,
            y: 8,
            width: Math.max(380, window.innerWidth - 16),
            height: Math.max(280, window.innerHeight - 74),
            z: nextZ(),
            restore: {
              x: state.x,
              y: state.y,
              width: state.width,
              height: state.height,
            },
          },
        };
      }

      return {
        ...current,
        [id]: {
          ...state,
          maximized: false,
          x: state.restore?.x ?? defaultGeometry[id].x,
          y: state.restore?.y ?? defaultGeometry[id].y,
          width: state.restore?.width ?? defaultGeometry[id].width,
          height: state.restore?.height ?? defaultGeometry[id].height,
          z: nextZ(),
          restore: null,
        },
      };
    });
  }

  function launchFromDesktop(id: WindowId) {
    const state = windowStates[id];
    if (!state.isOpen) {
      openWindow(id);
      return;
    }

    if (state.minimized) {
      setWindowStates((current) => ({
        ...current,
        [id]: {
          ...current[id],
          minimized: false,
          z: nextZ(),
        },
      }));
      return;
    }

    focusWindow(id);
  }

  function clickTaskbarIcon(id: WindowId) {
    const state = windowStates[id];
    if (!state.isOpen) {
      openWindow(id);
      return;
    }

    if (state.minimized) {
      setWindowStates((current) => ({
        ...current,
        [id]: {
          ...current[id],
          minimized: false,
          z: nextZ(),
        },
      }));
      return;
    }

    if (topWindowId === id) {
      minimizeWindow(id);
      return;
    }

    focusWindow(id);
  }

  function startDragging(id: WindowId, clientX: number, clientY: number) {
    const state = windowStates[id];
    if (!state.isOpen || state.minimized) {
      return;
    }

    if (state.maximized) {
      const restored = state.restore ?? defaultGeometry[id];
      const ratioX = state.width > 0 ? (clientX - state.x) / state.width : 0.5;
      const clampedRatioX = Math.min(0.9, Math.max(0.1, ratioX));
      const nextX = Math.max(8, Math.min(window.innerWidth - restored.width - 8, clientX - restored.width * clampedRatioX));
      const nextY = Math.max(8, clientY - 18);

      setWindowStates((current) => ({
        ...current,
        [id]: {
          ...current[id],
          maximized: false,
          x: nextX,
          y: nextY,
          width: restored.width,
          height: restored.height,
          z: nextZ(),
          restore: null,
        },
      }));

      dragRef.current = {
        id,
        pointerX: clientX,
        pointerY: clientY,
        originX: nextX,
        originY: nextY,
      };

      return;
    }

    dragRef.current = {
      id,
      pointerX: clientX,
      pointerY: clientY,
      originX: state.x,
      originY: state.y,
    };

    focusWindow(id);
  }

  function startResizing(id: WindowId, clientX: number, clientY: number, direction: ResizeDirection = "se") {
    const state = windowStates[id];
    if (!state.isOpen || state.maximized || state.minimized) {
      return;
    }

    resizeRef.current = {
      id,
      pointerX: clientX,
      pointerY: clientY,
      x: state.x,
      y: state.y,
      width: state.width,
      height: state.height,
      direction,
    };

    focusWindow(id);
  }

  function getResizeDirection(rect: DOMRect, clientX: number, clientY: number): ResizeDirection | null {
    const edge = 10;
    const nearLeft = clientX - rect.left <= edge;
    const nearRight = rect.right - clientX <= edge;
    const nearBottom = rect.bottom - clientY <= edge;

    if (nearBottom && nearLeft) return "sw";
    if (nearBottom && nearRight) return "se";

    return null;
  }

  function startDesktopSelection(event: ReactPointerEvent<HTMLDivElement>) {
    setContextMenu(null);
    setTaskIconMenu(null);

    if (event.target !== event.currentTarget || event.button !== 0) {
      return;
    }

    setSelectedIcons([]);
    setSelection({
      startX: event.clientX,
      startY: event.clientY,
      currentX: event.clientX,
      currentY: event.clientY,
    });
  }

  function startIconDrag(id: WindowId, event: ReactPointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) {
      return;
    }

    event.stopPropagation();

    const position = iconPositions[id];
    iconDragRef.current = {
      id,
      pointerX: event.clientX,
      pointerY: event.clientY,
      startX: position.x,
      startY: position.y,
    };

    setDraggingIconId(id);
    setSelectedIcons([id]);
  }

  function openDesktopMenu(event: React.MouseEvent<HTMLDivElement>) {
    event.preventDefault();
    setTaskIconMenu(null);

    const menuWidth = 190;
    const menuHeight = 166;

    const x = Math.min(event.clientX, window.innerWidth - menuWidth - 8);
    const y = Math.min(event.clientY, window.innerHeight - menuHeight - 8);

    setContextMenu({ x, y });
  }

  function refreshDesktop() {
    setContextMenu(null);
    setTaskIconMenu(null);
    setSelectedIcons([]);
    setIconPositions(defaultIconPositions);
    setSelection(null);
    setIsRefreshing(true);

    window.setTimeout(() => {
      setIsRefreshing(false);
    }, 180);

    router.refresh();
  }

  function openHelp() {
    setContextMenu(null);
    setTaskIconMenu(null);
    openWindow("terminal");
  }

  function openGithub() {
    setContextMenu(null);
    setTaskIconMenu(null);
    window.open(data.profile.url, "_blank", "noopener,noreferrer");
  }

  function openContact() {
    setContextMenu(null);
    setTaskIconMenu(null);
    const profileUrl = data.profile.url.replace(/\/+$/, "");
    window.open(`${profileUrl}?tab=followers`, "_blank", "noopener,noreferrer");
  }

  function openTaskIconMenu(event: React.MouseEvent<HTMLButtonElement>, id: WindowId) {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu(null);

    const menuWidth = 168;
    const menuHeight = 86;
    const x = Math.min(event.clientX, window.innerWidth - menuWidth - 8);
    const y = Math.min(event.clientY, window.innerHeight - menuHeight - 8);

    setTaskIconMenu({ id, x, y });
  }

  function centerWindowFromMenu() {
    if (!taskIconMenu) {
      return;
    }

    const { id } = taskIconMenu;
    setTaskIconMenu(null);

    setWindowStates((current) => {
      const state = current[id];
      const restored = state.restore ?? defaultGeometry[id];
      const width = state.isOpen && !state.maximized ? state.width : restored.width;
      const height = state.isOpen && !state.maximized ? state.height : restored.height;
      const x = Math.max(8, Math.floor((window.innerWidth - width) / 2));
      const y = Math.max(8, Math.floor((window.innerHeight - 42 - height) / 2));

      return {
        ...current,
        [id]: {
          ...state,
          isOpen: true,
          minimized: false,
          maximized: false,
          x,
          y,
          width,
          height,
          z: nextZ(),
          restore: null,
        },
      };
    });
  }

  function closeWindowFromMenu() {
    if (!taskIconMenu) {
      return;
    }

    const { id } = taskIconMenu;
    setTaskIconMenu(null);
    closeWindow(id);
  }

  function openWindowFromMenu() {
    if (!taskIconMenu) {
      return;
    }

    const { id } = taskIconMenu;
    setTaskIconMenu(null);
    openWindow(id);
  }

  const selectionStyle = selection
    ? {
        left: `${Math.min(selection.startX, selection.currentX)}px`,
        top: `${Math.min(selection.startY, selection.currentY)}px`,
        width: `${Math.abs(selection.currentX - selection.startX)}px`,
        height: `${Math.abs(selection.currentY - selection.startY)}px`,
      }
    : undefined;

  return (
    <div
      ref={desktopRef}
      className={`${styles.desktop} ${isRefreshing ? styles.refreshFlash : ""}`}
      onPointerDown={startDesktopSelection}
      onContextMenu={openDesktopMenu}
    >
      <div className={styles.paperNoise} aria-hidden />

      <aside className={styles.shortcuts}>
        {windows.map((windowItem) => (
          <button
            type="button"
            className={`${styles.shortcut} ${selectedIcons.includes(windowItem.id) ? styles.shortcutSelected : ""} ${
              draggingIconId === windowItem.id ? styles.shortcutDragging : ""
            }`}
            key={windowItem.id}
            style={{ left: `${iconPositions[windowItem.id].x}px`, top: `${iconPositions[windowItem.id].y}px` }}
            onDoubleClick={() => launchFromDesktop(windowItem.id)}
            onClick={() => {
              if (!draggingIconId) {
                setSelectedIcons([windowItem.id]);
              }
            }}
            onPointerDown={(event) => startIconDrag(windowItem.id, event)}
            title={`${windowItem.title} (double click to open)`}
            ref={(element) => {
              shortcutRefs.current[windowItem.id] = element;
            }}
          >
            <AppIcon id={windowItem.id} className={styles.shortcutIcon} />
            <span>{windowItem.title}</span>
          </button>
        ))}
      </aside>

      {selection ? <div className={styles.selectionBox} style={selectionStyle} aria-hidden /> : null}

      {contextMenu ? (
        <div
          className={styles.contextMenu}
          style={{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }}
          onPointerDown={(event) => event.stopPropagation()}
          onContextMenu={(event) => event.preventDefault()}
        >
          <button type="button" className={styles.contextItem} onClick={refreshDesktop}>
            Refresh
          </button>
          <button type="button" className={styles.contextItem} onClick={openHelp}>
            Help
          </button>
          <button type="button" className={styles.contextItem} onClick={openGithub}>
            GitHub
          </button>
          <button type="button" className={styles.contextItem} onClick={openContact}>
            Contact Me
          </button>
        </div>
      ) : null}

      <main className={styles.stage}>
        {windows
          .filter((windowItem) => windowStates[windowItem.id].isOpen && !windowStates[windowItem.id].minimized)
          .sort((a, b) => windowStates[a.id].z - windowStates[b.id].z)
          .map((windowItem) => {
            const state = windowStates[windowItem.id];
            const isFocused = topWindowId === windowItem.id;

            return (
              <section
                key={windowItem.id}
                data-window-id={windowItem.id}
                className={`${styles.window} ${isFocused ? styles.focused : ""}`}
                style={{
                  top: `${state.y}px`,
                  left: `${state.x}px`,
                  width: `${state.width}px`,
                  height: `${state.height}px`,
                  zIndex: state.z,
                }}
                onPointerDown={(event) => {
                  const rect = event.currentTarget.getBoundingClientRect();
                  const direction = getResizeDirection(rect, event.clientX, event.clientY);
                  if (direction) {
                    startResizing(windowItem.id, event.clientX, event.clientY, direction);
                    return;
                  }

                  focusWindow(windowItem.id);
                }}
              >
                <header
                  className={styles.windowBar}
                  onPointerDown={(event) => {
                    if ((event.target as HTMLElement).closest(`.${styles.windowControls}`)) {
                      return;
                    }
                    startDragging(windowItem.id, event.clientX, event.clientY);
                  }}
                >
                  <div className={styles.windowSpacer} />
                  <div className={styles.windowTitle}>
                    <AppIcon id={windowItem.id} className={styles.windowIcon} />
                    <h2>{windowItem.title}</h2>
                  </div>
                  <div className={styles.windowControls}>
                    <button
                      type="button"
                      className={`${styles.control} ${styles.closeButton}`}
                      onClick={() => closeWindow(windowItem.id)}
                      title="Close"
                      aria-label="Close"
                    >
                      <CloseIcon />
                    </button>
                    <button
                      type="button"
                      className={`${styles.control} ${styles.minimizeButton}`}
                      onClick={() => minimizeWindow(windowItem.id)}
                      title="Minimize"
                      aria-label="Minimize"
                    >
                      <MinimizeIcon />
                    </button>
                    <button
                      type="button"
                      className={`${styles.control} ${styles.maximizeButton}`}
                      onClick={() => toggleMaximizeWindow(windowItem.id)}
                      title={state.maximized ? "Restore" : "Maximize"}
                      aria-label={state.maximized ? "Restore" : "Maximize"}
                    >
                      {state.maximized ? <RestoreIcon /> : <MaximizeIcon />}
                    </button>
                  </div>
                </header>
                <div className={styles.windowBody}>{renderWindow(windowItem.id, data)}</div>
                <button
                  type="button"
                  className={styles.resizeHandle}
                  onPointerDown={(event) => startResizing(windowItem.id, event.clientX, event.clientY)}
                  aria-label="Resize window"
                />
              </section>
            );
          })}
      </main>

      <footer className={styles.taskbar}>
        <div className={styles.taskbarLeft} />
        <div className={styles.centerDock}>
          <button type="button" className={styles.start} title="Start Menu">
            <StartIcon />
          </button>
          <div className={styles.taskItems}>
            {windows.map((windowItem) => (
              <button
                type="button"
                key={windowItem.id}
                className={`${styles.taskItem} ${windowStates[windowItem.id].isOpen ? styles.openTask : ""} ${
                  windowStates[windowItem.id].minimized ? styles.minimizedTask : ""
                } ${
                  topWindowId === windowItem.id && windowStates[windowItem.id].isOpen && !windowStates[windowItem.id].minimized
                    ? styles.activeTask
                    : ""
                }`}
                onClick={() => clickTaskbarIcon(windowItem.id)}
                onContextMenu={(event) => openTaskIconMenu(event, windowItem.id)}
                title={windowItem.title}
              >
                <AppIcon id={windowItem.id} className={styles.taskIcon} />
              </button>
            ))}
          </div>
        </div>
        <div className={styles.tray}>
          <div className={styles.trayIcons}>
            <ArrowIcon />
            <VolumeIcon />
            <BatteryIcon />
          </div>
          <div className={styles.clock}>
            <span>{clock.time}</span>
            <span>{clock.date}</span>
          </div>
        </div>
      </footer>

      {taskIconMenu ? (
        <div
          className={styles.contextMenu}
          style={{ left: `${taskIconMenu.x}px`, top: `${taskIconMenu.y}px` }}
          onPointerDown={(event) => event.stopPropagation()}
          onContextMenu={(event) => event.preventDefault()}
        >
          {windowStates[taskIconMenu.id].isOpen ? (
            <>
              <button type="button" className={styles.contextItem} onClick={centerWindowFromMenu}>
                Center Window
              </button>
              <button type="button" className={styles.contextItem} onClick={closeWindowFromMenu}>
                Close Window
              </button>
            </>
          ) : (
            <button type="button" className={styles.contextItem} onClick={openWindowFromMenu}>
              Open App
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}

function renderWindow(id: WindowId, data: PortfolioData) {
  if (id === "terminal") {
    return (
      <div className={styles.terminal}>
        <p className={styles.terminalPrompt}>C:\Users\portfolio&gt; whoami</p>
        <p>{data.profile.name} (@{data.profile.login})</p>
        <p>{data.profile.bio}</p>
        <p className={styles.terminalPrompt}>C:\Users\portfolio&gt; list projects --top 3</p>
        <ul className={styles.terminalList}>
          {data.projects.slice(0, 3).map((project) => (
            <li key={project.id}>
              <span>{project.name}</span>
              <span>{project.language}</span>
              <span>{formatDate(project.updatedAt)}</span>
            </li>
          ))}
        </ul>
        <p className={styles.terminalPrompt}>C:\Users\portfolio&gt; list blogs --top 2</p>
        <ul className={styles.terminalList}>
          {data.blogs.slice(0, 2).map((post) => (
            <li key={post.id}>
              <span>{post.title}</span>
              <a href={post.url} target="_blank" rel="noreferrer">
                open
              </a>
            </li>
          ))}
        </ul>
        <p className={styles.terminalPrompt}>C:\Users\portfolio&gt; list failures --top 2</p>
        <ul className={styles.terminalList}>
          {data.failures.slice(0, 2).map((failure) => (
            <li key={failure.id}>
              <span>{failure.title}</span>
              <span>{failure.state}</span>
              <a href={failure.url} target="_blank" rel="noreferrer">
                open
              </a>
            </li>
          ))}
        </ul>
        <p className={styles.terminalPrompt}>C:\Users\portfolio&gt;_</p>
      </div>
    );
  }

  return (
    <div className={styles.fileManagerBlank}>
      <div className={styles.fileManagerToolbar}>
        <button type="button">&lt;</button>
        <button type="button">&gt;</button>
        <button type="button">^</button>
        <div className={styles.pathBar}>This PC &gt; Portfolio</div>
      </div>
      <div className={styles.fileManagerBody}>
        <p className={styles.fileManagerHint}>File manager stays uncluttered for now.</p>
      </div>
    </div>
  );
}

type IconProps = {
  id: WindowId;
  className?: string;
};

function AppIcon({ id, className }: IconProps) {
  if (id === "files") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M3 7h7l2 2h9v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" stroke="currentColor" strokeWidth="1.8" />
        <path d="M3 10h18" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    );
  }

  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="4" y="5" width="16" height="14" rx="1" stroke="currentColor" strokeWidth="1.8" />
      <path d="M7 8h10M7 12h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="m13 16 2-2m0 0 2 2m-2-2v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function StartIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M5 19V5h3l6 9V5h3v14h-3l-6-9v9H5Z" fill="currentColor" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="m7 14 5-5 5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MinimizeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.4" />
      <path d="M8 12h8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function MaximizeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.4" />
      <path d="M8 12h8M12 8v8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function RestoreIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.4" />
      <path d="M8 14h8M14 8v8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.4" />
      <path d="m9 9 6 6m0-6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function VolumeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 14h4l5 4V6L8 10H4z" stroke="currentColor" strokeWidth="1.6" />
      <path d="M16 9c1.2 1 1.2 5 0 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M19 7c2 2 2 8 0 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function BatteryIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="8" width="16" height="8" rx="1" stroke="currentColor" strokeWidth="1.6" />
      <path d="M21 10v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <rect x="5" y="10" width="10" height="4" fill="currentColor" />
    </svg>
  );
}
