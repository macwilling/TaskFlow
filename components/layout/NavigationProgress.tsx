"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

export function NavigationProgress() {
  const pathname = usePathname();
  const [width, setWidth] = useState(0);
  const [visible, setVisible] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const completedPathname = useRef(pathname);

  function clearTimers() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }

  function startProgress() {
    clearTimers();
    setVisible(true);
    setWidth(15);
    timers.current.push(setTimeout(() => setWidth(40), 100));
    timers.current.push(setTimeout(() => setWidth(65), 400));
    timers.current.push(setTimeout(() => setWidth(80), 900));
  }

  function completeProgress() {
    clearTimers();
    setWidth(100);
    timers.current.push(
      setTimeout(() => {
        setVisible(false);
        setWidth(0);
      }, 200)
    );
  }

  // Complete when pathname changes (navigation landed)
  useEffect(() => {
    if (pathname !== completedPathname.current) {
      completedPathname.current = pathname;
      completeProgress();
    }
  }, [pathname]);

  // Start on any internal link click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const anchor = (e.target as HTMLElement).closest("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("http") || href.startsWith("mailto")) return;
      // Skip same-page navigations
      try {
        const url = new URL(href, window.location.origin);
        if (url.pathname === window.location.pathname) return;
      } catch {
        return;
      }
      startProgress();
    }

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!visible) return null;

  return (
    <div
      className="fixed left-0 top-0 z-[200] h-[3px] bg-primary"
      style={{
        width: `${width}%`,
        transition: width === 100
          ? "width 100ms ease-out"
          : "width 300ms ease-in-out",
      }}
    />
  );
}
